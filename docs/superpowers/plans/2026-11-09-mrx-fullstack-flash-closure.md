# Full-Stack MRX Flash & Multi-Render Waterfall Closure — Implementation Plan (`K1`–`K6`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and `superpowers:test-driven-development` (`RED -> GREEN -> REFACTOR`) to implement this plan task-by-task.

**Goal:** Eliminate all remaining multi-render waterfalls, warm-cache microtask flashes, sticky `<thead>` unmount seams, and redundant Backend SQL round-trips across all MRX routes (`K1`–`K6`).

**Architecture:**
1. **Frontend Render-Phase Warm-Cache Hydration & Atomic Prefetching (`K1`, `K2`, `K4`, `K6`):** Synchronously hydrate `serverStateCache` hits during render in `useMrxSourceEdit`, `useReconciliationWorkspace`, `useReconciliationReports`, and `ReconciliationDashboardPage`; chain dependent cold fetches (`getBatchPage -> getBatchSummary` in `useReconciliationWorkspace`, `getWeeklySource -> getMaterialInspection/getPlanInspection` in `useMrxQuantityInspection`) before committing state so parent and child scopes update atomically.
2. **Backend Single-Pass Daily Line Ledger Projection (`K2`):** In `ReconciliationBatchService.GetWarehouseDailyManyCoreAsync`, compute `ledgerByDailyLine` (`NetIssuedQuantity` and `ReceivedReturnQuantity`) from the `issueRows` and `returnRows` queries directly, eliminating duplicate `Inventoryissuelines` and `Inventoryreturnlines` round-trips.
3. **Frontend Seam & Box-Model Invariance (`K3`, `K5`):** Keep `<DataGrid>` mounted on empty filter/variance states via `emptyState`, lock `ReconciliationBlockerStrip` to `h-11`, place `"Hoàn tất sửa từng dòng"` inline inside `MrxSourceEditGrid`'s first sticky `<th>`, and align `MrxCookingDishListBranch` `<thead>` styling.

---

### Task 1: `K1`, `K4`, & `K5` (Part 1) — Weekly Menu (`mrx-batch`, `mrx-materials`, `mrx-plans`)

**Files:**
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts`
- Modify: `frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Steps:**
1. **RED:** Add regression tests in `frontend/src/__tests__/WeeklyMenu.test.tsx` verifying:
   - `MrxSourceEditGrid` renders `"Hoàn tất sửa từng dòng"` inside `<thead>` (`th`) without mounting a wrapper block above `<table>`.
   - `useMrxQuantityInspection` pre-populates inspection data in the same commit as `getWeeklySource` when switching customers/weeks.
2. **GREEN:**
   - Update `useMrxSourceEdit.ts` to synchronously hydrate from `serverStateCache` during render when `scopeKey` changes and remove `window.setTimeout(..., 0)` around `void load()`.
   - Update `MrxSourceEditGrid.tsx` to render `"Hoàn tất sửa từng dòng"` inline inside the first sticky `<th>` cell.
   - Update `useMrxQuantityInspection.ts` so `sourceQuery.queryFn` prefetches and caches `getMaterialInspection` / `getPlanInspection` when `src` is `PUBLISHED` or `ACTIVE`.
3. **VERIFY:** Run `npx vitest run src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx`.

---

### Task 2: `K2` & `K5` (Part 2) — `/reconciliation` Atomic Switch, Strip Height Lock & Backend Single-Pass Ledger Query

**Files:**
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`
- Modify: `frontend/src/features/reconciliation/ReconciliationBlockerStrip.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`
- Test: `backend/tests/IPCManagement.Api.Tests`

**Steps:**
1. **RED:** Add regression assertions in `frontend/src/__tests__/Reconciliation.test.tsx` verifying:
   - `ReconciliationBlockerStrip` keeps `h-11` (`44px`) in both blocked and unblocked states.
   - Warm date switches on `/reconciliation` synchronously hydrate cached `mrx_recon_${batchId}_${serviceDate}` without flashing `isPreviousData`.
2. **GREEN:**
   - In `ReconciliationBatchService.cs` (`GetWarehouseDailyManyCoreAsync`), unify `issueRows` and `returnRows` loading so `ledgerByDailyLine` and `latestReturnByDailyId` are computed in a single pass without calling `ReconciliationNetIssueProjection.LoadByDailyLineIdsAsync` a second time.
   - In `useReconciliationWorkspace.ts`, add render-phase warm-cache hydration when `reconCacheKey` changes, and prefetch `getBatchSummary(selected, nextServiceDate)` inside `getBatchPage.then` when switching to a customer whose batch is not yet cached.
   - In `ReconciliationBlockerStrip.tsx`, lock both branches to `h-11 px-4 text-xs font-medium border-b ... flex items-center justify-between gap-3 shrink-0 overflow-x-auto no-scrollbar whitespace-nowrap`.
3. **VERIFY:** Run `dotnet test backend/tests/IPCManagement.Api.Tests` and `npx vitest run src/__tests__/Reconciliation.test.tsx`.

---

### Task 3: `K3` — Persistent `<DataGrid>` Sticky `<thead>` Seam on Empty States (`ReconciliationVariancesBranch`, `AdminBomBranch`, `AdminCustomersBranch`)

**Files:**
- Modify: `frontend/src/features/reconciliation/branches/ReconciliationVariancesBranch.tsx`
- Modify: `frontend/src/features/admin/branches/AdminBomBranch.tsx`
- Modify: `frontend/src/features/admin/branches/AdminCustomersBranch.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`
- Test: `frontend/src/__tests__/AdminBomBranch.test.tsx`
- Test: `frontend/src/__tests__/AdminCustomersBranch.test.tsx`

**Steps:**
1. **RED:** Add regression assertions verifying `<table` remains mounted (`document.querySelectorAll('table').length >= 1`) when `ReconciliationVariancesBranch` has `0` rows or when `AdminBomBranch` / `AdminCustomersBranch` filter to `0` matching rows.
2. **GREEN:**
   - In `ReconciliationVariancesBranch.tsx`, set `isEmpty={false}` on `<StateBoundary>` and pass `emptyState` to `<DataGrid>` with `"Chưa ghi nhận chênh lệch xuất kho"` and `"Xem tiến độ xuất kho tại Rà soát dòng ngày."` (when `!query`).
   - In `AdminBomBranch.tsx`, when `dishes.length > 0 && filteredDishes.length === 0`, keep `isEmpty={false}` on `<StateBoundary>` and render the empty message + `<Button onClick={clearFilters}>Xóa bộ lọc (Xem tất cả)</Button>` inside `<DataGrid emptyState={...} />`.
   - In `AdminCustomersBranch.tsx`, when `isFilterEmpty` (`contracts.length > 0 && filteredContracts.length === 0`), keep `isEmpty={false}` on `<StateBoundary>` and render the empty message + `<Button onClick={() => setSearchTerm('')}>Xóa bộ lọc</Button>` inside `<DataGrid emptyState={...} />`.
3. **VERIFY:** Run `npx vitest run src/__tests__/Reconciliation.test.tsx src/__tests__/AdminBomBranch.test.tsx src/__tests__/AdminCustomersBranch.test.tsx src/__tests__/AdminData.test.tsx`.

---

### Task 4: `K5` (Part 3) & `K6` — `/chef`, `/`, and `useReconciliationReports` Warm-Cache Render Hydration

**Files:**
- Modify: `frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx`
- Modify: `frontend/src/features/reconciliation/useReconciliationReports.ts`
- Modify: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`
- Test: `frontend/src/__tests__/Chef.test.tsx`
- Test: `frontend/src/__tests__/MrxDashboard.test.tsx`

**Steps:**
1. **RED:** Add regression checks in `Chef.test.tsx` (`bg-slate-100 border-b border-slate-200` on `MrxCookingDishListBranch` `<thead>` and no `transition-colors` on `<tr>`) and `MrxDashboard.test.tsx` (warm cache switch does not set `refreshing = true`).
2. **GREEN:**
   - Update `MrxCookingDishListBranch.tsx` `<thead>` and `<tr>` classes.
   - Add synchronous render-phase warm-cache hydration in `useReconciliationReports.ts` and `ReconciliationDashboardPage.tsx`.
3. **VERIFY:** Run `npx vitest run src/__tests__/Chef.test.tsx src/__tests__/MrxDashboard.test.tsx src/__tests__/Reconciliation.test.tsx`.

---

### Task 5: Full-Suite Verification & `.planning/WORK.md` Closure

**Steps:**
1. Run Backend xUnit tests: `dotnet test backend/tests/IPCManagement.Api.Tests`.
2. Run Frontend contract & unit test suites, `npm run lint`, and `npm run build`.
3. Update `.planning/WORK.md` to `IDLE` with full verification evidence.
