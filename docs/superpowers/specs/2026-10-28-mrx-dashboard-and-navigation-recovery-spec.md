# Spec: MRX Dashboard Recovery, Sidebar IA Standardization & Action Bridges

**Date:** 2026-10-28  
**Subsystem:** Material Reconciliation Subsystem (`FR-DASH`, `FR-RECON`, `FR-MENU`, `FR-WH`, `FR-CHEF`)  
**Scope:** Landing Experience, Navigation Architecture, and Cross-Station Action Bridges under `MATERIAL_RECONCILIATION` (`DOM-MODE-1`)

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Missing Dashboard in MRX Mode
In the legacy codebase (`IPCManagement-fe-legacy-backup`), when operating in MRX mode, navigating to `/` loaded `ReconciliationDashboardPage.tsx`—the executive "Control Tower" providing cross-batch visibility, 4 KPI counters, an interactive 4-step pipeline, and recent batch statuses.
In the current codebase, `App.tsx` redirects `/` directly to `/weekly-menu?view=mrx-batch`. Operators logging in are thrust immediately into single-batch preparation without an executive overview.

### 1.2 Over-Expanded Sidebar Anti-Pattern
In `frontend/src/components/workbench/AppShell.tsx`, `expandedParents` initializes with every single disclosure group set to `true`. This causes all 5 nested groups to be forced open by default, inflating sidebar height and overwhelming users with 12 simultaneous items.
- **IA Principle**: By default, only the parent containing the currently active route should be expanded; all others must be collapsed.

### 1.3 Terminology Inconsistencies & Fragmented Navigation
Nav labels currently mirror generic departmental titles rather than the end-to-end closed-loop MRX lifecycle. Furthermore, features that were previously located in one screen (e.g. Movement History in Warehouse, Cooking Slips in Reconciliation) are now in specialized sub-stations without bidirectional breadcrumb shortcuts.

---

## 2. Invariants & Architecture Specifications

- **`INV-MRX-DASHBOARD-LANDING`**: In `MATERIAL_RECONCILIATION` mode, navigating to `/` must render the dedicated `ReconciliationDashboardPage` (wrapped in `WorkspaceFrame`), eliminating the blind redirect to `/weekly-menu?view=mrx-batch`.
- **`INV-SMART-COLLAPSE-SIDEBAR`**: In `AppShell.tsx`, `expandedParents` must initialize dynamically based on `location.pathname`. Only the active route's parent disclosure may be open; all inactive groups must remain cleanly collapsed by default.
- **`INV-INTER-STATION-BRIDGES`**:
  - Warehouse Daily station (`/warehouse?view=mrx-daily`) must offer a direct link: `"Xem lịch sử giao dịch kho →"` linking to `/reconciliation?view=transactions`.
  - Reconciliation Lines station (`/reconciliation`) must offer a direct link: `"Xem phiếu nấu theo lô (Bếp) →"` linking to `/chef?view=mrx-cooking&batchId={id}`.
  - Batch Preparation station (`/weekly-menu?view=mrx-batch`) must offer a direct link: `"Chuyển sang Kho xuất ngày →"` linking to `/warehouse?view=mrx-daily&batchId={id}` when status is `TRANSFERRED` or `READY`.
- **`INV-CANONICAL-ROUTING`**: `/` is declared as `modes: ['DEFAULT', 'MATERIAL_RECONCILIATION']` in `routeRegistry.ts`.

---

## 3. Detailed Component Architecture

### 3.1 `ReconciliationDashboardPage.tsx` (`frontend/src/features/dashboard/`)
Structured as a compound `WorkspaceFrame`:
- **Zone 1: `WorkspaceHeader`**:
  - Title: `"Bàn điều hành đối soát"`
  - Breadcrumb: `"Tổng quan MRX · Đài chỉ huy"`
  - Actions: `"Lập lô đối soát mới"` (`/weekly-menu?view=mrx-batch`), `"Làm mới"`.
- **Zone 2: `TelemetrySubbar`**:
  - Scope selectors: Customer filter dropdown + Time period filter.
- **Zone 3: `WorkspaceFrame.Body`**:
  - **Section A: 4 Executive KPI Cards**:
    - "Tổng số lô" (Total batches)
    - "Chờ Kho xuất" (Ready / Transferred count, text-amber-700)
    - "Đang đối chiếu" (In-progress count, text-sky-700)
    - "Đã quyết toán" (Completed count, text-emerald-700)
  - **Section B: 4-Step Interactive Pipeline**:
    - Step 1: Lập lô & Nguồn thực đơn (`/weekly-menu?view=mrx-batch`)
    - Step 2: Kho xuất định lượng ngày (`/warehouse?view=mrx-daily`)
    - Step 3: Bếp nấu theo ca (`/chef?view=mrx-cooking`)
    - Step 4: Giám sát đối soát & Quyết toán (`/reconciliation`)
  - **Section C: DataGrid of Active Batches**:
    - Real data from `mrxApi.getBatchPage({ pageSize: 10 })`.
    - Columns: Mã lô, Khách hàng, Tuần phục vụ, Trạng thái, Thao tác nhanh ("Mở trạm làm việc").

### 3.2 Dynamic Active Expansion in `AppShell.tsx`
```tsx
const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>(() => {
  const currentPath = location.pathname;
  return {
    'weekly-menu': currentPath.startsWith('/weekly-menu'),
    warehouse: currentPath.startsWith('/warehouse'),
    chef: currentPath.startsWith('/chef'),
    reconciliation: currentPath.startsWith('/reconciliation'),
    reports: currentPath.startsWith('/reports'),
    administration: currentPath.startsWith('/admin-data') || currentPath.startsWith('/settings'),
  };
});
```

---

## 4. Verification Criteria

1. **Root Landing in MRX Mode**: Logging in as Admin in `MATERIAL_RECONCILIATION` renders `ReconciliationDashboardPage` at `/` with 0ms Render #1 hydration.
2. **Sidebar Collapse**: On initial landing at `/`, all disclosure trees are collapsed. Navigating to `/reconciliation` auto-expands only the `Đối soát nguyên liệu` group.
3. **Cross-Station Shortcuts**: Clicking "Xem lịch sử giao dịch kho →" in Warehouse navigates directly to `/reconciliation?view=transactions` without state loss.
4. **Automated Quality Gates**:
   - `npm run precommit:verify` (100% PASS).
   - `npx playwright test` (63/63 browser tests PASS).
   - `node scripts/check-architecture-growth.mjs` (0 files > 600 lines).
