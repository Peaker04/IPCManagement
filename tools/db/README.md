# Database utilities

Operational safety/runbook owner: [database recovery](../../docs/operations/database-recovery.md). No command is authorized by this index. Confirm exact target, credentials, backup and source guards before execution.

| Tool | Contract |
|---|---|
| `Backup-Database.ps1` | Dump/manifest/zip; optional different-volume mirror with hash verification. ZIP is not encrypted or offsite certification. |
| `Restore-Database.ps1` | Verify archive, restore target fences and manifest comparison. Never treat force/target override as permission. |
| `Compare-MigrationLineage.ps1` | Read-only source/history comparison; `-FailOnDrift` fails unresolved/stale lineage. |
| `migration-lineage.json` | Immutable migration identity/disposition data, not a project plan. |
| `Audit-NonCriticalDataQuality.sql` | Read-only audit; duplicate review ordering is not winner selection/merge authority. |
| `phase-04.2/` | Guarded exact-target/hash SQL and manifest schema retained as recovery/business safety contracts. Dated database identities are immutable technical identifiers, not campaign state. |

`stockmovements` cannot be reconstructed from display projections or master data. Preserve its history and balance chain. Secrets, dumps and recovery keys stay outside Git.
