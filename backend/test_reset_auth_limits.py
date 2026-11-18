"""The development reset works before migrations and never migrates user data."""
import contextlib
import io
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from backend.reset_auth_limits import main
from backend.test_migrations import seed_original
from backend.verify_migration import legacy_rows


class ResetAuthLimitsTests(unittest.TestCase):
    def test_original_partial_and_current_schema_can_be_reset_twice(self):
        for tables in ((), ('auth_limits',), ('auth_failures',), ('auth_limits','auth_failures')):
            with self.subTest(tables=tables), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'copy.db'
                seed_original(path)
                with contextlib.closing(sqlite3.connect(path)) as c:
                    for table in tables:
                        c.execute(f'CREATE TABLE {table}(key TEXT PRIMARY KEY, value INTEGER)')
                        c.execute(f'INSERT INTO {table} VALUES (?,?)',('public-test-bucket',10))
                    c.commit()
                    before = legacy_rows(c)
                    schema = c.execute('SELECT type,name,sql FROM sqlite_schema ORDER BY name').fetchall()
                output = io.StringIO()
                with patch.dict(os.environ, {'PYTHON_DOTENV_DISABLED':'1','COOKIE_SECURE':'false','VASTRE_DB':str(path)},clear=True), contextlib.redirect_stdout(output):
                    main()
                    main()
                with contextlib.closing(sqlite3.connect(path)) as c:
                    self.assertEqual(legacy_rows(c),before)
                    self.assertEqual(c.execute('SELECT type,name,sql FROM sqlite_schema ORDER BY name').fetchall(),schema)
                    for table in tables:
                        self.assertEqual(c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0],0)
                self.assertIn('reset' if tables else 'Start or restart the backend',output.getvalue())

    def test_missing_database_is_never_created(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'missing.db'
            with patch.dict(os.environ, {'PYTHON_DOTENV_DISABLED':'1','VASTRE_DB':str(path)},clear=True):
                with self.assertRaises(sqlite3.OperationalError):
                    main()
            self.assertFalse(path.exists())

    def test_production_guard_runs_before_opening_database(self):
        with patch.dict(os.environ, {'PYTHON_DOTENV_DISABLED':'1','COOKIE_SECURE':'true'},clear=True):
            with patch('backend.reset_auth_limits.sqlite3.connect') as connect:
                with self.assertRaisesRegex(SystemExit,'Development reset is disabled'):
                    main()
                connect.assert_not_called()
