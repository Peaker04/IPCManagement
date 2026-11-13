# MRX Root-to-Leaf Seam-Flash Closure Implementation Plan (`H1`–`H12`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` and `superpowers:test-driven-development` to implement this plan task-by-task.

**Goal:** Eliminate all 12 Root-to-Leaf seam flashes (`H1`–`H12`) across all 18 MRX route/view leaves so filter, search, date-tab, sub-tab, and button interactions keep Seams A, B, and C stationary.

**Architecture:** Anchor horizontal seams (`TelemetrySubbar`, `LocalFindBar`, `DataGrid` `<thead>`, `PaginationBar`) in place across state transitions, hydrate cached MRX source-edit state synchronously, retain previous scope/view data during switches, and add a `150ms` CSS delay to `isPreviousData` opacity dimming.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (`frontend/src/styles/index.css`), Vitest, React Testing Library.

---

### Task 1: Shared Seam Primitives (`H2` + `H12`)

**Files:**
- Modify: `frontend/src/components/ui/DataGrid.tsx`
- Modify: `frontend/src/components/common/StateBoundary.tsx`
- Modify: `frontend/src/features/reconciliation/ReconciliationReportTables.tsx`
- Test: `frontend/src/test/Primitives.test.tsx`

- [ ] **Step 1 (`RED`): Add failing tests in `Primitives.test.tsx`**
  - Verify `DataGrid` keeps `<table>` and `columnheader` elements (`<thead>`) mounted when `data={[]}` and `emptyState` or `emptyMessage` is rendered.
  - Verify `StateBoundary` applies `delay-150` on the `isPreviousData` transition wrapper.
- [ ] **Step 2 (`GREEN`): Update `DataGrid.tsx`, `StateBoundary.tsx`, and `ReconciliationReportTables.tsx`**
  - Render `emptyState || emptyMessage` inside `<tbody><tr><td colSpan={columns.length}>` in `DataGrid.tsx` while preserving `<table>` and `<thead className="sticky top-0 ...">`.
  - Add `delay-150` to `transition-opacity duration-150` in `StateBoundary.tsx` and `ReconciliationReportTables.tsx`.

---

### Task 2: `/weekly-menu` MRX Views (`H1` + `H7`)

**Files:**
- Modify: `frontend/src/features/planning/hooks/useMrxSourceEdit.ts`
- Modify: `frontend/src/features/planning/MrxBatchWorkbench.tsx`
- Modify: `frontend/src/features/planning/hooks/useMrxQuantityInspection.ts`
- Modify: `frontend/src/features/planning/MrxQuantityInspectionPage.tsx`
- Test: `frontend/src/test/WeeklyMenu.test.tsx`

- [ ] **Step 1 (`RED`): Add failing tests in `WeeklyMenu.test.tsx`**
  - Verify `MrxBatchWorkbench` keeps `MrxSourceEditGrid` mounted when switching customer/week instead of unmounting into `"Đang tải phạm vi nguồn tuần MRX…"`.
  - Verify `MrxQuantityInspectionPage` renders a persistent `<h2>` header in `MaterialsTable`'s detail pane and retains view content across `mrx-materials <-> mrx-plans` transitions.
- [ ] **Step 2 (`GREEN`): Implement `H1` and `H7`**
  - Hydrate warm cache synchronously and retain `rawEditScope` during scope transitions in `useMrxSourceEdit.ts`; remove `setTimeout(..., 0)`.
  - Keep `MrxSourceEditGrid` mounted during scope transitions in `MrxBatchWorkbench.tsx`.
  - Retain `inspection.data` across `mrx-materials <-> mrx-plans` in `useMrxQuantityInspection.ts` and stabilize `MrxQuantityInspectionPage.tsx` seams (`min-h-11` subbar + persistent detail `<h2>`).

---

### Task 3: `/warehouse` MRX Views (`H3` + `H8` + `H9`)

**Files:**
- Modify: `frontend/src/features/warehouse/components/MrxDailyHeaderBranch.tsx`
- Modify: `frontend/src/features/warehouse/components/MrxDailyLinesBranch.tsx`
- Modify: `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`
- Modify: `frontend/src/features/warehouse/components/MrxPrepAllocationsBranch.tsx`
- Modify: `frontend/src/features/warehouse/MrxSourceDeltaWorkbench.tsx`
- Test: `frontend/src/test/Warehouse.test.tsx`

- [ ] **Step 1 (`RED`): Add failing tests in `Warehouse.test.tsx`**
  - Verify `MrxDailyLinesBranch` renders revision metadata inside `LocalFindBar` without mounting a separate banner above `LocalFindBar`, and `MrxDailyIssueWorkbench` keeps `MrxDailyDateTabsBranch` and `LocalFindBar` mounted on the `Lịch sử phiếu` tab.
  - Verify `MrxSourceDeltaWorkbench` keeps `Tổng số thay đổi` mounted in `TelemetrySubbar` during page changes.
- [ ] **Step 2 (`GREEN`): Implement `H3`, `H8`, and `H9`**
  - Update `MrxDailyHeaderBranch.tsx`, `MrxDailyLinesBranch.tsx`, `MrxDailyIssueWorkbench.tsx`, `MrxMultiCustomerPreparationWorkbench.tsx`, `MrxPrepAllocationsBranch.tsx`, and `MrxSourceDeltaWorkbench.tsx`.

---

### Task 4: `/reconciliation` 5 Sub-Views (`H4`)

**Files:**
- Modify: `frontend/src/features/reconciliation/components/ReconciliationLinesBranch.tsx`
- Modify: `frontend/src/features/reconciliation/components/ReconciliationLinesFilterToolbar.tsx`
- Modify: `frontend/src/features/reconciliation/components/ReconciliationVariancesBranch.tsx`
- Modify: `frontend/src/features/reconciliation/components/ReconciliationAuditBranch.tsx`
- Test: `frontend/src/test/Reconciliation.test.tsx`

- [ ] **Step 1 (`RED`): Add failing tests in `Reconciliation.test.tsx`**
  - Verify `ReconciliationVariancesBranch` keeps `LocalFindBar` (`Tìm nguyên liệu chênh lệch`) mounted even when `rows` is empty.
  - Verify `ReconciliationAuditBranch` keeps both `LocalFindBar` and `PaginationBar` mounted when switching to the `Nguồn & BOM` sub-tab.
- [ ] **Step 2 (`GREEN`): Implement `H4`**
  - Keep `LocalFindBar` unconditionally mounted in `ReconciliationVariancesBranch.tsx`, keep `LocalFindBar` + `PaginationBar` mounted in both sub-tabs of `ReconciliationAuditBranch.tsx`, and stabilize `ReconciliationLinesFilterToolbar.tsx`.

---

### Task 5: `/admin-data` 4 Sub-Views (`H5`)

**Files:**
- Modify: `frontend/src/features/admin/components/AdminCatalogBranch.tsx`
- Modify: `frontend/src/features/admin/components/AdminBomBranch.tsx`
- Modify: `frontend/src/features/admin/components/AdminCustomersBranch.tsx`
- Test: `frontend/src/test/AdminData.test.tsx`
- Test: `frontend/src/test/AdminBomBranch.test.tsx`
- Test: `frontend/src/test/AdminCustomersBranch.test.tsx`

- [ ] **Step 1 (`RED`): Add failing tests in `AdminData.test.tsx` & `AdminCustomersBranch.test.tsx`**
  - Verify switching `/admin-data?view=ingredients` to `/admin-data?view=dishes` retains previous table rows via `isPreviousData` instead of unmounting into `WorkbenchSkeleton`.
  - Verify `AdminCustomersBranch` and `AdminBomBranch` render standardized `TelemetrySubbar` (`min-h-[44px]`) and keep the `tạm dừng` pill mounted when `inactiveCount === 0`.
- [ ] **Step 2 (`GREEN`): Implement `H5`**
  - Share `scopeKey` across `ingredients`/`dishes` in `AdminCatalogBranch.tsx`, keep `pageInfo` stable during non-error transitions, and standardize `TelemetrySubbar` in `AdminBomBranch.tsx` and `AdminCustomersBranch.tsx`.

---

### Task 6: `/`, `/chef`, `/settings/advanced` (`H6` + `H10` + `H11`)

**Files:**
- Modify: `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`
- Modify: `frontend/src/features/chef/components/MrxCookingHeaderBranch.tsx`
- Modify: `frontend/src/features/chef/components/MrxCookingDishListBranch.tsx`
- Modify: `frontend/src/features/system-operation/AdvancedSettingsPage.tsx`
- Test: `frontend/src/test/MrxDashboard.test.tsx`
- Test: `frontend/src/test/Chef.test.tsx`
- Test: `frontend/src/test/AdvancedSettings.test.tsx`

- [ ] **Step 1 (`RED`): Add failing tests in `MrxDashboard.test.tsx` & `AdvancedSettings.test.tsx`**
  - Verify `ReconciliationDashboardPage` keeps `<section aria-label="Công việc theo vai trò">` mounted when `summary.items` is empty.
  - Verify `AdvancedSettingsPage` renders feedback `InlineBanner` inside `WorkspaceFrame.Body` below `TelemetrySubbar`.
- [ ] **Step 2 (`GREEN`): Implement `H6`, `H10`, and `H11`**
  - Update `ReconciliationDashboardPage.tsx`, `MrxCookingHeaderBranch.tsx`, `MrxCookingDishListBranch.tsx`, and `AdvancedSettingsPage.tsx`.
