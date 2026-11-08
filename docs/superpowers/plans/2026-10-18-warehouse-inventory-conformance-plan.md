# Warehouse & Inventory Capability Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Warehouse and Inventory (`FR-WH`) capability conformance slice by disaggregating 26 bundled Warehouse/Inventory actions into operation-grain capabilities, fixing empty state resiliency in `WarehousePage.tsx` so that empty document lists render descriptive domain notices instead of bare tables, aligning types with C# Backend DTOs, and strictly reusing 100% existing UI Kit components.

**Architecture:** Backend controllers (`WarehousesController`, `InventoryIssuesController`, `InventoryReceiptsController`, `InventoryReturnsController`, `StocktakesController`, `LegacyLineageDispositionsController`) define authoritative DTOs, query contracts, and movement commands. This plan reconciles `docs/conformance-contracts.json` to map every HTTP action to a single operation-grain capability, repairs the flawed `isEmpty={false}` logic in `WarehousePage.tsx` to handle empty issues and receipts resiliently via `StateBoundary`, enforces the prohibition on unbacked direct issue commands, and ensures full behavioral test coverage for `/warehouse`.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Testing Library, Node.js test runner, Tailwind CSS (semantic tokens only).

**Spec:** `docs/superpowers/specs/2026-10-18-warehouse-inventory-conformance-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-WH`: Quản lý tồn kho tức thời, lập và duyệt phiếu nhập/xuất kho, ghi sổ thẻ kho bất biến.
  - `BR-GLOBAL-02`: Quantitative Traceability Chain từ Đề xuất mua $\rightarrow$ PO $\rightarrow$ Phiếu nhập kho $\rightarrow$ Phiếu xuất kho $\rightarrow$ Đối soát.
  - `BR-GLOBAL-03`: Phiếu xuất kho bắt buộc phải có căn cứ từ yêu cầu vật tư đã duyệt.
  - `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.
  - `NFR-UI-01` (Table Scalability): Bắt buộc cuộn viewport đơn trong `OperationalFrame`.
  - `NFR-UI-02` (Triple-Layer RBAC): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
  - `NFR-UI-03` (Formatting Primitives): Mã chứng từ dùng `<IdentifierText>`, ngày tháng dùng `formatVietnameseDate`.
  - `NFR-UI-04` (WCAG 2.2 AA Accessibility): Tỷ lệ tương phản >= 4.5:1, phím Tab/Enter/Esc, outline focus rõ nét.
  - `NFR-UI-05` (Motion & CLS): Hiệu ứng <= 150ms, `prefers-reduced-motion`, skeleton loading table 6x8 đồng dạng (CLS <= 0.1).
  - `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Data Area.
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt nghiệp vụ chuẩn hóa.
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - Route `/warehouse` với 3 URL-owned leaf views theo chuẩn `N6`: `?view=issues` (mặc định), `?view=receipts`, `?view=stock`.
  - `QueryViewBoundary` và `StateBoundary` làm chủ 6 trạng thái UI: `loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`.
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - **100% Dùng UI Kit có sẵn (`docs/UI-KIT.md`)**: `WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `Button`, `Badge`, `IdentifierText`. Tuyệt đối cấm tự chế component mới hoặc viết CSS tùy tiện.
  - `D6`: Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`.
  - `D7`: 0 nút Primary (chế độ đọc an toàn `READ_ONLY_BY_CONTRACT`), nút "Làm mới" là nút Outline.
  - `D8`: Viền hairline `1px border-slate-200`, không đổ bóng đậm.
  - `D9`: Icons Lucide 2px stroke.
  - `T7`: Frozen header cố định khi cuộn.
  - `T8`: Chiều cao dòng compact 36–40px.
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - API Client: `warehouseApi.ts` ánh xạ 100% khớp các C# DTOs: `WarehouseDto`, `InventoryIssueDto`, `InventoryReceiptDto`.
  - Zero Fake API Data (`Rule TA-5`): Không chứa dữ liệu giả định, không nuốt lỗi.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build`)**:
  - `scripts/check-conformance-contracts.test.mjs`, `frontend/src/__tests__/Warehouse.test.tsx`, `ZeroFakeApiAndTestAuditGuard.test.ts`.

---

## 2. Scoped Pre-Code UI Gate Block

```markdown
### Scoped Pre-Code UI Gate Block — Warehouse
- Route: /warehouse (N6 leaves: ?view=issues, ?view=receipts, ?view=stock)
- Single Primary Work Object: OperationalFrame (Surfaces: warehouse.issues, warehouse.receipts, warehouse.stock)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['Admin', 'ThuKho']); zero direct issue creation action exposed (Issue requires approved material request)
- 6 UI States:
  - loading: WorkbenchSkeleton (table 6x8)
  - empty: StateBoundary (issues: "Chưa có phiếu xuất kho"; receipts: "Chưa có phiếu nhập kho"; stock: "Chưa có nguồn tồn kho hiện tại")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: N/A (all rendered columns map to authoritative C# DTO properties)
  - write-reconciliation: N/A (read-only surface for warehouse documents; unbacked issue creation prohibited)
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, DataGrid, StateBoundary, Select, Button, Badge, IdentifierText
- Compliance Pledges: D6 (>=12px), D7 (0 primary, 1 outline), T7 (frozen header), T8 (36-40px density), M1.2 (0 blocking modals), N6 (URL-leaf views)
```

---

## 3. Global Constraints

- **DOM-MODE-1 Operational Mode Isolation**: Kho và chứng từ tồn kho thuộc `SHARED_MASTER_DATA`. Tuyệt đối không gửi header hoặc hòa trộn luồng với `MATERIAL_RECONCILIATION`.
- **100% Existing UI Kit Reuse**: Tuyệt đối không tự chế ra component mới. Sử dụng 100% primitives trong `components/ui/*` và `components/workbench/*`.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Mọi dữ liệu test mock bắt buộc phải khớp 100% tên trường, kiểu dữ liệu, cấu trúc C# DTO.
- **Rule TA-2 (No Self-Mocking / Tautological Tests)**: Không mock `WarehousePage`, không mock `StateBoundary`. Chỉ mock network boundary.
- **Rule TA-3 (Zero Allowlist Padding)**: Không dùng `test.skip`, không thêm file vào danh sách ngoại lệ.
- **Rule TA-5 (Zero Fake API Data)**: Không chứa bất kỳ dữ liệu fallback hoặc hardcoded arrays nào trong `warehouseApi.ts`.
- **No Destructive Operations**: Không can thiệp DB, không chạy migration, không git reset/clean.

---

## 4. Review Focus (5 Edge Cases & Verification Invariants)

1. **Empty State Resiliency in Issues View:** Khi `issues: []` và `view=issues`, `StateBoundary` phải hiển thị "Chưa có phiếu xuất kho" và thông báo mô tả, không render một bảng trống không lời giải thích.
2. **Empty State Resiliency in Receipts View:** Khi `receipts: []` và `view=receipts`, `StateBoundary` phải hiển thị "Chưa có phiếu nhập kho" và thông báo mô tả.
3. **Current Stock Precondition Blocked:** View `stock` phải hiển thị `emptyScenario="prerequisite-blocked"`, từ chối bịa đặt tồn kho từ phép tính nhập trừ xuất với tồn đầu kỳ bằng 0.
4. **Zero Direct Issue Command:** Tuyệt đối không render nút "Tạo phiếu xuất kho" trực tiếp; phiếu xuất kho phải có căn cứ từ yêu cầu vật tư đã duyệt (`BR-GLOBAL-03`).
5. **Operation-Grain Machine Invariants:** `docs/conformance-contracts.json` phải đảm bảo mọi action trong 26 actions của Warehouse/Inventory được map 1:1, không còn grouped capability nào.

---

## 5. Implementation Tasks

### Task 1: Disaggregate Warehouse & Inventory Capabilities in Conformance Inventory

**Files:**
- Modify: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: 26 actions thuộc Warehouse & Inventory trong `docs/backend-action-index.json`.
- Produces: Disaggregated operation-grain capabilities:
  - `WH.ISSUE.*`: `READ` (`GetAll`, `GetById`), `CREATE`, `CONFIRM`
  - `WH.RECEIPT.*`: `READ` (`GetAll`, `GetById`), `CREATE`, `CREATE_FROM_PURCHASE`
  - `WH.RETURN.*`: `READ` (`GetAll`, `GetById`, `GetAllocationBalances`), `CREATE`, `CONFIRM`, `DISPOSITION`
  - `WH.STOCKTAKE.*`: `READ` (`GetById`, `GetPaged`), `CREATE`, `UPDATE_ACTUAL`, `SUBMIT`, `APPROVE`, `REJECT`
  - `WH.LEGACY_LINEAGE.*`: `READ` (`Get`, `GetCandidates`), `CREATE`, `REVIEW`, `APPLY`

- [ ] **Step 1: Write the failing test**

Trong `scripts/check-conformance-contracts.test.mjs`, thêm test case kiểm chứng phân tách 26 capabilities của Warehouse thành operation-grain:

```javascript
test('splits Warehouse and Inventory capabilities at their actual operation grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const expectedOwners = new Map([
    ['InventoryIssues.GetAll', 'WH.ISSUE.READ'],
    ['InventoryIssues.GetById', 'WH.ISSUE.READ'],
    ['InventoryIssues.Create', 'WH.ISSUE.CREATE'],
    ['InventoryIssues.ConfirmReceipt', 'WH.ISSUE.CONFIRM'],
    ['InventoryReceipts.GetAll', 'WH.RECEIPT.READ'],
    ['InventoryReceipts.GetById', 'WH.RECEIPT.READ'],
    ['InventoryReceipts.Create', 'WH.RECEIPT.CREATE'],
    ['InventoryReceipts.CreateFromPurchase', 'WH.RECEIPT.CREATE_FROM_PURCHASE'],
    ['InventoryReturns.GetAll', 'WH.RETURN.READ'],
    ['InventoryReturns.Create', 'WH.RETURN.CREATE'],
    ['InventoryReturns.ConfirmReceipt', 'WH.RETURN.CONFIRM'],
    ['InventoryReturns.CreateAllocationDisposition', 'WH.RETURN.DISPOSITION'],
    ['Stocktakes.GetPaged', 'WH.STOCKTAKE.READ'],
    ['Stocktakes.Create', 'WH.STOCKTAKE.CREATE'],
    ['Stocktakes.Submit', 'WH.STOCKTAKE.SUBMIT'],
    ['Stocktakes.Approve', 'WH.STOCKTAKE.APPROVE'],
    ['Stocktakes.Reject', 'WH.STOCKTAKE.REJECT'],
    ['LegacyLineageDispositions.Get', 'WH.LEGACY_LINEAGE.READ'],
    ['LegacyLineageDispositions.Create', 'WH.LEGACY_LINEAGE.CREATE'],
    ['LegacyLineageDispositions.Review', 'WH.LEGACY_LINEAGE.REVIEW'],
    ['LegacyLineageDispositions.Apply', 'WH.LEGACY_LINEAGE.APPLY'],
  ]);

  for (const [actionId, capabilityId] of expectedOwners) {
    const owners = contract.capabilities.filter((capability) => capability.actionIds && capability.actionIds.includes(actionId));
    assert.deepEqual(owners.map((owner) => owner.id), [capabilityId], `${actionId} must be owned by ${capabilityId}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:conformance-contracts`  
Kỳ vọng: FAIL vì `InventoryIssues.Create` đang thuộc `WH.ISSUE`.

- [ ] **Step 3: Update `docs/conformance-contracts.json`**

1. Xóa các capability gộp: `WH.ISSUE`, `WH.RECEIPT`, `WH.RETURN`, `WH.STOCKTAKE`, `WH.LEGACY_LINEAGE`.
2. Thêm các capabilities mới đã disaggregate với actionIds 1:1, gán đúng `operation`, `mode: "DEFAULT"`, `deliveryClass: "PARTIAL"`.
3. Gán `WH.ISSUE.READ` và `WH.RECEIPT.READ` là `deliveryClass: "READY"`.
4. Cập nhật mảng `capabilityIds` trong các requirements liên quan: `FR-WH`, `BR-GLOBAL-02`.
5. Cập nhật surfaces `warehouse.issues` và `warehouse.receipts`.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:conformance-contracts && npm run check:conformance-contracts`  
Kỳ vọng: PASS toàn bộ 25/25 tests, không có dangling references.

- [ ] **Step 5: Commit**

```bash
git add docs/conformance-contracts.json scripts/check-conformance-contracts.test.mjs
git commit -m "feat(conformance): split warehouse and inventory capabilities to operation grain"
```

---

### Task 2: Fix Empty State Resiliency in `WarehousePage.tsx`

**Files:**
- Modify: `frontend/src/features/warehouse/WarehousePage.tsx`
- Modify: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Consumes: `issues: InventoryIssueItem[]`, `receipts: InventoryReceiptItem[]`, `activeView: 'issues' | 'receipts' | 'stock'`
- Produces: Dynamic empty state handling in `StateBoundary`:
  ```tsx
  <StateBoundary
    isLoading={isLoading}
    error={error}
    onRetry={loadData}
    isEmpty={!isLoading && !error && ((activeView === 'issues' && issues.length === 0) || (activeView === 'receipts' && receipts.length === 0))}
    emptyTitle={activeView === 'issues' ? 'Chưa có phiếu xuất kho' : 'Chưa có phiếu nhập kho'}
    emptyDescription={activeView === 'issues' ? 'Không có phiếu xuất kho nào phù hợp với bộ lọc.' : 'Không có phiếu nhập kho nào phù hợp với bộ lọc.'}
  >
  ```

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/Warehouse.test.tsx`**

Thêm test kiểm chứng khi `issues: []`, hiển thị đúng "Chưa có phiếu xuất kho":

```typescript
it('renders clean empty state when no issues exist', async () => {
  vi.spyOn(warehouseApi, 'getIssues').mockResolvedValue([]);

  renderWarehouse('/warehouse?view=issues');

  expect(await screen.findByText('Chưa có phiếu xuất kho')).toBeInTheDocument();
  expect(screen.getByText('Không có phiếu xuất kho nào phù hợp với bộ lọc.')).toBeInTheDocument();
});

it('renders clean empty state when no receipts exist', async () => {
  vi.spyOn(warehouseApi, 'getReceipts').mockResolvedValue([]);

  renderWarehouse('/warehouse?view=receipts');

  expect(await screen.findByText('Chưa có phiếu nhập kho')).toBeInTheDocument();
  expect(screen.getByText('Không có phiếu nhập kho nào phù hợp với bộ lọc.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: FAIL vì `WarehousePage.tsx` đang hardcode tĩnh `isEmpty={false}`.

- [ ] **Step 3: Implement in `frontend/src/features/warehouse/WarehousePage.tsx`**

Sửa đổi `StateBoundary`:
```tsx
<StateBoundary
  isLoading={isLoading}
  error={error}
  onRetry={loadData}
  isEmpty={!isLoading && !error && ((activeView === 'issues' && issues.length === 0) || (activeView === 'receipts' && receipts.length === 0))}
  emptyTitle={activeView === 'issues' ? 'Chưa có phiếu xuất kho' : 'Chưa có phiếu nhập kho'}
  emptyDescription={activeView === 'issues' ? 'Không có phiếu xuất kho nào phù hợp với bộ lọc.' : 'Không có phiếu nhập kho nào phù hợp với bộ lọc.'}
>
```

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/warehouse/WarehousePage.tsx frontend/src/__tests__/Warehouse.test.tsx
git commit -m "feat(warehouse): repair empty state resiliency in warehouse document views"
```

---

### Task 3: Behavioral Test Audit & Anti-Regression Verification for Warehouse

**Files:**
- Modify: `frontend/src/__tests__/Warehouse.test.tsx`

**Interfaces:**
- Consumes: `WarehousePage`, `warehouseApi`.
- Produces: Đầy đủ 4 kịch bản kiểm thử theo `Rule TA-4`:
  1. *Success & Views*: Render đúng cột và dữ liệu phiếu xuất, phiếu nhập.
  2. *View Switching*: Chuyển đổi giữa `issues`, `receipts`, `stock` qua URL query `?view=...`.
  3. *Empty States*: Cả 2 view issues và receipts hiển thị thông báo rỗng chuẩn; view stock hiển thị prerequisite blocked.
  4. *Error Handling & Retry*: Báo lỗi mạng thật và nút `[Thử lại]` gọi lại API.
  5. *Zero Direct Issue*: Tuyệt đối không render nút hay form tạo xuất kho tùy tiện.

- [ ] **Step 1: Write and audit tests**

Cập nhật và mở rộng `Warehouse.test.tsx` tuân thủ nghiêm ngặt `Rule TA-1` (fixtures chuẩn C# DTOs), `Rule TA-2` (thực thi trên cây DOM thật), `Rule TA-3` (zero allowlist padding), `Rule TA-5` (zero fake API).

- [ ] **Step 2: Run tests to verify**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS toàn bộ test files.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/Warehouse.test.tsx
git commit -m "test(conformance): audit warehouse behavioral coverage and empty states"
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
2. `ipc-ui-review`: Chuẩn 3-Zone OperationalFrame, D6 font size >= 12px, D7 action hierarchy (0 primary, 1 outline), T7 frozen header, T8 compact density (36–40px), N6 URL-leaf navigation.
3. `ipc-code-review`: Khớp 1:1 C# DTOs, sửa lỗi `isEmpty={false}`, bảo vệ bất biến `DOM-MODE-1`.

- [ ] **Step 3: Update `.planning/WORK.md`**

Ghi nhận mục `GF-R36 — Warehouse capability conformance and empty-state resiliency` vào `.planning/WORK.md`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record warehouse conformance closure and return to idle"
```
