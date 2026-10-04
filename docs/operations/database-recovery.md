# Database migration and recovery safety

This is an operational runbook, not authorization to execute SQL or a certification of recovery. Source/tool guards and the operator's exact target approval must agree. No process cleanup changes schema/data/migration IDs or deletes retained business records.

## Before mutation

1. Confirm target identity, current migration lineage/schema and source checkout; never assume a local DB is disposable.
2. Preserve an independently recoverable backup and pre-state table/row/ID/FK/ledger integrity checks. Rehearse on an explicitly approved disposable target before production promotion.
3. Review exact SQL/bundle, preflight/postflight, rollback and data-loss handling. `USE` in SQL overrides the CLI target. Inspect destructive statements and declare charset/collation for temporary tables.
4. Stop when source identity is ambiguous; no name/header/first-candidate backfill. Nullable lineage is not permission to invent relationships. Source FK existence does not prove ingredient/unit/customer compatibility.
5. Apply only the reviewed operation; never clone/restore a whole rehearsal database over production as promotion.

## Migrations and lineage

Operational commands and lineage: [tools/db](../../tools/db/README.md), `tools/db/migration-lineage.json`, and `backend/tools/IPCManagement.DatabaseTool`. Existing migration IDs are immutable.

- A handwritten EF migration needs a Designer or inline `[Migration]`; otherwise EF discovery omits it.
- Do not `migrations remove` against a final migration missing metadata: snapshot can collapse and subsequent migrations recreate schema.
- Before declaring a migration present in a baseline, compare every owned schema change. No-op retired seeds do not authorize data mutation.
- Clone preservation needs `SHOW CREATE TABLE`, foreign keys, triggers and migration-history comparison; `CREATE TABLE LIKE` plus row counts is insufficient.
- Startup must not auto-repair operational warehouse/data or migrate from multiple API instances. Pending migrations/DB failures are readiness failures; resolve explicitly rather than testing against incompatible schema.
- Lifecycle kernel tables are append-only transitions, outbox and idempotent receipts. Once durable evidence exists, destructive down migrations are not a rollback strategy; use forward recovery/compensating commands.
- Reviewed legacy lineage uses proposal → different-actor review → approved apply, checks exact source/unit at create/apply and changes only authorized nullable provenance, not stock quantities.
- Open supplemental uniqueness uses a nullable generated key with a named unique fence: one active request per source issue line, terminal history retained. Duplicate groups require disposition, not winner selection or destructive upsert. Concurrency probes have their own exact-target guards and may not be run during cleanup.

## Utility-specific mechanics

`tools/db/Backup-Database.ps1` uses `--single-transaction --routines --triggers --events --set-gtid-purged=OFF`. It requires a final dump-completed marker and derives table/ledger/migration counts from the same SQL snapshot (not a racy live read). The extended-INSERT parser respects escaped strings and tuple boundaries. Output ZIP/manifest is **unencrypted**; protect it like production data. `MirrorDir` verifies SHA-256 and must differ by volume, which still does not prove a different physical disk/offsite. Failed/partial dumps are not valid backups. Use a least-privilege backup identity, not root by default; Scheduler credentials/session availability and restore rehearsals require real operator verification.

`Restore-Database.ps1` checks SQL SHA-256 and manifest table/ledger/migration counts when present; an old manifest-less archive needs independent full comparison. Restore into a new approved temporary database first. Existing schema objects created after the dump may survive a table-based restore; never infer exact fidelity from command success or manually drop production to bypass it. A production replacement needs explicit loss acceptance, full schema/row/FK/trigger/ledger oracles and exact authorization.

PITR: preserve source binlogs before intervention; identify the dump-content coordinate and real transaction event positions, not CREATE DATABASE time. On a GTID-enabled standalone rehearsal, review whether `mysqlbinlog --skip-gtids` is needed to avoid already-executed transactions being silently skipped. `--rewrite-db` applies before `--database`; use the rewritten target name. Start position binds first file, stop position last file. Inspect replay SQL for unrevised production/protected targets and GTID directives before applying to a disposable target. Compare unaffected tables against an independently captured incident pre-state before any promotion. Do not enable binlog/restart server or run replay during cleanup. `--set-gtid-purged=OFF` is a standalone-restore choice, not a replica bootstrap recipe.

## Backup / restore

[Encrypted recovery tools](../../scripts/database-recovery/README.md) preserve provider identity, target fences, oracle and immutability checks. Current DB business-safety verification SQL/tools remain technical regression owners even when historical phase names survive in immutable test/API identifiers. They are not a roadmap or task-state system.

PITR baseline is the time represented by dump contents, not file creation or CREATE DATABASE time; idle binlog proves nothing. Verify unaffected-table/row oracles. Same-host ciphertext/mirrors do not prove independent off-host immutable recovery. Retained backup tables and evidence-only subjects remain unreconciled until explicit business/recovery disposition; a process reset does not certify or surrender them.

After direct restore, restart/clear server catalog/BOM cache (which can persist for thirty minutes), invalidate client cache and refetch before comparing results. Retain append-only stock/audit/document evidence; never erase committed history to fit a narrative.

[Deployment](../DEPLOYMENT.md) owns backup/RPO/RTO/health targets. Those are targets, not proof: authorized provider/restore drills must demonstrate them. Business backup bundles, keys and private inputs must remain outside Git and require explicit retention/loss decisions.
