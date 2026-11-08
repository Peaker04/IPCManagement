# Purchasing & Approvals Capability Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Purchasing (`FR-PUR`) and Approvals (`FR-APPR`) capability conformance slice by disaggregating 23 bundled Purchasing/Approvals actions into operation-grain capabilities, eliminating hardcoded partner counts (`(35 đối tác)`), aligning types and telemetry with C# Backend DTOs, and strictly reusing 100% existing UI Kit components.

**Architecture:** Backend controllers (`PurchaseOrdersController`, `PurchaseRequestsController`, `PurchaseWorkflowController`, `SuppliersController`, `ApprovalsController`, `WarehousePurchaseReceiptsController`) define authoritative DTOs, query contracts, and decision commands. This plan reconciles `docs/conformance-contracts.json` to map every HTTP action to a single operation-grain capability, repairs hardcoded telemetry in `PurchasingPage.tsx` by computing dynamic partner counts from `/api/suppliers`, verifies single-primary button hierarchy (`D7`) and decision conflict recovery (`APPR.DECISION`) in `ApprovalPage.tsx`, and ensures full behavioral test coverage across `/purchasing` and `/approvals`.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Testing Library, Node.js test runner, Tailwind CSS (semantic tokens only).

**Spec:** `docs/superpowers/specs/2026-10-18-purchasing-approvals-conformance-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-PUR`: Quản lý nhu cầu thiếu hụt, đơn mua hàng PO, thông tin nhà cung cấp, đối chiếu giá mua.
  - `FR-APPR`: Trung tâm phê duyệt tập trung các đề xuất mua hàng, báo giá NCC, phiếu nhập kho.
  - `BR-GLOBAL-02`: Quantitative Traceability Chain từ đề xuất mua $\rightarrow$ PO $\rightarrow$ Phiếu nhập kho.
  - `BR-GLOBAL-03`: Quyết định từ chối phê duyệt bắt buộc nhập lý do giải trình.
  - `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.
  - `NFR-UI-01` (Table Scalability): Bắt buộc cuộn viewport đơn trong `SplitView` 60/40.
  - `NFR-UI-02` (Triple-Layer RBAC): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard capabilityId="APPR.DECISION"`).
  - `NFR-UI-03` (Formatting Primitives): `<Num format="currency">`, `<IdentifierText>`, `formatVietnameseDate`, `formatVietnameseDateTime`.
  - `NFR-UI-04` (WCAG 2.2 AA Accessibility): Tỷ lệ tương phản >= 4.5:1, phím Tab/Enter/Esc, outline focus rõ nét.
  - `NFR-UI-05` (Motion & CLS): Hiệu ứng <= 150ms, `prefers-reduced-motion`, skeleton loading split 60/40 đồng dạng (CLS <= 0.1).
  - `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Split Data Area (60/40).
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt nghiệp vụ chuẩn hóa.
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - Route `/purchasing` (SplitWorkbench: danh sách PO bên trái 60%, chi tiết đơn bên phải 40%).
  - Route `/approvals` (SplitWorkbench: hàng đợi duyệt bên trái 60%, drawer thẩm định bên phải 40%).
  - `QueryViewBoundary` và `StateBoundary` làm chủ 6 trạng thái UI: `loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`.
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - **100% Dùng UI Kit có sẵn (`docs/UI-KIT.md`)**: `WorkspaceHeader`, `TelemetrySubbar`, `SplitView`, `DataGrid`, `StateBoundary`, `Select`, `Tabs`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, `ActionGuard`. Tuyệt đối cấm tự chế component mới hoặc viết CSS tùy tiện.
  - `D6`: Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`.
  - `D7`: Tối đa 1 nút Primary per zone. Nút "Phê duyệt yêu cầu đang chọn" là nút Primary duy nhất trên Header của Approvals; nút "Làm mới" là nút Outline.
  - `D8`: Viền hairline `1px border-slate-200`, không đổ bóng đậm.
  - `D9`: Icons Lucide 2px stroke.
  - `T1–T3`: Căn phải số lượng/tiền tệ bằng `<Num>` và font `tabular-nums`.
  - `T7`: Frozen header cố định khi cuộn.
  - `T8`: Chiều cao dòng compact 36–40px.
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - API Client: `purchasingApi.ts`, `approvalsApi.ts` ánh xạ 100% khớp các C# DTOs: `PurchaseOrderDto`, `SupplierDto`, `ApprovalInboxDto`.
  - Zero Fake API Data (`Rule TA-5`): Không chứa dữ liệu giả định, không nuốt lỗi.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build`)**:
  - `scripts/check-conformance-contracts.test.mjs`, `frontend/src/__tests__/Purchasing.test.tsx`, `frontend/src/__tests__/Approvals.test.tsx`, `ZeroFakeApiAndTestAuditGuard.test.ts`.

---

## 2. Scoped Pre-Code UI Gate Blocks

### Pre-Code UI Gate Block 1 — Purchasing (`/purchasing`)
```markdown
### Scoped Pre-Code UI Gate Block — Purchasing
- Route: /purchasing
- Single Primary Work Object: SplitWorkbench (Surface: purchasing.orders, 60/40)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['Admin', 'QuanLyThuMua']); zero direct write action exposed (PO created from approved PR only)
- 6 UI States:
  - loading: WorkbenchSkeleton (split 60/40, columns: 6, rows: 8, toolbar: true)
  - empty: StateBoundary (emptyTitle: "Chưa có đơn mua hàng PO", emptyDescription: "Không có đơn mua hàng nào phù hợp với bộ lọc đã chọn.")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: N/A (all rendered columns map to authoritative C# DTO properties)
  - write-reconciliation: N/A (read-only surface for PO list; direct creation prohibited)
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, SplitView, DataGrid, StateBoundary, Select, Tabs, Button, Badge, Num, IdentifierText
- Compliance Pledges: D6 (>=12px), D7 (0 primary, 1 outline), T7 (frozen header), T8 (36-40px density), M1.2 (0 blocking modals)
```

### Pre-Code UI Gate Block 2 — Approvals (`/approvals`)
```markdown
### Scoped Pre-Code UI Gate Block — Approvals
- Route: /approvals
- Single Primary Work Object: SplitWorkbench (Surface: approval.inbox, 60/40)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['Admin', 'Manager', 'QuanLyThuMua', 'QuanLySanXuat']); ActionGuard capabilityId="APPR.DECISION"
- 6 UI States:
  - loading: WorkbenchSkeleton (split 60/40, columns: 5, rows: 8, toolbar: true)
  - empty: StateBoundary (emptyTitle: "Hàng đợi phê duyệt trống", emptyDescription: "Hiện không có hồ sơ nào đang chờ bạn xử lý.")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: N/A (all rendered items map to authoritative inbox facts)
  - write-reconciliation: Inline conflict alert retains selected item on 409 conflict and offers authoritative reload
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, SplitView, DataGrid, StateBoundary, Select, Tabs, Button, Badge, Num, IdentifierText, Modal, ActionGuard
- Compliance Pledges: D6 (>=12px), D7 (1 primary, 1 outline), T7 (frozen header), T8 (36-40px density), M1.2 (1 blocking modal with reason required for rejection)
```

---

## 3. Global Constraints

- **DOM-MODE-1 Operational Mode Isolation**: Đơn mua hàng PO và hồ sơ duyệt thuộc `SHARED_MASTER_DATA`. Tuyệt đối không gửi header hoặc hòa trộn luồng với `MATERIAL_RECONCILIATION`.
- **100% Existing UI Kit Reuse**: Tuyệt đối không tự chế ra component mới. Sử dụng 100% primitives trong `components/ui/*` và `components/workbench/*`.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Mọi dữ liệu test mock bắt buộc phải khớp 100% tên trường, kiểu dữ liệu, cấu trúc C# DTO.
- **Rule TA-2 (No Self-Mocking / Tautological Tests)**: Không mock `PurchasingPage`, không mock `ApprovalPage`, không mock `StateBoundary`. Chỉ mock network boundary.
- **Rule TA-3 (Zero Allowlist Padding)**: Không dùng `test.skip`, không thêm file vào danh sách ngoại lệ.
- **Rule TA-5 (Zero Fake API Data)**: Không chứa bất kỳ dữ liệu fallback hoặc hardcoded arrays nào trong `purchasingApi.ts` hay `approvalsApi.ts`.
- **No Destructive Operations**: Không can thiệp DB, không chạy migration, không git reset/clean.

---

## 4. Review Focus (5 Edge Cases & Verification Invariants)

1. **Dynamic Supplier Count Invariant:** Khi danh sách nhà cung cấp có 5 đối tác, selector phải render "Tất cả nhà cung cấp (5 đối tác)". Khi có 0 đối tác, render "Tất cả nhà cung cấp". Tuyệt đối không hiển thị con số tĩnh `(35 đối tác)`.
2. **Approval Rejection Reason Mandatory (`BR-GLOBAL-03`):** Khi bấm "Từ chối" trong Modal phê duyệt mà không nhập lý do, hệ thống bắt buộc phải chặn submit và hiển thị validation error rõ ràng.
3. **Empty States in SplitWorkbench:** Khi không có đơn PO hoặc hàng đợi duyệt rỗng, `StateBoundary` phải hiển thị empty state chuẩn ở panel trái và không làm vỡ panel phải.
4. **Single Primary Button Policy (`D7`):** Trên Header của `/approvals`, chỉ có duy nhất 1 nút Primary là "Phê duyệt yêu cầu đang chọn" (được bảo vệ qua `ActionGuard`), nút "Làm mới" bắt buộc là `variant="outline"`. Trên `/purchasing`, có 0 nút Primary.
5. **Operation-Grain Machine Invariants:** `docs/conformance-contracts.json` phải đảm bảo mọi action trong 23 actions của Purchasing/Approvals được map 1:1, không còn grouped capability nào.

---

## 5. Implementation Tasks

### Task 1: Disaggregate Purchasing & Approvals Capabilities in Conformance Inventory

**Files:**
- Modify: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: 23 actions thuộc Purchasing & Approvals trong `docs/backend-action-index.json`.
- Produces: Disaggregated operation-grain capabilities:
  - `APPR.INBOX.READ` (`Approvals.GetInbox`) & `APPR.HISTORY.READ` (`ApprovalHistory.GetHistory`)
  - `PUR.WORKFLOW.GENERATE`, `PUR.WORKFLOW.CONFIRM_SUPPLIER`, `PUR.WORKFLOW.SUBMIT`
  - `PUR.ORDER.CREATE_FROM_REQUEST`, `PUR.ORDER.CANCEL`
  - `PUR.QUOTATION.CREATE`, `PUR.QUOTATION.UPDATE`, `PUR.QUOTATION.DEACTIVATE`
  - `PUR.RECEIPT.*` (6 capabilities: `RECORD`, `ACCEPT_QUALITY`, `POST`, `CORRECTION`, `REWORK`, `VOID`)
  - `WH.SUPPLEMENTAL.*` (6 capabilities: `READ`, `GET_BY_ID`, `CREATE`, `FULFILL`, `REJECT`, `ROUTE_TO_PURCHASING`)

- [ ] **Step 1: Write the failing test**

Trong `scripts/check-conformance-contracts.test.mjs`, thêm test case kiểm chứng phân tách 23 capabilities của Purchasing và Approvals thành operation-grain:

```javascript
test('splits Purchasing and Approvals capabilities at their actual operation grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const expectedOwners = new Map([
    ['Approvals.GetInbox', 'APPR.INBOX.READ'],
    ['ApprovalHistory.GetHistory', 'APPR.HISTORY.READ'],
    ['PurchaseWorkflow.GenerateFromDemand', 'PUR.WORKFLOW.GENERATE'],
    ['PurchaseWorkflow.ConfirmLineSupplier', 'PUR.WORKFLOW.CONFIRM_SUPPLIER'],
    ['PurchaseWorkflow.Submit', 'PUR.WORKFLOW.SUBMIT'],
    ['PurchaseOrders.CreateFromRequest', 'PUR.ORDER.CREATE_FROM_REQUEST'],
    ['PurchaseOrders.Cancel', 'PUR.ORDER.CANCEL'],
    ['SupplierQuotations.Create', 'PUR.QUOTATION.CREATE'],
    ['SupplierQuotations.Update', 'PUR.QUOTATION.UPDATE'],
    ['SupplierQuotations.Deactivate', 'PUR.QUOTATION.DEACTIVATE'],
    ['WarehousePurchaseReceipts.Record', 'PUR.RECEIPT.RECORD'],
    ['WarehousePurchaseReceipts.AcceptQuality', 'PUR.RECEIPT.ACCEPT_QUALITY'],
    ['WarehousePurchaseReceipts.Post', 'PUR.RECEIPT.POST'],
    ['SupplementalMaterialRequests.Create', 'WH.SUPPLEMENTAL.CREATE'],
    ['SupplementalMaterialRequests.Fulfill', 'WH.SUPPLEMENTAL.FULFILL'],
    ['SupplementalMaterialRequests.Reject', 'WH.SUPPLEMENTAL.REJECT'],
    ['SupplementalMaterialRequests.RouteToPurchasing', 'WH.SUPPLEMENTAL.ROUTE_TO_PURCHASING'],
  ]);

  for (const [actionId, capabilityId] of expectedOwners) {
    const owners = contract.capabilities.filter((capability) => capability.actionIds && capability.actionIds.includes(actionId));
    assert.deepEqual(owners.map((owner) => owner.id), [capabilityId], `${actionId} must be owned by ${capabilityId}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:conformance-contracts`  
Kỳ vọng: FAIL vì `ApprovalHistory.GetHistory` đang thuộc `APPR.INBOX.READ`.

- [ ] **Step 3: Update `docs/conformance-contracts.json`**

1. Tách `APPR.INBOX.READ` thành `APPR.INBOX.READ` và `APPR.HISTORY.READ`.
2. Xóa các capability gộp: `PUR.REQUEST.WORKFLOW`, `PUR.ORDER.LIFECYCLE`, `PUR.QUOTATION.WRITE`, `PUR.RECEIPT.LIFECYCLE`, `WH.SUPPLEMENTAL_REQUEST`.
3. Thêm các capabilities mới đã disaggregate với actionIds 1:1, gán đúng `operation`, `mode: "SHARED_MASTER_DATA"`, `deliveryClass: "PARTIAL"`.
4. Cập nhật mảng `capabilityIds` trong các requirements liên quan: `FR-PUR`, `FR-APPR`, `BR-GLOBAL-02`, `NFR-SEC-01`.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:conformance-contracts && npm run check:conformance-contracts`  
Kỳ vọng: PASS toàn bộ 24/24 tests, không có dangling references.

- [ ] **Step 5: Commit**

```bash
git add docs/conformance-contracts.json scripts/check-conformance-contracts.test.mjs
git commit -m "feat(conformance): split purchasing and approvals capabilities to operation grain"
```

---

### Task 2: Eliminate Hardcoded Partner Count in `PurchasingPage.tsx`

**Files:**
- Modify: `frontend/src/features/purchasing/PurchasingPage.tsx`
- Modify: `frontend/src/__tests__/Purchasing.test.tsx`

**Interfaces:**
- Consumes: `suppliers: SupplierItem[]`
- Produces: Dynamic supplier selector label:
  ```typescript
  const supplierOptions = [
    {
      value: 'ALL',
      label: suppliers.length > 0
        ? `Tất cả nhà cung cấp (${suppliers.length} đối tác)`
        : 'Tất cả nhà cung cấp',
    },
    ...suppliers.map((s) => ({ value: s.supplierId, label: `${s.supplierCode} - ${s.supplierName}` })),
  ];
  ```

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/Purchasing.test.tsx`**

Thêm test kiểm chứng khi `suppliers` có 2 đối tác, hiển thị `(2 đối tác)`, không hiển thị `(35 đối tác)`:

```typescript
it('renders dynamic supplier partner count and avoids hardcoded 35 partners', async () => {
  vi.spyOn(purchasingApi, 'getSuppliers').mockResolvedValue([
    { supplierId: 's1', supplierCode: 'NCC-01', supplierName: 'Nhà cung cấp Thịt Sạch', isActive: true },
    { supplierId: 's2', supplierCode: 'NCC-02', supplierName: 'Nhà cung cấp Rau Củ', isActive: true },
  ]);

  renderPurchasing();

  expect(await screen.findByRole('combobox')).toBeInTheDocument();
  expect(screen.getByText(/Tất cả nhà cung cấp \(2 đối tác\)/i)).toBeInTheDocument();
  expect(screen.queryByText(/35 đối tác/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: FAIL vì `PurchasingPage.tsx` đang hardcode tĩnh `(35 đối tác)`.

- [ ] **Step 3: Implement in `frontend/src/features/purchasing/PurchasingPage.tsx`**

Thay:
```tsx
const supplierOptions = [
  { value: 'ALL', label: 'Tất cả nhà cung cấp (35 đối tác)' },
  ...suppliers.map((s) => ({ value: s.supplierId, label: `${s.supplierCode} - ${s.supplierName}` })),
];
```
Bằng:
```tsx
const supplierOptions = [
  {
    value: 'ALL',
    label: suppliers.length > 0
      ? `Tất cả nhà cung cấp (${suppliers.length} đối tác)`
      : 'Tất cả nhà cung cấp',
  },
  ...suppliers.map((s) => ({ value: s.supplierId, label: `${s.supplierCode} - ${s.supplierName}` })),
];
```

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/purchasing/PurchasingPage.tsx frontend/src/__tests__/Purchasing.test.tsx
git commit -m "feat(purchasing): eliminate hardcoded supplier count in selector"
```

---

### Task 3: Behavioral Test Audit & Anti-Regression Verification for Purchasing & Approvals

**Files:**
- Modify: `frontend/src/__tests__/Purchasing.test.tsx`
- Modify: `frontend/src/__tests__/Approvals.test.tsx`

**Interfaces:**
- Consumes: `PurchasingPage`, `ApprovalPage`, `purchasingApi`, `approvalsApi`.
- Produces: Đầy đủ 4 kịch bản kiểm thử theo `Rule TA-4`:
  1. *Success & Dynamic Split*: Render đúng master table và detail panel từ C# DTOs.
  2. *Filtering & Selection*: Lọc trạng thái đơn PO, chọn đơn khác nhau thì detail panel cập nhật.
  3. *Empty States*: Khi không có đơn PO hoặc hàng đợi duyệt rỗng, hiển thị đúng empty state qua `StateBoundary`.
  4. *Error Handling & Retry*: Báo lỗi mạng thật và nút `[Thử lại]` gọi lại API.
  5. *Approval Decision & Guard*: Quyết định từ chối bắt buộc có lý do (`BR-GLOBAL-03`); nút duyệt được bọc `ActionGuard`.

- [ ] **Step 1: Write and audit tests**

Cập nhật và mở rộng `Purchasing.test.tsx` và `Approvals.test.tsx` tuân thủ nghiêm ngặt `Rule TA-1` (fixtures chuẩn C# DTOs), `Rule TA-2` (thực thi trên cây DOM thật), `Rule TA-3` (zero allowlist padding), `Rule TA-5` (zero fake API).

- [ ] **Step 2: Run tests to verify**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS toàn bộ test files.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/Purchasing.test.tsx frontend/src/__tests__/Approvals.test.tsx
git commit -m "test(conformance): audit purchasing and approvals behavioral coverage"
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
git diff --check
```
Kỳ vọng: Toàn bộ kiểm thử PASS 100%, không có lỗi type check hay lint.

- [ ] **Step 2: Apply Mandatory Review Gates**

Áp dụng 3 review gates theo `AGENTS.md`:
1. `ipc-test-audit`: Fixtures bám sát C# DTOs (`Rule TA-1`), không mock component (`Rule TA-2`), zero allowlist padding (`Rule TA-3`), đủ 4 kịch bản (`Rule TA-4`), zero fake API (`Rule TA-5`).
2. `ipc-ui-review`: Chuẩn 3-Zone SplitWorkbench, D6 font size >= 12px, D7 action hierarchy (1 primary on Approvals, 0 on Purchasing), T7 frozen header, T8 compact density (36–40px), M1.2 single modal.
3. `ipc-code-review`: Khớp 1:1 C# DTOs, xóa bỏ hardcoding `(35 đối tác)`, bảo vệ bất biến `DOM-MODE-1`.

- [ ] **Step 3: Update `.planning/WORK.md`**

Ghi nhận mục `GF-R35 — Purchasing and Approvals capability conformance and supplier telemetry authority` vào `.planning/WORK.md`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record purchasing and approvals conformance closure and return to idle"
```
