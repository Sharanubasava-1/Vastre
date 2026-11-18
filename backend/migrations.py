"""Additive SQLite auth migration; importing this module never opens a database."""
import secrets


ORIGINAL_TABLES = {
    'users': '''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE,
        salt TEXT, password TEXT, role TEXT)''',
    'sessions': '''CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, user_id INTEGER, expires INTEGER)''',
    'orders': '''CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY, user_id INTEGER, amount INTEGER,
        details TEXT, status TEXT, payment_id TEXT)''',
}

USER_COLUMNS = {
    'google_sub': 'TEXT',
    'picture': 'TEXT',
    'auth_provider': "TEXT NOT NULL DEFAULT 'password' CHECK(auth_provider IN ('password','google','both'))",
    'email_verified': 'INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1))',
    'disabled': 'INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1))',
    'created_at': 'INTEGER',
    'last_login_at': 'INTEGER',
}

SESSION_COLUMNS = {
    'id': 'TEXT',
    'created_at': 'INTEGER',
    'last_seen_at': 'INTEGER',
    'user_agent': 'TEXT CHECK(user_agent IS NULL OR length(user_agent)<=200)',
    'ip': 'TEXT CHECK(ip IS NULL OR length(ip)<=45)',
}


def _add_missing_columns(connection, table, definitions):
    # Names/definitions are fixed application constants, never request input.
    present = {row[1] for row in connection.execute(f'PRAGMA table_info({table})')}
    for name, definition in definitions.items():
        if name not in present:
            connection.execute(f'ALTER TABLE {table} ADD COLUMN {name} {definition}')


def migrate(connection):
    """Upgrade once, atomically; serialize competing startup workers.

    Original tables/keys are retained. Unknown historical timestamps stay NULL.
    No expiry cleanup, role change, password rewrite or audit event occurs here.
    The caller supplies the connection; no production database path is assumed.
    """
    if connection.in_transaction:
        raise RuntimeError('Migration requires a connection without an active transaction.')
    connection.execute('BEGIN IMMEDIATE')
    try:
        for statement in ORIGINAL_TABLES.values():
            connection.execute(statement)
        _add_missing_columns(connection, 'users', USER_COLUMNS)
        _add_missing_columns(connection, 'sessions', SESSION_COLUMNS)
        # SQLite ADD COLUMN cannot add UNIQUE. A unique index permits many NULLs.
        connection.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users(google_sub)')
        connection.execute('CREATE UNIQUE INDEX IF NOT EXISTS sessions_id_unique ON sessions(id)')
        # Device identifiers are opaque and independent of the secret token hash.
        missing_ids = connection.execute('SELECT rowid FROM sessions WHERE id IS NULL').fetchall()
        for row in missing_ids:
            connection.execute('UPDATE sessions SET id=? WHERE rowid=?', (secrets.token_urlsafe(24), row[0]))
        connection.execute('''CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, user_id INTEGER,
            event TEXT NOT NULL, detail TEXT,
            ip TEXT CHECK(ip IS NULL OR length(ip)<=45))''')
        connection.execute('''CREATE TABLE IF NOT EXISTS auth_limits (
            key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires INTEGER NOT NULL)''')
        connection.execute('''CREATE TABLE IF NOT EXISTS auth_failures (
            key TEXT PRIMARY KEY, failures INTEGER NOT NULL, started INTEGER NOT NULL,
            locked_until INTEGER NOT NULL DEFAULT 0)''')
        connection.execute('''CREATE TABLE IF NOT EXISTS email_verifications (
            token TEXT PRIMARY KEY, user_id INTEGER NOT NULL UNIQUE, expires INTEGER NOT NULL)''')
        connection.execute('''CREATE TRIGGER IF NOT EXISTS revoke_disabled_sessions
            AFTER UPDATE OF disabled ON users WHEN NEW.disabled=1
            BEGIN DELETE FROM sessions WHERE user_id=NEW.id; END''')
        connection.execute('''CREATE TRIGGER IF NOT EXISTS revoke_password_sessions
            AFTER UPDATE OF salt,password ON users
            WHEN NEW.salt IS NOT OLD.salt OR NEW.password IS NOT OLD.password
            BEGIN DELETE FROM sessions WHERE user_id=NEW.id; END''')
        connection.commit()
    except BaseException:
        connection.rollback()
        raise
