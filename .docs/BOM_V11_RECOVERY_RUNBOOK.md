# BOM v1.1 Gate A recovery runbook

This runbook proves recovery before any BOM v1.1 production/schema edit. It uses a read-only legacy source profile and a separately provisioned disposable MySQL clone. Gate A remains blocked until the commands below produce matching deterministic and immutable checksums.

## Safety contract

- Source profile: `BomLegacyReadOnly`; its database account must have read-only privileges.
- Target profile: `BomV11RestoreClone`; its schema name must contain `clone`, `restore`, `rehearsal`, `sandbox`, or `test`.
- Source and target profile names and resolved `server:port/database` identities must differ.
- Never point the target at `ipcmanagement`, `prod`, or `production`.
- Keep profiles in process environment variables or local `.secrets/bom-connections.json`. That file must remain untracked.
- Passwords are supplied to MySQL child processes only through their temporary environment. Artifacts omit credentials and absolute executable paths.
- The baseline only performs `SELECT` queries. It supports the legacy schema at migration `20260716113000_CorrectPresetBomTechnicalUnits` and only feature-detects later provenance fields.
- The restore changes only the explicitly confirmed disposable target. The source is never changed.

## Local profile setup

Preferred environment variables:

```powershell
$env:IPC_BOM_CONNECTION_BOMLEGACYREADONLY='server=HOST;port=3306;database=SOURCE_SCHEMA;user=READ_ONLY_USER;password=SECRET;'
$env:IPC_BOM_CONNECTION_BOMV11RESTORECLONE='server=HOST;port=3306;database=ipcmanagement_restore_clone;user=CLONE_USER;password=SECRET;'
```

Alternative untracked file `.secrets/bom-connections.json`:

```json
{
  "BomLegacyReadOnly": "server=HOST;port=3306;database=SOURCE_SCHEMA;user=READ_ONLY_USER;password=SECRET;",
  "BomV11RestoreClone": "server=HOST;port=3306;database=ipcmanagement_restore_clone;user=CLONE_USER;password=SECRET;"
}
```

Do not copy the application `DefaultConnection` into artifacts and do not silently treat it as the read-only profile.

## Repeatable legacy baseline

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Get-BomSafetyBaseline.ps1 `
  -ConnectionName BomLegacyReadOnly `
  -OutputDirectory .artifacts/bom-v1.1/gate-a/pre-edit/baseline-1

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Get-BomSafetyBaseline.ps1 `
  -ConnectionName BomLegacyReadOnly `
  -OutputDirectory .artifacts/bom-v1.1/gate-a/pre-edit/baseline-2

Compare-Object `
  (Get-Content .artifacts/bom-v1.1/gate-a/pre-edit/baseline-1/checksums.csv) `
  (Get-Content .artifacts/bom-v1.1/gate-a/pre-edit/baseline-2/checksums.csv)
```

`Compare-Object` must return no rows. `observation.json` is intentionally excluded because it stores collection time and machine separately.

## Isolated backup/restore rehearsal

Provision the target schema outside this script, confirm that it is disposable, then run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Invoke-BomBackupRestoreRehearsal.ps1 `
  -SourceConnectionName BomLegacyReadOnly `
  -TargetConnectionName BomV11RestoreClone `
  -OutputDirectory .artifacts/bom-v1.1/gate-a/pre-edit/recovery `
  -ConfirmIsolatedTarget
```

Required PASS evidence:

- `recovery-metadata.json` contains an identified backup ID/hash, source schema fingerprint, distinct target schema, and `ImmutableChecksumEquality: PASS`.
- `source-baseline/immutable-checksums.csv` equals `restored-baseline/immutable-checksums.csv`.
- The backup SHA-256 equals the current hash of `bom-v1.1-backup.sql`.
- `applied-migration-sha256.csv` remains unchanged from the pre-edit manifest.
- Characterization tests, lifecycle policy completeness, and ownership guard pass.

## Failure and escalation

Any missing profile/tool/table, baseline drift, backup failure, protected/equal target, restore error, or checksum difference keeps Gate A `BLOCKED`. Preserve evidence, correct the environment or route data anomalies to Admin review, and rerun from a clean output directory. Never bypass a failed check and never run broad cleanup SQL from `Clean_Legacy_Imported_Bom.sql` as part of recovery.
