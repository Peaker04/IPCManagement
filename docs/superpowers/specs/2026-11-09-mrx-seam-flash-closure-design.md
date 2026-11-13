# MRX Root-to-Leaf Seam-Flash Closure Design Specification (`H1`–`H12`)

- **Date:** 2026-11-09
- **Scope (`DOM-MODE-1`):** `MATERIAL_RECONCILIATION` (`MRX`) operational mode routes and shared MRX catalog/system routes across all 18 route/view leaves:
  1. `/` ([`ReconciliationDashboardPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/dashboard/ReconciliationDashboardPage.tsx))
  2. `/weekly-menu?view=mrx-batch` ([`MrxBatchWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/MrxBatchWorkbench.tsx), [`useMrxSourceEdit.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/hooks/useMrxSourceEdit.ts))
  3. `/weekly-menu?view=mrx-materials` ([`MrxQuantityInspectionPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/MrxQuantityInspectionPage.tsx), [`useMrxQuantityInspection.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/hooks/useMrxQuantityInspection.ts))
  4. `/weekly-menu?view=mrx-plans` ([`MrxQuantityInspectionPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/MrxQuantityInspectionPage.tsx), [`useMrxQuantityInspection.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/hooks/useMrxQuantityInspection.ts))
  5. `/warehouse?view=mrx-daily` ([`MrxDailyIssueWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx), [`MrxDailyHeaderBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/components/MrxDailyHeaderBranch.tsx), [`MrxDailyLinesBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/components/MrxDailyLinesBranch.tsx))
  6. `/warehouse?view=mrx-prep` ([`MrxMultiCustomerPreparationWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx), [`MrxPrepAllocationsBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/components/MrxPrepAllocationsBranch.tsx))
  7. `/warehouse?view=mrx-delta` ([`MrxSourceDeltaWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx))
  8. `/chef` ([`MrxCookingWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/MrxCookingWorkbench.tsx), [`MrxCookingHeaderBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/components/MrxCookingHeaderBranch.tsx), [`MrxCookingDishListBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/components/MrxCookingDishListBranch.tsx))
  9. `/reconciliation?view=summary` ([`ReconciliationPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/ReconciliationPage.tsx), [`ReconciliationLinesBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationLinesBranch.tsx), [`ReconciliationLinesFilterToolbar.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationLinesFilterToolbar.tsx))
  10. `/reconciliation?view=differences` ([`ReconciliationVariancesBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationVariancesBranch.tsx), [`ReconciliationReportTables.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/ReconciliationReportTables.tsx))
  11. `/reconciliation?view=export-history` ([`ReconciliationIssueHistoryBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationIssueHistoryBranch.tsx))
  12. `/reconciliation?view=audit` (Sub-tab `Kho` & Sub-tab `Nguồn & BOM` in [`ReconciliationAuditBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationAuditBranch.tsx))
  13. `/reconciliation?view=monthly` ([`ReconciliationMonthlySummaryBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationMonthlySummaryBranch.tsx))
  14. `/admin-data?view=ingredients` ([`AdminCatalogBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/components/AdminCatalogBranch.tsx))
  15. `/admin-data?view=dishes` ([`AdminCatalogBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/components/AdminCatalogBranch.tsx))
  16. `/admin-data?view=bom` ([`AdminBomBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/components/AdminBomBranch.tsx))
  17. `/admin-data?view=customers` ([`AdminCustomersBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/components/AdminCustomersBranch.tsx))
  18. `/settings/advanced` ([`AdvancedSettingsPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/system-operation/AdvancedSettingsPage.tsx))

---

## 1. Architectural Problem Statement

Every MRX operational screen stacks three horizontal layout seams inside [`WorkspaceFrame`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/components/common/WorkspaceFrame.tsx):
1. **Seam A (`CommandBar` ↔ `TelemetrySubbar`):** `border-b border-slate-200` separating the primary command bar from telemetry pills, sub-view tabs, and date tabs (`min-h-[44px]`).
2. **Seam B (`TelemetrySubbar` ↔ `LocalFindBar` / Filter Toolbar ↔ `DataGrid` `<thead>`):** The structural junction between filter controls and the sticky `<thead>` of the data table (`bg-slate-100/95 border-b border-slate-200`).
3. **Seam C (`DataGrid` `<tbody>` ↔ `PaginationBar` / Bottom Status Strip):** The bottom boundary of the table scroll region.

When the user interacts with filters, search inputs, date tabs, sub-tabs, or action buttons, visual flashes ("chớp nháy ở đường nối các bảng thông tin bên dưới") occur whenever a component along Seams A, B, or C:
- Unmounts `<table>` and `<thead className="sticky top-0">` on 0-row filter results (`H2`),
- Conditionally mounts/unmounts intermediate banners, filter toolbars, or pagination bars between `TelemetrySubbar` and `DataGrid` (`H3`, `H4`, `H6`, `H7`, `H11`),
- Drops hook state to `null` or delays cache hydration via `setTimeout(..., 0)` on scope switches (`H1`, `H5`, `H7`, `H9`),
- Remounts date inputs via dynamic `key` props or triggers `animate-in fade-in` on existing status badges (`H3`, `H5`, `H10`, `H11`), or
- Applies immediate `opacity-70` dimming across filter toolbars and tables on sub-150ms transitions (`H4`, `H12`).

---

## 2. Root-to-Leaf Remediation Design (`H1`–`H12`)

### 2.1 Shared Seam Primitives (`H2`, `H12`)
- **`H2` ([`DataGrid.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/components/ui/DataGrid.tsx)):**
  - When `data.length === 0 && (emptyState || emptyMessage)`, do not unmount the `<div className="w-full h-full overflow-auto"><table ...><thead className="sticky top-0 ...">` structure.
  - Instead, keep `<table>` and `<thead className="sticky top-0 z-20 bg-slate-100/95 ...">` mounted so Seam B never loses its `40px` column header bar, and render `emptyState || emptyMessage` inside `<tbody><tr><td colSpan={columns.length} className="p-8 text-center align-middle">...</td></tr></tbody>`.
- **`H12` ([`StateBoundary.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/components/common/StateBoundary.tsx) & [`ReconciliationReportTables.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/ReconciliationReportTables.tsx)):**
  - Add CSS `delay-150` (`transition-opacity duration-150 delay-150`) to the `isPreviousData` dimming wrapper and top progressbar so fast local/cached filter transitions (`< 150ms`) never visually flash to 70% opacity in the browser while preserving synchronous DOM classes for contract tests.

### 2.2 `/weekly-menu` MRX Views (`H1`, `H7`)
- **`H1` ([`useMrxSourceEdit.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/hooks/useMrxSourceEdit.ts) & [`MrxBatchWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/MrxBatchWorkbench.tsx)):**
  - Hydrate `rawEditScope`, `draft`, `dishOptions`, and `loadedScopeKey` synchronously when `serverStateCache` already holds a warm entry for `mrx_edit_scope_${customerId}_${weekStartDate}_${sourceVersionKey}`.
  - Remove `window.setTimeout(..., 0)` inside `useEffect` in `useMrxSourceEdit.ts` so `void load()` runs immediately in the effect.
  - Retain `rawEditScope` across scope transitions (`editScope = scope.enabled !== false ? (loadedScopeKey === scopeKey ? rawEditScope : (isLoading && !error ? rawEditScope : null)) : null`) and expose `isTransitioningScope: boolean` so `MrxBatchWorkbench.tsx` keeps `<MrxSourceEditGrid>` mounted with `disabled={busy || sourceEdit.isLoading}` instead of collapsing Seam B into `<p role="status">Đang tải phạm vi nguồn tuần MRX…</p>`.
- **`H7` ([`useMrxQuantityInspection.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/hooks/useMrxQuantityInspection.ts) & [`MrxQuantityInspectionPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/planning/MrxQuantityInspectionPage.tsx)):**
  - In `useMrxQuantityInspection.ts`, retain `inspection.data` during `mrx-materials <-> mrx-plans` view switches for the same `menuVersionId` (`isInspectionTransitioning = Boolean(inspection.data && (inspection.isLoading || inspection.data.menuVersionId !== menuVersionId || inspection.data.view !== view))`).
  - In `MrxQuantityInspectionPage.tsx`, add `min-h-11` (`44px`) to the telemetry strip so Seam A matches `TelemetrySubbar`, and always render the `<h2 className="px-4 py-2 text-sm font-semibold border-b border-slate-200 bg-slate-50 shrink-0">` header inside `MaterialsTable`'s detail pane so clicking a row in the master table never shifts the detail pane top seam by `37px`.

### 2.3 `/warehouse` MRX Views (`H3`, `H8`, `H9`)
- **`H3` ([`MrxDailyHeaderBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/components/MrxDailyHeaderBranch.tsx), [`MrxDailyLinesBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/components/MrxDailyLinesBranch.tsx), [`MrxDailyIssueWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx)):**
  - Remove `key={activeBatchId}` from `<VietnameseDateInput />` in `MrxDailyHeaderBranch.tsx` and remove `animate-in fade-in duration-150` from the status `<Badge>`.
  - In `MrxDailyLinesBranch.tsx`, relocate the revision notice (`Định lượng đã được điều chỉnh` / `Lúc ... bởi ...`) from a `52px` conditional `<InlineBanner>` above `<LocalFindBar>` into the right-side `children` slot of `<LocalFindBar>` so switching between `T2..T7` and `Cả tuần` has zero vertical jump at Seam B while preserving exact text and semantics.
  - In `MrxDailyIssueWorkbench.tsx`, keep `<MrxDailyDateTabsBranch>` mounted in `<TelemetrySubbar>` when `activeTab === 'history'` and include `<LocalFindBar>` at Seam B of the `Lịch sử phiếu` tab so switching `Định lượng xuất ca <-> Lịch sử phiếu` keeps both Seam A and Seam B stationary.
- **`H8` ([`MrxMultiCustomerPreparationWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx) & [`MrxPrepAllocationsBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/components/MrxPrepAllocationsBranch.tsx)):**
  - Lock column 0 width to `'320px'` in `MrxMultiCustomerPreparationWorkbench.tsx` regardless of whether `activeBatches.length` is `1` or `> 1`.
  - Change the outer wrapper in `MrxPrepAllocationsBranch.tsx` from `overflow-auto` to `overflow-hidden` so `<DataGrid>` is the single scroll container below `<LocalFindBar>`.
- **`H9` ([`MrxSourceDeltaWorkbench.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx)):**
  - Bind `telemetryPills` to `displayed` instead of `current` so `Tổng số thay đổi` never unmounts during pagination.

### 2.4 `/reconciliation` 5 Sub-Views (`H4`)
- **`H4` ([`ReconciliationPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/ReconciliationPage.tsx), [`ReconciliationLinesBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationLinesBranch.tsx), [`ReconciliationLinesFilterToolbar.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationLinesFilterToolbar.tsx), [`ReconciliationVariancesBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationVariancesBranch.tsx), [`ReconciliationAuditBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/reconciliation/components/ReconciliationAuditBranch.tsx)):**
  - Keep `<LocalFindBar>` unconditionally mounted at Seam B in `ReconciliationVariancesBranch.tsx` (`view=differences`) even when `report.rows.length === 0`.
  - Keep `<LocalFindBar>` and `<PaginationBar>` mounted in both `auditSubTab === 'warehouse'` and `auditSubTab === 'source'` in `ReconciliationAuditBranch.tsx` (`view=audit`) so switching sub-tabs never shifts the top or bottom table seam.
  - Keep the `"Giải trình hàng loạt"` action slot stable in `ReconciliationLinesFilterToolbar.tsx` (`disabled={needsReviewCount <= 1}`) when bulk disposition is supported.

### 2.5 `/admin-data` 4 Sub-Views (`H5`)
- **`H5` ([`AdminCatalogBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/components/AdminCatalogBranch.tsx), [`AdminBomBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/components/AdminBomBranch.tsx), [`AdminCustomersBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/admin/components/AdminCustomersBranch.tsx)):**
  - In `AdminCatalogBranch.tsx`, share `scopeKey` across `ingredients` and `dishes` (`JSON.stringify(['admin_catalog', user?.userId, user?.roleCode, operationalMode])`) so switching `/admin-data?view=ingredients <-> /admin-data?view=dishes` retains previous rows via `isPreviousData` instead of unmounting `<DataGrid>` into `<WorkbenchSkeleton>`. Keep `pageInfo` stable during non-error transitions while resetting to `undefined` (`'— kết quả'`) when `stateProps.error` is present. Remove `animate-in fade-in duration-150` from the mode badge.
  - In `AdminBomBranch.tsx` and `AdminCustomersBranch.tsx`, replace the raw `33px` `<div className="px-4 py-2 ...">` telemetry strip with `<TelemetrySubbar>` (`min-h-[44px]`), keep the `tạm dừng` pill permanently mounted in `AdminCustomersBranch.tsx`, and use `hasExistingData && !error` for `<Num>` counts so background refreshes never flash `'—'`.

### 2.6 `/`, `/chef`, `/settings/advanced` (`H6`, `H10`, `H11`)
- **`H6` ([`ReconciliationDashboardPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/dashboard/ReconciliationDashboardPage.tsx)):**
  - Keep `<section aria-label="Công việc theo vai trò">` mounted whenever `data` is present (rendering a compact empty row `"Không có công việc chờ xử lý theo bộ lọc hiện tại."` when `data.summary.items.length === 0`) so changing Customer/Period filters never unmounts the upper section above the Batch table.
- **`H10` ([`MrxCookingHeaderBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/components/MrxCookingHeaderBranch.tsx) & [`MrxCookingDishListBranch.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/chef/components/MrxCookingDishListBranch.tsx)):**
  - Remove `animate-in fade-in duration-150` from the status badge in `MrxCookingHeaderBranch.tsx` and enforce `min-h-[52px]` on the `CookingDishDetail` header in `MrxCookingDishListBranch.tsx`.
- **`H11` ([`AdvancedSettingsPage.tsx`](file:///d:/ki7/PRN222%20Doanh%20Nghi%E1%BB%87p/IPCManagement/frontend/src/features/system-operation/AdvancedSettingsPage.tsx)):**
  - Remove `animate-in fade-in duration-150` from the mode badge and render `{feedback && <InlineBanner ... />}` inside `<WorkspaceFrame.Body>` below `<TelemetrySubbar>` so `TelemetrySubbar` never shifts down when saving mode.
