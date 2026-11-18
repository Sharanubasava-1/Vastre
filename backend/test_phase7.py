"""Explicit Phase 7 contract cases, real TestClient, mocked Google, temporary DBs."""
from pathlib import Path
import sqlite3

import pytest
from backend import test_google_auth as scenarios


def scenario(body):
    scenarios.GoogleEndpointTests().run_scenario('''
from fastapi.testclient import TestClient
with TestClient(store.app, headers={'Origin':'http://testserver','X-Requested-With':'vastre'}) as browser:
''' + '\n'.join('    ' + line for line in body.splitlines()))


@pytest.mark.google_auth
def test_google_created_account_is_denied_admin_overview_even_with_client_admin_claims():
    scenario('''
claims = valid_claims() | {'role':'admin','admin':True}
with patch('backend.google_auth.id_token.verify_firebase_token',return_value=claims):
    created = browser.post('/api/auth/google',json={'id_token':TOKEN,'role':'admin','admin':True})
assert created.status_code == 200 and created.json()['role'] == 'user'
assert browser.get('/api/admin/overview').status_code == 403
assert browser.get('/api/admin/users').status_code == 403
assert browser.get('/api/orders').status_code == 200
with store.db() as c:
    assert c.execute('SELECT role,auth_provider FROM users').fetchone()[:] == ('user','google')
''')


@pytest.mark.sessions
def test_disabled_password_user_cannot_relogin_or_replay_a_previously_valid_cookie():
    scenario('''
uid = seed()
assert browser.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'}).status_code == 200
old_cookie = browser.cookies.get('vastre_session')
with store.db() as c:
    c.execute('UPDATE users SET disabled=1 WHERE id=?',(uid,))
browser.cookies.clear()
browser.cookies.set('vastre_session',old_cookie)
assert browser.get('/api/auth/me').status_code == 401
assert browser.get('/api/orders').status_code == 401
rejected = browser.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})
assert rejected.status_code == 401 and rejected.json() == {'detail':'Incorrect email or password.'}
assert 'set-cookie' not in rejected.headers
''')


@pytest.mark.sessions
@pytest.mark.parametrize('action', ['logout-all', 'change-password'])
def test_logout_all_and_password_change_reject_other_devices_cookie_replay(action):
    scenario('action = ' + repr(action) + '''
seed()
assert browser.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'}).status_code == 200
first_cookie = browser.cookies.get('vastre_session')
assert browser.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'}).status_code == 200
second_cookie = browser.cookies.get('vastre_session')
assert first_cookie != second_cookie
body = {} if action == 'logout-all' else {'current_password':'public-password','new_password':'Changed-password-23'}
assert browser.post('/api/auth/' + action,json=body).status_code == 200
for cookie in (first_cookie,second_cookie):
    browser.cookies.clear()
    browser.cookies.set('vastre_session',cookie)
    assert browser.get('/api/auth/me').status_code == 401
    assert browser.get('/api/orders').status_code == 401
''')


@pytest.mark.csrf
@pytest.mark.parametrize('attack', ['missing-header', 'foreign-origin'])
@pytest.mark.parametrize('method,path', [('POST','/api/auth/google'), ('PATCH','/api/auth/profile'),
                                        ('DELETE','/api/auth/sessions/not-owned'), ('POST','/api/payments/order')])
def test_csrf_blocks_auth_profile_session_and_payment_mutations_before_handlers(method, path, attack):
    scenario('method,path,attack = ' + repr((method, path, attack)) + '''
headers = {'X-Requested-With':''} if attack == 'missing-header' else {'Origin':'https://foreign.test'}
with patch('backend.google_auth.id_token.verify_firebase_token') as verifier, patch.object(store,'razorpay') as payment:
    response = browser.request(method,path,json={'id_token':TOKEN,'name':'Changed','items':[]},headers=headers)
    assert response.status_code == 403
    verifier.assert_not_called()
    payment.assert_not_called()
with store.db() as c:
    assert c.execute('SELECT count(*) FROM users').fetchone()[0] == 0
    assert c.execute('SELECT count(*) FROM orders').fetchone()[0] == 0
''')


@pytest.mark.rate_limits
def test_lockout_response_is_identical_for_known_and_unknown_email():
    scenario('''
from dataclasses import replace
store.settings = replace(store.settings,login_rate_per_min=100,login_lockout_failures=2,login_lockout_min=1)
seed()
responses = []
now = int(time.time())
with patch('backend.security.time.time',return_value=now):
    for email in ('customer@example.test','absent@example.test'):
        attempts = [browser.post('/api/auth/login',json={'email':email,'password':'incorrect-password'}) for _ in range(3)]
        responses.append([(r.status_code,r.json(),r.headers.get('retry-after')) for r in attempts])
assert responses[0] == responses[1]
assert [entry[0] for entry in responses[0]] == [401,401,429]
assert responses[0][-1][2] == '60'
''')


@pytest.mark.other
def test_sqlite_guard_rejects_live_store_without_opening_it():
    live = Path(__file__).resolve().parent / 'store.db'
    with pytest.raises(RuntimeError, match='only open temporary SQLite'):
        sqlite3.connect(live)
