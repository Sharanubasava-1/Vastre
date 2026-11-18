"""Fail closed if a backend test ever tries to open a non-temporary SQLite DB."""
import os
from pathlib import Path
import sqlite3
import tempfile
from urllib.parse import unquote, urlsplit

import pytest

AREAS = ('google_auth', 'rate_limits', 'csrf', 'sessions', 'rbac', 'migration', 'other')
_selected = {}
_passed = set()


def pytest_configure(config):
    temporary = tempfile.TemporaryDirectory(prefix='vastre-pytest-safety-')
    config._vastre_temporary = temporary
    values = {'VASTRE_DB': str(Path(temporary.name) / 'fallback.db'),
              'PYTHON_DOTENV_DISABLED': '1', 'ADMIN_EMAIL': '', 'ADMIN_PASSWORD': '', 'SMTP_HOST': ''}
    config._vastre_environment = {key: os.environ.get(key) for key in values}
    os.environ.update(values)
    original = sqlite3.connect
    config._vastre_connect = original
    temp_root = Path(tempfile.gettempdir()).resolve()
    live = (Path(__file__).resolve().parent / 'store.db').resolve()

    def connect(database, *args, **kwargs):
        name = os.fsdecode(database)
        if name not in ('', ':memory:') and not name.startswith('file::memory:'):
            if name.startswith('file:'):
                uri = urlsplit(name)
                name = unquote(uri.path)
                if uri.netloc and uri.netloc != 'localhost':
                    name = '//' + uri.netloc + name
                # file:///C:/... needs its leading URI slash removed on Windows.
                if os.name == 'nt' and len(name) > 3 and name[0] == '/' and name[2] == ':':
                    name = name[1:]
            target = Path(name).resolve()
            if target == live or not target.is_relative_to(temp_root):
                raise RuntimeError('Backend tests may only open temporary SQLite databases.')
        return original(database, *args, **kwargs)

    sqlite3.connect = connect


def pytest_unconfigure(config):
    if hasattr(config, '_vastre_connect'):
        sqlite3.connect = config._vastre_connect
        for key, value in config._vastre_environment.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        config._vastre_temporary.cleanup()


def pytest_collection_modifyitems(items):
    for item in items:
        area = next((name for name in AREAS if item.get_closest_marker(name)), None)
        if area is None:
            filename, name = item.path.name, item.originalname or item.name
            area = {'test_google_auth.py': 'google_auth', 'test_authorization.py': 'rbac',
                    'test_migrations.py': 'migration', 'test_migration_auth.py': 'migration',
                    'test_reset_auth_limits.py': 'rate_limits'}.get(filename, 'other')
            if filename == 'test_hardening.py':
                if 'csrf_' in name:
                    area = 'csrf'
                elif 'rate_limits_' in name or 'progressive_lockout_' in name:
                    area = 'rate_limits'
                elif name not in ('test_email_verification_single_use_expiry_resend_and_checkout_opt_in',
                                  'test_account_deletion_needs_fresh_credentials_retains_orders_and_protects_admins'):
                    area = 'sessions'
            item.add_marker(getattr(pytest.mark, area))
        _selected[item.nodeid] = area


def pytest_runtest_logreport(report):
    # pytest-subtests adds reports for nested checks; count each collected case once.
    if report.when == 'call' and report.passed and type(report).__name__ != 'SubTestReport':
        _passed.add(report.nodeid)


def pytest_terminal_summary(terminalreporter):
    items = terminalreporter._session.items
    terminalreporter.section('Backend areas (collected cases; subtests counted separately)')
    for area in AREAS:
        ids = {item.nodeid for item in items if _selected.get(item.nodeid) == area}
        if ids:
            terminalreporter.write_line(f'{area}: {len(ids & _passed)} passed / {len(ids)} selected')
