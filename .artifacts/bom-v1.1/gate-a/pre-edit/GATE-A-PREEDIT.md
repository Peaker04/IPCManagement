# Gate A pre-edit evidence

Status: **BLOCKED**

Gate A cannot become `PASS` until every row below has current evidence from the same pre-edit baseline and policy version `BOM-LIFECYCLE-v1.1.0`.

| Requirement | Current result | Evidence |
|---|---|---|
| Dirty-worktree ownership manifest | PASS | `dirty-worktree.txt`, `owned-paths.txt`, `scripts/Test-BomWorktreeOwnership.ps1` |
| Applied migration SHA-256 manifest | PASS | `applied-migration-sha256.csv` |
| GitNexus impact review | PASS with documented UNKNOWN private/partial-symbol limits | `impact-report.md`; UNKNOWN blocks production edits |
| BOM characterization tests | PASS (17 tests) | `BomContractCharacterizationTests.cs` and task 03-01-01 verification |
| Exact lifecycle policy | PASS | `03-LIFECYCLE-POLICY.md`, `PolicyVersion: BOM-LIFECYCLE-v1.1.0` |
| Two unchanged legacy baseline runs | BLOCKED | `BomLegacyReadOnly` profile is not configured in the current process |
| Identified backup and isolated restore | BLOCKED | `BomLegacyReadOnly` and `BomV11RestoreClone` profiles are not configured |
| Restored-clone immutable checksum equality | BLOCKED | Requires successful isolated restore rehearsal |

## Current environment finding

- MySQL client binaries were found under the local MySQL installation and can be resolved by the scripts even though they are not currently in `PATH`.
- No `IPC_BOM_CONNECTION_*` or `ConnectionStrings__Bom*` profile was present during this check.
- No database command was executed and no application data was changed.

## Pass rule

Change this status to `PASS` only after:

1. baseline run 1 and run 2 have identical `checksums.csv` files;
2. recovery metadata records backup ID, SHA-256, source schema/fingerprint, and a distinct confirmed clone;
3. source and restored clone have identical `immutable-checksums.csv` files;
4. characterization, lifecycle-policy, ownership, migration-manifest, and GitNexus checks still pass; and
5. all evidence references the exact policy version above.

Plan 03-02 is blocked while this document is not `PASS`.
