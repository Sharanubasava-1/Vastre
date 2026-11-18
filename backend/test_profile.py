"""Phase 6 profile editing: isolated temporary databases, no live customer data."""
import unittest
from backend import test_google_auth as scenarios


class ProfileTests(unittest.TestCase):
    run_scenario = scenarios.GoogleEndpointTests.run_scenario

    def test_profile_is_owned_name_only_and_audited(self):
        self.run_scenario('''
            uid = seed()
            assert (await client.patch('/api/auth/profile',json={'name':'New'})).status_code == 401
            assert (await client.post('/api/auth/login',json={'email':'customer@example.test','password':'public-password'})).status_code == 200
            before = snapshot()
            result = await client.patch('/api/auth/profile',json={'name':'  New name  ','role':'admin','email':'other@example.test'})
            assert result.status_code == 200 and result.json()['name'] == 'New name'
            me = (await client.get('/api/auth/me')).json()
            assert me['name'] == 'New name' and me['email'] == 'customer@example.test' and me['role'] == 'user'
            assert (await client.patch('/api/auth/profile',json={'name':'  '})).status_code == 400
            assert (await client.patch('/api/auth/profile',json={'name':'x'*81})).status_code == 422
            with store.db() as c:
                assert c.execute("SELECT count(*) FROM audit_log WHERE user_id=? AND event='profile_updated'",(uid,)).fetchone()[0] == 1
                assert c.execute('SELECT count(*) FROM sessions WHERE user_id=?',(uid,)).fetchone()[0] == 1
            assert snapshot()['orders'] == before['orders']
        ''')
