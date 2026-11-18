"""Exercise the real app in child processes against temporary original-schema copies."""
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import textwrap
import unittest
from contextlib import closing
from pathlib import Path

from backend.test_migrations import seed_original

ROOT = Path(__file__).resolve().parent.parent


class MigratedAuthTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='vastre-migrated-auth-')
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        source = self.directory / 'original-schema.db'
        self.copy = self.directory / 'app-copy.db'
        seed_original(source)
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
            with closing(sqlite3.connect(self.copy)) as copy:
                original.backup(copy)

    def run_scenario(self, body):
        environment = {
            **os.environ, 'VASTRE_DB': str(self.copy),
            'MIGRATION_TEST_ROOT': str(self.directory),
            'PYTHON_DOTENV_DISABLED': '1', 'ADMIN_EMAIL': '', 'ADMIN_PASSWORD': '',
            'COOKIE_SECURE': 'false', 'SESSION_HOURS': '24',
            'SMTP_HOST':'', 'REQUIRE_VERIFIED_EMAIL':'false',
            'ALLOWED_ORIGINS': 'http://localhost:5173,http://127.0.0.1:5173',
        }
        prefix = '''
import asyncio, hashlib, json, os, sqlite3, time
from pathlib import Path
from contextlib import closing
from fastapi import Request, Response, HTTPException
import httpx
from backend.verify_migration import legacy_rows
database = Path(os.environ['VASTRE_DB']).resolve()
assert database.is_relative_to(Path(os.environ['MIGRATION_TEST_ROOT']).resolve())
with closing(sqlite3.connect(database)) as connection:
    before = legacy_rows(connection)
from backend import app as store
# Startup intentionally removes expired sessions only; valid legacy rows survive.
before['sessions'] = [row for row in before['sessions'] if row[3] > int(time.time())]
with store.db() as connection:
    assert legacy_rows(connection) == before
'''
        result = subprocess.run(
            [sys.executable, '-c', textwrap.dedent(prefix) + '\n' + textwrap.dedent(body)],
            cwd=ROOT, env=environment, capture_output=True, text=True, timeout=45,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)['passed'])

    def test_existing_passwords_roles_cookies_and_order_ownership_survive(self):
        self.run_scenario('''
def legacy_request(token):
    return Request({'type':'http', 'headers':[(b'cookie', ('vastre_session=' + token).encode())]})
customer = legacy_request('public-legacy-user-session')
admin = legacy_request('public-legacy-admin-session')
assert store.current_user(customer)['id'] == 7
assert store.current_user(admin)['role'] == 'admin'
assert [order['id'] for order in store.orders(customer,store.current_user(customer))] == ['order_legacy_paid']
assert len(store.overview(admin,store.admin_access(admin,store.current_user(admin)))['orders']) == 2
try:
    store.current_user(legacy_request('public-expired-session'))
except HTTPException as error:
    assert error.status_code == 401
else:
    raise AssertionError('Expired session became valid')
async def check_logins():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=store.app), base_url='http://testserver', headers={'Origin':'http://testserver','X-Requested-With':'vastre'}) as client:
        for role in ('user', 'admin'):
            response = await client.post('/api/auth/login', json={'email':role + '@example.test', 'password':'public-test-password'})
            assert response.status_code == 200
            assert response.json()['role'] == role
            assert set(response.json()) == {'id','name','email','role'}
            assert 'HttpOnly' in response.headers['set-cookie']
            assert (await client.get('/api/auth/me')).json()['role'] == role
asyncio.run(check_logins())
with store.db() as connection:
    assert connection.execute("SELECT role FROM users WHERE id=9").fetchone()[0] == 'admin'
    # Logins may add sessions; every pre-existing hash/owner/expiry is retained.
    current = legacy_rows(connection)
    assert all(row in current['sessions'] for row in before['sessions'])
    assert current['users'] == before['users']
    assert current['orders'] == before['orders']
assert any(route.path == '/api/auth/google' for route in store.app.routes)
print(json.dumps({'passed':True}))
''')

    def test_null_credentials_unknown_email_and_wrong_password_have_identical_errors(self):
        self.run_scenario('''
with store.db() as connection:
    for email, salt, password in (
        ('google-only@example.test', None, None),
        ('null-salt@example.test', None, 'unused-password-hash'),
        ('null-password@example.test', 'unused-salt', None),
    ):
        connection.execute("INSERT INTO users(email,salt,password,role,auth_provider) VALUES (?,?,?,'user','google')", (email,salt,password))
    count = connection.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]
async def check_failures():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=store.app), base_url='http://testserver', headers={'Origin':'http://testserver','X-Requested-With':'vastre'}) as client:
        for email in ('user@example.test', 'missing@example.test', 'google-only@example.test', 'null-salt@example.test', 'null-password@example.test'):
            response = await client.post('/api/auth/login', json={'email':email,'password':'public-wrong-password'})
            assert response.status_code == 401
            assert response.json() == {'detail':'Incorrect email or password.'}
            assert 'set-cookie' not in response.headers
asyncio.run(check_failures())
with store.db() as connection:
    assert connection.execute('SELECT COUNT(*) FROM sessions').fetchone()[0] == count
print(json.dumps({'passed':True}))
''')

    def test_new_sessions_and_registration_fill_bounded_metadata_without_changing_api_shapes(self):
        self.run_scenario('''
async def check_metadata():
    transport = httpx.ASGITransport(app=store.app, client=('203.0.113.15', 1234))
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver', headers={'Origin':'http://testserver','X-Requested-With':'vastre'}) as client:
        response = await client.post('/api/auth/register', json={'name':'Test New User','email':'new@example.test','password':'public-test-password'}, headers={'User-Agent':'x' * 350, 'X-Forwarded-For':'198.51.100.99'})
        assert response.status_code == 200
        assert set(response.json()) == {'id','name','email','role'}
        uid = response.json()['id']
        raw_cookie = client.cookies.get('vastre_session')
        with store.db() as connection:
            user = connection.execute('SELECT * FROM users WHERE id=?', (uid,)).fetchone()
            session = connection.execute('SELECT * FROM sessions WHERE token=?', (hashlib.sha256(raw_cookie.encode()).hexdigest(),)).fetchone()
            assert user['auth_provider'] == 'password'
            assert user['email_verified'] == 0 and user['disabled'] == 0
            assert 0 <= int(time.time()) - user['created_at'] <= 5
            assert user['last_login_at'] == session['created_at'] == session['last_seen_at']
            assert session['user_agent'] == 'x' * 200
            assert session['ip'] == '203.0.113.15'
            assert session['id'] and session['id'] not in (session['token'], raw_cookie)
        assert (await client.get('/api/orders')).json() == []
asyncio.run(check_metadata())
# Bound the stored peer string too, without trusting a forwarded IP header.
request = Request({'type':'http','headers':[(b'user-agent', b'y' * 250)],'client':('z' * 100,1234)})
store.session(Response(), 7, request)
with store.db() as connection:
    row = connection.execute('SELECT user_agent,ip FROM sessions ORDER BY rowid DESC LIMIT 1').fetchone()
    assert len(row['user_agent']) == 200 and len(row['ip']) == 45
print(json.dumps({'passed':True}))
''')


if __name__ == '__main__':
    unittest.main()
