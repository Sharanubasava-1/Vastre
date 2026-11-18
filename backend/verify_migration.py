"""Verify migrations on a temporary backup only; never migrate the source file."""
import argparse
import json
import sqlite3
import tempfile
from contextlib import closing
from pathlib import Path

from backend.migrations import migrate

LEGACY_COLUMNS = {
    'users': ('id', 'name', 'email', 'salt', 'password', 'role'),
    'sessions': ('token', 'user_id', 'expires'),
    'orders': ('id', 'user_id', 'amount', 'details', 'status', 'payment_id'),
}


def legacy_rows(connection):
    return {table: [tuple(row) for row in connection.execute(
        f'SELECT rowid,{",".join(columns)} FROM {table} ORDER BY rowid',
    )] for table, columns in LEGACY_COLUMNS.items()}


def full_snapshot(connection):
    tables = (*LEGACY_COLUMNS, 'audit_log')
    return (
        [tuple(row) for row in connection.execute('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name')],
        {table: [tuple(row) for row in connection.execute(f'SELECT rowid,* FROM {table} ORDER BY rowid')] for table in tables},
        tuple(connection.execute('PRAGMA schema_version').fetchone()),
    )


def verify_copy(source):
    source = Path(source).resolve(strict=True)
    with tempfile.TemporaryDirectory(prefix='vastre-migration-copy-') as directory:
        destination = Path(directory) / 'migration-copy.db'
        if destination.resolve() == source or not destination.resolve().is_relative_to(Path(directory).resolve()):
            raise RuntimeError('Migration verification must target its temporary copy.')
        with closing(sqlite3.connect(destination)) as copy:
            # SQLite's backup API takes a consistent snapshot, including WAL data.
            with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as original:
                original.backup(copy)
            for table, columns in LEGACY_COLUMNS.items():
                actual = tuple(row[1] for row in copy.execute(f'PRAGMA table_info({table})'))
                if actual != columns:
                    raise ValueError('Verification source must use the original schema; use its pre-migration backup.')
            before = legacy_rows(copy)
            counts = {table: len(rows) for table, rows in before.items()}
            admins = copy.execute("SELECT COUNT(*) FROM users WHERE role='admin'").fetchone()[0]
            migrate(copy)
            after_first = legacy_rows(copy)
            if after_first != before:
                raise AssertionError('First migration changed original data.')
            first = full_snapshot(copy)
            changes = copy.total_changes
            migrate(copy)
            after_second = legacy_rows(copy)
            if after_second != before or full_snapshot(copy) != first or copy.total_changes != changes:
                raise AssertionError('Second migration was not a no-op.')
            if copy.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise AssertionError('Copied database integrity check failed.')
            return {
                'temporary_copy_only': True, 'migration_runs': 2,
                'before': counts,
                'after_first': {table: len(rows) for table, rows in after_first.items()},
                'after_second': {table: len(rows) for table, rows in after_second.items()},
                'admins_preserved': admins, 'original_columns_and_rowids_unchanged': True,
                'second_run_changes': 0, 'integrity_check': 'ok',
            }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True, help='Original-schema SQLite file, opened read-only')
    args = parser.parse_args()
    print(json.dumps(verify_copy(args.source), indent=2))


if __name__ == '__main__':
    main()