# MRX Final 7-Verdict Closure (`N1–N7`) — Design Specification

- **Date:** 2026-11-09
- **Operational Mode Scope (`DOM-MODE-1`):** `MATERIAL_RECONCILIATION` (`MRX`) only (`DEFAULT != MATERIAL_RECONCILIATION`)
- **Affected Feature Codes:** `FR-RECON`, `FR-WH`
- **Affected Routes:** `/reconciliation`, `/warehouse?view=mrx-daily`

## 1. Problem Statement & Root Causes (`N1–N7`)

Following the comprehensive `/ponytail-audit` review across all 18 MRX Frontend route/view leaves and Backend services (after closing all 72 prior items `F1–M10`), 7 concrete issues (`N1–N7`) were identified:

1. **`N1` (Must fix — Sticky `isLoading = true` / `inert` UI Lock When Switching Batches or Cross-Week Dates on `/reconciliation` Report Tabs):**
   - In [`useReconciliationWorkspace.ts`](../../../frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts), `handleSelectBatch(nextId)` (line 547) and `handleSelectDate(date)` (line 587) call `if (!cached) setIsLoading(true)` unconditionally without updating `explicitBatchIdRef.current`.
   - When `activeReportTab !== 'lines'` (`'variances' | 'transactions' | 'audit'`), the `useEffect` that fetches `mrxApi.getBatchSummary` (line 387) exits early via `if (activeReportTab !== 'lines' && explicitBatchIdRef.current !== batchId) return;` without clearing `setIsLoading(false)`.
   - Because [`ReconciliationPage.tsx`](../../../frontend/src/features/reconciliation/ReconciliationPage.tsx) passes `isCatalogTransitioning: !hasBatchesLoaded || catalogLoading || isLoading` to `useReconciliationReports`, `isReportLoading` remains permanently stuck at `true`, leaving the report table dimmed (`opacity-70`) and non-interactive (`inert`) until the user switches back to the `'lines'` tab.

2. **`N2` (Should fix — `<WorkbenchSkeleton>` Unmount Flash on Cold Cross-Tab Switches Between Report Tabs on `/reconciliation`):**
   - In [`useReconciliationReports.ts`](../../../frontend/src/features/reconciliation/useReconciliationReports.ts), `baseTabScope` includes `${activeReportTab}` (`mrx_report_${user?.userId}_${operationalMode}_${activeReportTab}`).
   - In [`ReconciliationReportTables.tsx`](../../../frontend/src/features/reconciliation/ReconciliationReportTables.tsx), `hasCurrentReport` checks only the newly selected `activeTab`'s report data.
   - When switching between different report tabs (e.g., `'variances'` -> `'transactions'`, `'transactions'` -> `'audit'`, or `'audit'` -> `'completed'`) when the target tab is not yet cached, `hasCurrentReport` is `false` while `isReportLoading` is `true`, causing `<LocalizedBoundary isLoading={isReportLoading && !hasCurrentReport}>` to unmount the currently visible report branch into `<WorkbenchSkeleton>` instead of keeping the previous report branch mounted in `isTransitioning` (`opacity-70` + top 2px progressbar) until the new report resolves.

3. **`N3` (Should fix — `2px` Border & Font-Weight Box-Model Shift on Shift Filter Buttons in `MrxBatchDishesModal`):**
   - In [`MrxBatchDishesModal.tsx`](../../../frontend/src/components/workbench/MrxBatchDishesModal.tsx) (lines 166–196), the shift filter buttons (`Tất cả`, `Sáng`, `Chiều`) toggle between `'bg-slate-900 text-white font-bold'` (no border, bold font) when active and `'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'` (`1px` border, medium font) when inactive, causing a `2px` box-model and glyph-width shift on click.

4. **`N4` (Should fix — Missing Shared `mrx_batch_dishes_${activeBatchId}` Cache in `MrxSupplementalIssueModal`):**
   - In [`MrxSupplementalIssueModal.tsx`](../../../frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx) (lines 64–85), `catalog` state is initialized to `null` and always re-fetches `mrxApi.getBatchDishes(activeBatchId)` on open without reading or writing `serverStateCache.get<MrxBatchDishSummary[]>(`mrx_batch_dishes_${activeBatchId}`)` (which [`MrxBatchDishesModal.tsx`](../../../frontend/src/components/workbench/MrxBatchDishesModal.tsx) uses).

5. **`N5` (Should fix — Transient Loading State When Switching Customer to a Known-Empty Customer on `/reconciliation`):**
   - In [`useReconciliationWorkspace.ts`](../../../frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts) (lines 492–520), `handleSelectCustomer(nextCode)` only takes the synchronous warm-cache fast path when `warmBatches && warmTargetBatch && warmSummary`. When a previously visited customer has `warmBatches` cached as an empty array (`warmBatches.length === 0`), it falls through to the cold path (`setHasBatchesLoaded(false)`, `setIsLoading(true)`).

6. **`N6` (Should fix — `<WorkbenchSkeleton>` Unmount Flash on `/warehouse?view=mrx-daily` When Switching to `'history'` Tab Before `history` Finishes Loading):**
   - In [`MrxDailyIssueWorkbench.tsx`](../../../frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx) (lines 377–378), `<StateBoundary>` receives `hasExistingData={Boolean(activeTab === 'history' ? history : daily)}` and `isLoading={stateProps.isLoading || Boolean(!stateProps.error && activeBatchId && (!daily || (activeTab === 'history' && !history)))}`.
   - When `daily` is already loaded (e.g., from a warm `snapshot:mrx_daily` entry that stored `{ daily }`) and the user switches to `activeTab === 'history'` while `history` is still `null`, `StateBoundary` unmounts the workbench into `<WorkbenchSkeleton>` instead of rendering the `'history'` tab's persistent `<LocalFindBar>`, `<DataGrid>`, and `<PaginationBar>` in `isPreviousData` (transitioning) state.

7. **`N7` (Nice to have — Redundant Revision Metadata SQL Queries in `ReconciliationBatchService.GetAsync`):**
   - In [`ReconciliationBatchService.cs`](../../../backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs) (line 250), `GetAsync` calls `GetWarehouseDailyManyCoreAsync([normalizedId], [batch], batchLines, preloadedWeeks, dailyDispositions, token)` with default `includeMetadata = true`, which executes `ReconciliationWarehouseRevisionQuery.GetLatestByBatchAsync` (up to 3 SQL queries against `Reconciliationsourcerevisions`, `Reconciliationsourcedeltas`, and `Users`) even though `GetAsync` only constructs `ReconciliationDailyReviewDto(daily.WeeklyStatus, reviewLines)` and discards `day.LastRevisionAt`, `day.LastRevisionByName`, and `day.LastRevisionByRole`.

---

## 2. Technical Design & Exact Remedies

### 2.1 `N1` & `N5`: `useReconciliationWorkspace.ts` State Machine & Warm Empty-Customer Fast Path
- **File:** [`frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`](../../../frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts)
- **Changes:**
  1. In the `getBatchSummary` `useEffect` (line 387):
     ```ts
     if (activeReportTab !== 'lines' && explicitBatchIdRef.current !== batchId) {
       setIsLoading(false);
       setIsFetching(false);
       return;
     }
     ```
  2. In `handleSelectBatch(nextId)` (line 547):
     Only set `setIsLoading(true)` when `!cached && activeReportTab === 'lines'`; when `activeReportTab !== 'lines'`, ensure `setIsLoading(false)` and `setIsFetching(false)` so `isCatalogTransitioning` never sticks at `true`.
  3. In `handleSelectDate(date)` (line 587):
     When `matchedBatch` is found on a cross-week date switch and `!cached`, only set `setIsLoading(true)` when `activeReportTab === 'lines'`; otherwise call `setIsLoading(false)` and `setIsFetching(false)`.
  4. In `handleSelectCustomer(nextCode)` (after line 520, before the cold fallback):
     Add an explicit synchronous fast path when `warmBatches && warmBatches.length === 0`:
     ```ts
     if (warmBatches && warmBatches.length === 0) {
       setBatches([]);
       setHasBatchesLoaded(true);
       setIsLoading(false);
       setIsFetching(false);
       setBatchId('');
       setData(null);
       if (c) {
         workspaceSessionStore.setScope({
           customerCode: nextCode,
           customerId: c.customerId,
           customerName: c.customerName,
           batchId: '',
         });
       }
       setSearchParams((curr) => {
         const next = new URLSearchParams(curr);
         if (c?.customerId) next.set('customerId', c.customerId);
         else if (nextCode) next.set('customerId', nextCode);
         next.delete('batchId');
         return next;
       }, { replace: true });
       return;
     }
     ```

### 2.2 `N2`: Cross-Report-Tab SWR Retention in `useReconciliationReports.ts` & `ReconciliationReportTables.tsx`
- **Files:**
  - [`frontend/src/features/reconciliation/useReconciliationReports.ts`](../../../frontend/src/features/reconciliation/useReconciliationReports.ts)
  - [`frontend/src/features/reconciliation/ReconciliationReportTables.tsx`](../../../frontend/src/features/reconciliation/ReconciliationReportTables.tsx)
- **Changes:**
  1. In [`useReconciliationReports.ts`](../../../frontend/src/features/reconciliation/useReconciliationReports.ts):
     - Define `userModeScope = `mrx_report_${user?.userId}_${operationalMode}`` and keep `baseTabScope = `${userModeScope}_${activeReportTab}``.
     - Update `previous` (line 95) to retain `state` across any report tab within the same `userModeScope`:
       ```ts
       const previous = !currentData && !current?.error && state?.tabScope.startsWith(userModeScope) && (enabled || isCatalogTransitioning) ? state : null;
       ```
  2. In [`ReconciliationReportTables.tsx`](../../../frontend/src/features/reconciliation/ReconciliationReportTables.tsx):
     - Determine `hasExactTabReport`:
       ```ts
       const hasExactTabReport = Boolean(
         (activeTab === 'variances' && variancesReport) ||
         (activeTab === 'transactions' && transactionsReport) ||
         (activeTab === 'audit' && (auditSubTab === 'source' ? (sourceChanges || (isReportLoading && auditReport)) : (auditReport || (isReportLoading && sourceChanges)))) ||
         (activeTab === 'completed' && completedReport)
       );
       ```
     - Determine fallback `fallbackTab` when `!hasExactTabReport && isReportLoading`:
       If `variancesReport` is non-null -> `'variances'`; else if `transactionsReport` is non-null -> `'transactions'`; else if `auditReport || sourceChanges` is non-null -> `'audit'`; else if `completedReport` is non-null -> `'completed'`; else `null`.
     - Set `effectiveTab = hasExactTabReport ? activeTab : (isReportLoading && fallbackTab ? fallbackTab : activeTab)` and `hasCurrentReport = hasExactTabReport || Boolean(isReportLoading && fallbackTab)`.
     - Render `effectiveTab`'s branch inside `<LocalizedBoundary isLoading={isReportLoading && !hasCurrentReport}>` so switching between any two report tabs keeps the previous report table mounted in `isReportLoading` (`opacity-70` + top progressbar) until the new report resolves.

### 2.3 `N3`: Fixed Box-Model (`border` + `font-semibold`) on Shift Filter Buttons in `MrxBatchDishesModal.tsx`
- **File:** [`frontend/src/components/workbench/MrxBatchDishesModal.tsx`](../../../frontend/src/components/workbench/MrxBatchDishesModal.tsx)
- **Changes:**
  - Lock `border` (`1px`) and `font-semibold` across both selected and unselected states on all 3 shift filter buttons (`Tất cả`, `Sáng`, `Chiều`) at lines 170–193:
    ```tsx
    className={`flex-1 py-0.5 rounded border text-xs font-semibold transition-colors cursor-pointer ${
      shiftFilter === 'ALL' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
    }`}
    ```

### 2.4 `N4`: Shared `mrx_batch_dishes_${activeBatchId}` Cache in `MrxSupplementalIssueModal.tsx`
- **File:** [`frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx`](../../../frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx)
- **Changes:**
  - Import `serverStateCache` from `../../store/serverStateCache`.
  - Initialize `catalog` state from `serverStateCache.get<MrxBatchDishSummary[]>(`mrx_batch_dishes_${activeBatchId}`)?.data` and synchronize during render if `activeBatchId` has a fresh cache entry and `catalog?.batchId !== activeBatchId`.
  - In the `useEffect` (lines 74–85), if `catalogRetry === 0`, check `const cached = serverStateCache.get<MrxBatchDishSummary[]>(`mrx_batch_dishes_${activeBatchId}`); if (cached && !cached.isStale) return;`. When `mrxApi.getBatchDishes(activeBatchId)` resolves, write `serverStateCache.set(`mrx_batch_dishes_${activeBatchId}`, items)` before calling `setCatalog`.

### 2.5 `N6`: Prevent `<WorkbenchSkeleton>` Unmount When Switching to `'history'` Tab on `/warehouse?view=mrx-daily`
- **File:** [`frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`](../../../frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx)
- **Changes:**
  - At lines 374–379 of `MrxDailyIssueWorkbench.tsx`:
    - Pass `hasExistingData={Boolean(daily || history)}`
    - Pass `isPreviousData={stateProps.isPreviousData || Boolean(activeTab === 'history' && !history && daily && !stateProps.error)}`
    - Pass `isLoading={stateProps.isLoading || Boolean(!stateProps.error && activeBatchId && !daily && !history)}`
  - When `daily` is already loaded and the user switches to `activeTab === 'history'` while `history` is still loading, `<StateBoundary>` stays mounted (`hasExistingData = true`, `isLoading = false`, `isPreviousData = true`) and renders the `'history'` tab's `<LocalFindBar>`, `<DataGrid>`, and `<PaginationBar>` with the top progressbar instead of unmounting into `<WorkbenchSkeleton>`.

### 2.6 `N7`: Skip Redundant Revision Metadata Queries in `ReconciliationBatchService.GetAsync`
- **File:** [`backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs`](../../../backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationBatchService.cs)
- **Changes:**
  - At line 250 of `ReconciliationBatchService.cs`, pass `includeMetadata: false` to `GetWarehouseDailyManyCoreAsync`:
    ```csharp
    var dailyMap = await GetWarehouseDailyManyCoreAsync([normalizedId], [batch], batchLines, preloadedWeeks, dailyDispositions, token, includeMetadata: false);
    ```

---

## 3. Acceptance Criteria (`AC-N1..AC-N7`)

- **`AC-N1`:** Switching batches (`handleSelectBatch`) or selecting a cross-week date (`handleSelectDate`) while on `/reconciliation?view=variances|transactions|audit` when the target batch's `mrx_recon_*` summary is uncached does NOT leave `isLoading` or `isReportLoading` stuck at `true`; once the report API resolves, the report table is interactive (`inert` is absent and `opacity-70` is removed).
- **`AC-N2`:** Switching from one loaded report tab (e.g., `variances`) to an uncached sibling report tab (e.g., `transactions` or `audit`) on `/reconciliation` keeps the previous report table mounted in `isReportLoading` state (`tableCount = 1`, zero `<WorkbenchSkeleton>` unmount) until the target tab's report data resolves.
- **`AC-N3`:** All 3 shift filter buttons (`Tất cả`, `Sáng`, `Chiều`) in `MrxBatchDishesModal` maintain `border` (`1px`) and `font-semibold` across both active and inactive states (`0px` box-model shift).
- **`AC-N4`:** `MrxSupplementalIssueModal` reads and populates `serverStateCache` key `mrx_batch_dishes_${activeBatchId}`; when `mrx_batch_dishes_${activeBatchId}` is already warm in `serverStateCache`, opening `MrxSupplementalIssueModal` renders dish options immediately on Frame 0 without calling `mrxApi.getBatchDishes` again.
- **`AC-N5`:** Switching Customer on `/reconciliation` to a customer whose `mrx_batches_${customerId}` cache entry is an empty array `[]` synchronously transitions to the empty state (`hasBatchesLoaded = true`, `isLoading = false`) on Frame 0.
- **`AC-N6`:** Switching from `"Định lượng xuất ca"` (`demand`) to `"Lịch sử phiếu"` (`history`) on `/warehouse?view=mrx-daily` when `daily` is loaded but `history` is not yet resolved keeps `<LocalFindBar>`, `<DataGrid>`, and `<PaginationBar>` mounted (`tableCount = 1`) in `isPreviousData` state without unmounting into `<WorkbenchSkeleton>`.
- **`AC-N7`:** `ReconciliationBatchService.GetAsync` passes `includeMetadata: false` to `GetWarehouseDailyManyCoreAsync`, preserving all `ReconciliationBatchDto` and `DailyReview` fields while skipping unused `ReconciliationWarehouseRevisionQuery` queries.
