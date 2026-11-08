# MRX Cross-Flow Integrity and Main Database Alignment Design

Date: 2026-11-02

## Intent and approved approach

Close the seven findings from the fresh MRX audit and finish the previously missing deployment leg: repository migrations must be reconciled with the actual main database, not merely exercised on a disposable clone. Owner approved Native sequential work in the current workspace and inclusion of main-database migration after backup/rehearsal, with a separate final confirmation immediately before any main-database write.

This document records that conversationally approved approach. Implementation details are subject to the accompanying plan review. `.planning/WORK.md` remains the only execution-state owner.

## Scope and contracts

- FR-MENU, FR-WH, FR-RECON and operational recovery; BR-MRX-EDIT-3..9, BR-MRX-TRUTH-1/2, BR-MRX-HIST-1/2, DOM-MODE-1 and retained-history query scale.
- Existing stack, current branch, one writer, no delegation, dependency, speculative index, styling change or parallel stock ledger.
- Retain current APIs where possible. Regenerate any changed contracts through `npm run gen:api` only.
- Existing source/ledger data is evidence. Never recreate missing old decisions, invent issue lineage or replace unavailable facts with zero.
- Main DB alignment is a forward schema deployment, not permission to repair business rows, restore a clone over the main DB, purge, reset credentials, seed, downgrade or change operational mode.

## Alternatives

1. Fix only repository owners: smallest code scope but repeats the missing main-DB closure. Rejected.
2. Fix existing owners, rehearse on a fresh full clone, then inspect/approve/apply the exact migration range on main. Selected by Owner.
3. Replace reconciliation/stock persistence or auto-migrate at startup: larger risk, duplicate authority and unsafe multi-instance writes. Rejected.

## Behavioral changes

### Decisions retain every version

Both daily and weekly disposition corrections invalidate the current row and append a new row. The new version increases monotonically, actor/time/reason remain attached to each old row, and active-owner uniqueness plus expected-version protection stay authoritative. Current projections read active rows; historical rows remain queryable. Do not rewrite an invalidated row or rely on a version number without retained values.

### One issue execution owner

The single-issue and coordinated preparation commands share transaction-internal initial-issue validation, provisioning, issue/line persistence, stock mutation, audit and lifecycle behavior. Public wrappers own replay and transaction boundaries; never nest public transactions. The coordinated command remains initial-issue-only, matching its real UI: reject an already-issued batch/date rather than creating an unvalidated supplemental path.

Provision uses canonical unit conversion and exact `inventoryissues`/issue ID/marker lineage. Create/detail/replay all derive provision metadata from persisted movements. Preparation reads use the net-issue projection, including received legacy returns.

### Retained zero rows are not active requirements

Preserve zero-quantity daily rows for history. Initial issuing validates exactly the positive requirements for that date on both command paths. Completed-register completeness checks positive requirements without requiring a fabricated issue for zero retained rows. Positive requirements lacking issue evidence still produce unavailable quantities. All-zero days are no-requirement, not legacy lineage corruption.

### Shortage does not become fulfilled by disposition

Use the current canonical daily contract: only overage is eligible for a daily completion disposition. Under-issued dates remain partial until linked actual/supplemental evidence closes the shortage. Existing shortage decisions are retained, not deleted, but cannot waive the daily completion condition. Weekly-only legacy compatibility remains separate. Existing completed records are not reopened or rewritten automatically.

### Audit identity matches its entity type

New issue-quantity reason audits refer to the exact persisted `IssueLineId`. Current detail, variance and typed-audit consumers follow that identity. Retained audit rows that used `DailyLineId` under the issue-line entity type remain readable only through proven daily-line/batch/issue relationships. Do not assign one legacy daily note to an arbitrary issue when multiple issues exist. Include old menu-version audit membership through retained source revisions, not only the batch's current version.

### Retained-volume queries remain bounded

Filter disposition invalidation by active state and affected IDs before materialization, including legacy return handling. Export must not buffer the full query under the production retry strategy. Preserve global mutation retries; use a narrowly scoped export read context with a non-retrying strategy, preserving provider, connection configuration, timeout and query owners. Cancellation and mid-stream failure must abort the download, never return a fabricated complete file. Confirm production-provider buffering behavior without opening a DB, then measure on the authorized clone. Retain full filtered scope, CSV format and ordering.

## Database alignment and safety gates

1. Read-only main inspection: verify actual server identity/database/mode, full migration chain and actual owned column/type/precision/default/generated expression/index/FK/check semantics. History parity alone is insufficient. Do not claim drift until observed.
2. Inventory the exact missing migration range. Existing migrations are immutable, including `20261101112409_RetainMrxDecisionAndContributorHistory` and `20261101124531_RetainWeeklyMenuImportSnapshots`. Create a new forward migration only if the repaired model actually needs one.
3. If history and schema disagree, stop and produce the exact discrepancy. Do not insert history rows, skip failed DDL or generate a blanket idempotent script to hide drift.
4. Fresh full clone rehearsal uses `Invoke-MrxDisposableEvidence.ps1` with absent run-owned targets. Source stays read-only; mutation integration runs in its subordinate schema; prepared Playwright never creates/drops schemas. Capture full production typed-audit EXPLAIN before any index decision.
5. Preserve a private, recoverable pre-change backup outside the repository, hash/manifest, exact schema/pre-state and a successful isolated restore check. Dump/manifest must describe one snapshot. Plain ZIP is not encrypted; do not relabel it immutable/off-host. No retained-backup pruning in this operation.
6. Present a final main-write gate with exact host/server identity, `ipcmanagement`, current/target migration heads, ordered migration IDs, reviewed SQL hash, backup/restore proof, writer-maintenance plan, verification and partial-DDL failure plan. STOP for Owner's final confirmation.
7. After confirmation, quiesce only confirmed writers, recheck target/history/schema/backup, apply only the approved forward range and verify actual schema plus invariant data snapshots before resuming. MySQL DDL can commit partially: on failure keep writers stopped, inspect actual history/schema and seek a reviewed forward recovery; never blindly retry, downgrade or restore.
8. Close only after explicit `PASS` or `BLOCKED/NEEDS_EVIDENCE` for code, clone, main migrations/schema and postflight. Provider five-year lock/publication/restore remains an independent evidence lane.

## Acceptance

Every numbered audit finding has an owner-boundary regression or independent provider/configuration proof; original regressions remain. Corrected disposition history survives reload, zero retained requirements do not block issue/reporting, coordinated initial issues preserve exact provision/stock lineage, shortage cannot waive completion, and issue notes remain visible across current/legacy audit identities. Main application is not complete until the final authorized schema/history/data/readiness checks pass.

Already overwritten decisions cannot be reconstructed without independent historical evidence. No data-repair operation is implicitly authorized by this design.
