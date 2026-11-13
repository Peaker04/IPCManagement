"""Read-only MySQL model/migration shape comparison; DB setup stays in CI."""
import difflib
import os
import subprocess
import sys
from pathlib import Path


def compare(model, migrated):
    if not model.strip() or not migrated.strip():
        raise ValueError('Schema shape is empty; model and migration must both contain evidence')
    return ''.join(difflib.unified_diff(
        sorted(line + '\n' for line in model.splitlines() if line.strip()),
        sorted(line + '\n' for line in migrated.splitlines() if line.strip()),
        fromfile='model', tofile='migrations'))


def shape(database):
    # Only these CI-owned schemas are queried. No caller-provided SQL identifier.
    if database not in ('ipc_lane8', 'ipcmanagement_model_ci'):
        raise ValueError('Unexpected schema')
    # Preserve the established scope: omit DEFAULT and index names; baseline SQL
    # intentionally differs there. activeWarehouseKey is a migration-only virtual
    # generated column deliberately unmapped by EF. Keep FKs/type/nullability/extra.
    sql = f"""
SELECT CONCAT('TBL|',table_name) FROM information_schema.tables
 WHERE table_schema='{database}' AND table_name<>'__EFMigrationsHistory'
UNION ALL
SELECT CONCAT('COL|',table_name,'|',column_name,'|',column_type,'|',is_nullable,'|',TRIM(REPLACE(extra,'DEFAULT_GENERATED','')))
 FROM information_schema.columns
 WHERE table_schema='{database}' AND table_name<>'__EFMigrationsHistory'
 AND NOT (table_name='stocktakes' AND column_name='activeWarehouseKey')
UNION ALL
SELECT CONCAT('FK|',table_name,'|',column_name,'|',referenced_table_name,'|',referenced_column_name)
 FROM information_schema.key_column_usage
 WHERE table_schema='{database}' AND referenced_table_name IS NOT NULL;
"""
    return subprocess.run(['mysql', '-h', '127.0.0.1', '-uroot', '-N', '-B', '-e', sql],
                          check=True, capture_output=True, text=True).stdout


def main():
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        raise ValueError('This database probe is restricted to GitHub CI; local tests use compare()')
    output = Path('.artifacts')
    output.mkdir(exist_ok=True)
    migrated, model = shape('ipc_lane8'), shape('ipcmanagement_model_ci')
    (output / 'shape-migrations.txt').write_text(migrated, encoding='utf-8')
    (output / 'shape-model.txt').write_text(model, encoding='utf-8')
    try:
        diff = compare(model, migrated)
    except ValueError as error:
        (output / 'shape-diff.txt').write_text(str(error), encoding='utf-8')
        raise
    (output / 'shape-diff.txt').write_text(diff, encoding='utf-8')
    if diff:
        print(diff)
        return 1
    print('Migration schema matches EF model (nonempty shapes).')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
