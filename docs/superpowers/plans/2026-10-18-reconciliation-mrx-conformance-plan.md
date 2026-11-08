# Material Reconciliation (MRX) Capability Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Material Reconciliation (`FR-RECON`) capability conformance slice by disaggregating 11 bundled Reconciliation actions into operation-grain capabilities, aligning `<ActionGuard capabilityId="RECON.BATCH.COMPLETE">` on `ReconciliationPage.tsx`, strictly enforcing operational mode isolation (`DOM-MODE-1`), and reusing 100% existing UI Kit components.

**Architecture:** Backend controllers (`ReconciliationBatchesController`, `ReconciliationActualsController`, `ReconciliationDailyLinesController`, `ReconciliationReportsController`) define authoritative DTOs, versioned optimistic concurrency checks (`ExpectedVersion`), and variance disposition commands. This plan reconciles `docs/conformance-contracts.json` to map every HTTP action to a single operation-grain capability, aligns surface `reconciliation.batch` action `complete-batch` with `RECON.BATCH.COMPLETE`, synchronizes `ReconciliationPage.tsx` with this operation-grain capability ID, and ensures full behavioral test coverage under `Rule TA-4`.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Testing Library, Node.js test runner, Tailwind CSS (semantic tokens only).

**Spec:** `docs/superpowers/specs/2026-10-18-reconciliation-mrx-conformance-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-RECON`: Đối soát lượng xuất kho sổ sách với lượng tiêu hao thực tế của ca nấu ăn, lập biên bản xử lý sai lệch, chốt hoàn tất lô.
  - `BR-GLOBAL-02`: Quantitative Traceability Chain từ Đề xuất mua $\rightarrow$ PO $\rightarrow$ Nhập kho $\rightarrow$ Xuất kho $\rightarrow$ Bàn giao $\rightarrow$ Đối soát.
  - `DOM-MODE-1`: Chế độ `MATERIAL_RECONCILIATION`. Bất biến: dữ liệu đối soát không hòa trộn với luồng công việc của `DEFAULT`.
  - `NFR-UI-01` (Table Scalability): Bảng đối soát cuộn trong khung nhìn `OperationalFrame` chiếm 85% chiều cao.
  - `NFR-UI-02` (Triple-Layer RBAC): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard capabilityId="RECON.BATCH.COMPLETE"`).
  - `NFR-UI-03` (Formatting Primitives): Số lượng dùng `<Num format="quantity">`, mã chứng từ dùng `<IdentifierText>`, ngày tháng dùng `formatVietnameseDate`.
  - `NFR-UI-04` (WCAG 2.2 AA Accessibility): Tỷ lệ tương phản >= 4.5:1, phím Tab/Enter/Esc, outline focus rõ nét.
  - `NFR-UI-05` (Motion & CLS): Hiệu ứng <= 150ms, `prefers-reduced-motion`, skeleton loading table 7x8 đồng dạng (CLS <= 0.1).
  - `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Data Area.
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt nghiệp vụ chuẩn hóa.
  - `UXR-05` (Destructive & Terminal Guards): Chốt lô đối soát yêu cầu xác nhận modal; lỗi 409 conflict giữ nguyên dữ liệu trên màn hình và hỗ trợ reload.
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - Route `/reconciliation` (OperationalFrame).
  - `QueryViewBoundary` và `StateBoundary` làm chủ 6 trạng thái UI: `loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`.
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - **100% Dùng UI Kit có sẵn (`docs/UI-KIT.md`)**: `WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, `ActionGuard`. Tuyệt đối cấm tự chế component mới hoặc viết CSS tùy tiện.
  - `D6`: Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`.
  - `D7`: Tối đa 1 nút Primary per zone. Nút "Chốt đối soát ca" là nút Primary duy nhất; nút "Làm mới" là nút Outline.
  - `D8`: Viền hairline `1px border-slate-200`, không đổ bóng đậm.
  - `D9`: Icons Lucide 2px stroke.
  - `T1–T3`: Căn phải số lượng nhu cầu, thực xuất, chênh lệch bằng `<Num>` font `tabular-nums`.
  - `T7`: Frozen header cố định khi cuộn.
  - `T8`: Chiều cao dòng compact 36–40px.
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - API Client: `reconciliationApi.ts` ánh xạ 100% khớp C# DTOs: `ReconciliationBatchDto`, `ReconciliationLineItem`.
  - Zero Fake API Data (`Rule TA-5`): Không chứa dữ liệu giả định, không nuốt lỗi.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build`)**:
  - `scripts/check-conformance-contracts.test.mjs`, `frontend/src/__tests__/Reconciliation.test.tsx`, `ZeroFakeApiAndTestAuditGuard.test.ts`.

---

## 2. Scoped Pre-Code UI Gate Block

```markdown
### Scoped Pre-Code UI Gate Block — Reconciliation (MRX)
- Route: /reconciliation
- Single Primary Work Object: OperationalFrame (Surface: reconciliation.batch)
- Server Mode: MATERIAL_RECONCILIATION (DOM-MODE-1: strict operational mode isolation)
- RBAC Guards: RoleGuard(['Admin', 'Manager', 'Quản lý']); ActionGuard capabilityId="RECON.BATCH.COMPLETE" (permissions: ReconciliationWriteAccess, allowedModes: ['MATERIAL_RECONCILIATION'])
- 6 UI States:
  - loading: WorkbenchSkeleton (table 7x8)
  - empty: StateBoundary (emptyTitle: "Chưa có lô đối soát", emptyDescription: "Không có lô đối soát nào cho khách hàng và ngày đã chọn.")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: StateBoundary (isPartial: data.lines.length === 0 && data.status !== 'COMPLETED', partialMessage: "Backend chỉ trả phạm vi vận hành hoặc chưa có daily review cho ngày đã chọn.")
  - write-reconciliation: Mutation error banner preserves loaded daily lines on HTTP 409 and provides "Tải lại dữ liệu mới nhất" action button
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, DataGrid, StateBoundary, Select, VietnameseDateInput, Button, Badge, Num, IdentifierText, Modal, ActionGuard
- Compliance Pledges: D6 (>=12px), D7 (1 primary, 1 outline), T7 (frozen header), T8 (36-40px density), M1.2 (1 blocking modal)
```

---

## 3. Global Constraints

- **DOM-MODE-1 Operational Mode Isolation**: Dữ liệu đối soát thuộc `MATERIAL_RECONCILIATION`. Nút chốt đối soát bắt buộc phải bị vô hiệu hóa khi máy chủ ở chế độ `DEFAULT`.
- **100% Existing UI Kit Reuse**: Tuyệt đối không tự chế ra component mới. Sử dụng 100% primitives trong `components/ui/*` và `components/workbench/*`.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Mọi dữ liệu test mock bắt buộc phải khớp 100% tên trường, kiểu dữ liệu, cấu trúc C# DTO.
- **Rule TA-2 (No Self-Mocking / Tautological Tests)**: Không mock `ReconciliationPage`, không mock `StateBoundary`. Chỉ mock network boundary.
- **Rule TA-3 (Zero Allowlist Padding)**: Không dùng `test.skip`, không thêm file vào danh sách ngoại lệ.
- **Rule TA-5 (Zero Fake API Data)**: Không chứa bất kỳ dữ liệu fallback hoặc hardcoded arrays nào trong `reconciliationApi.ts`.
- **No Destructive Operations**: Không can thiệp DB, không chạy migration, không git reset/clean.

---

## 4. Review Focus (5 Edge Cases & Verification Invariants)

1. **Operation-Grain Action Guard Parity:** `<ActionGuard capabilityId="RECON.BATCH.COMPLETE" ...>` trên `ReconciliationPage.tsx` phải khớp 1:1 với capability ID được khai báo trong `docs/conformance-contracts.json`.
2. **Strict Mode Isolation Check (`DOM-MODE-1`):** Khi `systemApi.getOperationalMode()` trả về `DEFAULT`, nút "Chốt đối soát ca" phải bị `disabled` và bọc trong fieldset giải thích "Chỉ khả dụng trong chế độ đối soát nguyên liệu".
3. **HTTP 409 Conflict Data Preservation:** Khi hoàn tất lô bị xung đột 409, dữ liệu dòng ngày đã nạp trước đó phải được giữ nguyên trên DOM, kèm thanh alert báo lỗi xung đột và nút "Tải lại dữ liệu mới nhất".
4. **HTTP 403 Permission Denied State:** Khi truy vấn hoặc mutation văng HTTP 403, giao diện phải hiển thị rõ ràng thông báo truy cập bị từ chối qua `StateBoundary`.
5. **Operation-Grain Machine Invariants:** `docs/conformance-contracts.json` phải đảm bảo mọi action trong 11 actions của Reconciliation được map 1:1, không còn grouped capability nào.

---

## 5. Implementation Tasks

### Task 1: Disaggregate Reconciliation Capabilities in Conformance Inventory

**Files:**
- Modify: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: 11 actions thuộc Reconciliation trong `docs/backend-action-index.json`.
- Produces: Disaggregated operation-grain capabilities:
  - `RECON.BATCH.*`: `CREATE`, `PREVIEW_IMPORT`, `COMMIT_IMPORT`, `READY`, `TRANSFER_WAREHOUSE`, `COMPLETE`
  - `RECON.DISPOSITION.READ` (`ReconciliationActuals.DispositionCategories`)
  - `RECON.ACTUALS.*`: `PURCHASED`, `ISSUED`, `DISPOSITION`
  - `RECON.DAILY_LINES.DISPOSITION`

- [ ] **Step 1: Write the failing test**

Trong `scripts/check-conformance-contracts.test.mjs`, thêm test case kiểm chứng phân tách 11 capabilities của Reconciliation thành operation-grain:

```javascript
test('splits Reconciliation capabilities at their actual operation grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const expectedOwners = new Map([
    ['ReconciliationBatches.Create', 'RECON.BATCH.CREATE'],
    ['ReconciliationBatches.PreviewQuantityImport', 'RECON.BATCH.PREVIEW_IMPORT'],
    ['ReconciliationBatches.CommitQuantityImport', 'RECON.BATCH.COMMIT_IMPORT'],
    ['ReconciliationBatches.Ready', 'RECON.BATCH.READY'],
    ['ReconciliationBatches.TransferToWarehouse', 'RECON.BATCH.TRANSFER_WAREHOUSE'],
    ['ReconciliationBatches.Complete', 'RECON.BATCH.COMPLETE'],
    ['ReconciliationActuals.DispositionCategories', 'RECON.DISPOSITION.READ'],
    ['ReconciliationActuals.Purchased', 'RECON.ACTUALS.PURCHASED'],
    ['ReconciliationActuals.Issued', 'RECON.ACTUALS.ISSUED'],
    ['ReconciliationActuals.Disposition', 'RECON.ACTUALS.DISPOSITION'],
    ['ReconciliationDailyLines.Disposition', 'RECON.DAILY_LINES.DISPOSITION'],
  ]);

  for (const [actionId, capabilityId] of expectedOwners) {
    const owners = contract.capabilities.filter((capability) => capability.actionIds && capability.actionIds.includes(actionId));
    assert.deepEqual(owners.map((owner) => owner.id), [capabilityId], `${actionId} must be owned by ${capabilityId}`);
  }

  const completeCap = contract.capabilities.find((c) => c.id === 'RECON.BATCH.COMPLETE');
  assert.ok(completeCap, 'RECON.BATCH.COMPLETE must exist');
  assert.equal(completeCap.deliveryClass, 'READY');
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:conformance-contracts`  
Kỳ vọng: FAIL vì `ReconciliationBatches.Complete` đang thuộc `RECON.BATCH.LIFECYCLE`.

- [ ] **Step 3: Update `docs/conformance-contracts.json`**

1. Xóa các capability gộp: `RECON.BATCH.LIFECYCLE`, `RECON.ACTUALS`.
2. Thêm các capabilities mới đã disaggregate với actionIds 1:1.
3. Gán `RECON.BATCH.COMPLETE` là `deliveryClass: "READY"`, `surfaceIds: ["reconciliation.batch"]`.
4. Cập nhật surface `reconciliation.batch` action `complete-batch`: `capabilityId: "RECON.BATCH.COMPLETE"`.
5. Cập nhật mảng `capabilityIds` trong `FR-RECON`.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:conformance-contracts && npm run check:conformance-contracts`  
Kỳ vọng: PASS toàn bộ tests.

- [ ] **Step 5: Commit**

```bash
git add docs/conformance-contracts.json scripts/check-conformance-contracts.test.mjs
git commit -m "feat(conformance): split reconciliation capabilities to operation grain"
```

---

### Task 2: Align ActionGuard in `ReconciliationPage.tsx` to `RECON.BATCH.COMPLETE`

**Files:**
- Modify: `frontend/src/features/reconciliation/ReconciliationPage.tsx`
- Modify: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `RECON.BATCH.COMPLETE`
- Produces: ActionGuard bọc nút "Chốt đối soát ca" với `capabilityId="RECON.BATCH.COMPLETE"`.

- [ ] **Step 1: Update `ReconciliationPage.tsx`**

Đổi `capabilityId="RECON.BATCH.LIFECYCLE"` thành `capabilityId="RECON.BATCH.COMPLETE"`.

- [ ] **Step 2: Run test to verify it passes**

Chạy lệnh: `npm run test:fe:unit && npm run test:conformance-contracts`  
Kỳ vọng: PASS toàn bộ tests (bao gồm cả test `maps every rendered Backend mutation to one guarded writable surface action`).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/reconciliation/ReconciliationPage.tsx
git commit -m "feat(reconciliation): align action guard capability to RECON.BATCH.COMPLETE"
```

---

### Task 3: Behavioral Test Audit & Anti-Regression Verification for Reconciliation

**Files:**
- Modify: `frontend/src/__tests__/Reconciliation.test.tsx`

**Interfaces:**
- Consumes: `ReconciliationPage`, `reconciliationApi`.
- Produces: Đầy đủ 4 kịch bản kiểm thử theo `Rule TA-4`:
  1. *Success & MRX Mode*: Render đúng các cột ngày.
  2. *Mode Isolation Guard*: Bị vô hiệu hóa khi ở chế độ `DEFAULT`.
  3. *Conflict Recovery 409*: Giữ nguyên dòng ngày, hiển thị nút reload.
  4. *Error 403 & Retry*: Xử lý lỗi phân quyền và lỗi mạng.

- [ ] **Step 1: Audit and verify tests in `frontend/src/__tests__/Reconciliation.test.tsx`**

Kiểm tra toàn bộ test cases tuân thủ `Rule TA-1` $\rightarrow$ `TA-5`.

- [ ] **Step 2: Run test to verify it passes**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/Reconciliation.test.tsx
git commit -m "test(conformance): audit reconciliation behavioral coverage and mode isolation"
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
2. `ipc-ui-review`: Chuẩn 3-Zone OperationalFrame, D6 font size >= 12px, D7 action hierarchy (1 primary, 1 outline), T7 frozen header, T8 compact density (36–40px), M1.2 single modal.
3. `ipc-code-review`: Khớp 1:1 C# DTOs, căn chỉnh ActionGuard capabilityId, bảo vệ bất biến `DOM-MODE-1`.

- [ ] **Step 3: Update `.planning/WORK.md`**

Ghi nhận mục `GF-R38 — Reconciliation capability conformance and operation-grain completion authority` vào `.planning/WORK.md`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record reconciliation conformance closure and return to idle"
```
