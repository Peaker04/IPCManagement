# MRX Final 5-Verdict Closure (`L1`–`L5`) — Design Specification

- **Date:** `2026-11-09`
- **Status:** `READY FOR REVIEW`
- **Mode Isolation (`DOM-MODE-1`):** `MATERIAL_RECONCILIATION` (`MRX`) & shared admin/settings workbenches; zero cross-contamination with `DEFAULT` operational workflows.
- **FR / NFR Mapping:** `FR-CHEF`, `FR-CAT`, `FR-ADMIN`, `FR-WH`, `FR-RECON`, `NFR-UI-STABILITY`

---

## 1. Intent & Why

After completing rounds `G1–G9`, `H1–H12`, `I1–I10`, `J1–J6`, and `K1–K6`, a line-by-line `/ponytail-audit` re-evaluation across all 18 MRX route/view leaves uncovered **5 remaining edge cases (`#1`–`#5` / `L1`–`L5`)** where interacting with a shift filter, search box, document-type tab, or customer selector on a report tab still unmounts a `<SplitView>` or `<DataGrid>` sticky `<thead>` seam or triggers a 2-step render waterfall.

Closing these 5 items brings all 18/18 leaves of the MRX Root-to-Leaf Architectural Tree to **100% zero seam-flash and zero multi-render waterfall**.

---

## 2. Scoped Pre-Code UI Gate Block

### Scoped Pre-Code UI Gate Block
- Route: `/chef?view=mrx-cooking`, `/admin-data?view=ingredients|dishes`, `/settings/approval-rules`, `/warehouse?view=mrx-deltas`, `/reconciliation?view=variances|transactions|audit`
- Single Primary Work Object: `SplitWorkbench` (`/chef?view=mrx-cooking`), `OperationalFrame` (`/admin-data`, `/settings/approval-rules`, `/warehouse`, `/reconciliation`)
- Server Mode: `MATERIAL_RECONCILIATION` (`DOM-MODE-1`)
- RBAC Guards: Existing `ProtectedRoute`, `RoleGuard`, `canNavigate` preserved
- 6 UI States: `loading | empty | error | permission-denied | partial | write-reconciliation`
- Primitives & Composites: `components/ui/*` (`Button`, `Badge`, `Num`, `Tabs`), `components/workbench/*` (`StateBoundary`, `DataGrid`, `SplitView`, `TelemetrySubbar`, `LocalFindBar`, `PaginationBar`)
- Compliance Pledges: D6 (>=12px), D7 (1 primary), T7 (frozen header/col), T8 (compact density 36-40px), M1.2 (1 blocking modal), N6 (nested sidebar v2)

---

## 3. Root-Cause & Architectural Specification (`L1`–`L5`)

### 3.1 `L1` (Must fix): `/chef?view=mrx-cooking` — Preserve `<SplitView>` & Ingredient `<thead>` Seam on Filter/Search Empty (`MrxCookingWorkbench.tsx`, `MrxCookingDishListBranch.tsx`)
- **Current Problem:** In [`MrxCookingWorkbench.tsx:L267`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/MrxCookingWorkbench.tsx#L267), `<StateBoundary>` receives `isEmpty={stateProps.isEmpty || isLegacyLineageMissing || isFilteredEmpty}`. Whenever a shift filter (`Ca sáng` / `Ca chiều`) or `<LocalFindBar>` search matches `0` dishes (`isFilteredEmpty = hasData && visibleDishGroups.length === 0`), `<StateBoundary>` unmounts `<MrxCookingDishListBranch>` (`<SplitView>` + vertical divider + right-hand ingredient `<table>`/`<thead>`) and replaces it with a full-width centered `EmptyState`.
- **Design Fix:**
  1. In [`MrxCookingWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/MrxCookingWorkbench.tsx#L267-L281), remove `isFilteredEmpty` from `<StateBoundary isEmpty={stateProps.isEmpty || isLegacyLineageMissing}>`.
  2. Pass `emptyFilterState?: { title: string; description: string; actionLabel: string; onAction: () => void }` into [`MrxCookingDishListBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx) when `isFilteredEmpty` is `true`:
     - `title`: `queryText ? 'Không có món khớp tìm kiếm' : 'Không có món cho ca đã chọn'`
     - `description`: `'Xóa tìm kiếm hoặc chọn ca khác. Tệp tải xuống vẫn gồm cả lô.'`
     - `actionLabel`: `queryText ? 'Xóa tìm trong phiếu nấu' : 'Xem tất cả ca'`
     - `onAction`: `() => (queryText ? setSearchTerm('') : setSelectedShift('ALL'))`
  3. Inside [`MrxCookingDishListBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx), keep `<SplitView>` mounted even when `groups.length === 0`:
     - In `master`, if `groups.length === 0 && emptyFilterState`, render a compact panel with `<h3 className="text-sm font-semibold text-slate-800">{emptyFilterState.title}</h3>`, `<p className="text-xs text-slate-500">{emptyFilterState.description}</p>`, and `<Button variant="outline" size="xs" onClick={emptyFilterState.onAction}>{emptyFilterState.actionLabel}</Button>`.
     - In `detail`, always render the right-hand Dish Header (`min-h-[52px] px-4 py-2 bg-slate-50 border-b border-slate-200`) and `<table className="w-full min-w-[640px] text-sm border-collapse table-fixed">` with its sticky `<thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200">` (`Nguyên liệu`, `ĐVT`, `Định mức / suất`, `Hao hụt (%)`, `Tổng lượng cần`); when `!selected`, render a single `<tr><td colSpan={5} className="p-8 text-center text-xs text-slate-500">Chọn món hoặc điều chỉnh bộ lọc để xem định mức nguyên liệu.</td></tr>` inside `<tbody>`.

### 3.2 `L2` (Must fix): `/admin-data?view=ingredients` & `/admin-data?view=dishes` — Preserve `<DataGrid>` Sticky `<thead>` Seam on Search Empty (`AdminCatalogBranch.tsx`)
- **Current Problem:** In [`AdminCatalogBranch.tsx:L258`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/branches/AdminCatalogBranch.tsx#L258), `<StateBoundary>` receives `isEmpty={stateProps.isEmpty && !needsPageCorrection}` even when `Boolean(keyword)` is true (`searchKeyword.trim().length > 0`). When a search keyword returns `0` items (`items.length === 0`), `<StateBoundary>` unmounts `<DataGrid>` and its sticky `<thead>` right below `<TelemetrySubbar>`.
- **Design Fix:**
  1. In [`AdminCatalogBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/branches/AdminCatalogBranch.tsx#L254-L279), define `const isFilterEmpty = Boolean(keyword) && stateProps.isEmpty && !needsPageCorrection;`.
  2. Pass `isEmpty={stateProps.isEmpty && !needsPageCorrection && !isFilterEmpty}` to `<StateBoundary>`.
  3. Pass `emptyState` to both `<DataGrid<IngredientItem>>` and `<DataGrid<DishItem>>` when `isFilterEmpty` is `true`:
     ```tsx
     const filterEmptyState = isFilterEmpty ? (
       <div className="py-12 text-center space-y-2">
         <p className="text-sm font-semibold text-slate-700">Không tìm thấy danh mục phù hợp</p>
         <p className="text-xs text-slate-500">Thử từ khóa khác hoặc xóa tìm kiếm.</p>
         <Button variant="outline" size="xs" onClick={() => setSearchKeyword('')}>
           Xóa từ khóa tìm kiếm
         </Button>
       </div>
     ) : undefined;
     ```
     This keeps `<DataGrid>` and its sticky `<thead>` permanently mounted (`tableCount = 1`) during all search interactions while preserving `<StateBoundary>`'s true-empty state (`"Chưa có danh mục nguyên liệu"` / `"Chưa có danh mục món ăn"`) when the catalog itself is empty (`!keyword && stateProps.isEmpty`).

### 3.3 `L3` (Should fix): `/settings/approval-rules` — Preserve `<DataGrid>` Sticky `<thead>` Seam on Empty Document-Type Tab (`ApprovalRulesPage.tsx`)
- **Current Problem:** In [`ApprovalRulesPage.tsx:L78`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/ApprovalRulesPage.tsx#L78), `<StateBoundary>` receives `isEmpty={!isLoading && !error && filteredRules.length === 0}`. Clicking a document-type tab (`purchase-order`, `material-demand`, `menu-amendment`) that has `0` rules unmounts `<DataGrid>` and its sticky `<thead>` right below `<TelemetrySubbar>`.
- **Design Fix:**
  1. In [`ApprovalRulesPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/ApprovalRulesPage.tsx#L74-L87), set `isEmpty={false}` on `<StateBoundary>` when `!isLoading && !error`.
  2. Pass `emptyState` into `<DataGrid data={filteredRules} columns={columns} keyExtractor={(row) => row.ruleId} emptyState={...} />` rendering:
     - `<p className="text-sm font-semibold text-slate-700">Chưa có quy tắc phê duyệt</p>`
     - `<p className="text-xs text-slate-500">Chưa thiết lập quy tắc phê duyệt cho loại chứng từ này.</p>`
     - `<Button variant="outline" size="xs" onClick={loadData}>Làm mới quy tắc</Button>`
  3. Lock the counter width in `<TelemetrySubbar>` (`<span className="text-slate-500 tabular-nums"><strong className="inline-block min-w-[2ch] text-right font-mono text-slate-900">{filteredRules.length}</strong> quy tắc trong phạm vi</span>`).

### 3.4 `L4` (Should fix): `/warehouse?view=mrx-deltas` — Persistent Subbar Telemetry Pill & `<DataGrid>` Sticky `<thead>` Seam (`MrxSourceDeltaWorkbench.tsx`, `MrxDeltaTableBranch.tsx`)
- **Current Problem:**
  1. In [`MrxSourceDeltaWorkbench.tsx:L59`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx#L59), `telemetryPills={displayed ? <span className="text-xs">Tổng số thay đổi: <Num value={displayed.totalCount} /></span> : undefined}` is `undefined` during initial load and mounts once `displayed` arrives.
  2. At `L61`, `<StateBoundary {...stateProps}>` unmounts `<MrxDeltaTableBranch>` (`<DataGrid>`) when `displayed.items.length === 0`.
- **Design Fix:**
  1. Always render `telemetryPills` in [`MrxSourceDeltaWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx#L58-L60) with a fixed-width numeric slot:
     ```tsx
     telemetryPills={
       <span className="text-xs">
         Tổng số thay đổi:{' '}
         <strong className="inline-block min-w-[3ch] text-right font-mono tabular-nums text-slate-900">
           {displayed ? <Num value={displayed.totalCount} /> : '—'}
         </strong>
       </span>
     }
     ```
  2. Pass `isEmpty={false}` to `<StateBoundary>` in `MrxSourceDeltaWorkbench.tsx` and pass `emptyState` to `<DataGrid>` in [`MrxDeltaTableBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/branches/MrxDeltaTableBranch.tsx) rendering `"Chưa có lịch sử thay đổi nguồn"` and `"Các thay đổi nguồn và dữ liệu tương thích cũ được giữ nguyên để tra cứu."` inside `<tbody>` so `<DataGrid>` and its sticky `<thead>` stay mounted (`tableCount = 1`).

### 3.5 `L5` (Should fix): `/reconciliation` — Atomic Customer Switch on Report Tabs (`variances`, `transactions`, `audit`) (`useReconciliationWorkspace.ts`)
- **Current Problem:** In [`useReconciliationWorkspace.ts:L279-L286`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts#L279-L286), `getBatchPage.then` only prefetches `mrxApi.getBatchSummary(selected, nextServiceDate)` when `activeReportTabRef.current === 'lines'`. When the user is on `?view=variances`, `?view=transactions`, or `?view=audit` and switches Customer, `getBatchPage.then` immediately commits `setBatches(sortedItems)` and `setBatchId(selected)` (Render #1: header batch dropdown shows Customer B's batch while the report table still shows Customer A's rows), and only afterwards does `useReconciliationReports` fetch the new batch's report (Render #2).
- **Design Fix:**
  1. In [`useReconciliationWorkspace.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts), read `user` and `operationalMode` from `useAuth()`, and keep `auditSubTabRef = useRef(auditSubTab)` updated.
  2. Inside `getBatchPage.then`, when `selected && hasUserSwitchedScopeRef.current` and `activeReportTabRef.current` is `'variances' | 'transactions' | 'audit'`:
     - Compute the target report cache key matching [`useReconciliationReports.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/useReconciliationReports.ts#L38-L41):
       `const reportTab = activeReportTabRef.current;`
       `const subTab = reportTab === 'audit' ? auditSubTabRef.current : '';`
       `const reportCacheKey = \`mrx_report_${user?.userId}_${operationalMode}_${reportTab}_${subTab}_${selected}_1\`;`
     - If `!serverStateCache.get(reportCacheKey)?.data`, await the corresponding report call (`mrxApi.getVarianceRegister(selected)`, `mrxApi.getTransactionsHistory({ batchId: selected, pageNumber: 1, pageSize: 25 })`, `mrxApi.getSourceChanges(selected)`, or `mrxApi.getAuditTrail(selected, 1, 50)`) and write the resulting `ReportData` object into `serverStateCache.set(reportCacheKey, ...)` **before** calling `setBatches(sortedItems)` and `setBatchId(selected)`.
  3. Because `useReconciliationReports` already performs synchronous render-phase hydration when `serverStateCache.get(cacheKey)` is warm (`K6`), committing `setBatchId(selected)` after warming `reportCacheKey` causes both the header batch selector and the report table rows to update to Customer B in **1 atomic React render**!

---

## 4. Non-Goals & Anti-Goals

- **Non-Goals:** No Backend API schema changes, no DB migrations, no changes to `DEFAULT` mode screens.
- **Anti-Goals:** Never unmount `<DataGrid>` or `<SplitView>` on filter-empty / tab-empty states; never introduce artificial delays or spinners that hide existing data.

---

## 5. Acceptance Criteria (`AC-L1` to `AC-L5`)

- **`AC-L1` (`/chef?view=mrx-cooking`):** Filtering by shift (`Ca sáng` / `Ca chiều`) or `<LocalFindBar>` keyword with `0` matching dishes keeps `<SplitView>` and the right-hand ingredient `<table>` + sticky `<thead>` mounted (`tableCount = 1`), while displaying the exact recovery heading (`"Không có món khớp tìm kiếm"` / `"Không có món cho ca đã chọn"`) and reset button (`"Xóa tìm trong phiếu nấu"` / `"Xem tất cả ca"`).
- **`AC-L2` (`/admin-data?view=ingredients|dishes`):** Searching with a keyword that returns `0` items keeps `<DataGrid>` and its sticky `<thead>` mounted (`tableCount = 1`) and renders `"Không tìm thấy danh mục phù hợp"` + `"Xóa từ khóa tìm kiếm"` inside `<tbody>`.
- **`AC-L3` (`/settings/approval-rules`):** Switching to a document-type tab with `0` rules keeps `<DataGrid>` and its sticky `<thead>` mounted (`tableCount = 1`) and renders `"Chưa có quy tắc phê duyệt"` inside `<tbody>`.
- **`AC-L4` (`/warehouse?view=mrx-deltas`):** `TelemetrySubbar` renders `Tổng số thay đổi:` on Frame 0 (`'—'` while loading, `<Num>` when loaded), and `<MrxDeltaTableBranch>` keeps `<DataGrid>` and its sticky `<thead>` mounted (`tableCount = 1`) even when `items.length === 0`.
- **`AC-L5` (`/reconciliation?view=variances|transactions|audit`):** Switching Customer while on `variances`, `transactions`, or `audit` pre-warms the target batch's report cache entry before committing `setBatches` and `setBatchId`, updating header batch options and report table rows atomically in 1 render.
