# Reports & Dashboard Capability Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Reports (`FR-REP`) and Dashboard (`FR-DASH`) capability conformance slice by disaggregating 7 bundled Data Quality actions into operation-grain capabilities, eliminating the hardcoded date string (`Thứ Hai, 21/09/2026`) in `DashboardPage.tsx`, restoring the "Làm mới" refresh button and `onRetry` recovery handler in `ReportsPage.tsx`, and strictly reusing 100% existing UI Kit components.

**Architecture:** Backend controllers (`WorkflowReportsController`, `DataQualityDispositionsController`, `UnitNormalizationReviewsController`, `DemandReportsController`, `PriceVarianceReportsController`, `StockMovementReportsController`) define authoritative DTOs, query contracts, and telemetry endpoints. This plan reconciles `docs/conformance-contracts.json` to map every HTTP action to a single operation-grain capability, repairs the static date in `DashboardPage.tsx` to format dynamically in the Vietnamese business timezone (`todayInVietnamese`), equips `ReportsPage.tsx` with standard reload actions in `WorkspaceHeader` and `StateBoundary`, and ensures full behavioral test coverage.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Testing Library, Node.js test runner, Tailwind CSS (semantic tokens only).

**Spec:** `docs/superpowers/specs/2026-10-18-reports-dashboard-conformance-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-DASH`: Bàn điều hành tổng quan hôm nay, KPI ca sản xuất, tắc luồng vận hành.
  - `FR-REP`: Báo cáo vận hành: nhu cầu nguyên liệu, biến động giá nhập, tồn kho định kỳ.
  - `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.
  - `NFR-UI-01` (Table Scalability): Phân trang server compact 25 dòng cho báo cáo.
  - `NFR-UI-02` (Triple-Layer RBAC): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
  - `NFR-UI-03` (Formatting Primitives): `<Num format="currency">`, `<Num format="quantity">`, `<IdentifierText>`, `formatVietnameseDateTime`.
  - `NFR-UI-04` (WCAG 2.2 AA Accessibility): Tỷ lệ tương phản >= 4.5:1, phím Tab/Enter/Esc, outline focus rõ nét.
  - `NFR-UI-05` (Motion & CLS): Hiệu ứng <= 150ms, `prefers-reduced-motion`, skeleton loading đồng dạng (CLS <= 0.1).
  - `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Data Area.
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt nghiệp vụ chuẩn hóa.
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - Route `/` (Dashboard) và `/reports` (3 URL-owned leaf views: `?view=demand`, `?view=prices`, `?view=stock`).
  - `QueryViewBoundary` và `StateBoundary` làm chủ 6 trạng thái UI: `loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`.
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - **100% Dùng UI Kit có sẵn (`docs/UI-KIT.md`)**: `WorkspaceHeader`, `TelemetrySubbar`, `SplitView`, `DataGrid`, `StateBoundary`, `Select`, `Button`, `Badge`, `Num`, `IdentifierText`. Tuyệt đối cấm tự chế component mới hoặc viết CSS tùy tiện.
  - `D6`: Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`.
  - `D7`: Tối đa 1 nút Primary per zone. Nút "Mở bàn giao ca" trên Dashboard là Primary duy nhất; Reports có 0 nút Primary (chỉ có nút outline "Làm mới").
  - `D8`: Viền hairline `1px border-slate-200`, không đổ bóng đậm.
  - `D9`: Icons Lucide 2px stroke.
  - `T1–T3`: Căn phải số lượng/tiền tệ bằng `<Num>` và font `tabular-nums`.
  - `T7`: Frozen header cố định khi cuộn.
  - `T8`: Chiều cao dòng compact 36–40px.
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - API Client: `dashboardApi.ts`, `reportsApi.ts` ánh xạ 100% khớp các C# DTOs.
  - Zero Fake API Data (`Rule TA-5`): Không chứa dữ liệu giả định, không nuốt lỗi.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build`)**:
  - `scripts/check-conformance-contracts.test.mjs`, `frontend/src/__tests__/Dashboard.test.tsx`, `frontend/src/__tests__/Reports.test.tsx`, `ZeroFakeApiAndTestAuditGuard.test.ts`.

---

## 2. Scoped Pre-Code UI Gate Blocks

### Pre-Code UI Gate Block 1 — Dashboard (`/`)
```markdown
### Scoped Pre-Code UI Gate Block — Dashboard
- Route: /
- Single Primary Work Object: OperationalFrame (Surface: dashboard.root)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['Admin', 'Manager', 'DieuPhoiVien', 'Chef', 'ThuKho', 'ThuMua'])
- 6 UI States:
  - loading: Skeleton (table 4x6)
  - empty: StateBoundary (tasks empty scenario)
  - error: StateBoundary (displays message + accessible retry)
  - permission-denied: StateBoundary (403 alert)
  - partial: N/A
  - write-reconciliation: N/A
- Primitives & Composites: WorkspaceHeader, SplitView, DataGrid, StateBoundary, Button, Badge, Num, IdentifierText
- Compliance Pledges: D6 (>=12px), D7 (1 primary, 1 outline), T7 (frozen header), T8 (36-40px density)
```

### Pre-Code UI Gate Block 2 — Reports (`/reports`)
```markdown
### Scoped Pre-Code UI Gate Block — Reports
- Route: /reports (N6 leaves: ?view=demand, ?view=prices, ?view=stock)
- Single Primary Work Object: OperationalFrame (Surfaces: reports.demand, reports.prices, reports.stock)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['Admin', 'Manager', 'KeToan'])
- 6 UI States:
  - loading: WorkbenchSkeleton (table 6x8)
  - empty: StateBoundary (emptyScenario="prerequisite-blocked", emptyTitle="Chưa có dữ liệu báo cáo")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (403 alert)
  - partial: N/A
  - write-reconciliation: N/A
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, DataGrid, StateBoundary, Select, Button, Badge, Num, IdentifierText
- Compliance Pledges: D6 (>=12px), D7 (0 primary, 1 outline), T7 (frozen header), T8 (36-40px density), N6 (URL-leaf views)
```

---

## 3. Global Constraints

- **DOM-MODE-1 Operational Mode Isolation**: Báo cáo và Dashboard thuộc `SHARED_MASTER_DATA`. Tuyệt đối không gửi header hoặc hòa trộn luồng với `MATERIAL_RECONCILIATION`.
- **100% Existing UI Kit Reuse**: Tuyệt đối không tự chế ra component mới. Sử dụng 100% primitives trong `components/ui/*` và `components/workbench/*`.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Mọi dữ liệu test mock bắt buộc phải khớp 100% tên trường, kiểu dữ liệu, cấu trúc C# DTO.
- **Rule TA-2 (No Self-Mocking / Tautological Tests)**: Không mock `DashboardPage`, không mock `ReportsPage`, không mock `StateBoundary`. Chỉ mock network boundary.
- **Rule TA-3 (Zero Allowlist Padding)**: Không dùng `test.skip`, không thêm file vào danh sách ngoại lệ.
- **Rule TA-5 (Zero Fake API Data)**: Không chứa bất kỳ dữ liệu fallback hoặc hardcoded arrays nào trong `dashboardApi.ts` hay `reportsApi.ts`.
- **No Destructive Operations**: Không can thiệp DB, không chạy migration, không git reset/clean.

---

## 4. Review Focus (5 Edge Cases & Verification Invariants)

1. **Dynamic Business Date Invariant:** Header của Dashboard phải hiển thị ngày tiếng Việt được sinh động (`todayInVietnamese`), tuyệt đối không bao giờ hiển thị cứng chuỗi tĩnh "Thứ Hai, 21/09/2026".
2. **Accessible Refresh & Retry in Reports:** `WorkspaceHeader` của `ReportsPage` phải có nút "Làm mới", và `StateBoundary` phải có `onRetry` handler để người dùng có thể tải lại khi gặp lỗi mạng.
3. **Server Pagination Navigation in Reports:** Chuyển trang qua `<nav aria-label="Phân trang báo cáo">` phải gọi đúng `reportsApi` với `pageNumber: 2`.
4. **Single Primary Action Policy (`D7`):** Dashboard có đúng 1 nút Primary là "Mở bàn giao ca" và 1 nút Outline "Làm mới"; Reports có 0 nút Primary (chỉ có nút Outline "Làm mới").
5. **Operation-Grain Machine Invariants:** `docs/conformance-contracts.json` phải đảm bảo mọi action trong 7 actions của Data Quality được map 1:1, không còn grouped capability nào.

---

## 5. Implementation Tasks

### Task 1: Disaggregate Data Quality Capabilities in Conformance Inventory

**Files:**
- Modify: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: 7 actions thuộc Data Quality & Diagnostics trong `docs/backend-action-index.json`.
- Produces: Disaggregated operation-grain capabilities:
  - `REP.DATA_QUALITY.READ`: `DataQualityDispositions.Get`
  - `REP.DATA_QUALITY.CREATE`: `DataQualityDispositions.Create`
  - `REP.DATA_QUALITY.REVIEW`: `DataQualityDispositions.Review`
  - `REP.DATA_QUALITY.APPLY`: `DataQualityDispositions.Apply`
  - `REP.DATA_QUALITY.CLEANUP`: `WorkflowReports.CleanupDataQuality`
  - `REP.DATA_QUALITY.REMEDIATE`: `WorkflowReports.UpdateDataQualityIssueRemediation`
  - `REP.UNIT_NORMALIZATION.DECIDE`: `UnitNormalizationReviews.Decide`

- [ ] **Step 1: Write the failing test**

Trong `scripts/check-conformance-contracts.test.mjs`, thêm test case kiểm chứng phân tách 7 capabilities của Data Quality thành operation-grain:

```javascript
test('splits Data Quality capabilities at their actual operation grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const expectedOwners = new Map([
    ['DataQualityDispositions.Get', 'REP.DATA_QUALITY.READ'],
    ['DataQualityDispositions.Create', 'REP.DATA_QUALITY.CREATE'],
    ['DataQualityDispositions.Review', 'REP.DATA_QUALITY.REVIEW'],
    ['DataQualityDispositions.Apply', 'REP.DATA_QUALITY.APPLY'],
    ['WorkflowReports.CleanupDataQuality', 'REP.DATA_QUALITY.CLEANUP'],
    ['WorkflowReports.UpdateDataQualityIssueRemediation', 'REP.DATA_QUALITY.REMEDIATE'],
    ['UnitNormalizationReviews.Decide', 'REP.UNIT_NORMALIZATION.DECIDE'],
  ]);

  for (const [actionId, capabilityId] of expectedOwners) {
    const owners = contract.capabilities.filter((capability) => capability.actionIds && capability.actionIds.includes(actionId));
    assert.deepEqual(owners.map((owner) => owner.id), [capabilityId], `${actionId} must be owned by ${capabilityId}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:conformance-contracts`  
Kỳ vọng: FAIL vì `DataQualityDispositions.Get` đang thuộc `REP.DATA_QUALITY.WRITE`.

- [ ] **Step 3: Update `docs/conformance-contracts.json`**

1. Xóa capability gộp: `REP.DATA_QUALITY.WRITE`.
2. Thêm 7 capabilities mới đã disaggregate với actionIds 1:1, gán đúng `operation`, `mode: "SHARED_MASTER_DATA"`, `deliveryClass: "PARTIAL"`.
3. Gán `REP.DATA_QUALITY.READ` là `deliveryClass: "READY"`.
4. Cập nhật mảng `capabilityIds` trong các requirements liên quan: `FR-REP`, `FR-SYS`, `BR-GLOBAL-03`.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:conformance-contracts && npm run check:conformance-contracts`  
Kỳ vọng: PASS toàn bộ tests.

- [ ] **Step 5: Commit**

```bash
git add docs/conformance-contracts.json scripts/check-conformance-contracts.test.mjs
git commit -m "feat(conformance): split data quality capabilities to operation grain"
```

---

### Task 2: Eliminate Hardcoded Date in Dashboard & Add Refresh/Retry to Reports

**Files:**
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Modify: `frontend/src/features/reports/ReportsPage.tsx`
- Modify: `frontend/src/__tests__/Dashboard.test.tsx`
- Modify: `frontend/src/__tests__/Reports.test.tsx`

**Interfaces:**
- Consumes: Vietnamese date formatting helper.
- Produces:
  - `DashboardPage`: Hiển thị ngày động theo thời gian thực tế `todayInVietnamese()`, không hardcode chuỗi tĩnh "21/09/2026".
  - `ReportsPage`: Thêm nút "Làm mới" trên `WorkspaceHeader` và kết nối `onRetry={reload}` vào `StateBoundary`.

- [ ] **Step 1: Write failing tests in `Dashboard.test.tsx` and `Reports.test.tsx`**

Thêm test kiểm chứng:
1. `DashboardPage` hiển thị ngày động trong tuần theo múi giờ Việt Nam, không có chuỗi tĩnh "21/09/2026".
2. `ReportsPage` có nút "Làm mới" trên header và nút "Thử lại" khi bị lỗi.

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: FAIL.

- [ ] **Step 3: Implement changes in `DashboardPage.tsx` and `ReportsPage.tsx`**

1. Sửa `DashboardPage.tsx`: Thêm hàm `todayInVietnamese()` và thay thế chuỗi tĩnh "Thứ Hai, 21/09/2026".
2. Sửa `ReportsPage.tsx`: Bổ sung hàm `reload()`, truyền `actions={<Button variant="outline" size="default" onClick={reload} className="h-9 text-sm font-medium">Làm mới</Button>}` vào `WorkspaceHeader` và `onRetry={reload}` vào `StateBoundary`.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/dashboard/DashboardPage.tsx frontend/src/features/reports/ReportsPage.tsx frontend/src/__tests__/Dashboard.test.tsx frontend/src/__tests__/Reports.test.tsx
git commit -m "feat(reports-dashboard): eliminate hardcoded dashboard date and restore reports error retry"
```

---

### Task 3: Behavioral Test Audit & Anti-Regression Verification

**Files:**
- Modify: `frontend/src/__tests__/Dashboard.test.tsx`
- Modify: `frontend/src/__tests__/Reports.test.tsx`

**Interfaces:**
- Consumes: `DashboardPage`, `ReportsPage`.
- Produces: Đầy đủ 4 kịch bản kiểm thử theo `Rule TA-4`.

- [ ] **Step 1: Audit and verify all test cases**

Xác minh tất cả test cases tuân thủ `Rule TA-1` $\rightarrow$ `TA-5`.

- [ ] **Step 2: Run test to verify**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS toàn bộ test files.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/Dashboard.test.tsx frontend/src/__tests__/Reports.test.tsx
git commit -m "test(conformance): audit dashboard and reports behavioral coverage"
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
2. `ipc-ui-review`: Chuẩn 3-Zone OperationalFrame, D6 font size >= 12px, D7 single primary hierarchy (1 on dashboard, 0 on reports), T7 frozen header, T8 compact density (36–40px).
3. `ipc-code-review`: Khớp 1:1 C# DTOs, xóa bỏ hardcoding ngày, bảo vệ bất biến `DOM-MODE-1`.

- [ ] **Step 3: Update `.planning/WORK.md`**

Ghi nhận mục `GF-R39 — Reports and Dashboard capability conformance and date authority` vào `.planning/WORK.md`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record reports and dashboard conformance closure and return to idle"
```
