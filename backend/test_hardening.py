"""Real ASGI hardening checks; temporary DB, mocked Google, no production data."""
import unittest
import backend.test_google_auth as scenarios


class HardeningTests(unittest.TestCase):
    run_scenario = scenarios.GoogleEndpointTests.run_scenario

    def test_csrf_requires_header_and_trusted_origin_including_login(self):
        self.run_scenario('''
body = {'items':[{'product_id':'essential-tee','size':'M','quantity':1}]}
client.headers.pop('X-Requested-With')
assert (await client.post('/api/checkout/quote',json=body)).status_code == 403
client.headers['X-Requested-With'] = 'vastre'
for origin in ('https://foreign.test','null','','http://testserver/invalid-origin-path'):
    rejected = await client.post('/api/checkout/quote',json=body,headers={'Origin':origin,'Referer':'http://testserver/cart'})
    assert rejected.status_code == 403
client.headers.pop('Origin')
assert (await client.post('/api/checkout/quote',json=body)).status_code == 403
assert (await client.post('/api/checkout/quote',json=body,headers={'Referer':'http://testserver/cart'})).status_code == 200
client.headers['Origin'] = 'http://testserver'
assert (await client.post('/api/checkout/quote',json=body)).status_code == 200
assert (await client.post('/api/checkout/quote',json=body,headers={'Origin':'http://localhost:5173'})).status_code == 200
assert (await client.post('/api/auth/login',json={'email':'nobody@example.test','password':'public-password'},headers={'Origin':'https://foreign.test'})).status_code == 403
''')

    def test_rate_limits_have_retry_after_and_are_scoped_correctly(self):
        self.run_scenario('''
from dataclasses import replace
store.settings = replace(store.settings,login_rate_per_min=2,register_rate_per_hour=1,google_rate_per_min=1)
body = {'email':'unknown@example.test','password':'public-password'}
for _ in range(2):
    assert (await client.post('/api/auth/login',json=body)).status_code == 401
limited = await client.post('/api/auth/login',json=body)
assert limited.status_code == 429 and 0 < int(limited.headers['retry-after']) <= 60
cors_limited = await client.post('/api/auth/login',json=body,headers={'Origin':'http://localhost:5173'})
assert cors_limited.status_code == 429 and cors_limited.headers['access-control-allow-origin'] == 'http://localhost:5173'
assert (await client.post('/api/auth/login',json=body | {'email':'other@example.test'})).status_code == 401
registration = {'email':'new@example.test','password':'Good-password-23'}
with patch.object(store,'send_email'):
    assert (await client.post('/api/auth/register',json=registration)).status_code == 200
    limited = await client.post('/api/auth/register',json=registration | {'email':'another@example.test'})
assert limited.status_code == 429 and 0 < int(limited.headers['retry-after']) <= 3600
with patch('backend.google_auth.id_token.verify_firebase_token',return_value=valid_claims()):
    assert (await client.post('/api/auth/google',json={'id_token':TOKEN})).status_code == 200
    assert (await client.post('/api/auth/google',json={'id_token':TOKEN})).status_code == 429
''')

    def test_progressive_lockout_matches_unknown_and_existing_email_and_recovers(self):
        self.run_scenario('''
from dataclasses import replace
store.settings = replace(store.settings,login_rate_per_min=100,login_lockout_failures=2,login_lockout_min=1,login_lockout_max_min=2)
seed()
baseline = int(time.time())
for email in ('customer@example.test','absent@example.test'):
    body = {'email':email,'password':'wrong-password'}
    with patch('backend.security.time.time',return_value=baseline):
        responses = [await client.post('/api/auth/login',json=body) for _ in range(3)]
    assert [r.status_code for r in responses] == [401,401,429]
    assert responses[0].json() == {'detail':'Incorrect email or password.'}
    assert int(responses[2].headers['retry-after']) == 60
    with patch('backend.security.time.time',return_value=baseline+61):
        responses = [await client.post('/api/auth/login',json=body) for _ in range(3)]
    assert [r.status_code for r in responses] == [401,401,429]
    assert int(responses[2].headers['retry-after']) == 120
with patch('backend.security.time.time',return_value=baseline+182):
    good = await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})
assert good.status_code == 200
with store.db() as c:
    assert c.execute('SELECT COUNT(*) FROM auth_failures WHERE key=?',(store.digest('customer@example.test'),)).fetchone()[0] == 0
''')

    def test_sessions_are_private_owned_revocable_and_cleanup_preserves_valid(self):
        self.run_scenario('''
uid = seed()
await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})
first_cookie = client.cookies.get('vastre_session')
await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})
listed = (await client.get('/api/auth/sessions')).json()
assert len(listed) == 2 and sum(row['current'] for row in listed) == 1
assert all(set(row) == {'id','created_at','last_seen_at','user_agent','ip','current'} for row in listed)
with store.db() as c:
    c.execute('INSERT INTO sessions(token,user_id,expires,id) VALUES (?,?,?,?)',('expired-hash',uid,int(time.time())-1,'expired-id'))
with store.db() as c:
    store.cleanup_sessions(c)
    assert c.execute('SELECT COUNT(*) FROM sessions WHERE user_id=?',(uid,)).fetchone()[0] == 2
    assert c.execute('SELECT COUNT(*) FROM sessions WHERE token=?',(store.digest(first_cookie),)).fetchone()[0] == 1
    c.execute('INSERT INTO sessions(token,user_id,expires,id) VALUES (?,?,?,?)',('foreign-hash',999,int(time.time())+300,'foreign-id'))
assert (await client.delete('/api/auth/sessions/foreign-id')).status_code == 404
old = next(row for row in listed if not row['current'])
assert (await client.delete('/api/auth/sessions/' + old['id'])).status_code == 200
assert len((await client.get('/api/auth/sessions')).json()) == 1
assert (await client.post('/api/auth/logout-all',json={})).status_code == 200
assert (await client.get('/api/auth/me')).status_code == 401
with store.db() as c:
    assert c.execute('SELECT COUNT(*) FROM sessions WHERE user_id=?',(uid,)).fetchone()[0] == 0
''')

    def test_password_rules_old_login_password_change_and_disabled_revocation(self):
        self.run_scenario('''
uid = seed()
for password in ('123456789','password123'):
    rejected = await client.post('/api/auth/register',json={'email':'new@example.test','password':password})
    assert rejected.status_code == 400
with store.db() as c:
    c.execute('UPDATE users SET password=? WHERE id=?',(store.password_hash('legacy88','public-salt'),uid))
assert (await client.post('/api/auth/login',json={'email':'customer@example.test','password':'legacy88'})).status_code == 200
assert (await client.post('/api/auth/login',json={'email':'customer@example.test','password':'legacy88'})).status_code == 200
assert (await client.post('/api/auth/change-password',json={'current_password':'incorrect','new_password':'New-password-23'})).status_code == 401
assert (await client.post('/api/auth/change-password',json={'current_password':'legacy88','new_password':'New-password-23'})).status_code == 200
assert (await client.get('/api/auth/me')).status_code == 401
with store.db() as c:
    assert c.execute('SELECT COUNT(*) FROM sessions WHERE user_id=?',(uid,)).fetchone()[0] == 0
assert (await client.post('/api/auth/login',json={'email':'customer@example.test','password':'New-password-23'})).status_code == 200
with store.db() as c:
    c.execute('UPDATE users SET disabled=1 WHERE id=?',(uid,))
    assert c.execute('SELECT COUNT(*) FROM sessions WHERE user_id=?',(uid,)).fetchone()[0] == 0
assert (await client.get('/api/auth/me')).status_code == 401
''')

    def test_google_set_password_requires_fresh_matching_subject(self):
        self.run_scenario('''
claims = valid_claims()
with patch('backend.google_auth.id_token.verify_firebase_token',return_value=claims):
    assert (await client.post('/api/auth/google',json={'id_token':TOKEN})).status_code == 200
body = {'id_token':TOKEN,'new_password':'New-password-23'}
for changes in ({}, {'auth_time':time.time()-301}, {'auth_time':time.time()+60},
                {'auth_time':True}, {'auth_time':time.time(),'sub':'other-user'}):
    with patch('backend.google_auth.id_token.verify_firebase_token',return_value=claims | changes):
        assert (await client.post('/api/auth/set-password',json=body)).status_code == 401
with patch('backend.google_auth.id_token.verify_firebase_token',return_value=claims | {'auth_time':time.time()}):
    assert (await client.post('/api/auth/set-password',json=body)).status_code == 200
assert (await client.get('/api/auth/me')).status_code == 401
assert (await client.post('/api/auth/login',json={'email':claims['email'],'password':'New-password-23'})).status_code == 200
assert (await client.get('/api/auth/me')).json()['auth_provider'] == 'both'
''')

    def test_concurrent_disable_or_password_change_cannot_issue_a_stale_session(self):
        self.run_scenario('''
real_hash = store.password_hash
for action in ('disabled','password'):
    email = action + '@example.test'
    uid = seed(email)
    def change_during_verification(password,salt):
        candidate = real_hash(password,salt)
        with store.db() as c:
            if action == 'disabled':
                c.execute('UPDATE users SET disabled=1 WHERE id=?',(uid,))
            else:
                c.execute('UPDATE users SET password=? WHERE id=?',('public-replaced-hash',uid))
        return candidate
    with patch.object(store,'password_hash',side_effect=change_during_verification):
        rejected = await client.post('/api/auth/login',json={'email':email,'password':'public-password'})
    assert rejected.status_code == 401 and rejected.json() == {'detail':'Incorrect email or password.'}
    with store.db() as c:
        assert c.execute('SELECT COUNT(*) FROM sessions WHERE user_id=?',(uid,)).fetchone()[0] == 0
        assert c.execute("SELECT COUNT(*) FROM audit_log WHERE event='login_success' AND user_id=?",(uid,)).fetchone()[0] == 0
''')

    def test_email_verification_single_use_expiry_resend_and_checkout_opt_in(self):
        self.run_scenario('''
from dataclasses import replace
with patch.object(store,'send_email') as mail:
    created = await client.post('/api/auth/register',json={'email':'new@example.test','password':'Good-password-23'})
    assert created.status_code == 200
    token = mail.call_args.args[2].split('#token=')[1]
uid = created.json()['id']
with store.db() as c:
    assert c.execute('SELECT token FROM email_verifications WHERE user_id=?',(uid,)).fetchone()[0] == store.digest(token)
checkout = {'items':[{'product_id':'essential-tee','size':'M','quantity':1}],'address':'Test delivery address 560001'}
with patch.object(store,'razorpay',return_value={'id':'test-order-free','amount':99000}), patch.dict('os.environ',{'RAZORPAY_KEY_ID':'public-key'}):
    assert (await client.post('/api/payments/order',json=checkout)).status_code == 200
store.settings = replace(store.settings,require_verified_email=True)
assert (await client.post('/api/payments/order',json=checkout)).status_code == 403
assert (await client.post('/api/auth/verify-email',json={'token':token})).status_code == 200
assert (await client.post('/api/auth/verify-email',json={'token':token})).status_code == 400
assert (await client.get('/api/auth/me')).json()['email_verified'] == 1
with store.db() as c:
    c.execute('UPDATE users SET email_verified=0 WHERE id=?',(uid,))
with patch.object(store,'send_email') as mail:
    assert (await client.post('/api/auth/send-verification',json={})).status_code == 200
    token = mail.call_args.args[2].split('#token=')[1]
with store.db() as c:
    c.execute('UPDATE email_verifications SET expires=0 WHERE user_id=?',(uid,))
assert (await client.post('/api/auth/verify-email',json={'token':token})).status_code == 400
''')

    def test_account_deletion_needs_fresh_credentials_retains_orders_and_protects_admins(self):
        self.run_scenario('''
uid = seed()
with store.db() as c:
    c.execute('INSERT INTO orders VALUES (?,?,?,?,?,?)',('order-retained',uid,12300,'{}','paid',None))
assert (await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})).status_code == 200
assert (await client.post('/api/auth/delete-account',json={'current_password':'wrong-password'})).status_code == 401
assert (await client.post('/api/auth/delete-account',json={'current_password':'public-password'})).status_code == 200
assert (await client.get('/api/auth/me')).status_code == 401
with store.db() as c:
    row = c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
    assert row['name'] == 'Deleted customer' and row['disabled'] == 1
    assert row['email'].endswith('@deleted.invalid') and row['salt'] is None and row['password'] is None
    assert c.execute('SELECT user_id FROM orders WHERE id=?',('order-retained',)).fetchone()[0] == uid
    assert c.execute('SELECT COUNT(*) FROM sessions WHERE user_id=?',(uid,)).fetchone()[0] == 0
claims = valid_claims()
with patch('backend.google_auth.id_token.verify_firebase_token',return_value=claims):
    google = await client.post('/api/auth/google',json={'id_token':TOKEN})
    assert google.status_code == 200
    assert (await client.post('/api/auth/delete-account',json={'id_token':TOKEN})).status_code == 401
with patch('backend.google_auth.id_token.verify_firebase_token',return_value=claims | {'auth_time':time.time()}):
    assert (await client.post('/api/auth/delete-account',json={'id_token':TOKEN})).status_code == 200
    again = await client.post('/api/auth/google',json={'id_token':TOKEN})
    assert again.status_code == 200 and again.json()['id'] != google.json()['id']
    assert (await client.get('/api/orders')).json() == []
admin = seed('admin@example.test',role='admin')
await client.post('/api/auth/login',json={'email':'admin@example.test','password':'public-password'})
assert (await client.post('/api/auth/delete-account',json={'current_password':'public-password'})).status_code == 403
with store.db() as c:
    assert c.execute('SELECT disabled FROM users WHERE id=?',(admin,)).fetchone()[0] == 0
''')

    def test_admin_idle_timeout_headers_validation_privacy_and_reset_cli(self):
        self.run_scenario('''
from dataclasses import replace
import os, subprocess, sys
uid = seed(role='admin')
await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})
with store.db() as c:
    c.execute('UPDATE sessions SET last_seen_at=? WHERE user_id=?',(int(time.time())-store.settings.admin_idle_min*60-1,uid))
assert (await client.get('/api/auth/me')).status_code == 401
for mode,header in (('report-only','content-security-policy-report-only'),('enforce','content-security-policy')):
    store.settings = replace(store.settings,csp_mode=mode)
    response = await client.get('/')
    assert header in response.headers and "object-src 'none'" in response.headers[header]
    assert response.headers['cross-origin-opener-policy'] == 'same-origin-allow-popups'
    assert response.headers['x-content-type-options'] == 'nosniff'
    assert 'strict-transport-security' not in response.headers
with patch.dict('os.environ',{'COOKIE_SECURE':'true'}):
    assert 'strict-transport-security' in (await client.get('/api/products')).headers
invalid = await client.post('/api/auth/login',json={'email':'x','password':'private-short-password-sentinel'})
assert invalid.status_code == 422 and 'private-short-password-sentinel' not in invalid.text
before = snapshot()
reset = subprocess.run([sys.executable,'-m','backend.reset_auth_limits'],capture_output=True,text=True,env=os.environ)
assert reset.returncode == 0 and snapshot() == before
with store.db() as c:
    assert c.execute('SELECT COUNT(*) FROM auth_limits').fetchone()[0] == 0
    assert c.execute('SELECT COUNT(*) FROM auth_failures').fetchone()[0] == 0
''')
