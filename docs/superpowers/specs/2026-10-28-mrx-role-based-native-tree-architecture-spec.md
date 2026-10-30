# Spec: MRX Role-Based Native Tree Architecture & Zero-Jitter Hardening

**Date:** 2026-10-28  
**Subsystem:** Material Reconciliation Subsystem (`FR-RECON`, `FR-MENU`, `FR-WH`, `FR-CHEF`, `FR-CAT`, `FR-SYS`)  
**Scope:** 5 Roles across 10 MRX Stations and 2 Shared Management Surfaces (`DOM-MODE-1`)

---

## 1. Domain & Architecture Objectives

The Material Reconciliation (`MATERIAL_RECONCILIATION`) subsystem must operate with zero visual jitter, zero skeleton flashing during in-session navigation and browser page reloads (F5 / Ctrl+Shift+R), and zero layout shifts across all 4 operational roles and 1 shared administrator role:

1. **Role 1: Coordinator (Điều phối viên)**: Manages weekly batch initialization, Excel menu import, dish lists, and frozen source review at `/weekly-menu?view=mrx-batch`.
2. **Role 2: Warehouse Staff (Thủ kho)**: Manages 7-day daily material issues, multi-customer preparation, and incoming source delta approvals at `/warehouse?view=mrx-daily`, `/warehouse?view=mrx-preparation`, and `/warehouse?view=mrx-issues`.
3. **Role 3: Head Chef (Bếp trưởng)**: Inspects frozen shift-based cooking breakdowns and dish recipes at `/chef?view=mrx-cooking`.
4. **Role 4: Reconciliation Auditor / Manager (Giám sát Đối soát & Quyết toán)**: Audits 5 reporting registers at `/reconciliation` (`lines`, `variances`, `transactions`, `audit`, `completed`).
5. **Role 5: Shared Administrator (Quản trị Hệ thống)**: Manages shared catalogs (`/admin-data`) and system operation modes (`/settings/advanced?view=mode`).

---

## 2. Mandatory Architectural Invariants

- **`INV-DOM-MODE-1` (Operational Mode Isolation)**: `DEFAULT != MATERIAL_RECONCILIATION`. Shared master data and physical stock never merge workflows, commands, queries, lineages, or audit logs. DEFAULT-only routes (`/`, `/meal-orders`, `/approvals`, `/purchasing`, `/reports`) must never be modified or polled in MRX mode.
- **`INV-ZERO-JITTER-HEADER`**: Every station header must maintain a fixed physical height of `56px` (`h-14`), with reserved anchor containers (`min-w-[110px] h-9 shrink-0` for status badges, `min-w-[140px] h-9 shrink-0` for metric badges, and stable action flex containers) to prevent horizontal element shifting when async data arrives.
- **`INV-0MS-RENDER1-L2`**: In-memory `serverStateCache` (L1) must be mirrored to `sessionStorage` (L2) for all MRX query keys (`mrx_*`, `snapshot:*`, `catalog_*`, `admin_data_*`). When an operator refreshes a page (F5), Render #1 must synchronously hydrate from L2 in 0ms without dropping to a white screen or flashing a skeleton.
- **`INV-TELEMETRY-SUBBAR`**: The TelemetrySubbar must maintain a fixed physical height of `44px` (`h-11`) across all tabs with pre-reserved metric containers to prevent vertical canvas jumping.
- **`INV-ARCHITECTURE-LIMITS`**: Every frontend source file must remain strictly $\le 600$ lines (`node scripts/check-architecture-growth.mjs`), with sub-tree branches $\le 250$ lines.

---

## 3. Station-by-Station Tree Architecture Specifications

### 3.1 Role 1: Coordinator (`/weekly-menu?view=mrx-batch`)
- **Controller**: `MrxBatchWorkbench.tsx` (280 lines) + `useMrxBatchWorkspace.ts` (351 lines).
- **Header**: `MrxBatchHeaderBranch.tsx`:
  - Context selectors: Customer dropdown (`w-52`), Monday-snapped date input (`w-36`), reserved badge slot (`min-w-[110px] h-9 shrink-0`).
  - Actions container: Reserved flex container with fixed alignment so that secondary buttons ("Món ăn trong lô", "Xem thay đổi") and primary button (`ActionGuard`) mount without horizontal jumping.
- **Body**: `WorkspaceFrame.Body` $\rightarrow$ `StateBoundary` $\rightarrow$ `MrxBatchPreviewSection.tsx`.

### 3.2 Role 2: Warehouse Staff (`/warehouse`)
- **Trạm 2 (`mrx-daily`)**: `MrxDailyIssueWorkbench.tsx` (221 lines) + `useMrxDailyWorkspace.ts` (298 lines).
  - Header: `MrxDailyHeaderBranch.tsx`: Batch select (`w-72`), Date input (`w-40`), reserved badge slot (`min-w-[110px] h-9 shrink-0`), stable action slot (`min-w-[160px]`).
  - Date Tabs: `MrxDailyDateTabsBranch.tsx`: 7 weekday tabs (Monday to Sunday) locked at `h-10`.
  - Body: `MrxDailyLinesBranch.tsx` (DataGrid).
- **Trạm 2b (`mrx-preparation`)**: `MrxMultiCustomerPreparationWorkbench.tsx` (245 lines).
  - Header: `MrxPrepHeaderBranch.tsx`: Date picker + stable button slot (`Xuất Excel`, `Xác nhận xuất phối hợp`).
  - Body: `MrxPrepAllocationsBranch.tsx` (Multi-customer allocation matrix).
- **Trạm 2c (`mrx-issues`)**: `MrxSourceDeltaWorkbench.tsx` (256 lines).
  - Header: `MrxDeltaHeaderBranch.tsx`: Refresh button + navigation button.
  - Body: `MrxDeltaTableBranch.tsx` (Delta table + process modal).

### 3.3 Role 3: Head Chef (`/chef?view=mrx-cooking`)
- **Controller**: `MrxCookingWorkbench.tsx` (212 lines).
- **Header**: `MrxCookingHeaderBranch.tsx`: Batch select (`w-72`), Shift select (`w-40`), reserved badge slot (`min-w-[110px] h-9 shrink-0`), stable export button slot.
- **Telemetry**: Fixed 44px subbar with pre-reserved metrics (Servings, Dishes).
- **Body**: `WorkspaceFrame.Body` $\rightarrow$ `StateBoundary` $\rightarrow$ `MrxCookingDishListBranch.tsx` (Dish-grouped cards).

### 3.4 Role 4: Reconciliation Auditor (`/reconciliation`)
- **Controller**: `ReconciliationPage.tsx` (218 lines) + `useReconciliationWorkspace.ts` (366 lines).
- **Header**: `ReconciliationHeaderBranch.tsx`: Customer select (`w-52`), Batch select (`w-56`), Date picker (`w-40`), reserved badge slot (`min-w-[110px] h-9 shrink-0`).
  - Synchronous Render #1 hydration: `batches` initialized from `serverStateCache.get('mrx_batches_' + customerId)`.
- **Queue Cards**: `ReconciliationQueueCards.tsx`: 5 metric cards locked at `h-12`, initialized from `serverStateCache.get('mrx_operational_summary')` to eliminate 0-to-N count jumps.
- **Subbar**: `TelemetrySubbar.tsx` permanently present across all 5 subviews (`lines`, `variances`, `transactions`, `audit`, `completed`).
- **Body**:
  - `lines`: `ReconciliationLinesBranch.tsx` (Lines DataGrid + Blocker strip).
  - Report tables: `ReconciliationReportTables.tsx` wrapped in `LocalizedBoundary` (Zero-flicker subview switching).

### 3.5 Role 5: Shared Administrator (`/admin-data`, `/settings/advanced`)
- **`/admin-data`**: `AdminDataPage.tsx`: Wrapped in `<WorkspaceFrame.Root>` and `<WorkspaceFrame.Body>`, badge enclosed in `<div className="min-w-[140px] h-9 flex items-center shrink-0">`.
- **`/settings/advanced`**: `AdvancedSettingsPage.tsx`: Wrapped in `<WorkspaceFrame.Root>` and `<WorkspaceFrame.Body>`, badge enclosed in `<div className="min-w-[220px] h-9 flex items-center shrink-0">`.

---

## 4. Verification & Evidence Gates

1. **Pre-commit Gate (`npm run precommit:verify`)**: 100% PASS on all 5 gates (Gate A: Physical Modules, Gate B: Forbidden Patterns, Gate C: Architecture Growth $\le 600$, Gate D: TypeCheck & Build, Gate E: Vitest Unit Suites).
2. **Playwright E2E Suite (`npx playwright test`)**: 63/63 tests PASS.
3. **Browser Cold Reload Trace**: Verified 0ms Render #1 hydration and 0px header element shifts across all 10 MRX stations.
