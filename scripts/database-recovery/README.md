# Database recovery tooling

Run from the repository root. The scripts never print database, provider or encryption credentials.
They intentionally fail closed until an approved provider adapter and real credentials are supplied.

```powershell
powershell.exe -File scripts/database-recovery/Invoke-DatabaseRecovery.ps1 -Mode Preflight `
  -ProviderAdapterPath <approved-adapter.ps1> `
  -EncryptionKeyReference <opaque-secret-store-reference>
```

The adapter is provider-specific and external to this repository. It must implement
`Upload-ProviderObjectVersion`, `Read-ProviderObjectMetadata` and
`Download-ProviderObjectVersion` using the selected provider's official API or CLI. Local directories,
local archive arguments and manually entered receipt strings are never accepted as off-site proof.

Backup encrypts the dump and manifest (including headers) before upload, then requires live object-version
lock/retention metadata:

```powershell
powershell.exe -File scripts/database-recovery/Invoke-DatabaseRecovery.ps1 -Mode Backup `
  -Database ipcmanagement -ProviderAdapterPath <approved-adapter.ps1> `
  -ProviderObjectKey <object-key> -EncryptionKeyReference <opaque-reference> `
  -DcrClosureArtifactPath <redacted-current-closure.json>
```

Restore drill accepts only the provider receipt/object identity and a newly absent `ipc_restore_*` target.
It downloads the exact immutable version into run-owned temporary storage, verifies archive/inner-manifest identity,
restores, and compares migration/schema/FK/trigger/row checksum plus DCR closure fields before optional teardown.
GTID/binlog fields are retained as source-manifest metadata but are **not yet snapshot-bound recovery-point provenance**
and are not compared with the new restore target.

Current E21 scope is a data-integrity comparator only. Business-state oracle, exact dump snapshot coordinates/time,
meaningful binlog provenance validation, elapsed operator recovery duration, measured RPO/RTO and off-host/provider
certification remain `NEEDS_EVIDENCE` under E22. The current success receipt must not be presented as those guarantees.

```powershell
powershell.exe -File scripts/database-recovery/Invoke-DatabaseRecovery.ps1 -Mode RestoreDrill `
  -ProviderAdapterPath <approved-adapter.ps1> -ProviderReceiptPath <redacted-receipt.json> `
  -RestoreDatabase ipc_restore_<unique-run-id> `
  -EncryptionKeyReference <opaque-reference> `
  -DcrClosureArtifactPath <redacted-current-closure.json> -Teardown
```

`ipcmanagement`, `ipc_lane1`, `ipc_lane9`, templates and every existing database are forbidden restore
targets. The seven dated `backup_*` tables remain blocked until the real provider-only restore and all
business/rehearsal gates pass.
