"""Configuration tests never read local credentials or open the production DB."""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.config import load_settings, parse_origins


class ConfigTests(unittest.TestCase):
    def test_dotenv_loads_explicit_file_without_overriding_process_environment(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {
            'FIREBASE_PROJECT_ID': 'process-project', 'SESSION_HOURS': '12',
        }, clear=True):
            env = Path(directory) / '.env'
            env.write_text(
                'FIREBASE_PROJECT_ID=file-project\nSESSION_HOURS=48\n'
                'ALLOWED_ORIGINS=https://shop.example.test\nVASTRE_DB=from-file.db\n',
                encoding='utf-8-sig',
            )
            settings = load_settings(env)
            self.assertEqual(settings.firebase_project_id, 'process-project')
            self.assertEqual(settings.session_seconds, 43200)
            self.assertEqual(settings.allowed_origins, ('https://shop.example.test',))
            self.assertEqual(os.environ['VASTRE_DB'], 'from-file.db')

    def test_defaults_work_without_any_environment_file_or_firebase(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {}, clear=True):
            settings = load_settings(Path(directory) / 'missing.env')
            self.assertEqual(settings.session_seconds, 86400)
            self.assertEqual(settings.firebase_project_id, '')
            self.assertEqual((settings.login_rate_per_min,settings.register_rate_per_hour,settings.google_rate_per_min),(5,5,20))
            self.assertEqual((settings.login_lockout_failures,settings.login_lockout_min,settings.admin_idle_min),(10,15,30))
            self.assertFalse(settings.require_verified_email)
            self.assertEqual(settings.allowed_origins, (
                'http://localhost:5173', 'http://127.0.0.1:5173',
            ))

    def test_isolated_tests_can_disable_dotenv_entirely(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(os.environ, {
            'PYTHON_DOTENV_DISABLED': '1',
        }, clear=True):
            env = Path(directory) / '.env'
            env.write_text('SESSION_HOURS=2\nADMIN_EMAIL=example@example.test\n')
            self.assertEqual(load_settings(env).session_hours, 24)
            self.assertNotIn('ADMIN_EMAIL', os.environ)

    def test_explicit_origins_are_normalized_deduplicated_or_disabled(self):
        self.assertEqual(parse_origins(
            ' https://SHOP.example.test/, https://shop.example.test, http://localhost:5173, ',
        ), ('https://shop.example.test', 'http://localhost:5173'))
        self.assertEqual(parse_origins(''), ())
        for bad in ['*', 'null', 'https://*.example.test', 'https://user:pass@example.test', 'https://@example.test',
                    'https://example.test/path', 'https://example.test?query=1',
                    'https://example.test#fragment', 'http://localhost:99999',
                    'https://exa mple.test', 'https://example.test\\other']:
            with self.subTest(origin=bad), self.assertRaisesRegex(ValueError, '^ALLOWED_ORIGINS'):
                parse_origins(bad)

    def test_invalid_lifetimes_fail_without_echoing_the_setting(self):
        for hours in ['0', '-1', 'bad-setting', '1.5', '']:
            with self.subTest(hours=hours), patch.dict(os.environ, {
                'PYTHON_DOTENV_DISABLED': '1', 'SESSION_HOURS': hours,
            }, clear=True), self.assertRaisesRegex(ValueError, '^SESSION_HOURS must be a positive integer\\.$'):
                load_settings()

    def test_hardening_settings_validate_and_can_be_overridden(self):
        with patch.dict(os.environ, {'PYTHON_DOTENV_DISABLED':'1','LOGIN_RATE_PER_MIN':'50',
                'LOGIN_LOCKOUT_MIN':'1','REQUIRE_VERIFIED_EMAIL':'true','CSP_MODE':'report-only',
                'PUBLIC_BASE_URL':'https://shop.example.test/'}, clear=True):
            settings = load_settings()
            self.assertEqual(settings.login_rate_per_min,50)
            self.assertEqual(settings.login_lockout_min,1)
            self.assertTrue(settings.require_verified_email)
            self.assertEqual(settings.public_base_url,'https://shop.example.test')
        for key,value in [('GOOGLE_RATE_PER_MIN','0'),('ADMIN_IDLE_MIN','private-invalid-setting'),
                          ('CSP_MODE','disabled'),('REQUIRE_VERIFIED_EMAIL','yes'),('PUBLIC_BASE_URL','https://shop.test/path')]:
            with self.subTest(setting=key), patch.dict(os.environ,{'PYTHON_DOTENV_DISABLED':'1',key:value},clear=True):
                with self.assertRaises(ValueError) as error:
                    load_settings()
                self.assertNotIn('private-invalid-setting',str(error.exception))


if __name__ == '__main__':
    unittest.main()
