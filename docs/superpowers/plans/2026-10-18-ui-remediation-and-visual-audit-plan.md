# UI Remediation & Visual Truth Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate visual defects identified in user screenshots: eliminate the null-safety crash on `/weekly-menu`, fix table header text collisions in `/approvals` and `/purchasing`, translate raw English PO statuses into Vietnamese (`UXR-04`), enforce the single primary action hierarchy (`D7`), and verify all fixes directly via live headed browser execution.

**Architecture:** Fixes are made at root owners: `weeklyMenuApi.ts` for query null safety, `DataGrid.tsx` for layout overflow protection, `ApprovalPage.tsx` for D7 primary button discipline and column spacing, and `PurchasingPage.tsx` for Vietnamese domain status mapping and detail empty state handling. All changes reuse 100% existing UI Kit components from `docs/UI-KIT.md`.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Playwright 1.60, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-10-18-ui-remediation-and-visual-audit-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `UXR-04` (`DOM-LANG-1`): 100% tiếng Việt chuẩn hóa. Loại bỏ hoàn toàn mã enum tiếng Anh (`ORDERED`, `PARTIALLY_RECEIVED`) trên giao diện người dùng.
  - `NFR-UI-01`: Table Scalability & Viewport.
  - `NFR-UI-04`: Accessibility WCAG 2.2 AA (không bị chồng chéo văn bản).
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - `StateBoundary`: Hiển thị empty state rõ ràng khi khách hàng chưa có thực đơn hoặc đơn PO chưa có dòng vật tư (`Rule TA-4`).
- **Layer 3 — UI Design & Taste Floor (`D1–D9`, `T1–T16`, `M1–M3`)**:
  - `D7`: Single Primary button per context. Loại bỏ nút Primary trùng lặp trên Header của Approvals, giữ nút Primary duy nhất trong Decision Drawer.
  - `T7` & `T8`: Bảng cố định header, mật độ compact 36–40px, bảo vệ không bị tràn chữ (`table-fixed` với `min-w-[640px]`).
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - Null safety trong `weeklyMenuApi.ts` khi C# API trả về `null`.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build · Browser`)**:
  - Unit tests + Playwright headed browser verification.

---

## 2. Implementation Tasks

### Task 1: Fix Null Pointer Crash in `weeklyMenuApi.ts` when Customer Menu is Null

**Files:**
- Modify: `frontend/src/api/weeklyMenuApi.ts`
- Modify: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `menuResponse: RawWeeklyMenuResponse | null`
- Produces: `rows = menuResponse?.rows || []` safely resolving without throwing `TypeError`.

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/WeeklyMenu.test.tsx`**

```typescript
it('handles null weekly menu response from backend without throwing Cannot read properties of null', async () => {
  vi.spyOn(weeklyMenuApi, 'getWeeklyMenu').mockResolvedValue(null as unknown as RawWeeklyMenuResponse);

  renderWeeklyMenu('/weekly-menu');

  expect(await screen.findByText('Chưa có thực đơn cho tuần này')).toBeInTheDocument();
  expect(screen.queryByText(/Cannot read properties of null/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy: `npm run test:fe:unit`  
Kỳ vọng: FAIL vì `weeklyMenuApi.ts` đang gọi `menuResponse.rows` trực tiếp.

- [ ] **Step 3: Implement in `frontend/src/api/weeklyMenuApi.ts`**

Thay:
```typescript
const rows = menuResponse.rows || [];
```
Bằng:
```typescript
const rows = menuResponse?.rows || [];
```

- [ ] **Step 4: Run test to verify it passes**

Chạy: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/weeklyMenuApi.ts frontend/src/__tests__/WeeklyMenu.test.tsx
git commit -m "fix(weekly-menu): prevent null pointer exception when customer weekly menu is null"
```

---

### Task 2: Prevent Table Header Overlap & Enforce Single Primary Button in `ApprovalPage.tsx` and `DataGrid.tsx`

**Files:**
- Modify: `frontend/src/components/workbench/DataGrid.tsx`
- Modify: `frontend/src/features/approvals/ApprovalPage.tsx`
- Modify: `frontend/src/__tests__/Approvals.test.tsx`

**Interfaces:**
- Consumes: `ColumnDef<T>`, `DataGridProps`.
- Produces:
  - `DataGrid`: Hỗ trợ `minWidth?: string` (mặc định `min-w-[640px]` trong SplitView) ngăn chặn co ép cột làm tràn chữ.
  - `ApprovalPage`: Cân chỉnh tỷ lệ phần trăm các cột (tổng đúng 100%), rút gọn tiêu đề `Giá trị / Khối lượng` thành `Giá trị / Quy mô` để tránh tràn chữ; loại bỏ nút Primary thừa trên Header (`D7`).

- [ ] **Step 1: Update `DataGrid.tsx` to prevent table cell overlap**

Trong `DataGrid.tsx`, bổ sung prop `minWidth?: string`:
`<table className={twMerge('w-full text-left text-sm text-slate-800 border-collapse table-fixed', minWidth ?? 'min-w-[640px]')}>`

- [ ] **Step 2: Update `ApprovalPage.tsx` column definitions and action hierarchy**

1. Cân đối lại độ rộng cột:
   - `targetCode`: 18%
   - `title`: 30%
   - `submittedBy`: 16%
   - `sla`: 14%
   - `total`: 12% (header: `Quy mô`)
   - `status`: 10%
   (Tổng = 100%).
2. Tuân thủ `Rule D7`: Loại bỏ nút Primary trên `WorkspaceHeader`. Giữ nút Primary duy nhất `Phê duyệt hồ sơ` ở footer của Decision Drawer (nơi người dùng xem chi tiết trước khi duyệt). Nút trên header chỉ là nút Outline "Làm mới".

- [ ] **Step 3: Update `Approvals.test.tsx` and verify**

Chạy: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/workbench/DataGrid.tsx frontend/src/features/approvals/ApprovalPage.tsx frontend/src/__tests__/Approvals.test.tsx
git commit -m "fix(approvals): prevent header text collision and enforce single primary button in decision drawer"
```

---

### Task 3: Translate PO Statuses to Vietnamese, Align Status Tabs & Add Detail Empty State in `PurchasingPage.tsx`

**Files:**
- Modify: `frontend/src/features/purchasing/PurchasingPage.tsx`
- Modify: `frontend/src/__tests__/Purchasing.test.tsx`

**Interfaces:**
- Consumes: `PurchaseOrderItem.status`.
- Produces:
  - Bản dịch tiếng Việt chuẩn `UXR-04`: `Dự thảo`, `Đã duyệt`, `Đã đặt hàng`, `Nhận một phần`, `Đã nhận đủ`, `Đã hủy`.
  - Bổ sung tabs lọc tương ứng với C# statuses: `ALL`, `ORDERED`, `PARTIALLY_RECEIVED`, `RECEIVED`.
  - Empty state trong Detail Panel khi PO chưa có dòng chi tiết.

- [ ] **Step 1: Write test in `Purchasing.test.tsx` verifying Vietnamese PO status translation**

Kiểm chứng các đơn PO trong bảng hiển thị nhãn tiếng Việt (`Đã đặt hàng`, `Nhận một phần`), không hiển thị chuỗi tiếng Anh `ORDERED` hay `PARTIALLY_RECEIVED`.

- [ ] **Step 2: Implement in `PurchasingPage.tsx`**

1. Khai báo từ điển trạng thái chuẩn tiếng Việt:
   ```typescript
   const PO_STATUS_CONFIG: Record<string, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }> = {
     DRAFT: { label: 'Dự thảo', variant: 'neutral' },
     APPROVED: { label: 'Đã duyệt', variant: 'info' },
     ORDERED: { label: 'Đã đặt hàng', variant: 'warning' },
     PARTIALLY_RECEIVED: { label: 'Nhận một phần', variant: 'warning' },
     RECEIVED: { label: 'Đã nhận đủ', variant: 'success' },
     CANCELLED: { label: 'Đã hủy', variant: 'danger' },
   };
   ```
2. Cập nhật `STATUS_TABS` phản ánh đúng các trạng thái có thật trong cơ sở dữ liệu:
   ```typescript
   const STATUS_TABS = [
     { id: 'ALL', label: 'Tất cả đơn PO', count: orders.length },
     { id: 'ORDERED', label: 'Đã đặt hàng', count: orders.filter((o) => o.status === 'ORDERED').length },
     { id: 'PARTIALLY_RECEIVED', label: 'Nhận một phần', count: orders.filter((o) => o.status === 'PARTIALLY_RECEIVED').length },
     { id: 'RECEIVED', label: 'Đã nhận đủ', count: orders.filter((o) => o.status === 'RECEIVED').length },
   ];
   ```
3. Cân đối độ rộng cột:
   - `code`: 18%
   - `supplier`: 28%
   - `date`: 14%
   - `items`: 10% (header: `Mặt hàng`)
   - `amount`: 16% (header: `Tổng tiền`)
   - `status`: 14% (header: `Trạng thái`)
4. Bổ sung empty state trong Detail Panel:
   Nếu `selectedPo.lines.length === 0`, hiển thị:
   `<div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">Đơn PO này chưa có dòng nguyên liệu chi tiết.</div>`

- [ ] **Step 3: Run test to verify it passes**

Chạy: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/purchasing/PurchasingPage.tsx frontend/src/__tests__/Purchasing.test.tsx
git commit -m "fix(purchasing): translate PO statuses to Vietnamese and align status filter tabs"
```

---

### Task 4: Full Non-Mutating Verification, Review Gates & Work Closure

**Files:**
- Modify: `.planning/WORK.md`

- [ ] **Step 1: Run complete verification suite**

```bash
npm run test:conformance-contracts
npm run check:conformance-contracts
npm run test:fe:unit
npm run lint:fe
npm run build:fe
npm run depcruise:fe
cd frontend && npx playwright test tests/browser/live-data-display-audit.spec.ts --project=chromium --workers=1
```
Kỳ vọng: Toàn bộ kiểm thử unit, contract, build, và Playwright browser tests đều PASS 100%.

- [ ] **Step 2: Apply Mandatory Review Gates**

1. `ipc-test-audit`: Fixtures bám sát C# DTOs, zero fake API data.
2. `ipc-ui-review`: Chuẩn 3-Zone Workbench, D6 font size >= 12px, D7 single primary, T7/T8 no table text collision, UXR-04 100% Vietnamese.
3. `ipc-code-review`: Khớp 1:1 C# DTOs, sửa lỗi null safety và status mapping.

- [ ] **Step 3: Update `.planning/WORK.md` and commit**

Ghi nhận mục `GF-R42 — UI visual defect remediation and domain microcopy conformance`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record ui visual defect remediation closure and return to idle"
```
