"""Local CLI only: clear testing throttles without altering users or sessions."""
import os
import sqlite3
from pathlib import Path

from backend.config import load_settings


def main():
    load_settings()
    if os.getenv('COOKIE_SECURE') == 'true':
        raise SystemExit('Development reset is disabled with COOKIE_SECURE=true.')
    path = Path(os.getenv('VASTRE_DB', str(Path(__file__).resolve().parent / 'store.db')))
    # Existing DB only: never silently create a database at a mistaken path.
    connection = sqlite3.connect(path.resolve().as_uri() + '?mode=rw', uri=True)
    found = False
    try:
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_schema WHERE type='table'")}
            # Reset is not a migration: legacy/partially upgraded DBs may have
            # neither or only one table. Never create or alter application data.
            for table in ('auth_limits', 'auth_failures'):
                if table in tables:
                    connection.execute(f'DELETE FROM {table}')
                    found = True
    finally:
        connection.close()
    if found:
        print('Development rate limits and login lockouts reset. Users and sessions unchanged.')
    else:
        print('No authentication limits exist yet. Start or restart the backend to initialize them. Users and sessions unchanged.')


if __name__ == '__main__':
    main()
