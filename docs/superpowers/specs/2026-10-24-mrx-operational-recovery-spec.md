# MRX Operational & Responsive Recovery Specification

> **Status:** Approved  
> **Scope:** `MATERIAL_RECONCILIATION` only  
> **Exclusions:** Chef workbench (`/chef?view=mrx-cooking`) is strictly preserved as-is (read-only sanitized cooking sheet with CSV/XLSX export).

---

## 1. Objectives & Business Context

Based on the audit of the legacy frontend backup (`IPCManagement-fe-legacy-backup`) and the current 3-Zone Flat Workbench architecture:
1. **Line-Level Deep Inspection (`ReconciliationLineDetailModal`)**: Recreate the missing legacy dialog that allows managers on `/reconciliation` to inspect full details of any daily line (BOM required quantity, actual issued quantity, variance difference, tolerance, warehouse notes, and current disposition) with a direct one-click CTA to resolve discrepancies.
2. **True Responsive Architecture (Root-Cause Fix, Zero Scrollbar Hacks)**: Replace superficial `.no-scrollbar` suppression with proper responsive layout geometry: flexible responsive select widths, two-tier/wrapping header containers on screens `< 1366px`, and adaptive sidebar collapsing on small desktop/tablet screens (`1024px` to `1280px`).
3. **Filterable Dish & BOM Inspection (`MrxBatchDishesModal`)**: Enhance the frozen dish breakdown modal with per-shift filtering (`Tất cả`, `Ca 1`, `Ca 2`) and search capability.
4. **Live Interactive Web Verification**: Execute true browser click-through tests asserting real DOM results and state transitions.

---

## 2. Component Specifications

### 2.1. `ReconciliationLineDetailModal.tsx`
- **Location**: `frontend/src/components/workbench/ReconciliationLineDetailModal.tsx`
- **Trigger**: Click on any row's ingredient name or the "Chi tiết" action button in `ReconciliationPage.tsx` / `reconciliationColumns.tsx`.
- **Content Contract**:
  - `Mã nguyên liệu`: Monospace `IdentifierText`
  - `Tên nguyên liệu`: Bold typography
  - `Đơn vị tính`: Unit name
  - `Ngày phục vụ`: Vietnamese formatted date
  - `Cần xuất (BOM)`: Formatted quantity via `Num`
  - `Thực tế đã xuất`: Formatted quantity or "Chưa xuất"
  - `Sai lệch`: Highlighted quantity (`+` amber for overage, `-` rose for kitchen savings, emerald for match)
  - `Ngưỡng sai lệch cho phép`: `frozenTolerance`
  - `Ghi chú từ Kho`: List of warehouse over-issue or supplemental notes (`issueNotes`)
  - `Kết luận giải trình hiện tại`: Category and reason if already disposed
  - `ID dòng`: `dailyLineId`
- **Footer Actions**:
  - `Xử lý chênh lệch`: When line is `NEEDS_REVIEW` and not completed, opens `ReconciliationDispositionModal` immediately.
  - `Đóng`: Closes the modal.

### 2.2. Responsive Geometry Contract
- **Breakpoints**:
  - `>= 1440px`: Full horizontal layout in `WorkspaceHeader` and `TelemetrySubbar`.
  - `1024px - 1366px`:
    - Responsive select widths: `w-40 sm:w-48 lg:w-60 xl:w-72`.
    - Auto-collapsing sidebar or priority flex wrapping: Controls wrap gracefully onto a second row if width < 1200px instead of overflowing or clipping.
    - Zero horizontal window overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
    - Zero double/nested scrollbars in headers or subbars.

### 2.3. Chef Station Invariant
- `MrxCookingWorkbench.tsx` remains strictly read-only:
  - Header: Shift filter (`Tất cả`, `Ca 1`, `Ca 2`), Batch selector, CSV & Excel export, Print action.
  - Subbar: Dish count, serving count, ingredient row count.
  - No receipt confirmations or return mutations are mounted in MRX chef view.

---

## 3. Verification Criteria
- 18/18 frontend unit test files pass (167/167 tests).
- All files strictly adhere to `< 600 lines` threshold (`check-architecture-growth.mjs`).
- ESLint 0 errors, Depcruise 0 violations.
- Conformance runtime suite passes 10/10 tests.
- Full-path lifecycle test passes 100% on isolated sandbox DB.
