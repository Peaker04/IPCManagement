# MRX Cross-Flow Integrity and Main Database Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Owner selected Native sequential execution; no subagents or new worktree.

**Goal:** Repair MRX cross-flow/history defects and close main-database schema deployment through inspected, rehearsed and separately confirmed forward migrations.

**Architecture:** Keep existing reconciliation/inventory owners. Share transaction-internal issue execution between single and coordinated commands; preserve append/invalidate decisions and exact audit identities. Separate repository validation, disposable MySQL rehearsal and main-database deployment acceptance so one cannot manufacture evidence for another.

**Tech Stack:** ASP.NET Core 9, EF Core/Pomelo, MySQL, xUnit/FluentAssertions, PowerShell 5.1 and existing Playwright MRX harness.

**Spec:** `docs/superpowers/specs/2026-11-02-mrx-cross-flow-and-main-database-alignment-design.md`

## Global Constraints

- `DEFAULT != MATERIAL_RECONCILIATION`; one physical stock ledger, existing RBAC/mode/version/idempotency gates.
- Native, current workspace, one writer; no delegation, package installation, speculative index, test exemption, UI/CSS redesign or test-only production seam.
- Preserve decimal six-place final-quantity policy, exact source/daily/issue/unit identities and `null` for missing positive-line issue evidence.
- No valid history deletion, fabricated historical decisions, business-row backfill, main-DB reset/seed/downgrade/restore-overwrite or automatic startup migration.
- Main-database scope is `ipcmanagement` on the identity established by read-only inspection; missing credentials or ambiguous host/schema is BLOCKED, not permission to guess.
- Credentials only through private configuration/environment or ACL-restricted run-owned defaults files; never CLI arguments, logs, docs or staged artifacts.
- Main DB remains read-only until Task 8's separate final confirmation. General approval of this plan does not satisfy that final write gate.
- Synthetic test fixtures only inside existing isolated test boundaries; no new business evidence/seed on main. Runtime mutations only inside approved run-owned clone/subordinate targets.
- Generated OpenAPI/types change only through `npm run gen:api`. Commit/push/deploy remain separately authorized; a confirmed API writer-maintenance window is scoped to migration, not remote deployment.
- `.planning/WORK.md` is the sole task-state owner. Checkboxes here are the implementation checklist, not a second status ledger.

## Review Focus

- Corrected decisions must retain prior reason/actor/time, not merely bump a version: Task 1.
- Zero retained daily rows must not demand nonexistent issue evidence, while missing positive-line evidence remains unavailable: Task 2.
- Coordinated issues must preserve real unit conversion, exact provision lineage and all-or-none group transactions: Task 4.
- Legacy daily-keyed issue audits cannot be assigned to an arbitrary issue; current issue-keyed reasons must appear in all consumers: Task 3.
- Passing repository/model checks or clone migrations must never certify actual main schema, nor permit partial-DDL blind retry: Tasks 6–8.

## File/owner map

- Decisions/status: `ReconciliationActualService.cs`, `ReconciliationDailyIssuePolicy.cs` and existing service/concurrency tests.
- Active requirements/completed facts: `ReconciliationInventoryIssueCreator.cs`, `ReconciliationPreparationService.cs`, `ReconciliationReportsService.cs`.
- Issue execution/provision: existing inventory creator, `MrxIssueProvisionQuery.cs`, preparation service/contracts and real frontend consumers if the wire response changes.
- Audit identity: issue writer, `ReconciliationBatchService.cs`, reports service, `MrxAuditScopeQuery.cs` and `MrxAuditScopeQueryTests.cs`.
- Retained-volume export: reports service, `MrxTransactionHistoryQuery.cs`, CSV writer and a production-only internal export-context owner if needed; do not duplicate query SQL.
- Migration/schema: existing `Migrations/`, `IpcManagementContext` model mappings; `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1` for clone rehearsal; existing backup/restore/recovery utilities where their safety contracts suffice.
- Canonical rules/operations: `docs/DOMAIN.md`, `docs/domain/material-reconciliation.md`, `docs/OPERATIONS.md` only for verified behavior and deployment procedure.

All service paths above are under `backend/src/IPCManagement.Api/Features/Reconciliation/Services/` unless explicitly inventory-owned; inventory paths are under `Features/Inventory/Services/`. Test paths below are under `backend/tests/IPCManagement.Api.Tests/`.

### Task 1: Append decision corrections and enforce daily completion rules

**Files:** Modify `ReconciliationActualService.cs`, `ReconciliationDailyIssuePolicy.cs`; extend `ReconciliationServiceTests.cs`, `ReconciliationDailyLineagePolicyTests.cs` and existing disposition-concurrency tests in their current owners.

**Interfaces:** Preserve `SetDailyDispositionAsync(...)`, `SetDispositionAsync(...)` and request DTOs. Each successful correction appends a new ID/version; old row receives invalidation metadata. `ResolveDailyStatus(...)` never treats an under-issued daily line as complete because of disposition.

- [ ] Step 1 — Extend existing correction cases: decision v1 reason A, correction expected v1 to reason B => two persisted rows, exactly one active, v1 reason/actor/time unchanged, active v2. Stale correction writes nothing. Pin both daily and weekly distinct storage contracts. Replace the old assertion that correction leaves one row.
- [ ] Step 2 — Extend existing daily completion case: required 5, issued 4 => daily disposition rejected, weekly not complete, completion rejected; a received legacy return producing shortage also stays partial. Preserve overage acceptance and separate weekly legacy compatibility.
- [ ] Step 3 — Run `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~ReconciliationServiceTests|FullyQualifiedName~ReconciliationDailyLineagePolicyTests"`; record intended RED, not unrelated compilation/fixture failures.
- [ ] Step 4 — Invalidate then append inside the existing protected transaction, increasing version and preserving optimistic concurrency/active-owner fences. Flush invalidation before insert if required by MySQL uniqueness, without breaking atomicity. Reject non-overage daily dispositions; ignore retained shortage decisions for completion rather than deleting them.
- [ ] Step 5 — Run the same selection GREEN; inspect existing relational concurrent corrections so one winner retains predecessor history. Determine whether the existing generated active-owner schema already suffices; do not create a migration just for service changes.

### Task 2: Separate positive requirements from retained zero history

**Files:** Modify inventory `ReconciliationInventoryIssueCreator.cs`, `ReconciliationPreparationService.cs`, `ReconciliationReportsService.cs`; extend `MrxBatchRecomputerTests.cs`, `ReconciliationWarehouseIssueApplicationPathTests.cs`, `ReconciliationPreparationTests.cs`, `ReconciliationDashboardAndReportsTests.cs` at their strongest distinct boundaries.

**Interfaces:** Same public requests; initial issue covers every positive daily requirement exactly once. Retained zero rows remain persisted. Completed totals require linked issues only for positive requirements, and never turn missing positive facts into zero.

- [ ] Step 1 — Extend the existing removed-ingredient scenario across its next real owner: an open day contains retained ingredient A=0 and active B=10; issuing only B succeeds, issuing A as an initial requirement fails, row A remains stored.
- [ ] Step 2 — Add the corresponding completed-report case: positive requirements have exact net evidence plus retained zero/no-issue row => real totals available; remove one positive issue => unavailable. Retain all-zero-day no-requirement behavior without claiming legacy corruption.
- [ ] Step 3 — Run the four named test-class filters and capture RED for the current completeness checks.
- [ ] Step 4 — Apply the positive-requirement predicate consistently to both issue writers and report completeness. Keep histories and locked days unchanged.
- [ ] Step 5 — Run the same filters GREEN; preserve frozen daily/weekly aggregate and cooking contributor regressions.

### Task 3: Correct audit identity and retain legacy read compatibility

**Files:** Modify inventory issue creator, preparation service, `ReconciliationBatchService.cs`, `ReconciliationReportsService.cs`, `MrxAuditScopeQuery.cs`; extend `MrxAuditScopeQueryTests.cs`, issue-path and report/service tests.

**Interfaces:** New quantity-reason audit rows use `EntityName=InventoryIssueLine` and exact persisted `IssueLineId`. Note projections resolve current identities through persisted issue-line/daily relationships; legacy daily-keyed rows remain batch/daily-scoped and are not assigned to a guessed issue.

- [ ] Step 1 — Extend a real issue-owner case: issue with overage reason => audit entity ID equals that new issue line, and batch daily review, variance and typed audit retain the reason. Include two issues for one day to prove exact new-note ownership.
- [ ] Step 2 — Extend audit scope with retained daily-keyed note and unrelated DEFAULT/other-batch negative controls. Add old-version audit membership through source revisions only if the current reader excludes a retained related version; do not broaden by business-area label.
- [ ] Step 3 — Run issue/audit/report filters RED. Existing handcrafted correct-ID audit fixtures alone do not prove the writer contract.
- [ ] Step 4 — Write correct IDs after issue-line allocation; update every connected note reader. Keep legacy compatibility bounded by proven persisted relationships; no database backfill or guessed mapping.
- [ ] Step 5 — Run the same selection GREEN and query-generation test `FullyQualifiedName~MrxAuditQueryPlanCaptureTests`; generated typed-audit SQL must still derive from the production owner.

### Task 4: Make coordinated initial issue use the inventory owner

**Files:** Refactor inventory `ReconciliationInventoryIssueCreator.cs`, `ReconciliationPreparationService.cs`; extend `ReconciliationPreparationTests.cs`, issue-path tests and provision tests. Modify preparation contract/frontend callers only if persisted provision response exposure requires it.

**Interfaces:** Extract an internal `CreateWithinTransactionAsync(CreateInventoryIssueRequest request, byte[] actorId, CancellationToken token)` on the existing creator (or an equally local existing owner) returning `InventoryIssueCreatedDto`. Single-command wrapper owns its transaction/replay; coordinated wrapper owns one outer transaction and group receipt and invokes the shared core without nested transactions. Coordinated requests are initial-only; a day with an existing issue conflicts.

- [ ] Step 1 — Extend real preparation tests for: shortage provision exact issue reference/markers visible after detail reload; stock in a different convertible unit; two selected batches consume the same pool; stale second batch rolls back all issue/movement/provision/receipts; same group replay returns same identities.
- [ ] Step 2 — Add an existing-date API/service rejection case with no new issue/stock/disposition effects, closing the hidden supplemental path. Preparation read with received legacy return must match daily net-issued projection.
- [ ] Step 3 — Run `FullyQualifiedName~ReconciliationPreparationTests|FullyQualifiedName~ReconciliationWarehouseIssueApplicationPathTests|FullyQualifiedName~MrxIssueProvisionQueryTests` RED. Mocking ledger calls is not sufficient for the unit/provision cases; use the existing real relational fixture/ledger boundary.
- [ ] Step 4 — Move the proven single-issue behavior into the transaction-internal owner. Derive stable child command IDs from group command and batch identity within existing length constraints; retain group atomic replay and each issue's lifecycle identity. Preserve `PreparationGroupId` linkage and initial-only guard. Remove the superseded manual stock/provision writer.
- [ ] Step 5 — Use `ReconciliationNetIssueProjection` for preparation quantities. Expose persisted provision information through existing DTOs/detail authority, regenerate contracts if necessary and update real callers together. Before any TSX change emit the scoped UI gate and load UI-review skills; no CSS redesign.
- [ ] Step 6 — Run the focused backend selection GREEN and affected frontend tests/lint/contracts if changed. Preserve source/version/day-lock races and exact group rollback assertions.

### Task 5: Bound invalidation queries and production CSV reads

**Files:** Modify inventory issue creator and `InventoryReturnService.cs`, reports service, transaction-history query and CSV export owner as needed; extend existing report/issue/return tests.

**Interfaces:** Filter active/affected decisions in SQL before `ToListAsync`. Preserve export stream signatures, ordering/CSV bytes/cancellation. A dedicated export read context inherits configured provider/connection/timeout but uses a non-retrying read execution strategy; global mutation retry behavior remains unchanged.

- [ ] Step 1 — Extend invalidation behavior with unrelated/invalidated decisions retained; add provider-generated query proof that active/affected filters execute server-side, not just equivalent small-fixture output.
- [ ] Step 2 — First confirm the production Pomelo query compilation buffering setting with retry enabled versus export read configuration, without opening a DB. Pin the export configuration and cancellation/full-scope CSV contract in the existing report owner tests. If the audit's buffering hypothesis is disproved, record that and skip unnecessary export refactoring.
- [ ] Step 3 — Run focused issue/return/report tests RED for demonstrated defects. No fake peak-memory assertion based on InMemory or `MemoryStream` output.
- [ ] Step 4 — Push predicates into SQL with bounded IDs. If required, create/dispose the dedicated export context in the production export lifetime, reuse query owners/actor projection and preserve global retries. Do not write a second handwritten transaction/audit query or silently retry a partially sent response.
- [ ] Step 5 — Run focused tests GREEN. Capture real export correctness/cancellation and retained-volume memory observations on the authorized clone in Task 7; do not invent a production capacity claim from unit tests.

### Task 6: Establish actual main migration/schema drift and deployment artifacts

**Files:** Read existing migration chain/model and `docs/OPERATIONS.md`; update operations procedure. New forward migration under `backend/src/IPCManagement.Api/Migrations/` only when an actual model change requires it. No main-DB write.

**Interfaces:** Produce sanitized identity/head/missing-migration list and owned-schema comparison, plus exact forward SQL artifact/hash in private run-owned storage. Inputs are approved operator credentials/configuration, never values printed into this plan.

- [ ] Step 1 — Inspect connection configuration safely and report only set/unset and approved nonsecret identity. Confirm actual host/server identity, exact `ipcmanagement`, operation mode and connected runtime build/target. Missing/ambiguous credentials => BLOCKED; never fall back to hardcoded passwords or a different database.
- [ ] Step 2 — Read ordered `__EFMigrationsHistory` and actual schema definitions for affected tables: columns/types/precision/defaults/nullability, generated active-owner expressions, unique indexes, FK columns/actions and checks. Compare with the migration chain, including the October direct-edit migrations and both November retention migrations; do not assume only two are missing.
- [ ] Step 3 — Run model pending-change check with the configured design-time context and no database update. If repairs require schema changes, generate one minimal forward migration with metadata/snapshot, inspect data preservation and add an independent storage regression. No model change => no new migration.
- [ ] Step 4 — Generate the explicit current-head-to-target-head forward script/bundle into private storage; review every statement, target override, drop/alter/index operation and hash. Schema/history disagreement or duplicate active rows => STOP for a separately reviewed recovery proposal, never manual history insertion or winner selection.
- [ ] Step 5 — Complete local code gates: `npm run verify`, focused recovery/evidence/query-generation tests, generated API parity if touched, EF model parity and `git diff --check`. Use existing installed tools only; package installation remains unauthorized. Record inherited warnings separately.

### Task 7: Fresh clone rehearsal and recoverable pre-main backup

**Files:** Reuse `scripts/mrx-evidence/Invoke-MrxDisposableEvidence.ps1`, prepared MRX E2E, existing backup/restore tools and `docs/OPERATIONS.md`. No main schema/data write.

**Interfaces:** Source `ipcmanagement` is read-only. Runner alone owns absent `ipc_mrx_evidence_<UTC-run-id>` and its `_integration` schema. Produce clone migration/schema, full typed-audit EXPLAIN, G1 and cleanup evidence, plus a private backup with verified isolated recovery.

- [ ] Step 1 — Run `npm run evidence:mrx:mysql -- -Mode Preflight` with the authorized environment; verify absent targets, source identity, tools, secret-safe defaults handling and non-overlapping listener ownership. No target reuse/CREATE IF NOT EXISTS.
- [ ] Step 2 — Run `npm run evidence:mrx:mysql -- -Mode Execute` only with preflight satisfied. Compare exact generated migration SQL with Task 6's range. Extend existing clone verification where needed to compare actual affected schema semantics, not just history count.
- [ ] Step 3 — Exercise initial/supplemental/disposition correction, zero-row source edit, coordinated initial issue, audit reason visibility and shortage rejection through existing public/relational owners on the disposable lanes. Recompute issue/provision/stock invariants; capture full production typed-audit EXPLAIN and export observations. Do not run legacy hardcoded reset harnesses.
- [ ] Step 4 — Require independent finally cleanup of exact owned schemas/processes/defaults/dumps. Cleanup failure => BLOCKED_CLEANUP, irrespective of previous test results. Main source identity/schema and existing records remain unchanged.
- [ ] Step 5 — Arrange approved private backup destination and recoverability inputs before main maintenance. No retained-backup pruning. Preserve an encrypted, hash-verified pre-change dump/manifest and actual schema snapshot outside Git; validate restoration on a newly absent authorized target, using snapshot-bound data/schema/ledger comparisons. A ZIP alone is not encryption; mirror is not immutable provider proof. If required destination/key/restore scope is unavailable, STOP before Task 8.
- [ ] Step 6 — Bind the final migration backup to a writer-quiesced cutover pre-state: if writers changed after the rehearsal snapshot, take and verify a fresh final backup and recheck drift. Restoring an old rehearsal backup is not evidence that the latest main state is recoverable.

### Task 8: Final Owner gate, main migration and postflight

**Files:** Update operational procedure and WORK only with actual results. The write artifact is the exact private SQL/bundle approved at this gate; no broad new production repair tool is required.

**Interfaces:** Final request names host/server identity, exact DB, source build, current/target heads, ordered migration range, SQL SHA-256, backup path/hash/recovery proof, confirmed writer IDs/services and maintenance window, pre/post invariants and partial-DDL recovery procedure. Main mutation remains forbidden until Owner confirms this exact gate.

- [ ] Step 1 — Present the full sanitized cutover packet and explicitly STOP. Ask for final confirmation before any schema/data write or writer shutdown. Prior approval of the scope/plan does not bypass this checkpoint.
- [ ] Step 2 — After final confirmation, quiesce only the confirmed writers; verify no overlapping migration/application writers and recheck host/database/build/history/schema and fresh recoverable backup. Any mismatch => STOP, no write.
- [ ] Step 3 — Apply only the reviewed forward migration range using environment/defaults-file credentials. Do not auto-migrate via application startup, set fake migration history, seed, downgrade or promote the clone database.
- [ ] Step 4 — Inspect actual schema and ordered history after application; verify row IDs/counts and hashes for unchanged business evidence, source snapshots, contributors/dispositions, issues/returns/movements, stock/lot balances and lifecycle receipts. Compare expected additive/metadata changes separately. Newly added columns require a projected pre/post comparison, not a false whole-table checksum equality.
- [ ] Step 5 — If MySQL DDL fails, keep writers stopped and capture exact applied history/schema; do not assume transaction rollback, retry the entire script, run Down or restore main automatically. Request a reviewed forward recovery or separately authorized restore with loss acceptance.
- [ ] Step 6 — Resume only confirmed writers once schema/data checks pass; verify correct connection/build, health readiness, mode isolation and non-mutating MRX reads/reloads. Main business mutation smoke requires explicit declared transaction scope; clone G1 is not permission to create production documents.
- [ ] Step 7 — Report separate verdicts for code, clone migration/G1, actual main schema/history/data, readiness and provider archive certification. Update WORK and return IDLE only on completed scope or an explicit safe pause with blockers; main deployment remains incomplete if stopped before this gate.

## Self-review and handoff

All seven audit findings map to Tasks 1–5. Migration/model necessity, actual drift, rehearse-first, recoverable backup, final authorization, partial-DDL handling and actual-main postflight map to Tasks 6–8. No live provider five-year certification is claimed by this plan. No old business history is reconstructed. Independent review is not silently delegated; parent performs scoped code/test review.

Plan is ready for Owner review before implementation. Execution method stays Native. Local commit/push are not implied by plan approval.
