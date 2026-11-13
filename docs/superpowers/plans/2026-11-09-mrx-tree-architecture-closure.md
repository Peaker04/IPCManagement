# MRX Root-to-Leaf Architectural Tree Closure (`G1–G7`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all remaining upstream architectural root causes (`G1–G7`) in `MATERIAL_RECONCILIATION` (`MRX`) mode across the React & Backend tree — achieving `CLS = 0.00000` on MRX Dashboard filter switches, `emptyBusyCount = 0` on cold MRX route loads, zero destructive `key` remounts on `MrxQuantityInspectionPage` and `AdminBomBranch`, zero `<React.StrictMode>` `HTTP 499` self-aborts on `/warehouse?view=mrx-preparation`, non-destructive scoped refresh on `/reconciliation`, and zero EF Core `Skip/Take without OrderBy` warnings in MRX Backend initializers.

**Architecture:**
- **Layer 1 & 3 (`App.tsx`, `StateBoundary.tsx`, `PaginationBar.tsx` — `G2`, `G7`):** Default `StateBoundary` `delayMs` to `0` (`minDurationMs = 0`) and use `<WorkbenchSkeleton />` inside `App.tsx` `<Suspense>` so cold loads render geometry-matched skeletons on Frame 0 instead of an empty `aria-busy="true"` div; lock `PaginationBar` desktop height to `md:h-12 md:py-0`.
- **Layer 2 (`useWorkbenchQuery.ts`, `useReconciliationWorkspace.ts` — `G4`, `G5`):** Defer `inFlightWorkbenchQueries` `controller.abort()` via `queueMicrotask` so `<React.StrictMode>`'s synchronous unmount+remount cycle re-attaches without aborting the live `fetch`; scope `/reconciliation` `handleRefresh` to delete only the active batch/report keys and mark `mrx_` entries stale (`serverStateCache.invalidate('mrx_')`) instead of wiping all cross-station caches.
- **Layer 4 & Backend MRX (`ReconciliationDashboardPage.tsx`, `WeeklyMenuPage.tsx`, `MrxQuantityInspectionPage.tsx`, `useMrxQuantityInspection.ts`, `AdminBomBranch.tsx`, `WarehouseRepository.cs`, `SystemOperationModeInitializer.cs`, `ReconciliationToleranceInitializer.cs` — `G1`, `G3`, `G6`):** Retain previous `DashboardData` and `InspectionResult` (`isPreviousData = true`, `hasExistingData = true`) during Customer/Period/Week/View switches, remove destructive `key` props, keep `<PaginationBar>` mounted, and add deterministic `.OrderBy(...)` before `.Take(...)` in the 3 MRX Backend initializers.

**Tech Stack:** .NET 9 / EF Core / xUnit (`IPCManagement.Api`), React 19 / TypeScript / Vite / Vitest (`frontend`).

**Spec:** [`docs/superpowers/specs/2026-11-09-mrx-tree-architecture-closure-design.md`](../specs/2026-11-09-mrx-tree-architecture-closure-design.md)

## Global Constraints

- Operational Mode Isolation (`DOM-MODE-1`): Scope is strictly isolated to `MATERIAL_RECONCILIATION` (`MRX`) mode and shared MRX primitives; do not modify `DEFAULT`-mode pages.
- Single Styling Authority: Zero ad-hoc colors, inline styles, or external CSS tokens outside `frontend/src/styles/index.css`.
- Anti-Tautology (`TA-1` to `TA-4`): Tests must exercise real components and hooks with C#-aligned DTO fixtures and verify `RED -> GREEN`.
- No Destructive Git/DB Operations: Preserve all existing uncommitted work; do not run `git reset`, `git restore`, or `git clean`.

## Review Focus

1. **False revision banner on `MrxQuantityInspectionPage` when switching customers/weeks (`G3`):** Retaining previous `result` while switching `customerId` or `weekStartDate` must reset `fingerprint.current = null` and `revisionNotice = false` on scope change so comparing Customer A's `contentFingerprint` with Customer B's `contentFingerprint` never triggers a false `"Nguồn đã thay đổi"` banner (pinned in Task 3).
2. **Stale `workspaceSessionStore` pollution during `useMrxQuantityInspection` transition (`G3`):** While `source` holds Customer A's previous data during a transition to Customer B, `useEffect` must only call `workspaceSessionStore.setScope` when `exactSource?.menuVersionId` matches the current `(customerId, weekStartDate)` (pinned in Task 3).
3. **Genuine unmount abort in `useWorkbenchQuery` after `queueMicrotask` (`G4`):** Deferring `controller.abort()` via `queueMicrotask` must still abort the `AbortSignal` when a component genuinely unmounts without remounting in the same tick (pinned in Task 2).
4. **Error boundary clearing on `ReconciliationDashboardPage` (`G1`):** If switching to a customer fails with an API error (`current?.error != null`), `isTransitioning` must become `false` so the error alert renders cleanly instead of staying stuck on dimmed previous data without error feedback (pinned in Task 3).
5. **Write mutation cache invalidation vs. read refresh on `/reconciliation` (`G5`):** `handleRefresh` must preserve `mrx_source_*` / `mrx_daily_*` entries (marked `isStale = true`), whereas `handleComplete` must still delete all `mrx_*` and `snapshot:mrx_*` entries via `invalidateMrxCaches()` (pinned in Task 2).

---

### Task 1: Backend MRX Deterministic `OrderBy` in Initializers & `WarehouseRepository` (`G6`)

**Files:**
- Modify: `backend/src/IPCManagement.Api/Data/Repositories/WarehouseRepository.cs:47-65`
- Modify: `backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeInitializer.cs:45-55`
- Modify: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationToleranceInitializer.cs:52-60`
- Test: `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs`

**Interfaces:**
- Consumes: `IpcManagementContext`, `WarehouseRepository.GetOperationalCandidatesAsync(int limit)`, `SystemOperationModeInitializer.InitializeAsync(string actorId, CancellationToken ct)`, `ReconciliationToleranceInitializer.InitializeAsync(string actorId, CancellationToken ct)`
- Produces: Deterministic `OrderBy` queries before `.Take(...)` in all 3 classes with unchanged public signatures.

- [ ] **Step 1: Write the failing test (`RED`) in `ReconciliationPreparationWorkbookTests.cs`**

Add a test `MrxInitializers_And_WarehouseRepository_Use_Deterministic_Ordering_On_Candidate_Queries` in `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs` that seeds 2 active operational warehouses (`wh-b` and `wh-a`) and verifies `WarehouseRepository.GetOperationalCandidatesAsync(1)` deterministically returns the warehouse ordered by `WarehouseId`, and both `SystemOperationModeInitializer.InitializeAsync` and `ReconciliationToleranceInitializer.InitializeAsync` succeed cleanly.

- [ ] **Step 2: Run test to verify current behavior**

Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-build --filter "FullyQualifiedName~MrxInitializers_And_WarehouseRepository_Use_Deterministic_Ordering_On_Candidate_Queries"`

- [ ] **Step 3: Implement deterministic `.OrderBy(...)` in `WarehouseRepository.cs`, `SystemOperationModeInitializer.cs`, and `ReconciliationToleranceInitializer.cs`**

1. In `backend/src/IPCManagement.Api/Data/Repositories/WarehouseRepository.cs:54-64`, add `.OrderBy(warehouse => warehouse.WarehouseId)` before `.Take(limit)`.
2. In `backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeInitializer.cs:48`, add `.OrderBy(row => row.Id)` before `.Take(2)`.
3. In `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationToleranceInitializer.cs:57`, add `.OrderBy(row => row.ToleranceId)` before `.Take(2)`.

- [ ] **Step 4: Run Backend tests to verify `GREEN`**

Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationPreparationWorkbookTests"`
Expected: PASS (`0` failed).

---

### Task 2: Upstream Layer 1–3 Fixes — `StateBoundary`, `App.tsx`, `PaginationBar`, `useWorkbenchQuery` StrictMode Abort, & Scoped Refresh (`G2`, `G4`, `G5`, `G7`)

**Files:**
- Modify: `frontend/src/components/workbench/StateBoundary.tsx:182-213`
- Modify: `frontend/src/App.tsx:1-65`
- Modify: `frontend/src/components/workbench/PaginationBar.tsx:27-35`
- Modify: `frontend/src/hooks/useWorkbenchQuery.ts:266-278`
- Modify: `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:188-198`
- Test: `frontend/src/__tests__/Primitives.test.tsx`
- Test: `frontend/src/__tests__/Render1CacheHitVerification.test.tsx`
- Test: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `StateBoundaryProps`, `UseWorkbenchQueryOptions<TData, TParams>`, `serverStateCache`
- Produces:
  - `StateBoundary`: defaults `delayMs` to `0` and `minDurationMs` to `0` so `isLoading && !hasExistingData` renders `customSkeleton` or `<WorkbenchSkeleton />` on Frame 0 even when `NODE_ENV !== 'test'`.
  - `useWorkbenchQuery`: defers `controller.abort()` in `useEffect` cleanup via `queueMicrotask` so `<React.StrictMode>` remounts keep `subscribers === 1` without aborting the in-flight `AbortSignal`.
  - `useReconciliationWorkspace.handleRefresh`: invalidates only active reconciliation cache keys and marks `mrx_` stale (`serverStateCache.invalidate('mrx_')`) without deleting other stations' caches.

- [ ] **Step 1: Write failing tests (`RED`) in `Primitives.test.tsx`, `Render1CacheHitVerification.test.tsx`, and `Reconciliation.test.tsx`**

1. In `frontend/src/__tests__/Primitives.test.tsx`:
   - Add test `G2: StateBoundary renders WorkbenchSkeleton immediately on Frame 0 in production mode without a 0-150ms empty div` using `vi.stubEnv('NODE_ENV', 'production')` and asserting `screen.getByRole('status', { name: 'Đang tải nội dung' })` is present immediately on initial render when `isLoading={true}` and `hasExistingData={false}`.
   - Add test `G7: PaginationBar locks desktop height with md:h-12 and md:py-0` asserting the footer `<nav>` has classes `md:h-12` and `md:py-0`.
2. In `frontend/src/__tests__/Render1CacheHitVerification.test.tsx`:
   - Add test `G4: useWorkbenchQuery under React.StrictMode does not abort in-flight AbortSignal during initial mount-remount cycle, but aborts on real unmount` wrapping a probe component in `<StrictMode>`, capturing the `AbortSignal` passed to `queryFn`, and asserting `signal.aborted === false` and `queryFn` is called once across StrictMode mount, and `signal.aborted === true` after `unmount()`.
3. In `frontend/src/__tests__/Reconciliation.test.tsx`:
   - Add test `G5: clicking Làm mới on ReconciliationPage refreshes active batch and marks cross-station mrx_ caches stale without deleting them` seeding `serverStateCache.set('mrx_daily_batches', [...])`, clicking `"Làm mới"`, and asserting `serverStateCache.get('mrx_daily_batches')` still exists with `isStale === true`.

- [ ] **Step 2: Run Vitest to verify `RED` failure**

Run: `npm --prefix frontend test -- --run src/__tests__/Primitives.test.tsx src/__tests__/Render1CacheHitVerification.test.tsx src/__tests__/Reconciliation.test.tsx`
Expected: FAIL on the new `G2`, `G4`, `G5`, and `G7` assertions.

- [ ] **Step 3: Implement `G2`, `G4`, `G5`, and `G7`**

1. In `frontend/src/components/workbench/StateBoundary.tsx:182-184`, change:
   ```ts
   const skeletonDelay = typeof delayMs === 'number' ? delayMs : 0;
   const isDeferredLoading = useDeferredSkeleton(Boolean(isLoading && !hasExistingData), skeletonDelay, 0);
   ```
2. In `frontend/src/App.tsx:60`, import `WorkbenchSkeleton` from `./components/workbench/WorkbenchSkeleton` and change `<Suspense fallback={...}>` to:
   ```tsx
   <Suspense fallback={<WorkbenchSkeleton geometry={{ kind: 'table', columns: 6, rows: 8 }} />}>
   ```
3. In `frontend/src/components/workbench/PaginationBar.tsx:30`, update the non-selector `<nav>` class string to:
   ```tsx
   `min-h-12 md:h-12 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 pt-1.5 shrink-0 ${placement === 'footer' ? 'pb-16 md:py-0' : 'pb-1.5 md:py-0'}`
   ```
4. In `frontend/src/hooks/useWorkbenchQuery.ts:266-277`, defer the `subscribers <= 0` abort check with `queueMicrotask`:
   ```ts
   return () => {
     ignore = true;
     requestGeneration.current += 1;
     const current = inFlightWorkbenchQueries.get(cacheKey);
     if (current && current.promise === sharedPromise) {
       current.subscribers -= 1;
       queueMicrotask(() => {
         const latest = inFlightWorkbenchQueries.get(cacheKey);
         if (latest && latest.promise === sharedPromise && latest.subscribers <= 0) {
           latest.controller.abort();
           inFlightWorkbenchQueries.delete(cacheKey);
         }
       });
     }
   };
   ```
5. In `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts:188-198`, update `handleRefresh`:
   ```ts
   const handleRefresh = async () => {
     setIsRefreshing(true);
     try {
       if (batchId) {
         serverStateCache.delete(`mrx_raw_batch_${batchId}`);
         serverStateCache.delete(`mrx_recon_${batchId}_${serviceDate}`);
       }
       serverStateCache.delete('snapshot:mrx_reconciliation');
       serverStateCache.deletePrefix('mrx_report_');
       serverStateCache.invalidate('mrx_');
       if (catalogError) retryCatalog();
       else if (activeReportTab === 'lines') await loadData();
       else await reports.reloadReport();
     } finally {
       setIsRefreshing(false);
     }
   };
   ```

- [ ] **Step 4: Run Vitest to verify `GREEN` pass**

Run: `npm --prefix frontend test -- --run src/__tests__/Primitives.test.tsx src/__tests__/Render1CacheHitVerification.test.tsx src/__tests__/Reconciliation.test.tsx src/__tests__/useDeferredSkeleton.test.ts`
Expected: PASS (`0` failed).

---

### Task 3: Leaf & Route Wrapper Closure — `ReconciliationDashboardPage`, `WeeklyMenuPage`, `MrxQuantityInspectionPage`, `useMrxQuantityInspection`, & `AdminBomBranch` (`G1`, `G3`)

**Files:**
- Modify: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx:82-115, 200-235`
- Modify: `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx:55-59`
- Modify: `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx:83-138`
- Modify: `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts:32-60`
- Modify: `frontend/src/features/admin/branches/AdminBomBranch.tsx:280-287`
- Test: `frontend/src/__tests__/Dashboard.test.tsx`
- Test: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `StateBoundary`, `useWorkbenchQuery`, `PaginationBar`, `DataGrid`
- Produces:
  - `ReconciliationDashboardPage`: retains `state?.data` with `isPreviousData={isTransitioning}` and `hasExistingData={Boolean(data)}` when switching `customerId`, `period`, or `page`.
  - `WeeklyMenuPage` & `MrxQuantityInspectionPage` & `useMrxQuantityInspection`: preserves mounted `<MrxQuantityInspectionPage />`, `<SplitView />`, `<DataGrid />`, and `<PaginationBar />` across customer/week/view/search/page switches without false revision notices.
  - `AdminBomBranch`: preserves mounted `<DataGrid />` across filter/search/page changes.

- [ ] **Step 1: Write failing tests (`RED`) in `Dashboard.test.tsx` and `WeeklyMenu.test.tsx`**

1. In `frontend/src/__tests__/Dashboard.test.tsx`:
   - Add test `G1: ReconciliationDashboardPage keeps KPI cards and batch table mounted with isPreviousData during uncached customer and period switches` where selecting a customer in `Lọc theo khách hàng` whose API response is pending keeps the existing KPI cards (`Chỉ số điều hành đối soát`), the 4-step pipeline section, and the batch `<table />` in the DOM with `progressbar` (`Đang tải trang`) instead of unmounting them.
2. In `frontend/src/__tests__/WeeklyMenu.test.tsx`:
   - Add test `G3: MrxQuantityInspectionPage preserves mounted Select focus, DataGrid, and PaginationBar across customer switch without false revision notice` where focusing `Chọn khách hàng MRX` and switching from Customer A to Customer B (while Customer B's `getWeeklySource` is pending) keeps the same `<select>` DOM node mounted (`document.activeElement === select`), keeps the `<table />` and `<nav aria-label="Định lượng nguyên liệu">` in the DOM with `progressbar`, and does not render `"Nguồn đã thay đổi"` when Customer B resolves with a different `contentFingerprint`.

- [ ] **Step 2: Run Vitest to verify `RED` failure**

Run: `npm --prefix frontend test -- --run src/__tests__/Dashboard.test.tsx src/__tests__/WeeklyMenu.test.tsx`
Expected: FAIL on the new `G1` and `G3` tests.

- [ ] **Step 3: Implement `G1` and `G3` in `ReconciliationDashboardPage.tsx`, `WeeklyMenuPage.tsx`, `MrxQuantityInspectionPage.tsx`, `useMrxQuantityInspection.ts`, and `AdminBomBranch.tsx`**

1. In `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`:
   - Update lines `84–88`:
     ```ts
     const current = state?.key === cacheKey ? state : null;
     const exactData = current?.data ?? serverStateCache.get<DashboardData>(cacheKey)?.data ?? null;
     const isTransitioning = !exactData && Boolean(state?.data) && !current?.error;
     const data = exactData ?? (isTransitioning ? state!.data : null);
     const customers = data?.customers ?? serverStateCache.get<readonly CustomerOption[]>(customersKey)?.data ?? [];
     const refreshing = current?.refreshing ?? (Boolean(exactData) || isTransitioning);
     ```
   - Pass `isPreviousData={isTransitioning}` to both `<StateBoundary>` components at lines `200` and `210`.
2. In `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx:55-58`, remove `key` from `<MrxQuantityInspectionPage />`:
   ```tsx
   if (view === 'mrx-materials' || view === 'mrx-plans') {
     return <MrxQuantityInspectionPage view={view === 'mrx-materials' ? 'materials' : 'plans'} />;
   }
   ```
3. In `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts:32-60`:
   ```ts
   const exactSource = sourceQuery.data?.customerId === customerId && sourceQuery.data.weekStartDate === weekStartDate ? sourceQuery.data : null;
   const isTransitioningSource = Boolean(
     validScope &&
     !exactSource &&
     sourceQuery.data &&
     !sourceQuery.stateProps.error &&
     (sourceQuery.stateProps.isFetching || sourceQuery.stateProps.isLoading || sourceQuery.stateProps.isPreviousData)
   );
   const source = exactSource ?? (isTransitioningSource ? sourceQuery.data : null);
   useEffect(() => {
     if (exactSource?.menuVersionId) workspaceSessionStore.setScope({ weeklyMenuScope: { customerId, weekStartDate } });
   }, [customerId, exactSource, weekStartDate]);
   const menuVersionId = exactSource?.menuVersionId ?? '';
   const published = exactSource?.menuVersionStatus === 'PUBLISHED' || exactSource?.menuVersionStatus === 'ACTIVE';
   const key = `mrx_inspection_${scope}_${menuVersionId}_${view}_${query.pageNumber}_${query.pageSize}_${query.searchKeyword}`;
   const inspection = useWorkbenchQuery<InspectionResult>({
     scopeKey: 'mrx_inspection', cacheKey: key, snapshotKey: `snapshot:${key}`,
     scopeId: menuVersionId, enabled: published,
     queryFn: async () => view === 'materials'
       ? { view, data: await mrxApi.getMaterialInspection(menuVersionId, query) }
       : { view, data: await mrxApi.getPlanInspection(menuVersionId, query) },
     isDatasetEmpty: result => result.data.page.totalCount === 0,
     emptyTitle: view === 'materials' ? 'Không có nguyên liệu phù hợp' : 'Không có kế hoạch theo ca phù hợp',
     emptyDescription: 'Kiểm tra phạm vi tuần hoặc thay đổi từ khóa tìm kiếm.',
   });
   const exactResult = published && inspection.data?.view === view && inspection.data.data.menuVersionId === menuVersionId
     ? inspection.data
     : null;
   const isTransitioningResult = Boolean(
     validScope &&
     !exactResult &&
     inspection.data?.view === view &&
     !sourceQuery.stateProps.error &&
     !inspection.stateProps.error &&
     (isTransitioningSource || (published && (inspection.stateProps.isFetching || inspection.stateProps.isLoading || inspection.stateProps.isPreviousData)))
   );
   const result = exactResult ?? (isTransitioningResult ? inspection.data : null);
   const isPreviousData = Boolean(result && (isTransitioningSource || isTransitioningResult || inspection.stateProps.isPreviousData));
   ```
   And update `stateProps`:
   ```ts
   const stateProps = sourceQuery.stateProps.error || (!source && !isTransitioningResult)
     ? { ...sourceQuery.stateProps, isEmpty: !validScope || (!source && !sourceQuery.stateProps.isLoading && !sourceQuery.stateProps.isFetching && !sourceQuery.stateProps.error),
         emptyTitle: validScope ? sourceQuery.stateProps.emptyTitle : 'Chọn khách hàng và tuần bắt đầu',
         emptyDescription: validScope ? sourceQuery.stateProps.emptyDescription : 'Chọn đúng khách hàng và ngày Thứ Hai để xem nguồn dự kiến.', emptyScenario: 'prerequisite-blocked' as const }
     : !published && !isTransitioningSource && !isTransitioningResult
       ? { ...sourceQuery.stateProps, isEmpty: true, emptyTitle: 'Thực đơn chưa được phát hành', emptyDescription: 'Hoàn thiện nguồn tại Chuẩn bị lô đối soát.', emptyScenario: 'prerequisite-blocked' as const }
       : { ...inspection.stateProps, hasExistingData: Boolean(result), isPreviousData, isLoading: !result && !inspection.stateProps.error,
           isPartial: Boolean(exactResult?.data.diagnostics.length), partialMessage: exactResult?.data.diagnostics.join(' · ') };
   ```
4. In `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx`:
   - Track scope key `${customerId}:${weekStartDate}` in `fingerprint` ref (`useRef<{ scope: string; value: string } | null>(null)`) so `revisionNotice` only triggers when `fingerprint.current.scope === `${customerId}:${weekStartDate}`` and `fingerprint.current.value !== result.data.contentFingerprint` (and only when `!workspace.stateProps.isPreviousData`).
   - Remove `key={`${result.view}:${result.data.menuVersionId}`}` on line `131`.
   - Always render `<PaginationBar>` at line `135` (`totalCount={result?.data.page.totalCount}`, `totalPages={result?.data.page.totalPages}`, `hasPrev={result?.data.page.hasPrev ?? false}`, `hasNext={result?.data.page.hasNext ?? false}`, `pending={workspace.stateProps.isFetching || workspace.stateProps.isLoading}`).
5. In `frontend/src/features/admin/branches/AdminBomBranch.tsx:281`, remove `key={`${statusFilter}:${searchQuery}:${currentPage}:${pageSize}`}` from `<DataGrid />`.

- [ ] **Step 4: Run Vitest to verify `GREEN` pass**

Run: `npm --prefix frontend test -- --run src/__tests__/Dashboard.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/Admin.test.tsx`
Expected: PASS (`0` failed).

---

### Task 4: Full Verification Gate — Unit/Contract Suites, Lint, Build, Live Chrome DevTools CDP Re-Audit (MRX), & `.planning/WORK.md` Closure

**Files:**
- Modify: `.planning/WORK.md`

- [ ] **Step 1: Run full Backend & Frontend test suites, linter, and production build**

Run:
- `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~ReconciliationPreparationWorkbookTests"`
- `npm --prefix frontend test -- --run`
- `npm --prefix frontend run lint`
- `npm --prefix frontend run build`
Expected: `0` test failures, `0` lint errors, clean production build.

- [ ] **Step 2: Run live Chrome DevTools CDP + Backend Serilog verification across all MRX scenarios (`MRX_01..MRX_13`)**

Start temporary BE (`http://127.0.0.1:5262`) and FE (`http://127.0.0.1:5173`) servers, execute the MRX CDP probe (`MRX_01..MRX_13`), verify:
- `MRX_02_Dashboard_CustomerSwitch` & `MRX_03_Dashboard_PeriodSwitch`: `CLS = 0.00000`, `maxEmptyBusy = 0`, `tableUnmountedMidTransition = false`.
- `MRX_07_Warehouse_Preparation_Load` & `MRX_08_Warehouse_Issues_SourceDelta_Load`: `maxEmptyBusy = 0`, `0` `HTTP 499` in Serilog.
- `0` EF Core `RowLimitingOperationWithoutOrderByWarning` logs from MRX startup/endpoints.
Then stop both temporary servers immediately.

- [ ] **Step 3: Update `.planning/WORK.md` to `IDLE` with full `G1–G7` verification receipts**
