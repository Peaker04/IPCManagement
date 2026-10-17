# Weekly Menu & Coordination Capability Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Weekly Menu (`FR-MENU`) and Meal Order Coordination (`FR-COORD`) capability conformance slice by disaggregating 46 bundled Planning/Coordination actions into operation-grain capabilities, eliminating hardcoded target prices (`25.000 ₫`) and fabricated `categoryName` fields, aligning types with C# Backend DTOs, and strictly reusing 100% existing UI Kit components.

**Architecture:** Backend controllers (`CoordinationOrdersController`, `WeeklyMenuImportsController`, `MaterialDemandController`, `ProductionPlansController`, `ServiceRunsController`) define authoritative DTOs, query contracts, and lifecycle commands. This plan reconciles `docs/conformance-contracts.json` to map every HTTP action to a single operation-grain capability, repairs hardcoded telemetry in `WeeklyScheduleView.tsx` by reading dynamic `mealTargetPrice` via `<Num format="currency">`, aligns `MenuCostView.tsx` with C# dish fields (`dishType` / `dishGroup`), and ensures full behavioral test coverage across `/weekly-menu` and `/meal-orders`.

**Tech Stack:** TypeScript 5, React 18, React Router v6, Vitest 4, Testing Library, Node.js test runner, Tailwind CSS (semantic tokens only).

**Spec:** `docs/superpowers/specs/2026-10-18-weekly-menu-coordination-conformance-design.md`

---

## 1. Architectural Alignment & Governance Matrix

### 5-Layer Governance Architecture & Rules Traceability

- **Layer 1 — Requirements (`FR`, `NFR`, `UXR`)**:
  - `FR-MENU`: Lập thực đơn và kế hoạch tuần (4 views: schedule, demand, production-plan, cost).
  - `FR-COORD`: Điều phối suất ăn khách hàng theo ca/ngày cho từng khách hàng, theo dõi sai lệch suất ăn.
  - `BR-GLOBAL-02`: Quantitative Traceability Chain từ BOM gốc $\rightarrow$ KHSX $\rightarrow$ Nhu cầu vật tư.
  - `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.
  - `NFR-UI-01` (Table Scalability): Bắt buộc phân trang server hoặc cuộn viewport đơn.
  - `NFR-UI-02` (Triple-Layer RBAC): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
  - `NFR-UI-03` (Formatting Primitives): `<Num format="currency">`, `<Num format="quantity">`, `<IdentifierText>`, `dd/MM/yyyy`.
  - `NFR-UI-04` (WCAG 2.2 AA Accessibility): Tỷ lệ tương phản >= 4.5:1, phím Tab/Enter/Esc, outline focus rõ nét.
  - `NFR-UI-05` (Motion & CLS): Hiệu ứng <= 150ms, `prefers-reduced-motion`, CLS <= 0.1.
  - `UXR-01` (3-Zone Workbench): Header 56px, Telemetry 44px, Data Area.
  - `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt nghiệp vụ chuẩn hóa.
- **Layer 2 — UX Architecture (`IA · Navigation · UI State Matrix`)**:
  - Route `/weekly-menu` với 4 URL-owned leaf views theo chuẩn `N6`: `?view=schedule` (mặc định), `?view=demand`, `?view=production-plan`, `?view=cost`.
  - Route `/meal-orders` với bộ lọc ca phục vụ bằng Tabs (`MORNING` / `AFTERNOON`).
  - `QueryViewBoundary` và `StateBoundary` làm chủ 6 trạng thái UI: `loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`.
- **Layer 3 — UI Design & Taste Floor (Impeccable `Operate` Mode · `D1–D9` · `T1–T16` · `M1–M3`)**:
  - **100% Dùng UI Kit có sẵn (`docs/UI-KIT.md`)**: `WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Tabs`, `Button`, `Badge`, `Num`, `IdentifierText`. Tuyệt đối cấm tự chế component mới hoặc viết CSS tùy tiện.
  - `D6`: Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`.
  - `D7`: Tối đa 1 nút Primary per zone. Nút "Làm mới" là nút Outline.
  - `D8`: Viền hairline `1px border-slate-200`, không đổ bóng đậm.
  - `D9`: Icons Lucide 2px stroke.
  - `T1–T3`: Căn phải số lượng/tiền tệ bằng `<Num>` và font `tabular-nums`.
  - `T7`: Frozen header cố định khi cuộn.
  - `T8`: Chiều cao dòng compact 36–40px.
- **Layer 4 — FE Implementation (`Component Architecture · API · RBAC`)**:
  - API Client: `weeklyMenuApi.ts`, `coordinationApi.ts` ánh xạ 100% khớp các C# DTOs: `WeeklyMenuImportResultDto`, `CoordinationOrderDto`, `ProductionPlanDto`, `MaterialDemandAggregateItem`.
  - Zero Fake API Data (`Rule TA-5`): Không chứa dữ liệu giả định, không nuốt lỗi.
- **Layer 5 — Quality & Validation (`Contract Tests · Anti-Tautology · Lint · Build`)**:
  - `scripts/check-conformance-contracts.test.mjs`, `frontend/src/__tests__/WeeklyMenu.test.tsx`, `frontend/src/__tests__/MealOrders.test.tsx`, `ZeroFakeApiAndTestAuditGuard.test.ts`.

---

## 2. Scoped Pre-Code UI Gate Blocks

### Pre-Code UI Gate Block 1 — Weekly Menu (`/weekly-menu`)
```markdown
### Scoped Pre-Code UI Gate Block — Weekly Menu
- Route: /weekly-menu (N6 leaves: ?view=schedule, ?view=demand, ?view=production-plan, ?view=cost)
- Single Primary Work Object: OperationalFrame (Surfaces: weekly.schedule, weekly.demand, weekly.production, weekly.cost)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['Admin', 'DieuPhoiVien', 'QuanLySanXuat']); ActionGuard on demand calculation / dispatch
- 6 UI States:
  - loading: WorkbenchSkeleton (schedule: matrix 7x6; demand/plan/cost: table 6x8)
  - empty: StateBoundary (emptyTitle: "Chưa có dữ liệu thực đơn tuần", emptyDescription: "Backend chưa có lịch thực đơn cho khách hàng và tuần đã chọn.")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: N/A (all rendered columns map to authoritative C# DTO properties)
  - write-reconciliation: N/A (read-only surface for schedule/cost; guarded actions retain inbox state on error)
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, StateBoundary, DataGrid, Select, VietnameseDateInput, Button, Badge, Num, IdentifierText
- Compliance Pledges: D6 (>=12px), D7 (0 primary, 1 outline), T7 (frozen header), T8 (36-40px density), M1.2 (0 blocking modals), N6 (URL-leaf views)
```

### Pre-Code UI Gate Block 2 — Meal Orders (`/meal-orders`)
```markdown
### Scoped Pre-Code UI Gate Block — Meal Orders
- Route: /meal-orders
- Single Primary Work Object: OperationalFrame (Surface: meal.orders)
- Server Mode: SHARED_MASTER_DATA (DOM-MODE-1: shared master data)
- RBAC Guards: RoleGuard(['Admin', 'DieuPhoiVien']); ActionGuard on order adjustments
- 6 UI States:
  - loading: WorkbenchSkeleton (table 6x8)
  - empty: StateBoundary (emptyTitle: "Không có đơn ăn ca", emptyDescription: "Không có đơn ăn nào cho ngày và ca phục vụ đã chọn.")
  - error: StateBoundary (preserves raw ApiError, displays message + accessible [Thử lại] retry button)
  - permission-denied: StateBoundary (ApiError status 403 renders distinct permission denied alert)
  - partial: N/A (renders exact persisted order facts)
  - write-reconciliation: N/A (unsupported mutations remain disabled)
- Primitives & Composites: WorkspaceHeader, TelemetrySubbar, StateBoundary, DataGrid, Select, VietnameseDateInput, Tabs, Badge, Num
- Compliance Pledges: D6 (>=12px), D7 (0 primary, 1 outline), T7 (frozen header), T8 (36-40px density), M1.2 (0 blocking modals)
```

---

## 3. Global Constraints

- **DOM-MODE-1 Operational Mode Isolation**: Thực đơn tuần và đơn điều phối thuộc `SHARED_MASTER_DATA`. Tuyệt đối không gửi header hoặc hòa trộn luồng với `MATERIAL_RECONCILIATION`.
- **100% Existing UI Kit Reuse**: Tuyệt đối không tự chế ra component mới. Sử dụng 100% primitives trong `components/ui/*` và `components/workbench/*`.
- **Rule TA-1 (Backend-Grounded Fixtures Only)**: Mọi dữ liệu test mock bắt buộc phải khớp 100% tên trường, kiểu dữ liệu, cấu trúc C# DTO.
- **Rule TA-2 (No Self-Mocking / Tautological Tests)**: Không mock `WeeklyMenuPage`, không mock `MealOrdersPage`, không mock `StateBoundary`. Chỉ mock network boundary.
- **Rule TA-3 (Zero Allowlist Padding)**: Không dùng `test.skip`, không thêm file vào danh sách ngoại lệ.
- **Rule TA-5 (Zero Fake API Data)**: Không chứa bất kỳ dữ liệu fallback hoặc hardcoded arrays nào trong `weeklyMenuApi.ts` hay `coordinationApi.ts`.
- **No Destructive Operations**: Không can thiệp DB, không chạy migration, không git reset/clean.

---

## 4. Review Focus (5 Edge Cases & Verification Invariants)

1. **Dynamic Target Price Rendering:** Khi `mealTargetPrice === 30000`, `WeeklyScheduleView` phải render `30.000 ₫` qua `<Num format="currency">`. Khi `mealTargetPrice === 0`, phải render `Theo ca / Chưa chốt`, tuyệt đối không bao giờ hiển thị cứng `25.000 ₫`.
2. **Dish Cost Column Fidelity:** `MenuCostView` phải hiển thị cột "Phân loại" đọc `row.dishType || row.dishGroup || '—'`, không đọc `row.categoryName`.
3. **Empty States Across 4 Views:** Khi dữ liệu trả về rỗng, `WeeklyMenuPage` và `MealOrdersPage` phải hiển thị thông báo rỗng chuẩn qua `StateBoundary` mà không gây lỗi runtime trên matrix rows hoặc data grid.
4. **View Switching without Layout Shift:** Chuyển đổi giữa 4 URL views `?view=schedule`, `?view=demand`, `?view=production-plan`, `?view=cost` phải cập nhật tiêu đề, telemetry bar và view tương ứng mà không re-render sai state hay giật layout (CLS <= 0.1).
5. **Operation-Grain Machine Invariants:** `docs/conformance-contracts.json` phải đảm bảo mọi action trong 46 actions của Planning/Coordination được map 1:1, không còn grouped capability nào.

---

## 5. Implementation Tasks

### Task 1: Disaggregate Coordination & Planning Capabilities in Conformance Inventory

**Files:**
- Modify: `docs/conformance-contracts.json`
- Modify: `scripts/check-conformance-contracts.test.mjs`

**Interfaces:**
- Consumes: 46 actions thuộc Coordination & Planning trong `docs/backend-action-index.json`.
- Produces: Disaggregated operation-grain capabilities:
  - `COORD.ORDER.*`: `ADJUST_AFTER_LOCK`, `ADJUST_SERVINGS`, `LOCK`, `SIGNOFF`, `SIGNOFF_SCOPE`, `UNLOCK`, `UNLOCK_SCOPE`, `UPDATE_FORECAST`
  - `COORD.MENU_SCHEDULE.*`: `RULES`, `VERSION`, `ROLLBACK`
  - `PLAN.DEMAND.*`: `GENERATE`, `APPROVE`, `STALENESS.READ`
  - `COORD.CUSTOMER_CONTRACT.*`: `READ`, `CREATE`, `UPDATE`
  - `COORD.PORTION_RULE.*`: `READ`, `RESOLVE`, `CREATE`, `UPDATE`
  - `PLAN.SERVICE_RUN.*`: `OPEN`, `START`, `RECORD_ACTUALS`, `CONFIRM`, `WAIVE_CONFIRM`, `RESOLVE_VARIANCE`, `RESOLVE_SERVING_VARIANCE`, `CREATE_ADJUSTMENT`, `CLOSE`, `DECLARE_VARIANCE`, `APPROVE_WAIVER`
  - `MENU.IMPORT.*`: `BATCH_COMMIT`, `PREVIEW`, `COMMIT`, `FILE_IMPORT`, `ROLLBACK`, `BULK_UPDATE`, `SAVE_MAPPING`
  - `MENU.AMENDMENT.*`: `CREATE`, `REVIEW`, `EXECUTE`, `BREAK_GLASS`, `EXECUTE_DECISION`, `REMEDIATE_FAN`

- [ ] **Step 1: Write the failing test**

Trong `scripts/check-conformance-contracts.test.mjs`, thêm test case kiểm chứng phân tách 46 capabilities của Planning và Coordination thành operation-grain:

```javascript
test('splits Coordination and Planning capabilities at their actual operation grain', () => {
  const repoRoot = join(import.meta.dirname, '..');
  const contract = JSON.parse(readFileSync(join(repoRoot, 'docs/conformance-contracts.json'), 'utf8'));
  const expectedOwners = new Map([
    ['CoordinationOrders.LockOrderPlan', 'COORD.ORDER.LOCK'],
    ['CoordinationOrders.UnlockOrderPlan', 'COORD.ORDER.UNLOCK'],
    ['CoordinationOrders.AdjustServings', 'COORD.ORDER.ADJUST_SERVINGS'],
    ['CoordinationOrders.SignoffOrder', 'COORD.ORDER.SIGNOFF'],
    ['MenuSchedules.UpdateMenuScheduleRules', 'COORD.MENU_SCHEDULE.RULES'],
    ['MenuSchedules.UpdateMenuScheduleVersion', 'COORD.MENU_SCHEDULE.VERSION'],
    ['MenuSchedules.RollbackMenuVersion', 'COORD.MENU_SCHEDULE.ROLLBACK'],
    ['MaterialDemand.Generate', 'PLAN.DEMAND.GENERATE'],
    ['MaterialDemand.Approve', 'PLAN.DEMAND.APPROVE'],
    ['MaterialDemand.GetStaleness', 'PLAN.DEMAND.STALENESS.READ'],
    ['CustomerContracts.GetCustomerContracts', 'COORD.CUSTOMER_CONTRACT.READ'],
    ['CustomerContracts.CreateCustomerContract', 'COORD.CUSTOMER_CONTRACT.CREATE'],
    ['CustomerContracts.UpdateCustomerContract', 'COORD.CUSTOMER_CONTRACT.UPDATE'],
    ['PortionRules.GetPortionRules', 'COORD.PORTION_RULE.READ'],
    ['PortionRules.ResolvePortionRule', 'COORD.PORTION_RULE.RESOLVE'],
    ['PortionRules.CreatePortionRule', 'COORD.PORTION_RULE.CREATE'],
    ['PortionRules.UpdatePortionRule', 'COORD.PORTION_RULE.UPDATE'],
    ['ServiceRuns.Open', 'PLAN.SERVICE_RUN.OPEN'],
    ['ServiceRuns.Start', 'PLAN.SERVICE_RUN.START'],
    ['ServiceRuns.Close', 'PLAN.SERVICE_RUN.CLOSE'],
    ['WeeklyMenuImports.ImportWeeklyMenu', 'MENU.IMPORT.FILE_IMPORT'],
    ['WeeklyMenuImports.PreviewWeeklyMenuImport', 'MENU.IMPORT.PREVIEW'],
    ['WeeklyMenuImports.CommitWeeklyMenuImport', 'MENU.IMPORT.COMMIT'],
    ['WeeklyMenuImports.RollbackWeeklyMenuImport', 'MENU.IMPORT.ROLLBACK'],
    ['WeeklyMenuImports.CreateMenuAmendment', 'MENU.AMENDMENT.CREATE'],
    ['WeeklyMenuImports.ReviewMenuAmendment', 'MENU.AMENDMENT.REVIEW'],
    ['WeeklyMenuImports.ExecuteMenuAmendment', 'MENU.AMENDMENT.EXECUTE'],
  ]);

  for (const [actionId, capabilityId] of expectedOwners) {
    const owners = contract.capabilities.filter((capability) => capability.actionIds && capability.actionIds.includes(actionId));
    assert.deepEqual(owners.map((owner) => owner.id), [capabilityId], `${actionId} must be owned by ${capabilityId}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:conformance-contracts`  
Kỳ vọng: FAIL vì `CoordinationOrders.LockOrderPlan` đang thuộc `COORD.ORDER.LIFECYCLE`.

- [ ] **Step 3: Update `docs/conformance-contracts.json`**

1. Xóa các capability gộp: `COORD.ORDER.LIFECYCLE`, `COORD.MENU_SCHEDULE.WRITE`, `PLAN.DEMAND`, `COORD.CUSTOMER_CONTRACT`, `COORD.PORTION_RULE`, `PLAN.SERVICE_RUN.LIFECYCLE`, `MENU.IMPORT.WRITE`.
2. Thêm các capabilities mới đã disaggregate với actionIds 1:1, gán đúng `operation`, `mode: "SHARED_MASTER_DATA"`, `deliveryClass: "PARTIAL"`.
3. Cập nhật mảng `capabilityIds` trong các requirements liên quan: `FR-MENU`, `FR-COORD`, `BR-GLOBAL-02`, `FR-SYS`.
4. Cập nhật surface `weekly.demand` sang `capabilityIds: ["PLAN.DEMAND.GENERATE", "PLAN.DEMAND.STALENESS.READ", "PLAN.PRODUCTION.READ"]`.

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:conformance-contracts && npm run check:conformance-contracts`  
Kỳ vọng: PASS toàn bộ 23/23 tests, không có dangling references.

- [ ] **Step 5: Commit**

```bash
git add docs/conformance-contracts.json scripts/check-conformance-contracts.test.mjs
git commit -m "feat(conformance): split coordination and planning capabilities to operation grain"
```

---

### Task 2: Eliminate Hardcoded Target Price & Fabricated Category in Weekly Menu

**Files:**
- Modify: `frontend/src/features/weekly-menu/views/WeeklyScheduleView.tsx`
- Modify: `frontend/src/features/weekly-menu/views/MenuCostView.tsx`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/__tests__/WeeklyMenu.test.tsx`

**Interfaces:**
- Consumes: `WeeklyMenuData.mealTargetPrice: number`
- Produces:
  - `WeeklyScheduleView`: Hiển thị `<Num value={data.mealTargetPrice} format="currency" />` nếu `> 0`, hoặc `Theo ca / Chưa chốt` nếu `=== 0`.
  - `DishCostSummaryItem`: `dishType?: string; dishGroup?: string;` thay thế `categoryName`.
  - `MenuCostView`: Cột "Phân loại" đọc `row.dishType || row.dishGroup || '—'`.

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/WeeklyMenu.test.tsx`**

Thêm các test kiểm chứng:
1. Khi `mealTargetPrice === 32000`, hiển thị `32.000 ₫`, tuyệt đối không hiển thị `25.000 ₫`.
2. Khi `mealTargetPrice === 0`, hiển thị `Theo ca / Chưa chốt`.
3. `MenuCostView` hiển thị đúng phân loại món ăn từ `dishType` hoặc `dishGroup` thay vì `categoryName`.

- [ ] **Step 2: Run test to verify it fails**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: FAIL vì `WeeklyScheduleView` đang hardcode tĩnh `25.000 ₫`.

- [ ] **Step 3: Implement in views & types**

1. Sửa `frontend/src/types/index.ts`: Trong `DishCostSummaryItem`, thay `categoryName: string` bằng `dishType?: string; dishGroup?: string;`.
2. Sửa `frontend/src/features/weekly-menu/views/WeeklyScheduleView.tsx`:
   Thay:
   ```tsx
   <strong className="text-slate-900 font-mono font-semibold">25.000 ₫</strong>
   ```
   Bằng:
   ```tsx
   {data.mealTargetPrice > 0 ? (
     <Num value={data.mealTargetPrice} format="currency" className="text-slate-900 font-mono font-semibold" />
   ) : (
     <span className="text-slate-500 font-medium">Theo ca / Chưa chốt</span>
   )}
   ```
3. Sửa `frontend/src/features/weekly-menu/views/MenuCostView.tsx`:
   Cột `category`:
   ```tsx
   {
     id: 'category',
     header: 'Phân loại',
     width: '18%',
     cell: (row) => <span className="text-slate-700">{row.dishType || row.dishGroup || '—'}</span>,
   }
   ```

- [ ] **Step 4: Run test to verify it passes**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/features/weekly-menu/views/WeeklyScheduleView.tsx frontend/src/features/weekly-menu/views/MenuCostView.tsx frontend/src/__tests__/WeeklyMenu.test.tsx
git commit -m "feat(weekly-menu): eliminate hardcoded target price and fabricated category name"
```

---

### Task 3: Behavioral Test Audit & Anti-Regression Verification for Weekly Menu & Meal Orders

**Files:**
- Modify: `frontend/src/__tests__/WeeklyMenu.test.tsx`
- Modify: `frontend/src/__tests__/MealOrders.test.tsx`

**Interfaces:**
- Consumes: `WeeklyMenuPage`, `MealOrdersPage`, `weeklyMenuApi`, `coordinationApi`.
- Produces: Đầy đủ 4 kịch bản kiểm thử theo `Rule TA-4`:
  1. *Success & Dynamic Data*: Kiểm chứng render đúng các cột và giá trị từ C# DTOs.
  2. *View Isolation & Tabs*: Kiểm chứng 4 views của weekly menu (`schedule`, `demand`, `production-plan`, `cost`) và 2 ca của meal orders (`MORNING`, `AFTERNOON`).
  3. *Empty States*: Khi không có dữ liệu thực đơn/đơn ăn, hiển thị đúng empty state thông qua `StateBoundary`.
  4. *Error Handling & Retry*: Báo lỗi mạng thật và nút `[Thử lại]` gọi lại API.

- [ ] **Step 1: Write and audit tests**

Cập nhật và mở rộng `WeeklyMenu.test.tsx` và `MealOrders.test.tsx` tuân thủ nghiêm ngặt `Rule TA-1` (fixtures chuẩn C# DTOs), `Rule TA-2` (thực thi trên cây DOM thật), `Rule TA-3` (zero allowlist padding), `Rule TA-5` (zero fake API).

- [ ] **Step 2: Run tests to verify**

Chạy lệnh: `npm run test:fe:unit`  
Kỳ vọng: PASS toàn bộ test files.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/__tests__/WeeklyMenu.test.tsx frontend/src/__tests__/MealOrders.test.tsx
git commit -m "test(conformance): audit weekly menu and meal orders behavioral coverage"
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
2. `ipc-ui-review`: Chuẩn 3-Zone Workbench, D6 font size >= 12px, D7 action hierarchy (0 primary, 1 outline), T7 frozen header, T8 compact density (36–40px), N6 URL-leaf navigation.
3. `ipc-code-review`: Khớp 1:1 C# DTOs, xóa bỏ hardcoding `25.000 ₫`, bảo vệ bất biến `DOM-MODE-1`.

- [ ] **Step 3: Update `.planning/WORK.md`**

Ghi nhận mục `GF-R34 — Weekly Menu and Coordination capability conformance and telemetry authority` vào `.planning/WORK.md`.
Chuyển trạng thái vòng đời về `IDLE`.

- [ ] **Step 4: Commit**

```bash
git add .planning/WORK.md
git commit -m "docs(work): record weekly menu and coordination conformance closure and return to idle"
```
