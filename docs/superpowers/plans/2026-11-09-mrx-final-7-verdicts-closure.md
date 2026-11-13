# MRX Final 7-Verdict Closure (`N1–N7`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the remaining 7 MRX audit findings (`N1–N7`), including the sticky `isLoading`/`inert` lock on `/reconciliation` report tabs when switching batches or cross-week dates (`N1`), cross-report-tab `<WorkbenchSkeleton>` unmount flashes (`N2`), shift-button box-model shifts in `MrxBatchDishesModal` (`N3`), missing shared `mrx_batch_dishes_` cache in `MrxSupplementalIssueModal` (`N4`), empty-customer warm switch loading flashes (`N5`), `'history'` tab skeleton unmounts on `/warehouse?view=mrx-daily` (`N6`), and redundant revision metadata SQL queries in `ReconciliationBatchService.GetAsync` (`N7`).

**Architecture:** Fix the `isLoading` state machine and warm empty-batch fast path in `useReconciliationWorkspace.ts`, widen `previous` retention in `useReconciliationReports.ts` and `ReconciliationReportTables.tsx` across sibling report tabs within the same `userModeScope`, lock `border` and `font-semibold` on `MrxBatchDishesModal` shift filter buttons, share `mrx_batch_dishes_${activeBatchId}` via `serverStateCache` in `MrxSupplementalIssueModal`, keep `StateBoundary` mounted on `/warehouse?view=mrx-daily` when `daily` is loaded and `activeTab === 'history'`, and pass `includeMetadata: false` inside `ReconciliationBatchService.GetAsync`.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vitest + React Testing Library, .NET 8, Entity Framework Core, xUnit.

**Spec:** [`docs/superpowers/specs/2026-11-09-mrx-final-7-verdicts-closure-design.md`](../specs/2026-11-09-mrx-final-7-verdicts-closure-design.md)

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): `DEFAULT != MATERIAL_RECONCILIATION`. All changes apply strictly to `MATERIAL_RECONCILIATION` (`MRX`) mode.
- Single Styling Authority: Zero ad-hoc CSS files or inline styles; use existing Tailwind tokens from `frontend/src/styles/index.css`.
- Anti-Tautology Test Gate (`TA-1` to `TA-5`): Tests must exercise real components/hooks/services with backend-grounded DTO fixtures and watch each test fail (`RED`) before implementing (`GREEN`).

## Review Focus

- Switching batches on `/reconciliation?view=variances` when the target batch has no cached `mrx_recon_*` summary must clear `isReportLoading` and `inert` as soon as `getVarianceRegister` resolves.
- Switching between `variances` and `transactions` on `/reconciliation` when `transactions` is cold must keep the `variances` `<DataGrid>` (`tableCount = 1`) mounted with `opacity-70` until `getTransactionsHistory` resolves.
- Opening `MrxSupplementalIssueModal` when `mrx_batch_dishes_${activeBatchId}` is already warm must render the `"Tính theo món ăn & suất phát sinh"` dish options immediately without calling `mrxApi.getBatchDishes`.
- Switching to `"Lịch sử phiếu"` on `/warehouse?view=mrx-daily` when `daily` is warm in `snapshot:mrx_daily` (without `history`) must keep `<DataGrid>` mounted (`tableCount = 1`) in `isPreviousData` state while `getIssues` resolves.
- Calling `ReconciliationBatchService.GetAsync` on a batch with daily lines and applied source revisions must still return identical `ReconciliationBatchDto` and `DailyReview` lines without executing revision metadata lookup for daily warehouse cards.

---

### Task 1: Close `N1`, `N2`, and `N5` on `/reconciliation` (`useReconciliationWorkspace.ts`, `useReconciliationReports.ts`, `ReconciliationReportTables.tsx`)

**Files:**
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:385-595`
- Modify: `frontend/src/features/reconciliation/useReconciliationReports.ts:38-97`
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx:54-106`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `serverStateCache.get<T>(key)`, `mrxApi.getVarianceRegister(batchId)`, `mrxApi.getTransactionsHistory(params)`
- Produces: Unstuck `isLoading`/`isReportLoading` across batch/date switches on report tabs (`N1`), retained report table DOM across cross-tab report switches (`N2`), and synchronous Frame-0 empty state on warm empty-customer switches (`N5`).

- [x] **Step 1: Write failing tests for `N1`, `N2`, and `N5` in `frontend/src/__tests__/Reconciliation.test.tsx`**
  - Add 3 tests to `frontend/src/__tests__/Reconciliation.test.tsx`:
    1. `clears isReportLoading and inert after switching batches on the variances report tab when target batch summary is uncached (N1)`
    2. `keeps the current report DataGrid mounted without flashing WorkbenchSkeleton when switching from variances to an uncached transactions tab (N2)`
    3. `transitions synchronously to empty state without loading flash when switching to a customer with warm empty mrx_batches_ cache (N5)`

- [x] **Step 2: Run Vitest on `Reconciliation.test.tsx` to verify RED**
  - Run: `npx vitest run src/__tests__/Reconciliation.test.tsx`
  - Expected: FAIL on the new `N1`, `N2`, and `N5` assertions.

- [x] **Step 3: Implement `N1`, `N2`, and `N5` in `useReconciliationWorkspace.ts`, `useReconciliationReports.ts`, and `ReconciliationReportTables.tsx`**
  - In `useReconciliationWorkspace.ts`:
    - Clear `setIsLoading(false)` and `setIsFetching(false)` when exiting early at `if (activeReportTab !== 'lines' && explicitBatchIdRef.current !== batchId)`.
    - In `handleSelectBatch` and `handleSelectDate`, only set `setIsLoading(true)` when `!cached && activeReportTab === 'lines'`; otherwise set `setIsLoading(false)`.
    - In `handleSelectCustomer`, add the `if (warmBatches && warmBatches.length === 0)` synchronous fast path before the cold fallback.
  - In `useReconciliationReports.ts`:
    - Introduce `const userModeScope = `mrx_report_${user?.userId}_${operationalMode}`;` and match `state?.tabScope.startsWith(userModeScope)` in `previous`.
  - In `ReconciliationReportTables.tsx`:
    - Compute `hasExactTabReport`, `fallbackTab`, `effectiveTab`, and `hasCurrentReport = hasExactTabReport || Boolean(isReportLoading && fallbackTab)`, and render `effectiveTab`'s branch inside `<LocalizedBoundary>`.

- [x] **Step 4: Run Vitest on `Reconciliation.test.tsx` to verify GREEN**
  - Run: `npx vitest run src/__tests__/Reconciliation.test.tsx`
  - Expected: PASS (`57/57` tests pass).

---

### Task 2: Close `N3`, `N4`, and `N6` on `/warehouse` & Modals (`MrxBatchDishesModal.tsx`, `MrxSupplementalIssueModal.tsx`, `MrxDailyIssueWorkbench.tsx`)

**Files:**
- Modify: `frontend/src/components/workbench/MrxBatchDishesModal.tsx:165-197`
- Modify: `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx:1-86`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx:373-385`
- Test: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Consumes: `serverStateCache.get<MrxBatchDishSummary[]>(`mrx_batch_dishes_${activeBatchId}`)`
- Produces: Zero box-model shift on `MrxBatchDishesModal` shift filter buttons (`N3`), shared warm dish cache in `MrxSupplementalIssueModal` (`N4`), and persistent `<DataGrid>` on `/warehouse?view=mrx-daily` when switching to `'history'` while `daily` is loaded (`N6`).

- [x] **Step 1: Write failing tests for `N3`, `N4`, and `N6` in `frontend/src/__tests__/Warehouse.test.tsx`**
  - Add 3 tests to `frontend/src/__tests__/Warehouse.test.tsx`:
    1. `locks border and font-semibold on MrxBatchDishesModal shift filter buttons across active and inactive states (N3)`
    2. `hydrates MrxSupplementalIssueModal synchronously from warm mrx_batch_dishes_ cache without refetching getBatchDishes (N4)`
    3. `keeps history DataGrid mounted in isPreviousData state without unmounting into WorkbenchSkeleton when switching to history tab while daily is warm in snapshot (N6)`

- [x] **Step 2: Run Vitest on `Warehouse.test.tsx` to verify RED**
  - Run: `npx vitest run src/__tests__/Warehouse.test.tsx`
  - Expected: FAIL on the new `N3`, `N4`, and `N6` assertions.

- [x] **Step 3: Implement `N3`, `N4`, and `N6` in `MrxBatchDishesModal.tsx`, `MrxSupplementalIssueModal.tsx`, and `MrxDailyIssueWorkbench.tsx`**
  - In `MrxBatchDishesModal.tsx`: lock `border` and `font-semibold` on all 3 shift filter buttons (`Tất cả`, `Sáng`, `Chiều`).
  - In `MrxSupplementalIssueModal.tsx`: hydrate `catalog` synchronously from `serverStateCache.get<MrxBatchDishSummary[]>(`mrx_batch_dishes_${activeBatchId}`)` and write `serverStateCache.set(`mrx_batch_dishes_${activeBatchId}`, items)` when `mrxApi.getBatchDishes` resolves.
  - In `MrxDailyIssueWorkbench.tsx`: pass `hasExistingData={Boolean(daily || history)}`, `isPreviousData={stateProps.isPreviousData || Boolean(activeTab === 'history' && !history && daily && !stateProps.error)}`, and `isLoading={stateProps.isLoading || Boolean(!stateProps.error && activeBatchId && !daily && !history)}` to `<StateBoundary>`.

- [x] **Step 4: Run Vitest on `Warehouse.test.tsx` to verify GREEN**
  - Run: `npx vitest run src/__tests__/Warehouse.test.tsx`
  - Expected: PASS (`55/55` tests pass).

---

### Task 3: Close `N7` in Backend `ReconciliationBatchService.GetAsync` & Run Full Verification

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs:250`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs`

**Interfaces:**
- Consumes: `GetWarehouseDailyManyCoreAsync(..., includeMetadata: false)`
- Produces: `ReconciliationBatchService.GetAsync` skips unused `ReconciliationWarehouseRevisionQuery.GetLatestByBatchAsync` queries while returning the exact same `ReconciliationBatchDto` and `DailyReview`.

- [x] **Step 1: Write a test in `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs` verifying `GetAsync` skips `Reconciliationsourcedeltas` / revision stamp queries while returning full `DailyReview` (`N7`)**
  - Add a test using a SQL command interceptor (like `GetVarianceRegisterAsync_DoesNotIncludeContributorsCartesianJoin_AndResolvesShiftDisplay`) that asserts `GetAsync` does not query `reconciliationsourcedeltas` while still returning accurate `DailyReview` lines.

- [x] **Step 2: Run `dotnet test` to verify RED**
  - Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationPreparationWorkbookTests"`
  - Expected: FAIL because `GetAsync` currently calls `GetWarehouseDailyManyCoreAsync` with `includeMetadata: true`, which queries `reconciliationsourcerevisions` / `reconciliationsourcedeltas`.

- [x] **Step 3: Pass `includeMetadata: false` at line 250 of `ReconciliationBatchService.cs`**
  - Update `GetAsync` in `ReconciliationBatchService.cs` to pass `includeMetadata: false` to `GetWarehouseDailyManyCoreAsync`.

- [x] **Step 4: Run Backend xUnit tests, full Frontend Vitest suite, ESLint, and Vite build to verify GREEN**
  - Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationPreparationWorkbookTests"`
  - Run: `npx vitest run src/__tests__/Reconciliation.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/Chef.test.tsx src/__tests__/MrxDashboard.test.tsx src/__tests__/AdminData.test.tsx src/__tests__/AdminBomBranch.test.tsx src/__tests__/AdminCustomersBranch.test.tsx src/__tests__/AdvancedSettings.test.tsx src/__tests__/Primitives.test.tsx src/__tests__/Render1CacheHitVerification.test.tsx`
  - Run: `npm run lint; npm run build`
  - Expected: All Backend and Frontend tests pass, `0` lint errors, and `vite build` succeeds.
