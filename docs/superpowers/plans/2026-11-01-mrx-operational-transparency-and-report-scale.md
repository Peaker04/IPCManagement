# MRX Operational Transparency and Report Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make automatic MRX stock provisioning durably visible and make transaction history correct and bounded over five years of data.

**Architecture:** Bind MRX provision ADJUSTMENT movements to the exact issue ID, expose those durable movements through generated API contracts and existing Warehouse surfaces, and refactor transaction history into a server-filtered paged query with full-filter CSV export. Add only indexes justified by the final SQL/query plan.

**Tech Stack:** ASP.NET Core 9, C# 13, EF Core 9/Pomelo, MySQL, React 19, TypeScript 6, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-01-mrx-data-integrity-and-five-year-retention-design.md`

## Global Constraints

- Phase 1 and Phase 2 plans must be complete before execution.
- Provisioning remains canonical `StockMovement` type `ADJUSTMENT`; no fake receipt, direct current-stock write or second ledger.
- Provision metadata is shown only when a persisted movement is linked to the exact MRX issue.
- No Purchasing action or workflow is added to MRX.
- `batchId`, `fromDate`, `toDate`, `pageNumber` and `pageSize` must be applied server-side before materialization.
- Table pagination must not truncate CSV; CSV exports the full filtered scope.
- Reuse existing UI primitives/tokens; no new dependency, duplicate component or inline/ad-hoc styling token.
- Preserve RBAC, mode/version fences, command replay and `DOM-MODE-1`.
- Do not apply migration to `ipcmanagement`; query-plan/MySQL verification needs a separately authorized disposable target.
- Generated API files are regenerated through `npm run gen:api`, never hand-edited.
- Commit steps require explicit Owner authorization at execution; otherwise record `NOT_RUN`.

## Review Focus

- Idempotent replay returns the same persisted provision metadata rather than an empty transient result — pinned in Task 2.
- A normal MRX issue with sufficient stock shows no provision badge — pinned in Tasks 2–4.
- A provision movement for another issue/batch cannot leak into detail — pinned in Task 1.
- A date window crossing year boundaries is inclusive and executed before paging — pinned in Task 5.
- CSV exports every filtered row while the table returns only the requested page — pinned in Task 5.

---

### Task 1: Durable Issue-Level Provision Query

**Files:**
- Create: `backend/src/IPCManagement.Api/Features/Inventory/Services/MrxIssueProvisionQuery.cs`
- Create: `backend/tests/IPCManagement.Api.Tests/MrxIssueProvisionQueryTests.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Inventory/Services/ReconciliationInventoryIssueCreator.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs`

**Interfaces:**
- Provision movement identity: `MovementType == "ADJUSTMENT"`, canonical `RefTable == "inventoryissues"`, `RefId == issueId`, and MRX provision reason/note.
- Produces: `MrxIssueProvisionQuery.GetByIssueIdAsync(byte[] issueId, CancellationToken token)` returning persisted provision facts.
- Produces: `MrxStockProvisionFact(byte[] MovementId, byte[] IngredientId, byte[] UnitId, decimal Quantity)`.

- [ ] **Step 1: Write failing durable-lineage tests**

Add tests:

```csharp
Provision_query_returns_only_adjustments_linked_to_exact_issue()
Provision_query_excludes_issue_movements_and_unrelated_adjustments()
Reconciliation_issue_persists_provision_reference_to_issue_id()
Sufficient_stock_creates_no_provision_fact()
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MrxIssueProvisionQueryTests|FullyQualifiedName~ReconciliationWarehouseIssueApplicationPathTests"
```

Expected: FAIL because adjustments currently reference the batch and no query exists.

- [ ] **Step 3: Implement exact issue linkage**

Use the already allocated issue ID when calling `AddStockAsync`; set `RefTable/RefId` to the issue identity and keep batch ID in the note. Do not alter ISSUE movement ownership.

- [ ] **Step 4: Implement bounded provision query**

Read only exact issue-linked ADJUSTMENT rows and return persisted facts. Do not classify arbitrary adjustments by free text alone.

- [ ] **Step 5: Run focused tests**

Use Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Inventory/Services/MrxIssueProvisionQuery.cs backend/src/IPCManagement.Api/Features/Inventory/Services/ReconciliationInventoryIssueCreator.cs backend/tests/IPCManagement.Api.Tests/MrxIssueProvisionQueryTests.cs backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs
git commit -m "fix(mrx): bind stock provision to issue"
```

### Task 2: Provision API Contracts and Idempotent Replay

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Inventory/Services/InventoryIssueService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Inventory/Services/ReconciliationInventoryIssueCreator.cs`
- Modify: `backend/src/IPCManagement.Api/Helpers/Mappers/InventoryMapper.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/InventoryIssueServiceTests.cs`

**Interfaces:**
- Produces public `MrxStockProvisionDto` with `StockMovementId`, `IngredientId`, `UnitId`, `UnitName`, `ProvisionedQuantity`.
- `InventoryIssueCreatedDto.Provisions` and `InventoryIssueDto.Provisions` default to empty collections.
- DEFAULT issue DTOs keep empty provisions.

- [ ] **Step 1: Add failing create/detail/replay tests**

Assert shortage issue creation returns one persisted provision, `GetByIdAsync(..., MATERIAL_RECONCILIATION)` returns the same movement ID/quantity, command replay returns identical metadata, and sufficient-stock/DEFAULT issues return empty collections.

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationWarehouseIssueApplicationPathTests|FullyQualifiedName~InventoryIssueServiceTests"
```

Expected: FAIL because DTOs lack provision metadata.

- [ ] **Step 3: Add DTOs and durable mapping**

Query Task 1 facts after persistence and when loading detail. Build the command receipt response from those persisted facts before serialization, so replay is stable.

- [ ] **Step 4: Run focused tests**

Use Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Inventory backend/tests/IPCManagement.Api.Tests/ReconciliationWarehouseIssueApplicationPathTests.cs backend/tests/IPCManagement.Api.Tests/InventoryIssueServiceTests.cs
git commit -m "feat(mrx): expose durable stock provisions"
```

### Task 3: Regenerate and Verify API Contracts

**Files:**
- Modify generated: `frontend/src/shared/api/contracts/openapi.json`
- Modify generated: `frontend/src/shared/api/contracts/schema.ts`
- Modify: `frontend/src/api/mrxApi.ts` only if generated aliases need no additional handwritten type
- Modify: `frontend/src/__tests__/ApiContracts.test.ts`

**Interfaces:**
- Consumes Task 2 public DTOs.
- Produces generated `MrxStockProvisionDto`, `InventoryIssueCreatedDto.provisions`, `InventoryIssueDto.provisions` types used by Tasks 4–5.

- [ ] **Step 1: Add failing generated-contract assertions**

Assert generated schema contains required readonly provision fields and both issue DTO collections.

- [ ] **Step 2: Run contract test and confirm RED**

```bash
npm run test:unit -w frontend -- src/__tests__/ApiContracts.test.ts
```

Expected: FAIL before regeneration.

- [ ] **Step 3: Regenerate through the authorized owner command**

```bash
npm run gen:api
```

Inspect diff; do not hand-edit generated files.

- [ ] **Step 4: Run parity checks**

```bash
npm run test:unit -w frontend -- src/__tests__/ApiContracts.test.ts
npm run gen:api
```

Confirm a second `npm run gen:api` leaves generated hashes unchanged. Run `npm run check:api-contract` only after the generated baseline is committed.

Expected: generated types are stable and contract tests pass.

- [ ] **Step 5: Commit if authorized**

```bash
git add frontend/src/shared/api/contracts frontend/src/api/mrxApi.ts frontend/src/__tests__/ApiContracts.test.ts
git commit -m "chore(api): generate MRX provision contracts"
```

### Task 4: Warehouse Provision Visibility

**Files:**
- Modify: `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Modify: `frontend/src/components/workbench/ReconciliationIssueDetailModal.tsx`
- Modify: `frontend/src/__tests__/Warehouse.test.tsx`
- Modify: `frontend/src/__tests__/Reconciliation.test.tsx` only if shared detail behavior is already owned there

**Interfaces:**
- Consumes generated `provisions` from Task 3.
- Produces post-create non-blocking notice and per-line detail badge `Đã tự động bù tồn kho: +X <unit>`.

- [ ] **Step 1: Emit the mandatory Scoped Pre-Code UI Gate Block**

Record in `.planning/WORK.md` before editing TSX:

```markdown
### Scoped Pre-Code UI Gate Block
- Route: /warehouse?view=mrx-daily and shared reconciliation issue detail
- Single Primary Work Object: OperationalFrame
- Server Mode: MATERIAL_RECONCILIATION (DOM-MODE-1)
- RBAC Guards: existing Warehouse route/action permissions
- 6 UI States: loading | empty | error | permission-denied | partial | write-reconciliation
- Primitives & Composites: Button, Badge, InlineBanner, Num, Modal, DataGrid
- Compliance Pledges: D6, D7, T7, T8, M1.2, N6
```

- [ ] **Step 2: Write failing UI tests**

Assert:

```text
shortage issue success renders provision notice with quantity/unit
sufficient-stock issue renders no provision notice
issue detail reload renders per-ingredient provision badge from API detail
unrelated provision is absent
```

Use generated DTO-shaped API fixtures; do not mock the component/hook under test.

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx src/__tests__/Reconciliation.test.tsx
```

Expected: FAIL on missing notice/badge.

- [ ] **Step 4: Implement minimal existing-owner UI**

Retain the create result in workspace mutation feedback until authoritative reload. Render `InlineBanner` after success only when provisions exist. In detail, match by ingredient/unit and render `Badge` plus `Num`; no inline styles or new tokens.

- [ ] **Step 5: Run focused UI/lint tests**

```bash
npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx src/__tests__/Reconciliation.test.tsx
npm run lint -w frontend -- src/features/warehouse/hooks/useMrxDailyWorkspace.ts src/features/warehouse/MrxDailyIssueWorkbench.tsx src/components/workbench/ReconciliationIssueDetailModal.tsx
```

Expected: PASS with zero diagnostics.

- [ ] **Step 6: Commit if authorized**

```bash
git add frontend/src/features/warehouse frontend/src/components/workbench/ReconciliationIssueDetailModal.tsx frontend/src/__tests__ .planning/WORK.md
git commit -m "feat(mrx): show automatic stock provision"
```

### Task 5: Server-Filtered Paged Transaction History and Full CSV

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`

**Interfaces:**
- Produces `GetTransactionsHistoryAsync(string? batchId, DateOnly? fromDate, DateOnly? toDate, PagedRequestDto page, CancellationToken token)` returning `PagedResponseDto<MrxTransactionHistoryRowDto>`.
- Produces `GetTransactionsHistoryExportAsync(string? batchId, DateOnly? fromDate, DateOnly? toDate, CancellationToken token)` returning the full filtered row sequence for CSV.
- Validates inclusive dates and page bounds through existing request policies.

- [ ] **Step 1: Add failing filter/page/CSV tests**

Add tests:

```csharp
TransactionsHistory_applies_inclusive_date_and_batch_filters_before_paging()
TransactionsHistory_returns_canonical_page_metadata()
TransactionsHistory_rejects_reversed_date_window()
TransactionsHistory_csv_exports_full_filtered_scope_not_current_page()
TransactionsHistory_query_count_and_materialization_are_bounded()
```

Seed rows before/on/after boundaries and another batch. Page size 1 must return one item and correct total; CSV must contain all in-window rows only.

- [ ] **Step 2: Run report tests and confirm RED**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationDashboardAndReportsTests"
```

Expected: FAIL because dates are ignored and all rows materialize.

- [ ] **Step 3: Compose one filtered union query**

Project issue and return rows to the common DTO shape in SQL-compatible queries, apply mode/batch/date filters before materialization, order deterministically by `CreatedAt` then document/line identity, count, then page.

- [ ] **Step 4: Add full filtered CSV path**

Reuse filter/query semantics without `Skip/Take`. Use bounded streaming/chunking if the existing response model cannot safely hold the expected export size; do not export the current page as full history.

- [ ] **Step 5: Run focused tests**

Use Step 2 command. Expected: PASS including cross-year inclusive window.

- [ ] **Step 6: Commit if authorized**

```bash
git add backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationContracts.cs backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationReportsService.cs backend/src/IPCManagement.Api/Features/Reconciliation/Controllers/ReconciliationReportsController.cs backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs
git commit -m "fix(mrx): page filtered transaction history"
```

### Task 6: Transaction-History Frontend Pagination

**Files:**
- Regenerate: `frontend/src/shared/api/contracts/openapi.json`
- Regenerate: `frontend/src/shared/api/contracts/schema.ts`
- Modify: `frontend/src/api/mrxApi.ts`
- Modify: `frontend/src/features/reconciliation/useReconciliationReports.ts`
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationTransactionsBranch.tsx`
- Modify: `frontend/src/__tests__/Reconciliation.test.tsx`
- Modify: `frontend/src/__tests__/ApiContracts.test.ts`

**Interfaces:**
- Consumes Task 5 paged response.
- Produces `mrxApi.getTransactionsHistory({ batchId, fromDate, toDate, pageNumber, pageSize })` returning generated `MrxTransactionHistoryRowDtoPagedResponseDto`.
- UI uses page size 25 and existing pagination control pattern; filter changes reset page to 1.

- [ ] **Step 1: Extend the UI gate block for `/reconciliation`**

Record the route/work-object, MRX mode, Manager/Admin guards, six states and existing `DataGrid`/pagination primitives before TSX edits.

- [ ] **Step 2: Write failing API/page tests**

Assert exact query parameters, page metadata preservation, next/previous navigation, page reset after filter change, and retained loaded rows during refresh.

- [ ] **Step 3: Run focused tests and confirm RED**

```bash
npm run test:unit -w frontend -- src/__tests__/ApiContracts.test.ts src/__tests__/Reconciliation.test.tsx
```

Expected: FAIL on old unpaged contract.

- [ ] **Step 4: Regenerate API and implement minimal pagination**

Run `npm run gen:api`, update the API adapter and report hook, then render existing accessible previous/next controls. Keep CSV request independent of page.

- [ ] **Step 5: Run focused/static verification**

```bash
npm run test:unit -w frontend -- src/__tests__/ApiContracts.test.ts src/__tests__/Reconciliation.test.tsx
npm run lint -w frontend
npm run depcruise -w frontend
npm run build -w frontend
npm run gen:api
```

Confirm a second generation leaves hashes unchanged; after an authorized generated-contract commit, run `npm run check:api-contract`.

Expected: PASS with zero lint/dependency violations.

- [ ] **Step 6: Commit if authorized**

```bash
git add frontend/src/shared/api/contracts frontend/src/api/mrxApi.ts frontend/src/features/reconciliation frontend/src/__tests__ .planning/WORK.md
git commit -m "feat(mrx): paginate transaction history"
```

### Task 7: Evidence-Based Query Indexes

**Files:**
- Create only if EXPLAIN proves need: `backend/src/IPCManagement.Api/Migrations/20261101110000_IndexMrxRetainedHistoryQueries.cs`
- Create only if needed: `backend/src/IPCManagement.Api/Migrations/20261101110000_IndexMrxRetainedHistoryQueries.Designer.cs`
- Modify only if needed: `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs`
- Modify: `backend/tests/IPCManagement.Api.Tests/ReconciliationDailyPersistenceModelTests.cs`

**Interfaces:**
- Consumes final Task 1/5 queries.
- Produces only indexes justified by authorized disposable-MySQL `EXPLAIN`; no speculative index bundle.

- [ ] **Step 1: Capture generated SQL and EXPLAIN on authorized disposable MySQL**

Measure batch/date transaction query, daily net projection, active contributor/disposition and typed audit scope at representative retained volume. Record plans in WORK, not a new state artifact.

- [ ] **Step 2: Decide whether migration is needed**

If existing indexes avoid full scans/filesort at the bounded scope, mark task `NOT_NEEDED` with evidence and create no migration. Otherwise add only the exact composite indexes supported by EXPLAIN.

- [ ] **Step 3: Add model-index tests before mapping changes**

Assert exact index property order/name for every justified index. Run and confirm RED.

- [ ] **Step 4: Add mapping/migration and rerun EXPLAIN**

Expected: intended index selected and result semantics unchanged.

- [ ] **Step 5: Run model/migration tests**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationDailyPersistenceModelTests|FullyQualifiedName~ReconciliationDashboardAndReportsTests"
```

Expected: PASS.

- [ ] **Step 6: Commit if authorized and needed**

```bash
git add backend/src/IPCManagement.Api/Features/Reconciliation/Persistence backend/src/IPCManagement.Api/Migrations backend/tests/IPCManagement.Api.Tests/ReconciliationDailyPersistenceModelTests.cs
git commit -m "perf(mrx): index retained history queries"
```

### Task 8: End-to-End Consistency and Final Closure

**Files:**
- Modify: `frontend/tests/e2e-mrx/specs/g1-golden-path.spec.ts` or the existing strongest issue→completion owner
- Modify: `frontend/tests/e2e-mrx/core/mysqlVerifier.ts`
- Modify: `docs/domain/material-reconciliation.md`
- Modify: `docs/FLOWS.md`
- Modify: `.planning/WORK.md`

**Interfaces:**
- Consumes every phase contract.
- Produces persisted public-flow evidence: provision → issue detail → reconciliation → completion/report.

- [ ] **Step 1: Extend one permanent sandbox E2E owner**

Through public UI/API on `ipc_mrx_e2e_sandbox`, create an issue that requires declared MRX provision, assert the amber notice, reload detail and assert the same quantity/movement identity, then verify Warehouse daily, variance/completed reports and DB net ledger agree.

- [ ] **Step 2: Add DB oracles without direct mutation**

`mysqlVerifier` may read exact issue-linked ADJUSTMENT and ISSUE movements, batch/daily lines and report facts. Fixture bootstrap remains the only authorized synthetic setup; behavior after import uses public seams.

- [ ] **Step 3: Run focused Backend/Frontend gates**

```bash
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~Reconciliation|FullyQualifiedName~InventoryIssue"
npm run test:unit -w frontend -- src/__tests__/Warehouse.test.tsx src/__tests__/Reconciliation.test.tsx src/__tests__/ApiContracts.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run aggregate verification**

```bash
npm run verify
git diff --check
```

Expected: PASS; report exact skips/warnings without lowering gates. If generated contracts were committed under authorization, also run `npm run check:api-contract`; otherwise verify repeat-generation hash stability and retain the intentional generated diff.

- [ ] **Step 5: Run permanent MRX sandbox E2E**

```bash
npm run test:e2e:mrx:g1
```

Expected: PASS, residual test customers `0`, ports stopped, sandbox dropped. Never target `ipcmanagement`.

- [ ] **Step 6: Run mandatory reviews**

Use `ipc-test-audit`, `ipc-ui-review` and `ipc-code-review`. Report each in the mandated semicolon format. Provider/archive runtime remains independently `NEEDS_EVIDENCE` unless separately authorized and proven.

- [ ] **Step 7: Update canonical docs and WORK**

Document durable provision visibility, paged transaction history, CSV scope and final PASS/FAIL/NEEDS_EVIDENCE/BLOCKED matrix. Return lifecycle to `IDLE` only after all in-scope gates close.

- [ ] **Step 8: Commit if authorized**

```bash
git add frontend/tests/e2e-mrx docs .planning/WORK.md
git commit -m "test(mrx): verify retained ledger consistency"
```
