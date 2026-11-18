"""No real Google tokens/network: mock the verifier, use temporary SQLite only."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import time
import unittest
from unittest.mock import patch

import pytest

from backend.google_auth import GoogleSignInFailed, FAILURE, verify_google_token

PROJECT = 'test-project'
TOKEN = 'public-dummy-id-token'
ROOT = Path(__file__).resolve().parent.parent


def valid_claims():
    return dict(sub='google-subject', email='Customer@Example.test', email_verified=True,
                name='Google Customer', picture='https://example.test/avatar.jpg',
                iss=f'https://securetoken.google.com/{PROJECT}', aud=PROJECT,
                exp=time.time() + 3600, firebase={'sign_in_provider': 'google.com'})


def test_verifier_uses_firebase_project_audience():
    with patch('backend.google_auth.id_token.verify_firebase_token', return_value=valid_claims()) as verifier:
        profile = verify_google_token(TOKEN, PROJECT)
    assert profile['email'] == 'customer@example.test'
    assert verifier.call_args.args[0] == TOKEN
    assert verifier.call_args.kwargs == {'audience': PROJECT}


@pytest.mark.parametrize('changes', [
    {'exp': 0}, {'exp': None}, {'exp': True}, {'exp': float('nan')},
    {'aud': 'another-project'}, {'iss': 'https://accounts.google.com'},
    {'aud': ['test-project']}, {'exp': 'tomorrow'},
    {'firebase': {'sign_in_provider': 'password'}}, {'firebase': None},
    {'email_verified': False}, {'email_verified': 'true'},
    {'sub': None}, {'sub': ''}, {'email': None},
])
def test_verifier_rejects_invalid_claims(changes):
    with patch('backend.google_auth.id_token.verify_firebase_token', return_value=valid_claims() | changes):
        with pytest.raises(GoogleSignInFailed, match=r'^Google sign-in failed\. Please try again\.$'):
            verify_google_token(TOKEN, PROJECT)


def test_verifier_hides_provider_exception_and_fails_closed_without_project(capsys, caplog):
    with patch('backend.google_auth.id_token.verify_firebase_token', side_effect=ValueError(TOKEN)):
        with pytest.raises(GoogleSignInFailed) as error:
            verify_google_token(TOKEN, PROJECT)
    assert str(error.value) == FAILURE
    with patch('backend.google_auth.id_token.verify_firebase_token') as verifier:
        with pytest.raises(GoogleSignInFailed):
            verify_google_token(TOKEN, '')
        verifier.assert_not_called()
    assert TOKEN not in capsys.readouterr().out + caplog.text


class GoogleEndpointTests(unittest.TestCase):
    def run_scenario(self, body):
        # An isolated process avoids app-import configuration leaking into legacy tests.
        with tempfile.TemporaryDirectory(prefix='vastre-google-auth-') as directory:
            environment = {
                **os.environ, 'VASTRE_DB': str(Path(directory) / 'test.db'),
                'VASTRE_TEST_ROOT': directory,
                'PYTHON_DOTENV_DISABLED': '1', 'ADMIN_EMAIL': '', 'ADMIN_PASSWORD': '',
                'COOKIE_SECURE': 'false', 'SESSION_HOURS': '24', 'FIREBASE_PROJECT_ID': PROJECT,
                'ALLOWED_ORIGINS': 'http://localhost:5173',
                'SMTP_HOST':'', 'REQUIRE_VERIFIED_EMAIL':'false', 'CSP_MODE':'enforce',
                'LOGIN_RATE_PER_MIN':'5','REGISTER_RATE_PER_HOUR':'5','GOOGLE_RATE_PER_MIN':'20',
                'LOGIN_LOCKOUT_FAILURES':'10','LOGIN_LOCKOUT_MIN':'15','LOGIN_LOCKOUT_MAX_MIN':'60',
                'LOGIN_FAILURE_WINDOW_MIN':'60','ADMIN_IDLE_MIN':'30',
                'EMAIL_VERIFICATION_HOURS':'24','EMAIL_VERIFICATION_RATE_PER_HOUR':'3',
                'PUBLIC_BASE_URL':'http://localhost:8000',
            }
            prefix = '''
import asyncio, hashlib, json, logging, time, os
from pathlib import Path
from unittest.mock import patch
import httpx
assert Path(os.environ['VASTRE_DB']).resolve().is_relative_to(Path(os.environ['VASTRE_TEST_ROOT']).resolve())
from backend import app as store
from backend.test_google_auth import valid_claims, TOKEN
failure = {'detail':'Google sign-in failed. Please try again.'}
def snapshot():
    with store.db() as c:
        return {table:[tuple(r) for r in c.execute('SELECT * FROM ' + table)]
                for table in ('users','sessions','orders','audit_log')}
def seed(email='customer@example.test', role='user', disabled=0, subject=None):
    with store.db() as c:
        return c.execute(''' + '"""' + '''INSERT INTO users
            (name,email,salt,password,role,disabled,google_sub) VALUES (?,?,?,?,?,?,?)''' + '"""' + ''',
            ('Original name',email,'public-salt',store.password_hash('public-password', 'public-salt'),role,disabled,subject)).lastrowid
async def scenario():
    # Even a mistakenly unmocked Google transport must fail locally, never call Google.
    with patch('requests.sessions.Session.request', side_effect=AssertionError('Network forbidden')):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=store.app), base_url='http://testserver', headers={'Origin':'http://testserver','X-Requested-With':'vastre'}) as client:
'''
            suffix = '''
asyncio.run(scenario())
print(json.dumps({'passed':True}))
'''
            script = textwrap.dedent(prefix) + textwrap.indent(textwrap.dedent(body), '            ') + suffix
            result = subprocess.run([sys.executable, '-c', script], cwd=ROOT, env=environment,
                                    capture_output=True, text=True, timeout=45)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(json.loads(result.stdout)['passed'])

    def test_create_repeat_cookie_profile_and_no_admin_from_any_client_claim(self):
        self.run_scenario('''
claims = valid_claims() | {'role':'admin', 'admin':True}
with patch('backend.google_auth.id_token.verify_firebase_token', return_value=claims):
    first = await client.post('/api/auth/google', json={'id_token':TOKEN, 'role':'admin'})
    assert first.status_code == 200
    profile = first.json()
    assert set(profile) == {'id','name','email','role','picture'}
    assert profile['role'] == 'user'
    cookie = client.cookies.get('vastre_session')
    assert 'HttpOnly' in first.headers['set-cookie'] and 'SameSite=lax' in first.headers['set-cookie']
    assert 'Max-Age=86400' in first.headers['set-cookie']
    me = (await client.get('/api/auth/me')).json()
    assert me['picture'] == claims['picture'] and me['auth_provider'] == 'google' and me['email_verified'] == 1
    assert (await client.get('/api/admin/overview')).status_code == 403
    second = await client.post('/api/auth/google', json={'id_token':TOKEN})
    assert second.json()['id'] == profile['id']
    assert client.cookies.get('vastre_session') != cookie
with store.db() as c:
    row = c.execute('SELECT * FROM users').fetchone()
    assert row['salt'] is None and row['password'] is None
    assert row['last_login_at'] and row['created_at'] and row['google_sub'] == claims['sub']
    assert c.execute('SELECT COUNT(*) FROM users').fetchone()[0] == 1
    assert c.execute('SELECT COUNT(*) FROM sessions').fetchone()[0] == 2
    assert c.execute('SELECT COUNT(*) FROM sessions WHERE token=?',(hashlib.sha256(cookie.encode()).hexdigest(),)).fetchone()[0] == 1
    assert [r[0] for r in c.execute('SELECT event FROM audit_log')] == ['google_login','admin_access_denied','google_login']
bad = await client.post('/api/auth/login', json={'email':profile['email'],'password':'public-password'})
assert bad.status_code == 401 and bad.json() == {'detail':'Incorrect email or password.'}
''')

    def test_link_only_verified_email_preserve_password_role_and_orders(self):
        self.run_scenario('''
for role in ('user','admin'):
    email = role + '@example.test'
    uid = seed(email,role)
    with store.db() as c:
        c.execute('INSERT INTO orders VALUES (?,?,?,?,?,?)', ('order_' + role,uid,12300,'{}','paid',None))
    before = snapshot()
    claims = valid_claims() | {'email':email.upper(), 'sub':'subject-' + role, 'email_verified':False}
    with patch('backend.google_auth.id_token.verify_firebase_token', return_value=claims):
        rejected = await client.post('/api/auth/google', json={'id_token':TOKEN})
    assert rejected.status_code == 401 and rejected.json() == failure and snapshot() == before
    claims['email_verified'] = True
    with patch('backend.google_auth.id_token.verify_firebase_token', return_value=claims):
        linked = await client.post('/api/auth/google', json={'id_token':TOKEN, 'role':'admin'})
    assert linked.status_code == 200 and linked.json()['id'] == uid and linked.json()['role'] == role
    assert linked.json()['name'] == 'Original name'
    with store.db() as c:
        row = c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
        assert row['auth_provider'] == 'both' and row['email_verified'] == 1
        assert row['salt'] == 'public-salt' and row['password'] == store.password_hash('public-password','public-salt')
        assert c.execute("SELECT COUNT(*) FROM audit_log WHERE user_id=? AND event='google_link'",(uid,)).fetchone()[0] == 1
    password = await client.post('/api/auth/login', json={'email':email,'password':'public-password'})
    assert password.status_code == 200 and password.json()['role'] == role
    assert (await client.get('/api/orders')).json()[0]['id'] == 'order_' + role
assert snapshot()['orders'] == before['orders']
''')

    def test_disabled_subject_collision_and_stable_subject_identity(self):
        self.run_scenario('''
uid = seed(disabled=1)
before = snapshot()
with patch('backend.google_auth.id_token.verify_firebase_token', return_value=valid_claims()):
    rejected = await client.post('/api/auth/google', json={'id_token':TOKEN})
assert rejected.status_code == 403 and rejected.json() == {'detail':'This account has been disabled.'}
assert snapshot() == before
with store.db() as c:
    c.execute('UPDATE users SET disabled=0,google_sub=? WHERE id=?',('another-subject',uid))
before = snapshot()
with patch('backend.google_auth.id_token.verify_firebase_token', return_value=valid_claims()):
    rejected = await client.post('/api/auth/google', json={'id_token':TOKEN})
assert rejected.status_code == 401 and rejected.json() == failure and snapshot() == before
claims = valid_claims() | {'sub':'another-subject','email':'changed@example.test'}
with patch('backend.google_auth.id_token.verify_firebase_token', return_value=claims):
    signed_in = await client.post('/api/auth/google', json={'id_token':TOKEN})
assert signed_in.json()['id'] == uid and signed_in.json()['email'] == 'customer@example.test'
with store.db() as c:
    c.execute('UPDATE users SET disabled=1 WHERE id=?',(uid,))
before = snapshot()
with patch('backend.google_auth.id_token.verify_firebase_token', return_value=claims):
    rejected = await client.post('/api/auth/google', json={'id_token':TOKEN})
assert rejected.status_code == 403 and snapshot() == before
''')

    def test_every_verification_failure_is_generic_and_has_no_side_effect(self):
        self.run_scenario('''
before = snapshot()
for changes in ({'exp':0}, {'aud':'wrong-project'}, {'iss':'wrong-issuer'},
                {'firebase':{'sign_in_provider':'password'}}, {'email_verified':False}, {'sub':None}):
    with patch('backend.google_auth.id_token.verify_firebase_token', return_value=valid_claims() | changes):
        rejected = await client.post('/api/auth/google', json={'id_token':TOKEN})
    assert rejected.status_code == 401 and rejected.json() == failure
    assert 'set-cookie' not in rejected.headers and snapshot() == before
with patch('backend.google_auth.id_token.verify_firebase_token', side_effect=ValueError('private-provider-detail-' + TOKEN)):
    rejected = await client.post('/api/auth/google', json={'id_token':TOKEN})
assert rejected.status_code == 401 and rejected.json() == failure and snapshot() == before
for body in ({}, {'id_token':None}, {'id_token':12}, {'id_token':''}, ['bad'], {'id_token':'x'*16385}):
    with patch('backend.google_auth.id_token.verify_firebase_token') as verifier:
        rejected = await client.post('/api/auth/google', json=body)
    verifier.assert_not_called()
    assert rejected.status_code == 401 and rejected.json() == failure and snapshot() == before
malformed = await client.post('/api/auth/google', content='{"id_token":"' + TOKEN)
assert malformed.status_code == 401 and malformed.json() == failure
''')

    def test_no_credentials_or_provider_errors_in_logs_or_audit(self):
        self.run_scenario('''
import contextlib, io
captured = io.StringIO()
handler = logging.StreamHandler(captured)
logging.getLogger().addHandler(handler)
logging.getLogger().setLevel(logging.DEBUG)
with contextlib.redirect_stdout(captured), contextlib.redirect_stderr(captured):
    with patch('backend.google_auth.id_token.verify_firebase_token', return_value=valid_claims()):
        response = await client.post('/api/auth/google', json={'id_token':TOKEN,'password':'private-password-sentinel'})
    cookie = client.cookies.get('vastre_session')
    with patch('backend.google_auth.id_token.verify_firebase_token', side_effect=ValueError('private-provider-detail-' + TOKEN)):
        rejected = await client.post('/api/auth/google', json={'id_token':TOKEN})
logging.getLogger().removeHandler(handler)
with store.db() as c:
    audit = json.dumps([tuple(r) for r in c.execute('SELECT * FROM audit_log')])
for secret in (TOKEN,cookie,'private-password-sentinel','private-provider-detail'):
    assert secret not in captured.getvalue() + audit + rejected.text
''')

    def test_session_failure_rolls_back_account_link_and_audit(self):
        self.run_scenario('''
uid = seed()
before = snapshot()
with patch('backend.google_auth.id_token.verify_firebase_token', return_value=valid_claims()):
    with patch.object(store,'session',side_effect=RuntimeError('public-test-failure')):
        try:
            await client.post('/api/auth/google', json={'id_token':TOKEN})
        except RuntimeError:
            pass
        else:
            raise AssertionError('Injected session failure did not propagate')
assert snapshot() == before
''')

    def test_missing_project_fails_closed_and_secure_cookie_keeps_existing_policy(self):
        self.run_scenario('''
from dataclasses import replace
before = snapshot()
with patch.object(store,'settings',replace(store.settings,firebase_project_id='')):
    with patch('backend.google_auth.id_token.verify_firebase_token') as verifier:
        rejected = await client.post('/api/auth/google', json={'id_token':TOKEN})
    verifier.assert_not_called()
assert rejected.status_code == 401 and rejected.json() == failure and snapshot() == before
with patch.dict('os.environ', {'COOKIE_SECURE':'true'}):
    with patch('backend.google_auth.id_token.verify_firebase_token', return_value=valid_claims()):
        response = await client.post('/api/auth/google', json={'id_token':TOKEN})
assert response.status_code == 200
assert 'Secure' in response.headers['set-cookie'] and 'HttpOnly' in response.headers['set-cookie']
assert 'SameSite=lax' in response.headers['set-cookie']
''')
