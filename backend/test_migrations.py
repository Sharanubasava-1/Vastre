"""Migration tests only create and mutate databases inside TemporaryDirectory."""
import hashlib
import sqlite3
import tempfile
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

from backend.migrations import migrate
from backend.verify_migration import full_snapshot, legacy_rows, verify_copy


def seed_original(path):
    """An independent copy of the original schema, with public test credentials."""
    with closing(sqlite3.connect(path)) as connection:
        connection.executescript('''
            CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, salt TEXT, password TEXT, role TEXT);
            CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER, expires INTEGER);
            CREATE TABLE orders (id TEXT PRIMARY KEY, user_id INTEGER, amount INTEGER, details TEXT, status TEXT, payment_id TEXT);
        ''')
        for uid, role in ((7, 'user'), (9, 'admin')):
            salt = f'public-legacy-salt-{uid}'
            password = hashlib.pbkdf2_hmac('sha256', b'public-test-password', salt.encode(), 600000).hex()
            connection.execute('INSERT INTO users VALUES (?,?,?,?,?,?)',
                (uid, f'Test {role}', f'{role}@example.test', salt, password, role))
        for name, uid, expiry in (
            ('public-legacy-user-session', 7, int(time.time()) + 3600),
            ('public-legacy-admin-session', 9, int(time.time()) + 3600),
            ('public-expired-session', 7, int(time.time()) - 3600),
        ):
            connection.execute('INSERT INTO sessions VALUES (?,?,?)',
                (hashlib.sha256(name.encode()).hexdigest(), uid, expiry))
        connection.executemany('INSERT INTO orders VALUES (?,?,?,?,?,?)', [
            ('order_legacy_paid', 7, 189000, '{"items":[{"product_id":"linen-sun-shirt","size":"M","quantity":1}]}', 'paid', 'public_test_payment'),
            ('order_legacy_pending', 9, 99000, '{"items":[],"coupon":"","address":"Test address"}', 'pending', None),
        ])
        connection.commit()


class MigrationTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='vastre-migration-test-')
        self.addCleanup(temporary.cleanup)
        self.path = Path(temporary.name) / 'original.db'
        seed_original(self.path)

    def connect(self):
        connection = sqlite3.connect(self.path)
        self.addCleanup(connection.close)
        return connection

    def test_twice_on_temporary_copy_preserves_every_original_row_and_source(self):
        digest = hashlib.sha256(self.path.read_bytes()).digest()
        result = verify_copy(self.path)
        for name in ('before', 'after_first', 'after_second'):
            self.assertEqual(result[name], {'users': 2, 'sessions': 3, 'orders': 2})
        self.assertEqual(result['admins_preserved'], 1)
        self.assertEqual(result['second_run_changes'], 0)
        self.assertTrue(result['original_columns_and_rowids_unchanged'])
        self.assertEqual(result['integrity_check'], 'ok')
        self.assertEqual(hashlib.sha256(self.path.read_bytes()).digest(), digest)

    def test_backfills_only_new_metadata_and_retains_keys_expiries_and_unknown_dates(self):
        connection = self.connect()
        before = legacy_rows(connection)
        root_pages = connection.execute("SELECT name,rootpage FROM sqlite_schema WHERE type='table' ORDER BY name").fetchall()
        migrate(connection)
        self.assertEqual(legacy_rows(connection), before)
        self.assertEqual(connection.execute("SELECT name,rootpage FROM sqlite_schema WHERE name IN ('users','sessions','orders') ORDER BY name").fetchall(), root_pages)
        self.assertEqual(connection.execute('SELECT auth_provider,email_verified,disabled,created_at,last_login_at FROM users').fetchall(), [('password', 0, 0, None, None)] * 2)
        sessions = connection.execute('SELECT id,created_at,last_seen_at,user_agent,ip FROM sessions').fetchall()
        self.assertEqual(len({row[0] for row in sessions}), 3)
        self.assertTrue(all(row[0] and row[1:] == (None, None, None, None) for row in sessions))
        first = full_snapshot(connection)
        migrate(connection)
        self.assertEqual(full_snapshot(connection), first)
        self.assertEqual(connection.execute('SELECT COUNT(*) FROM audit_log').fetchone()[0], 0)

    def test_unique_google_subject_allows_multiple_null_subjects_and_nullable_passwords(self):
        connection = self.connect()
        migrate(connection)
        for number in range(3):
            connection.execute("INSERT INTO users(email,salt,password,role,auth_provider,google_sub) VALUES (?,NULL,NULL,'user','google',?)",
                (f'google-{number}@example.test', 'public-google-subject' if number == 0 else None))
        connection.commit()
        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute("INSERT INTO users(email,google_sub) VALUES ('duplicate@example.test','public-google-subject')")
        connection.rollback()
        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute("INSERT INTO users(email,auth_provider) VALUES ('bad@example.test','invalid')")
        connection.rollback()
        self.assertEqual(connection.execute("SELECT COUNT(*) FROM users WHERE auth_provider='google' AND salt IS NULL AND password IS NULL").fetchone()[0], 3)

    def test_partial_additive_upgrade_is_resumed_without_overwriting_existing_metadata(self):
        connection = self.connect()
        connection.execute('ALTER TABLE users ADD COLUMN google_sub TEXT')
        connection.execute('ALTER TABLE sessions ADD COLUMN id TEXT')
        connection.execute("UPDATE users SET google_sub='public-existing-subject' WHERE id=7")
        connection.execute("UPDATE sessions SET id='public-existing-device-id' WHERE rowid=1")
        connection.commit()
        before = legacy_rows(connection)
        migrate(connection)
        self.assertEqual(legacy_rows(connection), before)
        self.assertEqual(connection.execute('SELECT google_sub FROM users WHERE id=7').fetchone()[0], 'public-existing-subject')
        self.assertEqual(connection.execute('SELECT id FROM sessions WHERE rowid=1').fetchone()[0], 'public-existing-device-id')
        first = full_snapshot(connection)
        migrate(connection)
        self.assertEqual(full_snapshot(connection), first)

    def test_failed_unique_constraint_rolls_back_the_whole_schema_upgrade(self):
        connection = self.connect()
        connection.execute('ALTER TABLE users ADD COLUMN google_sub TEXT')
        connection.execute("UPDATE users SET google_sub='duplicate-existing-subject'")
        connection.commit()
        before_schema = connection.execute('SELECT type,name,sql FROM sqlite_schema ORDER BY type,name').fetchall()
        before = legacy_rows(connection)
        with self.assertRaises(sqlite3.IntegrityError):
            migrate(connection)
        self.assertEqual(connection.execute('SELECT type,name,sql FROM sqlite_schema ORDER BY type,name').fetchall(), before_schema)
        self.assertEqual(legacy_rows(connection), before)
        self.assertFalse(connection.in_transaction)

    def test_competing_startup_workers_serialize_the_upgrade(self):
        def upgrade(_):
            with closing(sqlite3.connect(self.path, timeout=10)) as connection:
                migrate(connection)
        with ThreadPoolExecutor(max_workers=2) as workers:
            list(workers.map(upgrade, range(2)))
        connection = self.connect()
        self.assertEqual(connection.execute('SELECT COUNT(*),COUNT(DISTINCT id) FROM sessions').fetchone(), (3, 3))
        self.assertEqual(connection.execute('PRAGMA integrity_check').fetchone()[0], 'ok')

    def test_fresh_database_can_be_initialized_twice(self):
        with closing(sqlite3.connect(':memory:')) as connection:
            migrate(connection)
            before = full_snapshot(connection)
            migrate(connection)
            self.assertEqual(full_snapshot(connection), before)

    def test_verifier_requires_original_schema_and_never_alters_its_source(self):
        connection = self.connect()
        migrate(connection)
        before = full_snapshot(connection)
        with self.assertRaisesRegex(ValueError, 'original schema'):
            verify_copy(self.path)
        self.assertEqual(full_snapshot(connection), before)


if __name__ == '__main__':
    unittest.main()
