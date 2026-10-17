# Chef & Kitchen Production Capability Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Chef and Kitchen Production (`FR-CHEF`) capability conformance slice by verifying that all 25 actions associated with kitchen operations are operation-grain in `docs/conformance-contracts.json`, enhancing `Chef.test.tsx` to cover empty state resiliency under `Rule TA-4`, ensuring zero hardcoded assumptions, and strictly reusing 100% existing UI Kit components.

**Architecture:** Backend controllers (`ProductionPlansController`, `ServiceRunsController`, `InventoryIssuesController`, `InventoryReturnsController`, `SupplementalMaterialRequestsController`) define authoritative DTOs, query contracts, and handover states. This plan verifies `docs/conformance-contracts.json` to ensure 100% single-action capability mapping for `FR-CHEF`, verifies that `ChefDashboardPage.tsx` adheres to 3-Zone OperationalFrame layout contracts with compact density (`T8`) and frozen headers (`T7`), and proves empty state resiliency and error recovery through rigorous test audit.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Testing Library, Node.js test runner, Tailwind CSS (semantic tokens only).

**Spec:** `docs/superpowers/specs/2026-10-18-chef-production-conformance-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-CHEF`: Theo dõi KHSX theo ca, checklist kiểm đếm nhận nguyên liệu từ kho, xác nhận bàn giao, tạo phiếu trả hàng thừa.
  - `BR-GLOBAL-02`: Quantitative Traceability Chain từ KHSX $\rightarrow$ Phiếu xuất kho bàn giao bếp $\rightarrow$ Thực tế tiêu hao.
  - `BR-GLOBAL-03`: Phiếu xuất kho phải bắt đầu từ yêu cầu vật tư đã duyệt; mọi sai lệch ca phải có giải trình.
  - `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.
  - `NFR-UI-01` (Table Scalability): Bắt buộc phân trang server compact 25 dòng cho phiếu xuất.
  - `NFR-UI-02` (Triple-Layer RBAC): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
  - `NFR-UI-03` (Formatting Primitives): Số lượng dùng `<Num format="quantity">`, mã chứng từ dùng `<IdentifierText>`, ngày tháng dùng `formatVietnameseDate`.
  - `NFR-UI-04` (WCAG 2.2 AA Accessibility): Tỷ lệ tương phản >= 4.5:1, phím Tab/Enter/Esc, outline focus rõ nét.
  - `NFR-UI-05` (Motion & CLS): Hiệu ứng <= 150ms, `prefers-reduced-motion`, skeleton loading table 6x8 đồng dạng (CLS <= 0.1).
  - `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Data Area.
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt nghiệp vụ chuẩn hóa.
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - Route `/chef` với 2 URL-owned leaf views theo chuẩn `N6`: `?view=plans` (mặc định) và `?view=issues`.
  - `QueryViewBoundary` và `StateBoundary` làm chủ 6 trạng thái UI: `loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`.
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - **100% Dùng UI Kit có sẵn (`docs/UI-KIT.md`)**: `WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Button`, `Badge`, `Num`, `IdentifierText`. Tuyệt đối cấm tự chế component mới hoặc viết CSS tùy tiện.
  - `D6`: Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`.
  - `D7`: 0 nút Primary (chế độ đọc an toàn `READ_ONLY_BY_CONTRACT`), nút "Làm mới" là nút Outline.
  - `D8`: Viền hairline `1px border-slate-200`, không đổ bóng đậm.
  - `D9`: Icons Lucide 2px stroke.
  - `T1–T3`: Căn phải số lượng suất và số lượng thực xuất bằng `<Num>` font `tabular-nums`.
  - `T7`: Frozen header cố định khi cuộn.
  - `T8`: Chiều cao dòng compact 36–40px.
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - API Client: `chefApi.ts` ánh xạ 100% khớp các C# DTOs: `ProductionPlanDto`, `InventoryIssueDto`.
  - Zero Fake API Data (`Rule TA-5`): Không chứa dữ liệu giả định, không nuốt lỗi.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build`)**:
  - `scripts/check-conformance-contracts.test.mjs`, `frontend/src/__tests__/Chef.test.tsx`, `ZeroFakeApiAndTestAuditGuard.test.ts`.

---

## 2. Scoped Pre-Code UI Gate Block

```markdown
### Scoped Pre-Code UI Gate Block — Chef
- Route: /chef (N6 leaves: ?view=plans, ?view=issues)
- Single Primary Work Object: OperationalFrame (Surfaces: chef.plans, chef.issues)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['Admin', 'Chef', 'Beptruong']); zero unbacked completion action exposed
- 6 UI States:
  - loading: WorkbenchSkeleton (table 6x8)
  - empty: StateBoundary (plans: "Chưa có kế hoạch sản xuất"; issues: "Chưa có phiếu xuất bàn giao")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: N/A (all rendered columns map to authoritative C# DTO properties)
  - write-reconciliation: N/A (read-only surface for kitchen schedules; unbacked completion actions prohibited)
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, DataGrid, StateBoundary, Select, VietnameseDateInput, Button, Badge, Num, IdentifierText
- Compliance Pledges: D6 (>=12px), D7 (0 primary, 1 outline), T7 (frozen header), T8 (36-40px density), M1.2 (0 blocking modals), N6 (URL-leaf views)
```

---

## 3. Global Constraints

- **DOM-MODE-1 Operational Mode Isolation**: Kế hoạch bếp thuộc `SHARED_MASTER_DATA`. Tuyệt đối không gửi header hoặc hòa trộn luồng với `MATERIAL_RECONCILIATION`.
- **100% Existing UI Kit Reuse**: Tuyệt đối không tự chế ra component mới. Sử dụng 100% primitives trong `components/ui/*` và `components/workbench/*`.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Mọi dữ liệu test mock bắt buộc phải khớp 100% tên trường, kiểu dữ liệu, cấu trúc C# DTO.
- **Rule TA-2 (No Self-Mocking / Tautological Tests)**: Không mock `ChefDashboardPage`, không mock `StateBoundary`. Chỉ mock network boundary.
- **Rule TA-3 (Zero Allowlist Padding)**: Không dùng `test.skip`, không thêm file vào danh sách ngoại lệ.
- **Rule TA-5 (Zero Fake API Data)**: Không chứa bất kỳ dữ liệu fallback hoặc hardcoded arrays nào trong `chefApi.ts`.
- **No Destructive Operations**: Không can thiệp DB, không chạy migration, không git reset/clean.

---

## 4. Review Focus (5 Edge Cases & Verification Invariants)

1. **Empty State Resiliency in Plans View:** Khi `plans: []` và `view=plans`, `StateBoundary` phải hiển thị "Chưa có kế hoạch sản xuất" và mô tả chuẩn nghiệp vụ, không render bảng trống.
2. **Empty State Resiliency in Issues View:** Khi `issues: []` và `view=issues`, `StateBoundary` phải hiển thị "Chưa có phiếu xuất bàn giao" và mô tả chuẩn nghiệp vụ.
3. **Server Pagination Navigation for Issues:** Chuyển trang phiếu xuất qua `<nav aria-label="Phân trang phiếu xuất">` phải gọi đúng `chefApi.getChefDashboardData` với `pageNumber: 2`.
4. **Zero Unbacked Completion Action:** Tuyệt đối không render nút hay form "Hoàn tất ca nấu" khi chưa có service run confirmation authority.
5. **Operation-Grain Machine Invariants:** `docs/conformance-contracts.json` phải đảm bảo mọi capability trong 25 capabilities của `FR-CHEF` đều đã là operation-grain độc lập.

---

## 5. Implementation Tasks

### Task 1: Verify Operation-Grain Disaggregation of `FR-CHEF` in Conformance Inventory

**Files:**
- Modify: `scripts/check-conformance-contracts.test.mjs`

- [ ] **Step 1: Write test verifying FR-CHEF operation-grain capabilities**

Trong `scripts/check-conformance-contracts.test.mjs`, thêm test case kiểm chứng tất cả 25 capabilities của `FR-CHEF` đều là operation-grain và map 1:1:

```javascript
test('verifies FR-CHEF capabilities are all operation-grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const chefReq = contract.requirements.find((r) => r.id === 'FR-CHEF');
  assert.ok(chefReq, 'FR-CHEF must exist');
  assert.equal(chefReq.capabilityIds.length, 25);

  const chefCaps = contract.capabilities.filter((c) => chefReq.capabilityIds.includes(c.id));
  assert.equal(chefCaps.length, 25);
  for (const cap of chefCaps) {
    assert.ok(cap.actionIds.length > 0, `${cap.id} must have mapped actionIds`);
    assert.ok(['read', 'create', 'update', 'terminal'].includes(cap.operation), `${cap.id} has valid operation`);
  }
});
```

- [ ] **Step 2: Run test to verify it passes**

Chạy lệnh: `npm run test:conformance-contracts && npm run check:conformance-contracts`  
Kỳ vọng: PASS toàn bộ tests.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-conformance-contracts.test.mjs
git commit -m "feat(conformance): verify FR-CHEF operation-grain capabilities"
```

---

### Task 2: Behavioral Test Audit & Empty State Coverage in `Chef.test.tsx`

**Files:**
- Modify: `frontend/src/__tests__/Chef.test.tsx`

**Interfaces:**
- Consumes: `ChefDashboardPage`, `chefApi`.
- Produces: Đầy đủ 4 kịch bản kiểm thử theo `Rule TA-4`:
  1. *Success & View Isolation*: Render KHSX trên `view=plans` và phiếu xuất trên `view=issues`.
  2. *Server Pagination*: Phân trang phiếu xuất bàn giao.
  3. *Empty State*: Bổ sung kiểm thử khi không có KHSX, `StateBoundary` hiển thị "Chưa có kế hoạch sản xuất".
  4. *Error Handling & Retry*: Báo lỗi mạng thật và nút `[Thử lại]` gọi lại API.
  5. *Zero Unbacked Action*: Không render nút "Hoàn tất ca nấu".

- [ ] **Step 1: Write empty state test in `frontend/src/__tests__/Chef.test.tsx`**

Thêm test kiểm chứng khi `plans: []`:

```typescript
it('renders clean empty state when no production plans exist for the selected scope', async () => {
  vi.spyOn(chefApi, 'getChefDashboardData').mockResolvedValue({
    plans: [],
    issues: [],
    totalPlans: 0,
    sentPlans: 0,
    totalServings: 0,
    issuePage: { totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false },
  });

  renderChef('/chef?view=plans');

  expect(await screen.findByText('Chưa có kế hoạch sản xuất')).toBeInTheDocument();
  expect(screen.getByText('Điều phối chưa có KHSX persisted cho ngày, ca và khách hàng đã chọn.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it passes**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/Chef.test.tsx
git commit -m "test(conformance): audit chef behavioral coverage and empty states"
```

---

### Task 3: Full Non-Mutating Verification, Review Gates & Work Closure

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
2. `ipc-ui-review`: Chuẩn 3-Zone OperationalFrame, D6 font size >= 12px, D7 zero primary buttons, T7 frozen header, T8 compact density (36–40px), N6 URL-leaf navigation.
3. `ipc-code-review`: Khớp 1:1 C# DTOs, bảo vệ bất biến `DOM-MODE-1`, zero synthetic telemetry.

- [ ] **Step 3: Update `.planning/WORK.md`**

Ghi nhận mục `GF-R37 — Chef capability conformance and operational plan authority` vào `.planning/WORK.md`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record chef conformance closure and return to idle"
```
