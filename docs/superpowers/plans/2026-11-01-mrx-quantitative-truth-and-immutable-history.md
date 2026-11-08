# MRX Quantitative Truth and Immutable History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every MRX quantity projection ledger-derived and retain replaced contributor/disposition evidence instead of deleting it.

**Architecture:** Introduce one internal daily-line net-issue projector and migrate Warehouse, disposition, variance and completed-register consumers to it. Add append-plus-invalidation persistence for contributors and dispositions through one forward EF migration; current reads select active rows while history remains queryable.

**Tech Stack:** ASP.NET Core 9, C# 13, EF Core 9/Pomelo, MySQL 8+, xUnit, FluentAssertions.

**Spec:** `docs/superpowers/specs/2026-11-01-mrx-data-integrity-and-five-year-retention-design.md`

## Global Constraints

- `DEFAULT != MATERIAL_RECONCILIATION`; never admit DEFAULT issue/return/audit rows into MRX projections.
- Missing linked issue evidence is `null / UNTOUCHED`, never decimal zero.
- Quantity authority is linked issue quantity minus received return quantity, rounded through existing six-decimal policy.
- No valid contributor, disposition, issue, return, movement, revision, delta or audit row may be hard-deleted.
- Preserve existing protected transactions, expected mode/batch versions, idempotency and apply-vs-issue exactly-one-winner behavior.
- Add no dependency, test-only production seam, allowlist, baseline increase or synthetic business fixture.
- Do not apply migrations to `ipcmanagement`; relational application requires a separately authorized disposable MySQL target.
- Generated OpenAPI changes are limited to truthful completed-register nullability in Task 2 and must use `npm run gen:api`; generated files are never hand-edited.
- Commit steps are conditional on explicit Owner authorization at execution; otherwise record `NOT_RUN` in `.planning/WORK.md`.

## Review Focus

- A daily line with no issue rows remains untouched rather than becoming zero-issued — pinned in Task 1.
- Multiple issues plus multiple received/pending returns aggregate only received returns — pinned in Task 1.
- A completed batch with accepted non-zero variance reports real net issued rather than equality — pinned in Task 2.
- Concurrent replacement creates at most one active disposition while preserving invalidated history — pinned in Tasks 4–5.
- A source edit that changes one open day invalidates only that day’s active contributors and leaves locked/unchanged days byte-for-byte stable — pinned in Task 3.

---

### Task 1: Canonical Daily Net-Issue Projection

**Files:**
- Create: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationNetIssueProjection.cs`
- Create: `backend/tests/IPCManagement.Api.Tests/ReconciliationNetIssueProjectionTests.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs`

**Interfaces:**
- Consumes: `InventoryIssueLine.ReconciliationBatchDailyLineId`, received `InventoryReturnLine`, `DecimalPolicy.RoundQuantity`.
- Produces: `ReconciliationNetIssueProjection.LoadByDailyLineIdsAsync(IReadOnlyCollection<byte[]> dailyLineIds, CancellationToken token)` returning facts keyed by daily-line hex identity; absent key means untouched.
- Produces: `ReconciliationNetIssueFact(byte[] DailyLineId, decimal GrossIssuedQuantity, decimal ReceivedReturnQuantity, decimal NetIssuedQuantity)`.

- [ ] **Step 1: Write failing projection tests**

Add tests named:

```csharp
No_linked_issue_returns_no_fact_instead_of_zero()
Multiple_issues_subtract_only_received_source_linked_returns()
Issue_and_return_from_another_daily_line_are_excluded()
Projection_rounds_only_the_final_net_quantity_to_six_decimals()
```

Assert a 10 + 3 gross issue with a received 2 return and pending 4 return produces gross `13`, returned `2`, net `11`; unrelated rows do not participate.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationNetIssueProjectionTests"
```

Expected: FAIL because the projector/fact types do not exist.

- [ ] **Step 3: Implement the bounded projector**

Implement the exact interfaces above. Query only requested daily IDs, aggregate issue lines and only returns whose parent `ReceivedAt != null`, then round final aggregates. Do not load whole issue/return tables.

- [ ] **Step 4: Replace duplicate net arithmetic in current consumers**

Use the projector in `GetWarehouseDailyAsync` and `SetDailyDispositionAsync`. Preserve existing DTO/status behavior and InMemory test compatibility without a second formula.

- [ ] **Step 5: Run projection and connected daily/disposition tests**

Run:

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationNetIssueProjectionTests|FullyQualifiedName~ReconciliationServiceTests|FullyQualifiedName~ReconciliationDailyLineagePolicyTests"
```

Expected: PASS; no missing issue becomes zero.

- [ ] **Step 6: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationNetIssueProjection.cs backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs backend/tests/IPCManagement.Api.Tests/ReconciliationNetIssueProjectionTests.cs
git commit -m "fix(mrx): centralize net issued authority"
```

### Task 2: Ledger-Accurate Variance and Completed Registers

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs`
- Modify generated: `frontend/src/shared/api/contracts/openapi.json`
- Modify generated: `frontend/src/shared/api/contracts/schema.ts`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationCompletedBranch.tsx`
- Modify: `frontend/src/__tests__/Reconciliation.test.tsx`
- Modify: `frontend/src/__tests__/ApiContracts.test.ts`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`

**Interfaces:**
- Consumes: Task 1 `ReconciliationNetIssueProjection`.
- Produces: unchanged report routes/DTO names; completed quantitative fields come from net ledger.
- Compatibility decision: `MrxCompletedRegisterRowDto.TotalIssued` and `TotalVariance` become nullable so legacy batches without daily lineage can represent unavailable truth instead of copied equality.

- [ ] **Step 1: Extend report owner tests with failing ledger cases**

Add tests:

```csharp
VarianceRegister_subtracts_received_returns_and_ignores_invalidated_disposition()
CompletedRegister_reports_nonzero_accepted_variance_from_net_ledger()
CompletedRegister_does_not_fabricate_totals_for_missing_daily_lineage()
```

For the completed case assert required `10`, gross issued `12`, received return `1`, net issued `11`, variance `1` after a valid disposition.

- [ ] **Step 2: Run report tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationDashboardAndReportsTests"
```

Expected: FAIL because current code reports gross variance and copies required to issued.

- [ ] **Step 3: Implement report projection changes**

Load bounded daily IDs for selected batches, call Task 1 projector once, filter current dispositions by `InvalidatedAt == null`, and compute normalized variance. Remove `totalIss = totalReq`.

- [ ] **Step 4: Emit the UI gate and represent unavailable legacy totals**

Before TSX edits, record the scoped `/reconciliation` UI gate in WORK. Extend `Reconciliation.test.tsx` so a legacy completed row with nullable issued/variance renders `Không đủ dữ liệu theo ngày`/`—` and never `0` or required quantity. Update `ReconciliationCompletedBranch.tsx` with existing text/Num primitives only.

- [ ] **Step 5: Regenerate and verify the public contract**

Run:

```bash
npm run gen:api
npm run test:unit -w frontend -- src/__tests__/ApiContracts.test.ts
```

Run `npm run gen:api` a second time and confirm generated hashes do not change. Run `npm run check:api-contract` only after the generated baseline is committed; otherwise it correctly reports the intentional uncommitted contract diff.

Assert generated completed-register quantities are nullable; do not hand-edit generated files.

- [ ] **Step 6: Preserve CSV parity**

Keep CSV builders consuming the corrected DTO rows. For nullable legacy totals, emit an empty CSV cell rather than `0` or required quantity.

- [ ] **Step 7: Run report, UI and completion owner tests**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationDashboardAndReportsTests|FullyQualifiedName~ReconciliationServiceTests"
npm run test:unit -w frontend -- src/__tests__/ApiContracts.test.ts src/__tests__/Reconciliation.test.tsx
```

Expected: PASS with identical Warehouse/report net values and explicit legacy unavailable UI.

- [ ] **Step 8: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs frontend/src/shared/api/contracts frontend/src/features/reconciliation/branches/ReconciliationCompletedBranch.tsx frontend/src/__tests__/ApiContracts.test.ts frontend/src/__tests__/Reconciliation.test.tsx .planning/WORK.md
git commit -m "fix(mrx): report ledger-derived completed totals"
```

### Task 3: Retained Contributor Validity

**Files:**
- Modify: `backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchContributor.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxBatchRecomputer.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchQueryProjector.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationKitchenExportService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationPreparationWorkbookExporter.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/MrxBatchRecomputerTests.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationDailyPersistenceModelTests.cs`
- Create: `backend/src/IPCManagement.Api/Migrations/20261101100000_RetainMrxDecisionAndContributorHistory.cs`
- Create: `backend/src/IPCManagement.Api/Migrations/20261101100000_RetainMrxDecisionAndContributorHistory.Designer.cs`
- Modify: `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`

**Interfaces:**
- Produces contributor fields `DateTime? InvalidatedAt` and `byte[]? InvalidatedBySourceRevisionId`.
- Active contributor means `InvalidatedAt == null`.
- Invalidating revision FK uses `DeleteBehavior.Restrict`.

- [ ] **Step 1: Change owner tests to demand retained history**

Replace the assertion that old contributor rows disappear with assertions that:

```csharp
old.InvalidatedAt.Should().NotBeNull();
old.InvalidatedBySourceRevisionId.Should().Equal(revision.SourceRevisionId);
newContributor.InvalidatedAt.Should().BeNull();
```

Also assert locked-day and unchanged-open-day contributor IDs and validity remain unchanged.

- [ ] **Step 2: Run recomputer/model tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxBatchRecomputerTests|FullyQualifiedName~ReconciliationDailyPersistenceModelTests"
```

Expected: compile/test failure because validity fields do not exist and old rows are deleted.

- [ ] **Step 3: Add entity mapping and forward migration**

Add nullable columns/FK/index suitable for active daily/revision reads. Backfill is implicit active `NULL`; do not fabricate revision IDs for old rows. Update Designer and snapshot.

- [ ] **Step 4: Replace contributor deletion with invalidation**

In `ReplaceContributors`, stamp stored active rows with the current revision/time, append desired contributors, and never call `Remove`. Pass the revision explicitly so the method cannot invent ownership.

- [ ] **Step 5: Filter operational contributor reads**

Update cooking, preparation, source-change and report projections to read only active contributors where they represent current truth. Historical/audit queries retain all rows.

- [ ] **Step 6: Run focused model/recompute/query tests**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxBatchRecomputerTests|FullyQualifiedName~ReconciliationKitchenExportTests|FullyQualifiedName~ReconciliationPreparationTests|FullyQualifiedName~ReconciliationDailyPersistenceModelTests"
```

Expected: PASS; old contributor remains queryable and current projections contain only active facts.

- [ ] **Step 7: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchContributor.cs backend/src/IPCManagement.Api/Models/Entities/ReconciliationSourceRevision.cs backend/src/IPCManagement.Api/Features/Reconciliation backend/src/IPCManagement.Api/Migrations backend/tests/IPCManagement.Api.Tests/MrxBatchRecomputerTests.cs backend/tests/IPCManagement.Api.Tests/ReconciliationDailyPersistenceModelTests.cs
git commit -m "fix(mrx): retain contributor revision history"
```

### Task 4: Append-Only Daily and Weekly Dispositions

**Files:**
- Modify: `backend/src/IPCManagement.Api/Models/Entities/ReconciliationDailyDisposition.cs`
- Modify: `backend/src/IPCManagement.Api/Models/Entities/ReconciliationDisposition.cs`
- Modify: `backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchDailyLine.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs`
- Modify: migration/Designer/snapshot files created in Task 3
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs`
- Modify: active-disposition reads in `ReconciliationBatchService.cs`, `ReconciliationCompletionService.cs`, `ReconciliationComparisonService.cs`, and `ReconciliationReportsService.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationServiceTests.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationDailyPersistenceModelTests.cs`

**Interfaces:**
- Daily and weekly entities both expose `InvalidatedAt`, `InvalidatedBy`, `InvalidationReason`, and nullable generated `ActiveOwnerKey` used only for the MySQL active-row unique fence.
- `ReconciliationBatchDailyLine.Dispositions` becomes a collection; current reads query active rows explicitly.
- `SetDailyDispositionAsync` and `SetDispositionAsync` append when no active row exists; correcting an active row retains existing expected-version behavior.

- [ ] **Step 1: Write failing append/invalidation tests**

Add tests proving:

```csharp
Invalidated_daily_disposition_is_retained_and_new_decision_gets_new_id()
Invalidated_weekly_disposition_is_retained_and_new_decision_gets_new_id()
Current_batch_projection_ignores_invalidated_dispositions()
Model_has_at_most_one_active_daily_and_weekly_disposition_fence()
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationServiceTests|FullyQualifiedName~ReconciliationDailyPersistenceModelTests"
```

Expected: FAIL because weekly invalidation and appendable relationships do not exist.

- [ ] **Step 3: Extend entity/migration mapping**

Use the repository’s generated-nullable-key pattern: active owner key equals daily/weekly line ID only while `InvalidatedAt IS NULL`; unique index enforces at most one active record. Keep historical rows unrestricted and all FKs `Restrict`.

- [ ] **Step 4: Make decision commands active-row aware**

Query `InvalidatedAt == null`. Append a new row after prior invalidation; update the active row only for an explicit correction with matching expected version. Never clear invalidation fields on an old record.

- [ ] **Step 5: Update every current projection/completion query**

Filter active dispositions explicitly. Historical/audit paths must not filter them out.

- [ ] **Step 6: Run focused tests**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationServiceTests|FullyQualifiedName~ReconciliationDailyPersistenceModelTests|FullyQualifiedName~ReconciliationDashboardAndReportsTests"
```

Expected: PASS and no `SingleOrDefault` ambiguity with historical rows.

- [ ] **Step 7: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Models/Entities/ReconciliationDailyDisposition.cs backend/src/IPCManagement.Api/Models/Entities/ReconciliationDisposition.cs backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchDailyLine.cs backend/src/IPCManagement.Api/Features/Reconciliation backend/src/IPCManagement.Api/Migrations backend/tests/IPCManagement.Api.Tests
git commit -m "fix(mrx): preserve disposition decision history"
```

### Task 5: Replace Every Destructive Disposition Mutation

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Inventory/Services/ReconciliationInventoryIssueCreator.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReturnService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationActualService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxBatchRecomputer.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/Phase30WarehouseReturnFamilyTests.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/MrxBatchRecomputerTests.cs`

**Interfaces:**
- Consumes Task 4 invalidation fields/fences.
- Produces one shared internal helper only if at least three real callers use the exact same stamp contract; otherwise keep local stamping explicit.

- [ ] **Step 1: Extend strongest mutation tests**

Assert supplemental issue, received return, actual correction and source revision each retain the old disposition with invalidation actor/time/reason and leave no active stale decision.

- [ ] **Step 2: Run tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationWarehouseIssueApplicationPathTests|FullyQualifiedName~Phase30WarehouseReturnFamilyTests|FullyQualifiedName~MrxBatchRecomputerTests|FullyQualifiedName~ReconciliationServiceTests"
```

Expected: FAIL because three paths call `Remove`.

- [ ] **Step 3: Replace deletion with atomic invalidation stamps**

Use the mutation actor/time/correlation and exact reason. Ensure invalidation occurs in the same protected transaction as the supplemental issue, received return, correction or source revision.

- [ ] **Step 4: Prove no destructive call remains**

Run:

```bash
rg -n "Reconciliationdispositions\.Remove|Reconciliationdailydispositions\.Remove|Reconciliationbatchcontributors\.Remove" backend/src/IPCManagement.Api
```

Expected: no matches in production code.

- [ ] **Step 5: Run mutation/concurrency suites**

Use the command from Step 2 plus:

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxSourceChangeApplierTests|FullyQualifiedName~ReconciliationActualsControllerTests"
```

Expected: PASS; stale decisions cannot survive linked quantity changes.

- [ ] **Step 6: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Inventory/Services/ReconciliationInventoryIssueCreator.cs backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryReturnService.cs backend/src/IPCManagement.Api/Features/Reconciliation/Services backend/tests/IPCManagement.Api.Tests
git commit -m "fix(mrx): invalidate decisions without deletion"
```

### Task 6: Phase 1 Documentation and Verification Gate

**Files:**
- Modify: `docs/DOMAIN.md`
- Modify: `docs/domain/material-reconciliation.md`
- Modify: `docs/FLOWS.md` only if the observable decision/source flow changed
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes all Phase 1 contracts.
- Produces stable documentation authority for Phase 2 audit/retention work.

- [ ] **Step 1: Update canonical domain owners**

Document canonical net-issued authority, non-zero completed variance, contributor/disposition append-only validity and active-versus-history read semantics. Do not duplicate task evidence into DOMAIN.

- [ ] **Step 2: Run migration/model checks without applying to the main DB**

```bash
dotnet ef migrations list --project backend/src/IPCManagement.Api --startup-project backend/src/IPCManagement.Api
npm run test:architecture-growth
npm run check:architecture-growth
```

Expected: migration discoverable; architecture gates PASS without baseline growth.

- [ ] **Step 3: Run Phase 1 Backend verification**

```bash
dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj -c Release --no-restore
dotnet test backend/tests/IPCManagement.Application.Tests/IPCManagement.Application.Tests.csproj --no-restore
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter "FullyQualifiedName~Reconciliation|FullyQualifiedName~Mrx"
```

Expected: PASS; report exact executed/skipped counts.

- [ ] **Step 4: Run authorized disposable MySQL migration/concurrency lane**

Only with explicit DB authorization and `IPC_TEST_CONNECTION_STRING` pointing to a disposable target:

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~IPCManagement.Api.Tests.Integration"
```

Expected: active-row fences and concurrent decisions PASS. Otherwise mark `BLOCKED`, never fake PASS.

- [ ] **Step 5: Run mandatory review gates and update WORK**

Use `ipc-test-audit` and `ipc-code-review`. Record:

```text
Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact
```

Mark Phase 1 `PASS`, `FAIL`, `NEEDS_EVIDENCE` or `BLOCKED` by criterion.

- [ ] **Step 6: Commit if authorized**

```bash
git add docs/DOMAIN.md docs/domain/material-reconciliation.md docs/FLOWS.md .planning/WORK.md
git commit -m "docs(mrx): define ledger and history authority"
```
