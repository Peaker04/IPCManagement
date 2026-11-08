# UI Remediation & Visual Truth Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** Deep UI Defect Remediation from Headed Visual Inspection (Screenshots 1, 2, 3), Elimination of Header Overlaps, Null-Safety on Weekly Menu, Vietnamese Translation of PO Statuses (`UXR-04`), Single Primary Button Rule (`D7`), and Headed Visual Verification across the Entire Frontend  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Root Cause Diagnosis of Visual Defects (From User Screenshots)

Direct visual inspection of the user's three screenshots on live Chrome revealed four severe defects that passed automated headless assertions but fail real-world usability:

### Defect 1: Null Pointer Crash on Weekly Menu (`pi-clipboard-db889fd7-...png`)
- **Observed Behavior:** On `/weekly-menu`, selecting customer `ANV - AMANN` on week `12/10/2026` crashes with error banner:  
  `Không thể tải dữ liệu`  
  `Cannot read properties of null (reading 'rows')`
- **Root Cause:** In `frontend/src/api/weeklyMenuApi.ts` line 175:
  ```typescript
  const rows = menuResponse.rows || [];
  ```
  When the backend C# API returns `null` for a customer without a committed menu schedule, `menuResponse` is `null`. Accessing `.rows` throws an unhandled `TypeError` instead of gracefully resolving to an empty array.
- **Fix:** Use optional chaining: `const rows = menuResponse?.rows || [];`. When `rows` is empty, safely return empty matrix/demand arrays so `WeeklyMenuPage.tsx` renders the clean, friendly `StateBoundary` empty state: *"Chưa có thực đơn cho tuần này - Không có dòng thực đơn persisted cho khách hàng và tuần đã chọn."*

---

### Defect 2: Table Header Text Collision & Competing Primary Buttons in Approvals (`pi-clipboard-ff80aeb4-...png`)
- **Observed Behavior:**
  1. In the master queue table (left 60% panel), `GIÁ TRỊ / KHỐI LƯỢNG` collides and paints over `TRẠNG THÁI`, resulting in garbled text `LƯỢNG TRẠNG TH...`.
  2. Double primary buttons: A primary dark button `Phê duyệt yêu cầu đang chọn` exists on `WorkspaceHeader`, AND another primary button `Phê duyệt hồ sơ` exists in the detail drawer bottom footer.
- **Root Causes:**
  1. In `ApprovalPage.tsx`, column widths sum to $110\%$. In `DataGrid.tsx`, `table-fixed` without a minimum table width (`min-w-[680px]`) forces columns into 70–90px widths in the 60% split container. With `whitespace-nowrap` and no cell overflow protection, the 20-character uppercase header text overflows and overlaps the next column header.
  2. Having primary approval actions in both the header and drawer violates **`Rule D7`** (*Single Primary Action Button Hierarchy*).
- **Fix:**
  1. In `DataGrid.tsx`, set table `min-w-full` with container horizontal scroll, and give columns appropriate minimum pixel widths or concise headers (`Giá trị / SLA`).
  2. In `ApprovalPage.tsx`, streamline the action hierarchy: The primary decision button `Phê duyệt hồ sơ` belongs in the Detail Drawer (where the user actually reviews the document lines); the top `WorkspaceHeader` only keeps the outline "Làm mới" action and secondary scope controls, fulfilling `Rule D7`.

---

### Defect 3: Header Overlap, Raw English Enums & Status Tab Mismatch in Purchasing (`pi-clipboard-789cbcd5-...png`)
- **Observed Behavior:**
  1. In the master PO table, `MẶT HÀNG` and `TỔNG TIỀN` collide into `MẶT HÀNG TỔNG TIỀN`, and `TRẠNG THÁI` is truncated to `TRẠNG THÁ...`.
  2. Badges display raw English enums `ORDERED` and `PARTIALLY_RECEIVED` (truncated as `PARTIALLY...`).
  3. Status tabs in `TelemetrySubbar` show `Dự thảo 0`, `Đã duyệt 0`, `Đã nhận hàng 1`, completely missing tabs for `Đã đặt hàng` (`ORDERED` - 4 orders) and `Nhận một phần` (`PARTIALLY_RECEIVED` - 3 orders).
  4. When Row 1 is selected, the PO has 0 lines, leaving the detail table header floating with an empty body and no explanation.
- **Root Causes:**
  1. Same as Defect 2: percentage column widths in a 58% SplitView without minimum column widths causes headers to collide.
  2. Violates **`UXR-04` / `DOM-LANG-1`**: Raw backend enums `ORDERED` and `PARTIALLY_RECEIVED` are rendered directly without translation into standard Vietnamese business terms (`Đã đặt hàng`, `Nhận một phần`).
  3. `STATUS_TABS` was hardcoded to `DRAFT | APPROVED | RECEIVED` instead of reflecting the real C# `PurchaseOrderStatus` enum.
  4. The detail panel table lacks an empty state when a PO has 0 lines.
- **Fix:**
  1. Add minimum widths to `columns` in `PurchasingPage.tsx` and container scroll in `DataGrid`.
  2. Map all PO statuses to Vietnamese labels:
     - `DRAFT` $\rightarrow$ `Dự thảo` (neutral)
     - `APPROVED` $\rightarrow$ `Đã duyệt` (info)
     - `ORDERED` $\rightarrow$ `Đã đặt hàng` (warning)
     - `PARTIALLY_RECEIVED` $\rightarrow$ `Nhận một phần` (warning)
     - `RECEIVED` $\rightarrow$ `Đã nhận đủ` (success)
     - `CANCELLED` $\rightarrow$ `Đã hủy` (danger)
  3. Update `STATUS_TABS` to include `ORDERED` and `PARTIALLY_RECEIVED` so users can filter all real orders.
  4. Render a clean empty state in the detail panel when `selectedPo.lines.length === 0`: *"Đơn PO này chưa có dòng nguyên liệu chi tiết."*

---

## 2. Requirements & Governance Matrix

- `UXR-04` (`DOM-LANG-1`): 100% Vietnamese domain microcopy. Zero raw English enum values (`ORDERED`, `PARTIALLY_RECEIVED`) in badges or headings.
- `Rule D7` (Action Hierarchy): Exactly 1 Primary Action button per active work context.
- `Rule T7` & `T8`: DataGrid must have sticky headers (`T7`) and compact 36–40px rows (`T8`) without text collision or overlapping headers.
- `Rule TA-4`: Every empty scenario (such as empty PO lines or empty customer weekly menu) must render a domain-accurate empty state via `StateBoundary`.
- `DOM-MODE-1`: Operational mode isolation strictly preserved.

---

## 3. Scope of Modifications

| File | Target Defect & Fix |
|---|---|
| `frontend/src/api/weeklyMenuApi.ts` | Fix null safety `menuResponse?.rows || []` to prevent `Cannot read properties of null` crash. |
| `frontend/src/components/workbench/DataGrid.tsx` | Prevent header text collision: add `min-w-[640px]` on table in split views and ensure cell truncation / proper whitespace handling. |
| `frontend/src/features/approvals/ApprovalPage.tsx` | Fix column widths to prevent overlap; enforce `Rule D7` (remove redundant top primary button, keep primary button in decision drawer). |
| `frontend/src/features/purchasing/PurchasingPage.tsx` | Fix column widths; translate all PO statuses to Vietnamese; align status tabs with C# enum; add empty state for 0-line PO detail. |
| `frontend/tests/browser/headed-visual-audit.spec.ts` | Create headed Playwright verification suite that visits live pages and asserts zero header overlaps and zero English status text. |
