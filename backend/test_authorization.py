"""RBAC and ownership tests use temporary databases and real ASGI dependencies."""
import unittest
import pytest
from fastapi import HTTPException
import backend.test_google_auth as scenarios
from backend.authorization import allowed, canonical_role, validate_user_change


def test_permission_map_preserves_legacy_alias_and_unknown_roles_fail_closed():
    assert canonical_role('user') == 'customer'
    for role in ('user','customer','support','admin'):
        for action in ('account:self','orders:own','checkout:own'):
            assert allowed(role,action)
    for role in ('user','customer','support','unknown'):
        assert not allowed(role,'admin:users:write')
    assert not allowed('unknown','orders:own')
    assert allowed('admin','admin:users:write')


@pytest.mark.parametrize('patch', [{'role':'customer','disabled':False},{'role':'admin','disabled':True}])
def test_last_admin_guard_is_independent_of_self_guard(patch):
    with pytest.raises(HTTPException) as error:
        validate_user_change(99,{'id':1,'role':'admin','disabled':0},active_admins=1,**patch)
    assert error.value.status_code == 409 and 'last active admin' in error.value.detail


class AuthorizationTests(unittest.TestCase):
    run_scenario = scenarios.GoogleEndpointTests.run_scenario

    def test_admin_routes_require_admin_and_denials_are_audited(self):
        self.run_scenario('''
for path in ('/api/admin/overview','/api/admin/users'):
    assert (await client.get(path)).status_code == 401
assert (await client.patch('/api/admin/users/1',json={'role':'admin'})).status_code == 401
assert (await client.patch('/api/admin/users/1',json={'role':'admin'},headers={'X-Requested-With':''})).status_code == 403
uid = seed()
await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})
for path in ('/api/admin/overview','/api/admin/users'):
    assert (await client.get(path)).status_code == 403
assert (await client.patch('/api/admin/users/' + str(uid),json={'role':'admin'})).status_code == 403
admin = seed('admin@example.test',role='admin')
await client.post('/api/auth/login',json={'email':'admin@example.test','password':'public-password'})
assert (await client.get('/api/admin/overview')).status_code == 200
assert (await client.get('/api/admin/users')).status_code == 200
with store.db() as c:
    assert c.execute("SELECT COUNT(*) FROM audit_log WHERE event='admin_access_denied'").fetchone()[0] == 7
    assert c.execute('SELECT role FROM users WHERE id=?',(admin,)).fetchone()[0] == 'admin'
''')

    def test_orders_are_owned_in_list_detail_and_payment_verification(self):
        self.run_scenario('''
uid = seed()
seed('other@example.test')
seed('admin@example.test',role='admin')
with store.db() as c:
    c.execute('INSERT INTO orders VALUES (?,?,?,?,?,?)',('owned-order',uid,99000,'{}','paid','public-payment'))
for email in ('other@example.test','admin@example.test','customer@example.test'):
    await client.post('/api/auth/login',json={'email':email,'password':'public-password'})
    response = await client.get('/api/orders/owned-order')
    own = email == 'customer@example.test'
    assert response.status_code == (200 if own else 404)
    assert len((await client.get('/api/orders')).json()) == int(own)
    if not own:
        assert response.json() == (await client.get('/api/orders/missing-order')).json() == {'detail':'Order not found.'}
        with patch.object(store,'razorpay') as provider:
            rejected = await client.post('/api/payments/verify',json={'razorpay_order_id':'owned-order','razorpay_payment_id':'public-payment','razorpay_signature':'public-signature'})
        assert rejected.status_code == 404
        provider.assert_not_called()
''')

    def test_customer_alias_support_and_unknown_roles(self):
        self.run_scenario('''
for role in ('user','customer','support','unknown'):
    email = role + '@example.test'
    seed(email,role=role)
    await client.post('/api/auth/login',json={'email':email,'password':'public-password'})
    assert (await client.get('/api/auth/me')).json()['role'] == role
    assert (await client.get('/api/orders')).status_code == (403 if role == 'unknown' else 200)
    assert (await client.get('/api/admin/users')).status_code == 403
''')

    def test_user_listing_is_paginated_filterable_literal_search_and_sanitized(self):
        self.run_scenario('''
seed('admin@example.test',role='admin')
legacy = seed('literal_100%@example.test')
seed('customer@example.test',role='customer',disabled=1)
await client.post('/api/auth/login',json={'email':'admin@example.test','password':'public-password'})
response = (await client.get('/api/admin/users',params={'page_size':1})).json()
assert response['total'] == 3 and response['pages'] == 3 and len(response['users']) == 1
assert response['active_admins'] == 1
assert set(response['users'][0]) == {'id','name','email','role','disabled','auth_provider','email_verified','created_at','last_login_at'}
assert (await client.get('/api/admin/users',params={'role':'customer'})).json()['total'] == 2
assert (await client.get('/api/admin/users',params={'status':'disabled'})).json()['total'] == 1
assert (await client.get('/api/admin/users',params={'provider':'google'})).json()['total'] == 0
found = (await client.get('/api/admin/users',params={'search':'_100%'})).json()
assert found['total'] == 1 and found['users'][0]['id'] == legacy
assert (await client.get('/api/admin/users',params={'page_size':101})).status_code == 422
assert (await client.get('/api/admin/users',params={'search':"' OR 1=1 --"})).json()['total'] == 0
''')

    def test_self_guard_invalid_fields_and_noop_do_not_change_users(self):
        self.run_scenario('''
admin = seed('admin@example.test',role='admin')
await client.post('/api/auth/login',json={'email':'admin@example.test','password':'public-password'})
for update in ({'role':'customer'},{'disabled':True},{'role':'support','disabled':True}):
    rejected = await client.patch('/api/admin/users/' + str(admin),json=update)
    assert rejected.status_code == 409 and 'your own' in rejected.json()['detail']
for update in ({'role':'superadmin'},{'disabled':'true'},{'role':'admin','password':'private-sentinel'}):
    rejected = await client.patch('/api/admin/users/' + str(admin),json=update)
    assert rejected.status_code == 422 and 'private-sentinel' not in rejected.text
for update in ({},{'role':None}):
    assert (await client.patch('/api/admin/users/' + str(admin),json=update)).status_code == 400
assert (await client.patch('/api/admin/users/' + str(admin),json={'role':'admin','disabled':False})).status_code == 200
assert (await client.get('/api/auth/me')).status_code == 200
with store.db() as c:
    assert c.execute('SELECT role,disabled FROM users WHERE id=?',(admin,)).fetchone()[:] == ('admin',0)
    assert c.execute("SELECT COUNT(*) FROM audit_log WHERE event IN ('role_change','account_disabled','account_enabled')").fetchone()[0] == 0
''')

    def test_every_actual_change_is_audited_and_revokes_target_sessions(self):
        self.run_scenario('''
admin = seed('admin@example.test',role='admin')
target = seed()
await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})
old_cookie = client.cookies.get('vastre_session')
await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})
await client.post('/api/auth/login',json={'email':'admin@example.test','password':'public-password'})
for update,event in (({'role':'support'},'role_change'),({'disabled':True},'account_disabled'),({'disabled':False},'account_enabled')):
    response = await client.patch('/api/admin/users/' + str(target),json=update)
    assert response.status_code == 200
    with store.db() as c:
        assert c.execute('SELECT COUNT(*) FROM sessions WHERE user_id=?',(target,)).fetchone()[0] == 0
        record = c.execute('SELECT * FROM audit_log WHERE event=? ORDER BY id DESC',(event,)).fetchone()
        assert record['user_id'] == target and json.loads(record['detail'])['actor_id'] == admin
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=store.app),base_url='http://testserver',cookies={'vastre_session':old_cookie}) as other:
        assert (await other.get('/api/auth/me')).status_code == 401
assert (await client.get('/api/auth/me')).json()['id'] == admin
''')

    def test_concurrent_admin_demotions_cannot_remove_the_last_admin(self):
        self.concurrent_admin_change({'role':'customer'})

    def test_concurrent_admin_disabling_cannot_remove_the_last_admin(self):
        self.concurrent_admin_change({'disabled':True})

    def concurrent_admin_change(self, update):
        self.run_scenario('update = ' + repr(update) + '\n' + '''
first = seed('first@example.test',role='admin')
second = seed('second@example.test',role='admin')
await client.post('/api/auth/login',json={'email':'first@example.test','password':'public-password'})
async with httpx.AsyncClient(transport=httpx.ASGITransport(app=store.app),base_url='http://testserver',headers=dict(client.headers)) as other:
    await other.post('/api/auth/login',json={'email':'second@example.test','password':'public-password'})
    results = await asyncio.gather(client.patch('/api/admin/users/' + str(second),json=update),other.patch('/api/admin/users/' + str(first),json=update))
assert sorted(r.status_code for r in results)[0] == 200
assert sum(r.status_code == 200 for r in results) == 1
assert all(r.status_code in (200,401,403,409) for r in results)
with store.db() as c:
    assert c.execute("SELECT COUNT(*) FROM users WHERE role='admin' AND disabled=0").fetchone()[0] == 1
    assert c.execute("SELECT COUNT(*) FROM audit_log WHERE event IN ('role_change','account_disabled')").fetchone()[0] == 1
''')
