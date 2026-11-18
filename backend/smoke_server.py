"""Local smoke fixture. Never imported by the production app.

Real HTTP routes, cookie sessions and SQLite run unchanged. Only the external
Razorpay transport is replaced, using public dummy test signing material.
"""
import os
import secrets
import tempfile
from unittest.mock import patch


def main():
    if os.getenv('VASTRE_SMOKE_FIXTURE') != '1':
        raise SystemExit('This fixture requires VASTRE_SMOKE_FIXTURE=1.')
    # Never import local credentials from backend/.env into the test fixture.
    os.environ['PYTHON_DOTENV_DISABLED'] = '1'
    with tempfile.TemporaryDirectory(prefix='vastre-purchase-smoke-') as temporary:
        os.environ['VASTRE_DB'] = os.path.join(temporary, 'smoke.db')
        os.environ['COOKIE_SECURE'] = 'false'
        os.environ['SESSION_HOURS'] = '24'
        os.environ['SMTP_HOST'] = ''
        os.environ['REQUIRE_VERIFIED_EMAIL'] = 'false'
        os.environ['ALLOWED_ORIGINS'] = 'http://localhost:5173,http://127.0.0.1:5173'
        os.environ['RAZORPAY_KEY_ID'] = 'rzp_test_local_smoke_fixture'
        os.environ['RAZORPAY_KEY_SECRET'] = 'public-local-smoke-fixture'
        os.environ.pop('ADMIN_EMAIL', None)
        os.environ.pop('ADMIN_PASSWORD', None)
        from backend import app as store
        import uvicorn
        if os.getenv('VASTRE_ADMIN_SMOKE_FIXTURE') == '1':
            # Public credentials in an explicitly selected, disposable fixture only.
            with store.db() as c:
                for name,email,role in (
                    ('Smoke Admin','admin-smoke@example.test','admin'),
                    ('Second Smoke Admin','second-admin-smoke@example.test','admin'),
                    ('Smoke Customer','user-smoke@example.test','user'),
                ):
                    salt = secrets.token_hex(16)
                    c.execute('INSERT INTO users(name,email,salt,password,role) VALUES (?,?,?,?,?)',
                              (name,email,salt,store.password_hash('Public-admin-smoke-23',salt),role))
                uid = c.execute("SELECT id FROM users WHERE email='user-smoke@example.test'").fetchone()[0]
                c.execute('INSERT INTO orders VALUES (?,?,?,?,?,?)',
                          ('order_admin_smoke_owned',uid,99000,'{}','paid','public-fixture-payment'))
        created = {}

        def fake_provider(path, payload=None):
            if path == 'orders':
                order_id = 'order_smoke_' + secrets.token_hex(8)
                created[order_id] = dict(id=order_id, amount=payload['amount'], currency=payload['currency'])
                return created[order_id]
            if path.startswith('payments/pay_order_smoke_'):
                order_id = path.removeprefix('payments/pay_')
                order = created[order_id]
                return dict(order_id=order_id, amount=order['amount'], currency=order['currency'], status='captured')
            raise RuntimeError('Unexpected smoke-provider operation')

        with patch.object(store, 'razorpay', fake_provider):
            uvicorn.run(store.app, host='127.0.0.1', port=5182, log_level='warning')


if __name__ == '__main__':
    main()
