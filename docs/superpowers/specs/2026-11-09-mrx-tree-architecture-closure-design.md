# MRX Root-to-Leaf Architectural Tree Closure (`G1–G7`) — Design Spec

Date: 2026-11-09

**Document scope:** Spec to close all 7 ranked architectural root causes (`G1–G7` / `AC-G1` to `AC-G7`) identified in the Root-to-Leaf Tree Audit of `MATERIAL_RECONCILIATION` (`MRX`) mode, combining Chrome DevTools Protocol (`PerformanceObserver` `layout-shift`/`CLS`, `MutationObserver` frame-by-frame DOM transitions, Network Waterfall) and Backend Serilog telemetry. Scope is strictly isolated to `MATERIAL_RECONCILIATION` routes and shared MRX primitives per `DOM-MODE-1`. `.planning/WORK.md` remains the sole task-state owner.

**Companion Plan:** `docs/superpowers/plans/2026-11-09-mrx-tree-architecture-closure.md`

---

## 1. Intent, Why Now, and Architectural Root Causes

### 1.1 Why Now
While previous leaf-level remediations (`F1–F9`) eliminated layout shifts on intra-page tab switches (`MrxBatchWorkbench`, `MrxDailyIssueWorkbench`, `ReconciliationPage`, `AdminDataPage`), a second-round live Chrome DevTools CDP + Backend Serilog audit across the full **Root-to-Leaf React & Data-Flow Tree** of `MATERIAL_RECONCILIATION` mode exposed **upstream architectural defects** at the Route Dispatcher (Layer 1), Query/Cache Engine (Layer 2), Boundary Gatekeeper (Layer 3), and Leaf Filter State Transitions (Layer 4) that still cause:
1. **`CLS = 0.02914` (`86px` vertical jump) and `<DataGrid>` teardown (`tableCount: 1 -> 0 -> 1`)** when switching Customer or Period on the MRX Dashboard (`/`, `ReconciliationDashboardPage.tsx`).
2. **Blank transparent/white DOM flash (`emptyBusyCount = 1`, `70–165ms`)** on cold loads and uncached transitions because `StateBoundary.tsx` renders an empty `<div bg-transparent aria-busy="true" />` during the `0–150ms` window before showing `<WorkbenchSkeleton />`, and `App.tsx` renders an empty `<div className="flex-1 min-h-0 w-full bg-white" aria-busy="true" />` as its `<Suspense>` fallback.
3. **Full-subtree DOM destruction** when switching Customer, Week, or View on `/weekly-menu?view=mrx-materials` / `mrx-plans` and when typing/paginating on `/admin-data?branch=boms` because parent components attach dynamic `key` props (`WeeklyMenuPage.tsx:L56`, `MrxQuantityInspectionPage.tsx:L131`, `AdminBomBranch.tsx:L281`) and `useMrxQuantityInspection.ts` nulls `source` and `result` whenever scope/view parameters change.
4. **SWR Cache Wipeout across MRX stations** when a user clicks `"Làm mới"` on `/reconciliation` (`useReconciliationWorkspace.ts:L191`) because `handleRefresh` calls `invalidateMrxCaches()`, which deletes all `mrx_*` and `snapshot:mrx_*` entries across the entire application instead of only refreshing the active station, and `serverStateCache` lacks a non-destructive `markStalePrefix` for SWR `keepPreviousData`.
5. **`HTTP 499 Client Closed Request` (`status: 0` in CDP)** on `/warehouse?view=mrx-preparation` because `useWorkbenchQuery.ts` synchronously calls `current.controller.abort()` during `<React.StrictMode>`'s first unmount cleanup before the second mount re-subscribes to `inFlightWorkbenchQueries`.
6. **EF Core `RowLimitingOperationWithoutOrderByWarning` (`WRN`)** in Backend Serilog during MRX authority/warehouse initialization (`WarehouseRepository.cs`, `SystemOperationModeInitializer.cs`, `ReconciliationToleranceInitializer.cs`).
7. **Footer height jitter (`48px <-> 53px`)** in `PaginationBar.tsx` when transitioning between datasets with and without page-size/navigation controls.

### 1.2 Goals, Non-Goals, and Anti-Goals
- **Goals:**
  - Achieve `CLS = 0.00000` and `tableCount = 1` (zero table unmount) on MRX Dashboard (`/`) Customer and Period filter switches (`G1`).
  - Achieve `emptyBusyCount = 0` across all MRX cold navigations and uncached transitions by eliminating the `0–150ms` blank `<div>` window in `StateBoundary.tsx` and `App.tsx` (`G2`).
  - Preserve mounted component trees (`WorkspaceHeader`, `Select` focus, `SplitView`, `DataGrid`, `PaginationBar`) across Customer, Week, View, Search, and Page changes on `/weekly-menu?view=mrx-materials`, `/weekly-menu?view=mrx-plans`, and `/admin-data?branch=boms` (`G3`).
  - Eliminate `<React.StrictMode>` `HTTP 499` self-aborts in `useWorkbenchQuery.ts` (`G4`).
  - Preserve warm/stale L1/L2 caches across other MRX stations when clicking `"Làm mới"` on `/reconciliation` (`G5`).
  - Eliminate all EF Core `RowLimitingOperationWithoutOrderByWarning` logs in MRX initializers and lock `PaginationBar` footer geometry (`G6`, `G7`).
- **Non-Goals:**
  - Do not modify any `DEFAULT`-mode feature pages (`DashboardPage.tsx`, `DefaultWeeklyMenuPage`, `DefaultWarehousePage`, `DefaultChefDashboardPage`, `MealOrdersPage.tsx`, `ApprovalPage.tsx`, `ReportsPage.tsx`).
  - Do not alter `AuthProvider`'s fail-closed `isOperationalModeReady` contract tested by `Auth.test.tsx:L105` (`blocks a stored DEFAULT route until the authoritative MRX mode arrives`).
  - Do not delete `frontend/src/lib/scopedQuery.ts` (actively covered by `ScopedQuery.test.ts` and `clearSessionState.ts`).
- **Anti-Goals:**
  - Never mask loading states by hiding errors or bypassing `DOM-MODE-1` mode isolation.
  - Never introduce external state libraries or ad-hoc CSS tokens outside `frontend/src/styles/index.css`.

### 1.3 Root-to-Leaf Verdict Matrix (`G1–G7`)

| ID | Tree Layer & Rank | Root Cause & Measured Evidence | Canonical Owners |
|---|---|---|---|
| **G1** | **Layer 2 & 4 — Must Fix (#1)** | **MRX Dashboard (`/`) nulls `data` on uncached Customer/Period switch (`CLS = 0.02914`, `86px` vertical jump, `tableCount: 1 -> 0 -> 1`):**<br>`ReconciliationDashboardPage.tsx:L84-L85` computes `const current = state?.key === cacheKey ? state : null; const data = current?.data ?? serverStateCache.get<DashboardData>(cacheKey)?.data ?? null;`. On an uncached filter switch, `data` becomes `null`, collapsing `metrics` (`[]`) and unmounting `<DataGrid>`. | `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`, `frontend/src/__tests__/Dashboard.test.tsx` |
| **G2** | **Layer 1 & 3 — Must Fix (#2)** | **`StateBoundary` (`0–150ms` Blank Div) & `App.tsx` (`<Suspense>` Blank Div) cause `emptyBusyCount = 1` flash on cold MRX loads:**<br>`StateBoundary.tsx:L182-L212` defaults `delayMs` to `150` in production and returns `<div className="... bg-transparent" aria-busy="true" />` when `isLoading && !hasExistingData && !isDeferredLoading`. `App.tsx:L60` renders `<div className="flex-1 min-h-0 w-full bg-white" aria-busy="true" />` inside `<Suspense>`. | `frontend/src/components/workbench/StateBoundary.tsx`, `frontend/src/App.tsx`, `frontend/src/__tests__/Primitives.test.tsx` |
| **G3** | **Layer 1, 2 & 4 — Must Fix (#3)** | **Destructive `key` remounts & `result = null` on `/weekly-menu?view=mrx-materials` / `mrx-plans` and `/admin-data?branch=boms`:**<br>1. `WeeklyMenuPage.tsx:L56` passes `key={`${view}:${customerId}:${weekStartDate}`}` to `<MrxQuantityInspectionPage />`, destroying the entire page on every filter change.<br>2. `MrxQuantityInspectionPage.tsx:L131, L135` keys the table wrapper by `menuVersionId` and conditionally unmounts `<PaginationBar>` when `!result`.<br>3. `useMrxQuantityInspection.ts:L32, L49-L50` nulls `source` and `result` during scope/view transitions, defeating `useWorkbenchQuery`'s `isPreviousData`.<br>4. `AdminBomBranch.tsx:L281` passes `key={`${statusFilter}:${searchQuery}:${currentPage}:${pageSize}`}` to `<DataGrid />`, remounting the table on every search keystroke or page change. | `frontend/src/features/weekly-menu/WeeklyMenuPage.tsx`, `frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx`, `frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts`, `frontend/src/features/admin/branches/AdminBomBranch.tsx`, `frontend/src/__tests__/WeeklyMenu.test.tsx` |
| **G4** | **Layer 2 — Should Fix (#4)** | **`useWorkbenchQuery` StrictMode cleanup aborts in-flight `GET /api/reconciliation/preparation` (`HTTP 499`, `status: 0`):**<br>In `useWorkbenchQuery.ts:L266-L277`, effect cleanup synchronously decrements `subscribers` to `0` and calls `current.controller.abort()` before `<React.StrictMode>`'s second mount re-runs the effect, aborting the live `fetch` whenever `signal` is forwarded (`MrxMultiCustomerPreparationWorkbench.tsx:L38`). | `frontend/src/hooks/useWorkbenchQuery.ts`, `frontend/src/__tests__/Render1CacheHitVerification.test.tsx` |
| **G5** | **Layer 2 — Should Fix (#5)** | **`handleRefresh` on `/reconciliation` wipes all cross-station MRX caches via `invalidateMrxCaches()`:**<br>`useReconciliationWorkspace.ts:L191` calls `invalidateMrxCaches()` (`deletePrefix('mrx_')`, `deletePrefix('snapshot:mrx_')`) on a simple read refresh, destroying cached data for `/weekly-menu`, `/warehouse`, and `/chef`. | `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`, `frontend/src/__tests__/Reconciliation.test.tsx` |
| **G6** | **Backend MRX — Should Fix (#6)** | **EF Core `RowLimitingOperationWithoutOrderByWarning` (`WRN`) in 3 MRX startup/authority queries:**<br>`WarehouseRepository.cs:L54-L64` (`GetOperationalCandidatesAsync`), `SystemOperationModeInitializer.cs:L48`, and `ReconciliationToleranceInitializer.cs:L57` call `.Take(limit)` / `.Take(2)` without deterministic ordering. | `backend/src/IPCManagement.Api/Data/Repositories/WarehouseRepository.cs`, `backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeInitializer.cs`, `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationToleranceInitializer.cs`, `backend/tests/IPCManagement.Api.Tests/ReconciliationPreparationWorkbookTests.cs` |
| **G7** | **Layer 3 — Nice to Have (#7)** | **`PaginationBar` footer height jitter (`48px <-> 53px`):**<br>`PaginationBar.tsx:L30` uses `pt-2 pb-2` with `h-9` (`36px`) controls (`36 + 16 = 52px + 1px border = 53px`) when controls are visible, but `48px` (`min-h-12`) when controls are hidden. | `frontend/src/components/workbench/PaginationBar.tsx`, `frontend/src/__tests__/Primitives.test.tsx` |

---

## 2. Scoped Pre-Code UI Gate Block (Mandatory per `AGENTS.md` §3.2)

```markdown
### Scoped Pre-Code UI Gate Block
- Route: `/` (MRX `ReconciliationDashboardPage`), `/weekly-menu?view=mrx-*`, `/warehouse?view=mrx-*`, `/chef?view=mrx-*`, `/reconciliation`, `/admin-data?branch=boms`
- Single Primary Work Object: `OperationalFrame` | `SplitWorkbench` (`SplitView` + `DataGrid`)
- Server Mode: `MATERIAL_RECONCILIATION` (`DOM-MODE-1`)
- RBAC Guards: `ProtectedRoute` | `RoleGuard` | `ActionGuard` | `ActionAvailability` with token permission
- 6 UI States: `loading` | `empty` | `error` | `permission-denied` | `partial` | `write-reconciliation`
- Primitives & Composites: `components/ui/*` (`Button`, `Select`, `Input`, `Badge`, `Num`, `InlineBanner`), `components/workbench/*` (`AppShell`, `WorkspaceFrame`, `WorkspaceHeader`, `TelemetrySubbar`, `StateBoundary`, `LocalizedBoundary`, `DataGrid`, `PaginationBar`, `SplitView`)
- Compliance Pledges: D6 (>=12px), D7 (1 primary), T7 (frozen header/col), T8 (compact density 36-40px), M1.2 (1 blocking modal), N6 (nested sidebar v2), Single Styling Authority (`frontend/src/styles/index.css`)
```

---

## 3. Technical Design by Tree Layer

### 3.1 `G1` — MRX Dashboard (`ReconciliationDashboardPage.tsx`) `keepPreviousData` on Filter Transitions (`CLS: 0.02914 -> 0.00000`)

In [`frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/dashboard/ReconciliationDashboardPage.tsx#L82-L115):
- Track `current = state?.key === cacheKey ? state : null` and `exactData = current?.data ?? serverStateCache.get<DashboardData>(cacheKey)?.data ?? null`.
- Retain the previous filter's `DashboardData` during in-flight filter/page switches when no error has occurred for the current key:
  ```ts
  const isTransitioning = !exactData && Boolean(state?.data) && !current?.error;
  const data = exactData ?? (isTransitioning ? state!.data : null);
  ```
- Compute `refreshing = current?.refreshing ?? (Boolean(exactData) || isTransitioning);`.
- Pass `isLoading={!data && !current?.error}`, `hasExistingData={Boolean(data)}`, and `isPreviousData={isTransitioning}` to both the KPI `<StateBoundary>` (`L200`) and the Batch Table `<StateBoundary>` (`L210`).
- Result: Switching Customer or Period on `/` keeps all 4 KPI cards, the 4-step pipeline section (`y = 227px`), and the `<DataGrid>` mounted with `opacity-70` and the top progress bar during the `50ms` fetch (`CLS = 0.00000`, `tableCount = 1`, `emptyBusyCount = 0`).

### 3.2 `G2` — Immediate `<WorkbenchSkeleton />` in `StateBoundary.tsx` and `App.tsx` (`emptyBusyCount: 1 -> 0`)

1. **[`frontend/src/components/workbench/StateBoundary.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/components/workbench/StateBoundary.tsx#L182-L213):**
   - Change the default `skeletonDelay` on line `182` from `150` to `0` (`const skeletonDelay = typeof delayMs === 'number' ? delayMs : 0;`) and pass `minDurationMs = 0` to `useDeferredSkeleton(Boolean(isLoading && !hasExistingData), skeletonDelay, 0)`.
   - When `isLoading && !hasExistingData` (with default `delayMs = 0`), `isDeferredLoading` is immediately `true` on Frame 0, rendering `customSkeleton` or `<WorkbenchSkeleton />` immediately without flashing a blank `<div bg-transparent aria-busy="true" />`, and releasing the skeleton on the exact frame real data arrives (`minDurationMs = 0`).
   - Note: `useDeferredSkeleton.ts` itself remains unchanged so `useDeferredSkeleton.test.ts` (`useDeferredSkeleton(loading, 150, 250)`) continues to pass 100%.
2. **[`frontend/src/App.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/App.tsx#L60):**
   - Replace `<Suspense fallback={<div className="flex-1 min-h-0 w-full bg-white" aria-busy="true" />}>` with `<Suspense fallback={<WorkbenchSkeleton geometry={{ kind: 'table', columns: 6, rows: 8 }} />}>` so lazy chunk loading never emits a blank `aria-busy="true"` div without skeleton geometry.

### 3.3 `G3` — Eliminating Destructive `key` Remounts & Retaining Previous Data in `MrxQuantityInspectionPage` & `AdminBomBranch`

1. **[`frontend/src/features/weekly-menu/WeeklyMenuPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/weekly-menu/WeeklyMenuPage.tsx#L55-L58):**
   - Remove `key={`${view}:${searchParams.get('customerId') ?? ''}:${searchParams.get('weekStartDate') ?? ''}`}` from `<MrxQuantityInspectionPage view={view === 'mrx-materials' ? 'materials' : 'plans'} />`.
2. **[`frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/weekly-menu/hooks/useMrxQuantityInspection.ts#L32-L60):**
   - Track whether `sourceQuery` is transitioning to a new valid `(customerId, weekStartDate)` while holding previous data:
     ```ts
     const exactSource = sourceQuery.data?.customerId === customerId && sourceQuery.data.weekStartDate === weekStartDate ? sourceQuery.data : null;
     const isTransitioningSource = Boolean(validScope && !exactSource && sourceQuery.data && (sourceQuery.stateProps.isFetching || sourceQuery.stateProps.isLoading || sourceQuery.stateProps.isPreviousData) && !sourceQuery.stateProps.error);
     const source = exactSource ?? (isTransitioningSource ? sourceQuery.data : null);
     ```
   - Track whether `inspection` is transitioning across `pageNumber` / `pageSize` / `searchKeyword` / `menuVersionId` within the same `view`:
     ```ts
     const exactResult = inspection.data?.view === view && inspection.data.data.menuVersionId === menuVersionId ? inspection.data : null;
     const isTransitioningResult = Boolean(published && !exactResult && inspection.data?.view === view && !inspection.stateProps.error && (inspection.stateProps.isFetching || inspection.stateProps.isLoading || inspection.stateProps.isPreviousData));
     const result = exactResult ?? (isTransitioningResult ? inspection.data : null);
     const isPreviousData = Boolean(result && (isTransitioningSource || isTransitioningResult || inspection.stateProps.isPreviousData));
     ```
   - Only update `workspaceSessionStore.setScope` (`L34`) when `exactSource?.menuVersionId` is present (never persist a previous scope's `customerId`/`weekStartDate` onto the new scope).
3. **[`frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/weekly-menu/MrxQuantityInspectionPage.tsx#L84-L138):**
   - Reset `fingerprint.current = null` and `setRevisionNotice(false)` when `customerId` or `weekStartDate` changes so switching customers/weeks never triggers a false `"Nguồn đã thay đổi"` banner, while fingerprint changes within the same `(customerId, weekStartDate)` still show the notice.
   - Remove `key={`${result.view}:${result.data.menuVersionId}`}` on line `131` (`<div className="flex-1 min-h-0 flex flex-col">`).
   - Always render `<PaginationBar>` at the bottom of `MrxQuantityInspectionPage` (using `totalCount={result?.data.page.totalCount}`, `totalPages={result?.data.page.totalPages}`, `hasPrev={result?.data.page.hasPrev ?? false}`, `hasNext={result?.data.page.hasNext ?? false}`, `pending={workspace.stateProps.isFetching || workspace.stateProps.isLoading}`) so the footer bar never unmounts/remounts during loading.
4. **[`frontend/src/features/admin/branches/AdminBomBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/branches/AdminBomBranch.tsx#L280-L286):**
   - Remove `key={`${statusFilter}:${searchQuery}:${currentPage}:${pageSize}`}` from `<DataGrid />`.

### 3.4 `G4` — Deferring `inFlightWorkbenchQueries` Abort Across `<React.StrictMode>` Remounts (`useWorkbenchQuery.ts`)

In [`frontend/src/hooks/useWorkbenchQuery.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/hooks/useWorkbenchQuery.ts#L220-L278):
- When `useEffect` cleans up (`L266-L277`), decrement `current.subscribers -= 1`, but defer the `if (current.subscribers <= 0)` abort check via `queueMicrotask`:
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
- Under `<React.StrictMode>`, Mount #1's cleanup decrements `subscribers` (`1 -> 0`), Mount #2's effect runs synchronously in the same tick and increments `subscribers` (`0 -> 1`), and when the microtask runs, `latest.subscribers === 1`, so `latest.controller.abort()` is **not** called! If the component genuinely unmounts (e.g., route change), `latest.subscribers` remains `0` in the microtask and `controller.abort()` executes cleanly.

### 3.5 `G5` — Scoped Refresh in `useReconciliationWorkspace.ts` Without Wiping Cross-Station MRX Caches

In [`frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts#L188-L198):
- In `handleRefresh` (user clicking `"Làm mới"` on `/reconciliation`), invalidate only the active reconciliation batch/report caches (`serverStateCache.delete(\`mrx_raw_batch_\${batchId}\`)`, `serverStateCache.delete(\`mrx_recon_\${batchId}_\${serviceDate}\`)`, `serverStateCache.delete('snapshot:mrx_reconciliation')`, `serverStateCache.deletePrefix('mrx_report_')`) and mark `mrx_` entries stale (`serverStateCache.invalidate('mrx_')`) instead of calling `invalidateMrxCaches()` (`deletePrefix('mrx_')` + `deletePrefix('snapshot:mrx_')`), which previously wiped out L1/L2 caches for `/weekly-menu`, `/warehouse`, and `/chef`.
- True write mutations (`handleComplete`, warehouse issue submit, source change approval) continue to call `invalidateMrxCaches()` as required by `E1`/`D6`.

### 3.6 `G6` — Deterministic `OrderBy` in Backend MRX Initializers & `WarehouseRepository`

1. **[`backend/src/IPCManagement.Api/Data/Repositories/WarehouseRepository.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/backend/src/IPCManagement.Api/Data/Repositories/WarehouseRepository.cs#L54-L64):**
   - Chain `.OrderBy(warehouse => warehouse.WarehouseId)` before `.Take(limit)` in `GetOperationalCandidatesAsync`.
2. **[`backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeInitializer.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationModeInitializer.cs#L48):**
   - Chain `.OrderBy(row => row.Id)` before `.Take(2)` in `ReadAuthorityAsync`.
3. **[`backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationToleranceInitializer.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationToleranceInitializer.cs#L55-L58):**
   - Chain `.OrderBy(row => row.ToleranceId)` before `.Take(2)` in `ReadAuthorityAsync`.

### 3.7 `G7` — Fixed Desktop Footer Height (`md:h-12 md:py-0`) in `PaginationBar.tsx`

In [`frontend/src/components/workbench/PaginationBar.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/components/workbench/PaginationBar.tsx#L30):
- Update the non-selector `<nav>` class from:
  `min-h-12 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 pt-2 shrink-0 ${placement === 'footer' ? 'pb-16 md:pb-2' : 'pb-2'}`
  to:
  `min-h-12 md:h-12 flex flex-wrap md:flex-nowrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 pt-1.5 shrink-0 ${placement === 'footer' ? 'pb-16 md:py-0' : 'pb-1.5 md:py-0'}`
- This locks the desktop footer height at exactly `48px` (`h-12`) whether `showControls` is `true` or `false`, while preserving the mobile `<md` `pb-16` floating-menu clearance.

---

## 4. Acceptance Criteria (`AC-G1` to `AC-G7`)

- **`AC-G1`:** Switching Customer or Period on `ReconciliationDashboardPage` (`/`) retains the previous `DashboardData` (`isPreviousData = true`, `hasExistingData = true`) while the new filter loads; live CDP `CLS` on `MRX_02_Dashboard_CustomerSwitch` and `MRX_03_Dashboard_PeriodSwitch` is `0.00000`, `emptyBusyCount = 0`, and `tableUnmountedMidTransition = false`.
- **`AC-G2`:** `StateBoundary` (default `delayMs = 0`) and `App.tsx` `<Suspense>` render `<WorkbenchSkeleton />` immediately on cold load without a `0–150ms` empty `aria-busy="true"` div (`emptyBusyCount = 0` across all MRX CDP scenarios).
- **`AC-G3`:** `WeeklyMenuPage`, `MrxQuantityInspectionPage`, `useMrxQuantityInspection`, and `AdminBomBranch` do not remount `<MrxQuantityInspectionPage />` or `<DataGrid />` when `customerId`, `weekStartDate`, `view`, `searchQuery`, `statusFilter`, or `page` changes, and `<PaginationBar>` remains mounted during loading.
- **`AC-G4`:** Mounting `MrxMultiCustomerPreparationWorkbench` (`/warehouse?view=mrx-preparation`) under `<React.StrictMode>` issues exactly 1 `GET /api/reconciliation/preparation` request with `0` `HTTP 499` aborts.
- **`AC-G5`:** Clicking `"Làm mới"` on `/reconciliation` refreshes the active reconciliation batch/report data and marks `mrx_` entries stale without deleting cached entries for other MRX workbenches (`mrx_source_*`, `mrx_daily_*`, `mrx_cooking_*`).
- **`AC-G6`:** `WarehouseRepository.GetOperationalCandidatesAsync`, `SystemOperationModeInitializer.ReadAuthorityAsync`, and `ReconciliationToleranceInitializer.ReadAuthorityAsync` include deterministic `.OrderBy(...)` before `.Take(...)`, producing `0` EF Core `RowLimitingOperationWithoutOrderByWarning` logs in Backend Serilog from MRX startup/endpoints.
- **`AC-G7`:** `PaginationBar` maintains a constant `48px` (`md:h-12`) desktop height regardless of whether pagination controls are visible or hidden.
