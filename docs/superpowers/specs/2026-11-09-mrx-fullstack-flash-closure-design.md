# Full-Stack MRX Flash & Multi-Render Waterfall Closure — Design Specification (`K1`–`K6`)

- **Date:** `2026-11-09`
- **Status:** `APPROVED FOR INLINE EXECUTION`
- **Mode Isolation (`DOM-MODE-1`):** `MATERIAL_RECONCILIATION` (`MRX`) & shared workbench primitives; zero cross-contamination with `DEFAULT` business workflows.
- **FR / NFR Mapping:** `FR-RECON`, `FR-MENU`, `FR-WH`, `FR-CHEF`, `FR-CAT`, `FR-ADMIN`, `FR-DASH`, `NFR-UI-STABILITY`

---

## 1. Problem Statement & Root-Cause Summary

Even after CSS box-model stabilization (`I1`–`I10` and `J1`–`J6`), users still perceive subtle flashes, multi-frame jitter, and seam jumps across MRX routes when switching customers, dates, tabs, or filters. A full-stack (Frontend + Backend) root-cause audit (`K1`–`K6`) identified **6 structural causes**:

1. **`K1` (`/weekly-menu?view=mrx-batch` Macrotask Delay & Missing Render-Phase Warm-Cache Sync in `useMrxSourceEdit`):**
   - [`useMrxSourceEdit.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/weekly-menu/hooks/useMrxSourceEdit.ts#L33-L117) only reads `serverStateCache` inside `useState(() => ...)` on initial mount (`L33-35`). When switching back to a previously visited customer or week, it does not synchronously hydrate from `serverStateCache` during render, and wraps `void load()` in `window.setTimeout(..., 0)` (`L109`), adding an extra macrotask tick after `batchQuery` finishes.
2. **`K2` (`/reconciliation` Two-Stage Customer/Date Switch Waterfall & Backend Duplicate Ledger Queries in `ReconciliationBatchService.cs`):**
   - **Frontend:** In [`useReconciliationWorkspace.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts#L228-L325), switching to an uncached customer resolves `getBatchPage` first and immediately commits `setBatches`, `setBatchId(selected)`, and `setServiceDate(nextServiceDate)` before `getBatchSummary(selected, nextServiceDate)` starts, creating a 2-stage render waterfall where the header shows Customer B while the table shows Customer A. Additionally, switching between already-visited dates (`handleSelectDate`) does not synchronously hydrate `reconCacheKey` (`mrx_recon_${batchId}_${serviceDate}`) during render.
   - **Backend:** In [`ReconciliationBatchService.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs#L65-L125) (`GetWarehouseDailyManyCoreAsync`), `Inventoryissuelines` and `Inventoryreturnlines` are queried **twice** per call: once inside `ReconciliationNetIssueProjection.LoadByDailyLineIdsAsync(dailyLineIds, token)` and a second time immediately below (`L99-112`) to compute `latestReturnByDailyId` and `issueRows`!
3. **`K3` (`<StateBoundary isEmpty>` Unmounting `<DataGrid>` Sticky `<thead>` Seam Below `<LocalFindBar>`):**
   - In [`ReconciliationVariancesBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/branches/ReconciliationVariancesBranch.tsx#L102), [`AdminBomBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/branches/AdminBomBranch.tsx#L271), and [`AdminCustomersBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/branches/AdminCustomersBranch.tsx#L199), when a filter or report returns `0` rows (`report.rows.length === 0`, `filteredDishes.length === 0`, or `isFilterEmpty`), `<StateBoundary isEmpty={true}>` unmounts `<DataGrid>` and its sticky `<thead>` right below `<LocalFindBar>`, causing the table header seam to vanish and pop back in when filters change.
4. **`K4` (`/weekly-menu?view=mrx-materials` & `mrx-plans` Two-Hop Version-Before-Rows Waterfall):**
   - In [`useMrxQuantityInspection.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts#L22-L65), `sourceQuery` resolves `src.menuVersionId` on Render #2 (updating `Phiên bản: X` in the subbar while the table still shows the previous customer/week's rows), and only starts fetching `getMaterialInspection` / `getPlanInspection` on Render #2 (resolving on Render #3).
5. **`K5` (`ReconciliationBlockerStrip`, `MrxSourceEditGrid`, and `MrxCookingDishListBranch` Seam & Height Shifts):**
   - [`ReconciliationBlockerStrip.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/ReconciliationBlockerStrip.tsx#L18-L54) changes height between `!isBlocked` (`py-2.5` = `36px`) and `isBlocked` (`py-2` + `<Button size="xs">` + wrapping text = `44px`–`56px`).
   - [`MrxSourceEditGrid.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/weekly-menu/MrxSourceEditGrid.tsx#L58-L69) conditionally mounts a block `<div className="mb-2 flex justify-end">` above `<table>` when `mode === 'dish-edit' && expandedSlots.length > 0`, pushing the sticky `<thead>` down by `32px`.
   - [`MrxCookingDishListBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx#L79-L90) uses `bg-slate-50` in `<thead>` instead of `bg-slate-100 border-b border-slate-200` and includes `transition-colors` on `<tr>`.
6. **`K6` (Missing Render-Phase Warm-Cache Hydration in `useReconciliationReports` & `ReconciliationDashboardPage`):**
   - [`useReconciliationReports.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/useReconciliationReports.ts#L42-L91) and [`ReconciliationDashboardPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/dashboard/ReconciliationDashboardPage.tsx#L82-L111) wait for an async `useEffect` microtask even when `serverStateCache.get(cacheKey)` already holds fresh data, causing a 2-render flash (`refreshing = true` on `/`) on every warm tab/filter switch.

---

## 2. Acceptance Criteria (`AC-K1` to `AC-K6`)

- **`AC-K1` (`useMrxSourceEdit` Zero-Tick Warm Hydration & Microtask Cold Load):**
  - Switching back to a cached customer/week on `/weekly-menu?view=mrx-batch` hydrates `editScope` synchronously during render (`0` extra renders).
  - Cold customer/week switches invoke `void load()` immediately without a `window.setTimeout(..., 0)` macrotask delay once `isParentTransitioning` clears, while keeping `getEditScope` call count at `1` per scope change.
- **`AC-K2` (`/reconciliation` Atomic Customer/Date Switch & Backend Single-Pass Ledger Projection):**
  - Switching between warm dates or batches on `/reconciliation` hydrates `storedData` and `loadedScope` synchronously during render (`0` frames of `isPreviousData`).
  - Switching to an uncached customer on `/reconciliation` (when `activeReportTab === 'lines'`) prefetches `getBatchSummary(selected, nextServiceDate)` inside the `getBatchPage` promise chain before committing `setBatches`, `setBatchId`, `setServiceDate`, and `setData`, collapsing the 2-stage waterfall into 1 atomic commit.
  - `ReconciliationBatchService.GetWarehouseDailyManyCoreAsync` computes `ledgerByDailyLine` directly from the single `Inventoryissuelines` and `Inventoryreturnlines` query pair without calling `ReconciliationNetIssueProjection.LoadByDailyLineIdsAsync` a second time.
- **`AC-K3` (Persistent `<DataGrid>` Sticky `<thead>` Seam on Empty States):**
  - `ReconciliationVariancesBranch`, `AdminBomBranch` (when `dishes.length > 0 && filteredDishes.length === 0`), and `AdminCustomersBranch` (when `isFilterEmpty`) keep `<DataGrid>` mounted (`tableCount = 1`) and render their empty state inside `<DataGrid emptyState={...} />`.
- **`AC-K4` (`/weekly-menu?view=mrx-materials|mrx-plans` Single-Commit Source + Inspection Resolution):**
  - `useMrxQuantityInspection` pre-populates the `mrx_inspection_...` cache entry inside `sourceQuery.queryFn` when `src` is `PUBLISHED` or `ACTIVE`, so `source` and `inspection.data` update in the exact same React render commit.
- **`AC-K5` (Locked Strip Height, Inline Grid Action, and Solid Table Header Seam):**
  - `ReconciliationBlockerStrip` maintains a constant `h-11` (`44px`) height with `whitespace-nowrap overflow-x-auto no-scrollbar` in both blocked and unblocked states.
  - `MrxSourceEditGrid` renders `"Hoàn tất sửa từng dòng"` inline inside the first sticky `<th>` header cell instead of mounting a block `<div>` above `<table>`.
  - `MrxCookingDishListBranch` uses `bg-slate-100 border-b border-slate-200` on `<thead>` and removes `transition-colors` on `<tr>`.
- **`AC-K6` (Synchronous Warm-Cache Hydration in `useReconciliationReports` & `ReconciliationDashboardPage`):**
  - `useReconciliationReports` and `ReconciliationDashboardPage` synchronously hydrate fresh `serverStateCache` entries during render so warm tab/filter switches complete in 1 render with `loading: false` and `refreshing: false`.
