# MRX Disposable MySQL Evidence Execution Design

**Date:** 2026-11-01
**Status:** Approved by Owner — 2026-11-01
**Related authority:** `docs/superpowers/specs/2026-11-01-mrx-data-integrity-and-five-year-retention-design.md`

## 1. Intent

Close the remaining MRX database and public-flow evidence gaps without mutating `ipcmanagement`. Use `ipcmanagement` only as a read-only snapshot source, perform all schema/data mutation in one run-owned disposable MySQL clone, preserve bounded evidence, and remove only the clone created by the run.

The execution must prove that the current real-shaped database can accept the two pending MRX migrations, preserve required history, support concurrency and retained-history queries, and run the MRX G1 provision flow after migration.

## 2. Goals

1. Clone a consistent full snapshot of `ipcmanagement` into `ipc_mrx_evidence_<run-id>`.
2. Prove source identity and target absence before creation.
3. Apply the complete current EF migration chain only to the disposable clone.
4. Verify the two new migration heads and no pending model changes.
5. Run relational migration/concurrency and MRX owner tests against the clone.
6. Capture MySQL `EXPLAIN` evidence for retained-history queries before deciding on indexes.
7. Run G1 against the migrated clone and verify exact issue-linked provision evidence.
8. Run aggregate repository verification.
9. Capture source-before/source-after read-only fingerprints and target evidence.
10. Drop only the run-owned clone and remove temporary credentials/dumps.

## 3. Non-goals

- No migration, data correction, restore, seed, cleanup, or mode change in `ipcmanagement`.
- No production deployment or application restart.
- No provider archive publication or live restore certification without a separately supplied official provider adapter and credentials.
- No speculative index migration.
- No second stock ledger, data warehouse, or event-sourcing layer.
- No cleanup of databases not created by this run.

## 4. Anti-goals

The execution is considered failed if it:

- uses `CREATE DATABASE IF NOT EXISTS` and silently reuses a prior target;
- accepts a target name outside the run-owned evidence pattern;
- sends DDL/DML to `ipcmanagement`;
- applies migrations before the clone is fully restored and checked;
- manufactures retained volume or provider evidence and labels it production evidence;
- creates an index without before/after query-plan evidence;
- reports G1 PASS when the flow stops before persisted provision verification;
- leaves a listener, temporary credential file, SQL dump, or evidence database behind.

## 5. Approaches Considered

### A. Full read-only clone, migrate, verify, cleanup — selected

Highest fidelity to the current database shape. It validates existing rows, migrations, query plans, and public MRX behavior while preserving production isolation.

### B. Schema plus MRX subset

Cheaper but can omit FK, audit, lifecycle, and volume characteristics. Rejected for certification.

### C. Empty database plus synthetic fixtures

Repeatable but cannot prove migration safety for current persisted data. Rejected as the primary evidence lane.

## 6. Safety Boundary

### 6.1 Source

- Exact database name: `ipcmanagement`.
- Source connection is supplied through `IPC_MRX_SOURCE_CONNECTION_STRING`; it is never written to Git or command output.
- The runner parses the connection and refuses any source database other than exact lowercase-insensitive `ipcmanagement`.
- Source operations are restricted to connection metadata, read-only fingerprints, and `mysqldump --single-transaction`.
- No source SQL may contain mutation or schema verbs.

### 6.2 Target

- Generated name: `ipc_mrx_evidence_<UTC run-id>` where run-id contains only lowercase ASCII digits/letters/underscores.
- Target must be absent before creation; an existing database is a hard failure.
- The run records target name and an ownership nonce in its in-memory execution state and evidence header.
- All mutation commands receive the generated target explicitly.
- Cleanup checks exact target name and ownership before `DROP DATABASE`.

### 6.3 Credentials and temporary files

- Credentials come from environment variables or a run-owned temporary MySQL defaults file with restricted access.
- Passwords never appear in process arguments, logs, evidence, screenshots, or WORK.
- Dump, defaults file, and extracted artifacts live under a unique temporary run directory.
- Cleanup runs in `finally`; cleanup failure is reported as failure, not warning-only success.

## 7. Execution Architecture

A single repository-owned evidence runner coordinates the workflow. It reuses standard MySQL, EF, test, Playwright, and repository commands; no dependency is added.

### Stage 0 — Preflight

- Confirm clean command prerequisites: MySQL client, `mysqldump`, .NET SDK, Node, Playwright browser.
- Capture Git branch, HEAD, dirty/staged state, migration list, and exact source database identity.
- Confirm ports `5174` and `5263` have no LISTEN owner or stop only processes explicitly created by a prior evidence run.
- Confirm target absence.
- Refuse execution if source and target identities are equal.

### Stage 1 — Source fingerprint and full clone

- Capture source migration IDs/head and bounded MRX table counts/checksums.
- Create the absent target with source-compatible charset/collation.
- Dump source with `--single-transaction`, routines, triggers, events, `--hex-blob`, and `--set-gtid-purged=OFF`.
- Reject partial dumps without the completion marker.
- Restore only into the generated target.
- Compare pre-migration target schema/count/checksum manifest with the source manifest.

### Stage 2 — Migration rehearsal

- Supply the target connection through the child process environment.
- Run EF migration discovery and apply the current migration head to the target.
- Verify both pending migrations are present:
  - `20261101112409_RetainMrxDecisionAndContributorHistory`
  - `20261101124531_RetainWeeklyMenuImportSnapshots`
- Run `has-pending-model-changes` against source code.
- Verify retained contributor/disposition rows, generated active-owner fences, and normalized snapshot column semantics.
- Never edit migration history manually.

### Stage 3 — Relational and concurrency verification

- Set `IPC_TEST_CONNECTION_STRING` only for child test processes and point it to the disposable target.
- Run the environment-owned MySQL integration lane plus focused MRX mutation/concurrency tests.
- Verify append/invalidate behavior, one-active-decision fences, canonical net-issued math, audit isolation, and idempotent provision replay.
- Any test that assumes an empty database must receive its own run-owned subordinate schema or be excluded with an explicit reason; it may not clear the full clone.

### Stage 4 — Query-plan evidence

Capture SQL and `EXPLAIN`/`EXPLAIN ANALYZE` where safe for:

- batch/date transaction-history count and page query;
- full filtered transaction export query;
- exact issue provision lookup;
- active contributor/disposition reads;
- typed MRX audit scope;
- daily net-issued projection.

Decision rule:

- If existing indexes bound scans to the selected batch/date/issue identities and avoid unjustified retained-history full scans, record `NOT_NEEDED` and create no migration.
- If a plan demonstrates a material scan/filesort defect at representative retained volume, stop the evidence run at the decision barrier, add only the justified index through a reviewed migration, recreate a fresh clone, and repeat Stages 1–4. A post-hoc index on the already-tested clone is not final evidence.

### Stage 5 — G1 public-flow evidence

Refactor the MRX Playwright setup so it can consume a prepared run-owned database without recloning or dropping it:

- `MRX_E2E_DATABASE` must match the evidence target generated by the same run.
- `MRX_E2E_PREPARED_DATABASE=1` disables clone/drop in Playwright setup/teardown; the outer runner remains the sole database owner.
- Guardrails reject `ipcmanagement`, lane/template databases, and mismatched run IDs.
- Playwright may clean only the canonical G1 week inside the evidence target after migration.
- Run Kestrel/Vite on `5263/5174`, execute G1, and verify:
  - persisted provision returned from create;
  - same movement identity on detail reload and replay;
  - exact `ADJUSTMENT.RefTable = inventoryissues` and `RefId = issueId`;
  - issue and report quantities agree with the net ledger;
  - no unrelated provision appears.

### Stage 6 — Repository gates

- Focused Backend and Frontend tests.
- Recovery contract tests.
- `npm run verify`.
- `git diff --check`.
- API generation stability check.
- Migration model parity check.

### Stage 7 — Source immutability and cleanup

- Re-read source migration IDs/head and bounded fingerprints.
- Require equality with Stage 1 for the compared source facts; if concurrent external writes make data fingerprints unstable, report the ambiguity without claiming source immutability from row checks alone. Migration head/schema identity must remain unchanged.
- Stop only run-owned Kestrel/Vite processes.
- Assert no LISTEN owner on `5174/5263`.
- Drop the exact run-owned target.
- Confirm target absence.
- Delete temporary dump/defaults files.

## 8. Evidence and Reporting

`.planning/WORK.md` remains the only task-state owner. Run output may be stored under ignored `.artifacts/mrx-evidence/<run-id>/` and must contain no credentials.

Evidence summary includes:

- run ID, Git HEAD, source/target identities;
- source and pre-/post-migration target migration heads;
- clone manifest comparison;
- migration and test command exit codes/counts;
- query-plan decisions and any index decision;
- G1 result and exact persisted movement facts;
- source-after comparison;
- target/port/temp cleanup results.

A repository test PASS cannot be relabeled as live provider evidence.

## 9. Failure and Recovery

- Before target creation: stop with no cleanup mutation.
- After target creation: outer `finally` attempts exact-target cleanup.
- Migration/test/EXPLAIN/G1 failure: retain logs, do not retain the database unless the owner explicitly interrupts cleanup for investigation.
- Cleanup failure: status is `BLOCKED_CLEANUP`; print the exact target and do not create another clone.
- Source identity mismatch or any attempted source mutation: stop immediately and report a safety violation.

## 10. Provider Archive Lane

The approved disposable-MySQL run can close migration, concurrency, query-plan, and G1 evidence. Live five-year archive/restore certification remains a separate operational lane because the repository contains no official provider adapter or credentials.

That lane begins only when these exact inputs are supplied:

- official provider adapter path;
- provider/project/account security domain;
- immutable object destination/key policy;
- encryption key reference;
- authorized new `ipc_restore_*` target.

It will use the existing five-calendar-year receipt and restored-target MRX oracle guards. Missing inputs produce `NEEDS_EVIDENCE`, never a synthetic PASS.

## 11. Commit and Integration

After all authorized repository and disposable-MySQL gates pass:

- inspect the complete dirty diff and generated contracts;
- record PASS/NEEDS_EVIDENCE in WORK;
- commit only if the owner confirms commit authorization remains active at that point;
- push only if explicitly confirmed or already unambiguously included in the current authorization;
- never include dumps, credentials, temporary evidence databases, or ignored runtime artifacts.

## 12. Acceptance Criteria

1. `ipcmanagement` receives no migration or DML/DDL from the run.
2. A previously absent run-owned clone is created and later proven absent.
3. The full source clone matches its pre-migration manifest.
4. Both MRX migrations apply successfully to the clone.
5. MySQL relational/concurrency tests pass against disposable targets.
6. Every query-plan decision is supported by captured MySQL evidence.
7. No index migration is created without before/after proof.
8. G1 reaches and verifies persisted provision create/detail/replay/DB facts.
9. Aggregate repository verification passes.
10. Source migration/schema identity is unchanged.
11. Ports and temporary files are cleaned.
12. Provider status remains truthful until official provider inputs and a real restore drill exist.
