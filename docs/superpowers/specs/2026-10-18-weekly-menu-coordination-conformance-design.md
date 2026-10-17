# Weekly Menu & Coordination Capability Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** `FR-MENU` (Weekly Menu Planning) and `FR-COORD` (Meal Order Coordination) Conformance, Backend Ground Truth Alignment, Elimination of Hardcoded Values, Operation-Grain Capability Disaggregation, and 100% Existing UI Kit Reuse  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Intent & The "Why"

The Weekly Menu (`/weekly-menu`) and Meal Orders (`/meal-orders`) routes form the core operational bridge between customer demand, kitchen production planning, and warehouse material handoff. 

While earlier cleanup slices (GF-R19, GF-R25, GF-R28) established foundational DTO bindings and aggregate pagination, significant conformance gaps remain:
1. **Hardcoded Telemetry:** In `WeeklyScheduleView.tsx`, the target price pill renders a static string `Định mức: 25.000 ₫` regardless of the actual customer contract price (`data.mealTargetPrice`).
2. **Fabricated Attributes:** In `MenuCostView.tsx`, the table displays a "Phân loại" column bound to `row.categoryName`. Backend dish contracts do not expose `categoryName` (they expose `dishType` and `dishGroup`). Furthermore, the authoritative dish-cost report endpoint remains absent from Backend, currently cataloged as `BACKEND_CAPABILITY_GAP`.
3. **Coarse Capability Bundling:** In `docs/conformance-contracts.json`, over 45 distinct HTTP actions across Coordination and Planning are bundled into coarse, multi-action capabilities (`COORD.ORDER.LIFECYCLE` with 8 actions, `PLAN.SERVICE_RUN.LIFECYCLE` with 11 actions, `MENU.IMPORT.WRITE` with 13 actions, `COORD.MENU_SCHEDULE.WRITE` with 3 actions, `PLAN.DEMAND` with 3 actions, `COORD.CUSTOMER_CONTRACT` with 3 actions, `COORD.PORTION_RULE` with 4 actions).
4. **Guarded Mutation Authority:** Mutations like order locking (`/api/coordination/orders/lock`), serving adjustments, daily production plan dispatch to kitchen (`/api/production-plans/daily/send-to-kitchen`), and demand generation must be strictly guarded by permissions and operational states without premature write exposure.

This design establishes an unbroken chain of technical truth across `FR-MENU` and `FR-COORD`: disaggregating all Planning/Coordination capabilities to operation-grain, eliminating all hardcoded values, aligning types strictly with C# DTOs, and guaranteeing 100% reuse of existing UI Kit primitives without inventing custom components.

---

## 2. Mandatory UI Kit & Design System Authority (Zero Inventions)

**CỐT LÕI BẮT BUỘC:** 100% mã giao diện BẮT BUỘC phải tái sử dụng trực tiếp các thành phần có sẵn trong Catalog dự án (`docs/UI-KIT.md`, `frontend/src/components/ui/`, `frontend/src/components/workbench/`). **TUYỆT ĐỐI CẤM TỰ CHẾ, TỰ PHÁT MINH COMPONENT MỚI HOẶC VIẾT CSS RIÊNG.**

### Danh mục thành phần có sẵn được phép sử dụng:

1. **Khung bố cục 3-Zone Workbench (`frontend/src/components/workbench/`)**:
   - `WorkspaceHeader` (Zone 1 - 56px): Tiêu đề trang + bộ chọn khách hàng/ngày/tuần + badge đếm số lượng persisted + nút thao tác outline "Làm mới". 0 nút Primary khi ở chế độ xem đọc (`D7`).
   - `TelemetrySubbar` (Zone 2 - 44px): Chỉ báo phạm vi nghiệp vụ và inline telemetry pills (`Num` font `tabular-nums`, không dùng hộp card 120px cồng kềnh).
   - `DataGrid`, `type ColumnDef` (Zone 3): Bảng dữ liệu phẳng, chiều cao dòng 36–40px (`T8`), header cố định (`T7`), hover hàng nhẹ nhàng.
   - `StateBoundary`: Quản lý tập trung 6 trạng thái UI (`loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`), tích hợp sẵn skeleton loading và nút thử lại khi lỗi.
   - `WorkbenchSkeleton`: Skeleton loading hình học đồng dạng với bảng/matrix thật (loại bỏ layout shift CLS <= 0.1).
2. **UI Primitives chuẩn hóa (`frontend/src/components/ui/`)**:
   - `Button`: Chỉ dùng biến thể `variant="outline"` với kích thước chuẩn (`size="default"` trên Header, `size="xs"` trên phân trang/chuyển ngày).
   - `Badge`: Chỉ dùng hiển thị trạng thái hoạt động (`variant="success"`, `variant="warning"`, `variant="neutral"`).
   - `Num`: Định dạng số tiền `format="currency"` căn phải, số lượng `format="quantity"`, tỷ lệ `format="percent"` (`T1`, `T3`).
   - `IdentifierText`: Hiển thị mã nguyên liệu/món ăn/đơn ăn dạng monospace (`L1`, `L7`), hỗ trợ hover sao chép mã.
   - `Select`: Bộ chọn khách hàng trong header (`w-52` / `h-9`).
   - `VietnameseDateInput`: Bộ chọn ngày giao diện Việt Nam (`dd/MM/yyyy`).
   - `Tabs`: Bộ chuyển view hoặc ca phục vụ phẳng (`size="sm"`).
3. **Quy định cấm tuyệt đối**:
   - **CẤM** tạo file component mới (không tạo CustomMatrix, không tạo OrdersTable, không tạo BadgeV2).
   - **CẤM** viết thêm bất kỳ class CSS tùy tiện, style inline `style={{...}}`, hoặc mã hex màu nào ngoài các semantic tokens đã có trong `frontend/src/styles/index.css`.
   - **CẤM** tạo các khối thẻ hộp lồng hộp (Zero Box-in-Box), không dùng thẻ `<details>` che khuất luồng công việc.

---

## 3. Requirements & Governance Matrix (`FR`, `NFR`, `UXR`, `D`, `T`, `M`, `N`)

### Functional Requirements (FR)
- `FR-MENU`: Lập thực đơn và kế hoạch tuần (4 views: schedule, demand, production-plan, cost).
- `FR-COORD`: Điều phối suất ăn khách hàng theo ca/ngày cho từng khách hàng, theo dõi sai lệch suất ăn.
- `BR-GLOBAL-02`: Quantitative Traceability Chain từ BOM gốc $\rightarrow$ KHSX $\rightarrow$ Nhu cầu vật tư $\rightarrow$ Xuất kho.
- `DOM-MODE-1`: Chế độ `DEFAULT` (hoặc `SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.

### UI Non-Functional Requirements (NFR-UI)
- `NFR-UI-01` (Table Scalability & Viewport): Mọi danh sách vượt quá 20 dòng bắt buộc hỗ trợ phân trang hoặc cuộn viewport đơn.
- `NFR-UI-02` (Triple-Layer RBAC Defense): Bảo vệ 3 lớp: Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
- `NFR-UI-03` (Strict Formatting Primitives): 100% số tiền dùng `<Num format="currency">`, số lượng dùng `<Num format="quantity">`, mã chứng từ dùng `<IdentifierText>`, ngày tháng dùng `VietnameseDateInput` định dạng `dd/MM/yyyy`.
- `NFR-UI-04` (Accessibility WCAG 2.2 AA): Tỷ lệ tương phản text >= 4.5:1, nút điều khiển >= 3:1. Hỗ trợ phím Tab/Enter/Esc, outline focus rõ nét (`focus-visible:ring-2`), aria-label đầy đủ.
- `NFR-UI-05` (Motion & Zero CLS): Hiệu ứng <= 150ms, tôn trọng `prefers-reduced-motion`, skeleton loading đồng dạng với bảng/matrix thật (CLS <= 0.1).

### User Experience Requirements (UXR)
- `UXR-01` (3-Zone Workbench Foundation): Cố định Zone 1 (Header 56px), Zone 2 (Telemetry 44px), Zone 3 (Bảng/Matrix dữ liệu).
- `UXR-02` (Operational Density): Ưu tiên hiển thị tối đa dữ liệu nghiệp vụ hữu ích trong 1 màn hình cuộn, không padding thừa.
- `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt chuẩn hóa ngành ("Kế hoạch tuần", "Nhu cầu nguyên liệu", "Lệnh sản xuất ca", "Đơn ăn ca phục vụ"...).
- `UXR-05` (Destructive & Terminal Guards): Mọi thao tác chốt đơn, khóa kế hoạch hoặc gửi bếp bắt buộc phải có guard an toàn.

### Design System & Taste Floor (Impeccable `Operate` Mode & `D1–D9`)
- Mode: **`Operate`** (môi trường vận hành công nghiệp bếp ăn tập thể, ưu tiên tốc độ quét mắt, tính chính xác và mật độ dữ liệu).
- `D1–D5` (Token Authority & Palette): 100% dùng token ngữ nghĩa cool-slate từ `frontend/src/styles/index.css`. Viền hairline `1px border-slate-200`, không đổ bóng đậm (`no heavy drop-shadows`).
- `D6` (Typography Scale): Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`, hỗ trợ dấu tiếng Việt đầy đủ.
- `D7` (Action Hierarchy): Tối đa 1 nút Primary trên một vùng làm việc. Nút "Làm mới" là nút Outline.
- `D8` (Neutral Baseline): Viền hairline `1px border-slate-200`, không bo góc tròn hình viên thuốc trên bảng nghiệp vụ.
- `D9` (Icon Grammar): Icons Lucide chuẩn hóa stroke 2px, kích thước 16px/20px.

### Table & Data Grid Rules (`T1–T16`)
- `T1`, `T2`, `T3`: Căn phải toàn bộ số lượng/tiền tệ bằng `<Num>` và font `tabular-nums`; tiêu đề cột `<th>` đồng bộ căn lề 100% với ô `<td>`.
- `T7` (Horizontal/Vertical Freeze): Cố định tiêu đề (`sticky top-0`) khi cuộn dọc và cố định cột phân nhóm/mã khi cuộn ngang.
- `T8` (Operational Compact Density): Chiều cao dòng chuẩn cứng `36px–40px` cho toàn bộ các dòng dữ liệu.
- `T11–T12`: Bảng demand 5 cột, bảng production plan 5 cột, bảng meal orders 6 cột.

### Navigation Rules (`N1–N7`)
- `N1–N5` (Work Object Navigation): URL query `?view=schedule`, `?view=demand`, `?view=production-plan`, `?view=cost` làm chủ view hiển thị của `/weekly-menu`.
- `N6` (Nested Sidebar Authority): Thẩm quyền điều hướng thuộc về Sidebar v2; loại bỏ tab bar nội bộ trang cũ.

---

## 4. Technical Ground Truth (Backend Contracts & Elimination of Hardcoding)

### A. Elimination of Hardcoded Target Price in `WeeklyScheduleView.tsx`
- **Hiện trạng:**
  ```tsx
  <strong className="text-slate-900 font-mono font-semibold">25.000 ₫</strong>
  ```
- **Sửa đúng theo C# Backend Truth:**
  `weeklyMenuApi.getWeeklyMenuData` tính toán `mealTargetPrice` từ các lệnh sản xuất (`rawPlans.flatMap(p => p.lines.map(l => l.priceTierAmount))`).
  Nếu `data.mealTargetPrice > 0`: Hiển thị `<Num value={data.mealTargetPrice} format="currency" className="text-slate-900 font-mono font-semibold" />`.
  Nếu `data.mealTargetPrice === 0`: Hiển thị `<span className="text-slate-500 font-medium">Theo ca / Chưa chốt</span>`.
  Tuyệt đối không hardcode con số `25.000 ₫`.

### B. Elimination of Fabricated `categoryName` in `MenuCostView.tsx` & Types
- **Hiện trạng:** Cột "Phân loại" đọc `row.categoryName`. Trong C# Backend (`DishDto.cs`), chỉ có `DishType` (Món chính, Canh...) và `DishGroup` (Nhóm thịt, Nhóm rau...).
- **Sửa đúng:** Đổi trường trong `DishCostSummaryItem` thành `dishType?: string; dishGroup?: string;`. Cột hiển thị: "Phân loại" đọc `row.dishType || row.dishGroup || '—'`.

### C. C# Contracts for Coordination & Planning

1. **`CoordinationOrderDto` (`backend/src/IPCManagement.Api/Features/Coordination/Contracts/CoordinationOrderDto.cs`)**:
   - `QuantityPlanLineId` (string), `QuantityPlanId` (string), `MenuScheduleId` (string), `CustomerId` (string), `CustomerCode` (string), `CustomerName` (string), `MealType` (string), `ForecastQuantity` (int), `ActualQuantity` (int), `UnitPrice` (decimal), `AppliedRate` (decimal), `ServiceDate` (DateOnly string), `ShiftName` (string), `Dishes` (`IReadOnlyList<CoordinationDishDto>`).
2. **`ProductionPlanDto` (`backend/src/IPCManagement.Api/Features/Planning/Contracts/ProductionPlanDto.cs`)**:
   - `PlanId` (string), `PlanCode` (string), `PlanDate` (DateOnly string), `CustomerId` (string), `Status` (string), `SentToKitchenAt` (DateTime?), `Lines` (`IReadOnlyList<ProductionPlanLineDto>`).
3. **`MaterialDemandAggregateItem` (`backend/src/IPCManagement.Api/Features/Planning/Contracts/MaterialDemandDtos.cs`)**:
   - `RequestDate` (string), `CustomerId` (string), `IngredientId` (string), `IngredientName` (string), `UnitName` (string), `TotalRequiredQty` (decimal), `IssuedQty` (decimal), `RemainingToIssueQty` (decimal), `FulfillmentStatus` (`MISSING | IN_PROGRESS | FULFILLED`).

---

## 5. UI Architecture & Scoped Pre-Code UI Gate Blocks

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

## 6. Machine Inventory Disaggregation (`docs/conformance-contracts.json`)

Tách toàn bộ 46 Backend actions thuộc Coordination và Planning thành các capabilities độc lập:

| Grouped Capability Cũ | Disaggregated Capabilities Mới | Operations | Actions Ánh Xạ | Ghi chú & Gaps |
|---|---|---|---|---|
| `COORD.ORDER.LIFECYCLE` | • `COORD.ORDER.ADJUST_AFTER_LOCK`<br>• `COORD.ORDER.ADJUST_SERVINGS`<br>• `COORD.ORDER.LOCK`<br>• `COORD.ORDER.SIGNOFF`<br>• `COORD.ORDER.SIGNOFF_SCOPE`<br>• `COORD.ORDER.UNLOCK`<br>• `COORD.ORDER.UNLOCK_SCOPE`<br>• `COORD.ORDER.UPDATE_FORECAST` | `terminal`, `update` | `CoordinationOrders.AdjustOrderAfterLock`<br>`CoordinationOrders.AdjustServings`<br>`CoordinationOrders.LockOrderPlan`<br>`CoordinationOrders.SignoffOrder`<br>`CoordinationOrders.SignoffOrderScope`<br>`CoordinationOrders.UnlockOrderPlan`<br>`CoordinationOrders.UnlockOrderPlanScope`<br>`CoordinationOrders.UpdateForecastServings` | Phân loại `PARTIAL`. Quyền ghi và concurrency trên UI chưa reconciled. |
| `COORD.MENU_SCHEDULE.WRITE` | • `COORD.MENU_SCHEDULE.RULES`<br>• `COORD.MENU_SCHEDULE.VERSION`<br>• `COORD.MENU_SCHEDULE.ROLLBACK` | `update`, `terminal` | `MenuSchedules.UpdateMenuScheduleRules`<br>`MenuSchedules.UpdateMenuScheduleVersion`<br>`MenuSchedules.RollbackMenuVersion` | Phân loại `PARTIAL`. |
| `PLAN.DEMAND` | • `PLAN.DEMAND.GENERATE`<br>• `PLAN.DEMAND.APPROVE`<br>• `PLAN.DEMAND.STALENESS.READ` | `create`, `terminal`, `read` | `MaterialDemand.Generate`<br>`MaterialDemand.Approve`<br>`MaterialDemand.GetStaleness` | Phân loại `PARTIAL`. Đòi hỏi approval workflow authority. |
| `COORD.CUSTOMER_CONTRACT` | • `COORD.CUSTOMER_CONTRACT.READ`<br>• `COORD.CUSTOMER_CONTRACT.CREATE`<br>• `COORD.CUSTOMER_CONTRACT.UPDATE` | `read`, `create`, `update` | `CustomerContracts.GetCustomerContracts`<br>`CustomerContracts.CreateCustomerContract`<br>`CustomerContracts.UpdateCustomerContract` | Phân loại `PARTIAL`. UI surface chưa map. |
| `COORD.PORTION_RULE` | • `COORD.PORTION_RULE.READ`<br>• `COORD.PORTION_RULE.RESOLVE`<br>• `COORD.PORTION_RULE.CREATE`<br>• `COORD.PORTION_RULE.UPDATE` | `read`, `read`, `create`, `update` | `PortionRules.GetPortionRules`<br>`PortionRules.ResolvePortionRule`<br>`PortionRules.CreatePortionRule`<br>`PortionRules.UpdatePortionRule` | Phân loại `PARTIAL`. |
| `PLAN.SERVICE_RUN.LIFECYCLE` | 11 operation-grain capabilities: `OPEN`, `START`, `RECORD_ACTUALS`, `CONFIRM`, `WAIVE_CONFIRM`, `RESOLVE_VARIANCE`, `RESOLVE_SERVING_VARIANCE`, `CREATE_ADJUSTMENT`, `CLOSE`, `DECLARE_VARIANCE`, `APPROVE_WAIVER` | `create`, `update`, `terminal` | Tương ứng 11 actions trong `ServiceRuns` và `ServiceRunVarianceDeclarations` | Phân loại `PARTIAL`. Phục vụ bếp trưởng / ca sản xuất. |
| `MENU.IMPORT.WRITE` | 13 operation-grain capabilities: `BATCH_COMMIT`, `PREVIEW`, `COMMIT`, `FILE_IMPORT`, `ROLLBACK`, `BULK_UPDATE`, `SAVE_MAPPING`, `AMENDMENT.CREATE`, `AMENDMENT.REVIEW`, `AMENDMENT.EXECUTE`, `AMENDMENT.BREAK_GLASS`, `AMENDMENT.EXECUTE_DECISION`, `AMENDMENT.REMEDIATE_FAN` | `create`, `update`, `terminal` | Tương ứng 13 actions trong `WeeklyMenuBatchImports` và `WeeklyMenuImports` | Phân loại `PARTIAL`. |

---

## 7. Verification & Test Audit Strategy

### Test Suites & Rules (`Rule TA-1` $\rightarrow$ `TA-5`)

1. **Rule TA-1 (Backend-Grounded Fixtures Only)**:
   - Tất cả fixtures cho WeeklyMenu và Coordination trong test bắt buộc phải có đủ trường C# DTOs: `quantityPlanLineId`, `forecastQuantity`, `actualQuantity`, `serviceDate`, `shiftName`, `dishes: [{ dishId, dishCode, dishName }]`.
2. **Rule TA-2 (No Self-Mocking)**:
   - Test component `WeeklyMenuPage` và `MealOrdersPage` trên cây DOM thật; chỉ mock network ranh giới `apiClient` / `weeklyMenuApi` / `coordinationApi`.
3. **Rule TA-4 (4 Kịch bản hành vi bắt buộc)**:
   - **Kịch bản 1 (Dynamic Meal Target Price)**: Kiểm chứng khi `mealTargetPrice: 30000`, hiển thị đúng "30.000 ₫", không hiển thị "25.000 ₫". Khi `mealTargetPrice: 0`, hiển thị "Theo ca / Chưa chốt".
   - **Kịch bản 2 (View-Isolation & 4 Views)**: Kiểm chứng chuyển đổi giữa `schedule`, `demand`, `production-plan`, `cost` qua URL query `?view=...` mà không bị giật layout.
   - **Kịch bản 3 (Empty State)**: Khi không có dữ liệu thực đơn tuần hoặc đơn ăn ca, `<StateBoundary>` hiển thị thông báo rỗng đúng văn phong nghiệp vụ.
   - **Kịch bản 4 (Error & Retry)**: Báo lỗi mạng thật và nút `[Thử lại]` nạp lại đúng tuần/ca đã chọn.
4. **Machine Conformance Test**:
   - `scripts/check-conformance-contracts.test.mjs` kiểm tra toàn bộ 46 actions mới được ánh xạ 1:1, không có capability gộp nào còn sót lại.

---

## 8. What is Left to the Builder

The builder (executing agent) will:
1. Update `scripts/check-conformance-contracts.test.mjs` with RED test asserting operation-grain disaggregation of Planning/Coordination capabilities.
2. Update `docs/conformance-contracts.json` to disaggregate all grouped capabilities and resolve requirement references.
3. Fix hardcoding in `WeeklyScheduleView.tsx` (`mealTargetPrice`) and update `MenuCostView.tsx` / `types/index.ts` to eliminate `categoryName`.
4. Add/update tests in `frontend/src/__tests__/WeeklyMenu.test.tsx` and `MealOrders.test.tsx` covering all behavioral scenarios.
5. Run full non-mutating verification suite (`conformance`, `unit`, `lint`, `build`, `depcruise`, `diff-check`).
6. Apply 3 mandatory review gates (`ipc-test-audit`, `ipc-ui-review`, `ipc-code-review`) and record in `.planning/WORK.md`.
