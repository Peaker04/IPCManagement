# Chef & Kitchen Production Capability Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** `FR-CHEF` (Kitchen Production & Shift Handover) Conformance, Backend Ground Truth Alignment, Elimination of Synthetic Telemetry, Operation-Grain Capability Verification, and 100% Existing UI Kit Reuse  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Intent & The "Why"

The Chef dashboard (`/chef`) coordinates kitchen production schedules, receipt confirmation of issued ingredients from warehouse, shift-level variance declarations, and leftover return vouchers.

Previous cleanup passes (GF-R21, GF-R28) eliminated synthetic chef progress gauges ("Đang nấu: 70%"), removed unverified quality checkboxes, and established server pagination for warehouse issues.

This design solidifies the technical truth for `FR-CHEF`:
1. **Operation-Grain Machine Invariants:** Verify that all 25 capabilities associated with `FR-CHEF` (production plans, service runs, supplemental requests, issues, and returns) are disaggregated into single-action operation grains in `docs/conformance-contracts.json`.
2. **Zero Synthetic Telemetry:** Kitchen production metrics (`totalPlans`, `sentPlans`, `totalServings`) must be strictly computed from persisted C# `ProductionPlanDto` facts; unsupported chef completion actions remain guarded.
3. **Empty State Resiliency:** The view-isolated UI (`?view=plans` and `?view=issues`) must handle empty datasets gracefully with standard `StateBoundary` empty scenarios (`prerequisite-blocked`).
4. **Strict UI Kit Compliance:** 100% of the UI must use established primitives (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Button`, `Badge`, `Num`, `IdentifierText`) without inventing custom components or writing ad-hoc CSS.

---

## 2. Mandatory UI Kit & Design System Authority (Zero Inventions)

**CỐT LÕI BẮT BUỘC:** 100% mã giao diện BẮT BUỘC phải tái sử dụng trực tiếp các thành phần có sẵn trong Catalog dự án (`docs/UI-KIT.md`, `frontend/src/components/ui/`, `frontend/src/components/workbench/`). **TUYỆT ĐỐI CẤM TỰ CHẾ, TỰ PHÁT MINH COMPONENT MỚI HOẶC VIẾT CSS RIÊNG.**

### Danh mục thành phần có sẵn được phép sử dụng:

1. **Khung bố cục 3-Zone OperationalFrame (`frontend/src/components/workbench/`)**:
   - `WorkspaceHeader` (Zone 1 - 56px): Tiêu đề trang + bộ chọn khách hàng/ngày/ca + nút thao tác outline "Làm mới". 0 nút Primary (`D7`).
   - `TelemetrySubbar` (Zone 2 - 44px): Chỉ báo phạm vi nghiệp vụ và inline telemetry pills (`Num` font `tabular-nums`, không dùng thẻ KPI card 120px cồng kềnh).
   - `DataGrid`, `type ColumnDef` (Zone 3): Bảng dữ liệu phẳng, chiều cao dòng 36–40px (`T8`), header cố định (`T7`), hover hàng nhẹ nhàng.
   - `StateBoundary`: Quản lý tập trung 6 trạng thái UI (`loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`), tích hợp `WorkbenchSkeleton` (table 6x8) và nút thử lại khi lỗi.
2. **UI Primitives chuẩn hóa (`frontend/src/components/ui/`)**:
   - `Button`: `variant="outline"` cho thao tác làm mới và các nút phân trang (`D7`).
   - `Badge`: Hiển thị trạng thái bàn giao (`info` cho đã gửi bếp, `neutral` cho chưa gửi; `success` cho bếp đã nhận, `warning` cho chờ xác nhận).
   - `Num`: Định dạng số lượng suất kế hoạch và thực xuất qua `format="quantity"`, font `tabular-nums` (`T1`, `T3`).
   - `IdentifierText`: Hiển thị mã KHSX, mã phiếu xuất dạng monospace (`L1`, `L7`), hỗ trợ hover sao chép.
   - `Select`: Bộ chọn khách hàng (`w-64`), bộ chọn ca sản xuất (`w-36`).
   - `VietnameseDateInput`: Bộ chọn ngày giao diện Việt Nam (`dd/MM/yyyy`).
3. **Quy định cấm tuyệt đối**:
   - **CẤM** tạo file component mới (không tạo ChefCard, không tạo KitchenMatrix, không tạo BadgeV2).
   - **CẤM** viết thêm bất kỳ class CSS tùy tiện, style inline `style={{...}}`, hoặc mã hex màu nào ngoài `frontend/src/styles/index.css`.
   - **CẤM** tạo các khối thẻ hộp lồng hộp (Zero Box-in-Box), không dùng thẻ `<details>`.

---

## 3. Requirements & Governance Matrix (`FR`, `NFR`, `UXR`, `D`, `T`, `M`, `N`)

### Functional Requirements (FR)
- `FR-CHEF`: Theo dõi KHSX theo ca, checklist kiểm đếm nhận nguyên liệu từ kho, xác nhận bàn giao, tạo phiếu trả hàng thừa.
- `BR-GLOBAL-02`: Quantitative Traceability Chain từ KHSX $\rightarrow$ Phiếu xuất kho bàn giao bếp $\rightarrow$ Thực tế tiêu hao.
- `BR-GLOBAL-03`: Phiếu xuất kho phải bắt đầu từ yêu cầu vật tư đã duyệt; mọi sai lệch ca phải có giải trình.
- `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.

### UI Non-Functional Requirements (NFR-UI)
- `NFR-UI-01` (Table Scalability & Viewport): Danh sách KHSX và phiếu xuất phân trang server compact 25 dòng.
- `NFR-UI-02` (Triple-Layer RBAC Defense): Route (`RoleGuard(['Admin', 'Chef', 'Beptruong'])`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
- `NFR-UI-03` (Strict Formatting Primitives): Số lượng dùng `<Num format="quantity">`, mã chứng từ dùng `<IdentifierText>`, ngày tháng dùng `formatVietnameseDate`.
- `NFR-UI-04` (Accessibility WCAG 2.2 AA): Tỷ lệ tương phản text >= 4.5:1, nút điều khiển >= 3:1. Hỗ trợ phím Tab/Enter/Esc, outline focus rõ nét (`focus-visible:ring-2`), aria-label đầy đủ.
- `NFR-UI-05` (Motion & Zero CLS): Hiệu ứng <= 150ms, tôn trọng `prefers-reduced-motion`, skeleton loading table 6x8 đồng dạng (CLS <= 0.1).

### User Experience Requirements (UXR)
- `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Data Area.
- `UXR-02` (Operational Density): Ưu tiên hiển thị tối đa dữ liệu nghiệp vụ hữu ích trong 1 màn hình cuộn, không padding thừa.
- `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt chuẩn hóa ("Bếp trưởng & Bàn giao ca", "Kế hoạch sản xuất", "Phiếu xuất bàn giao", "Ca sản xuất", "Bếp xác nhận"...).
- `UXR-05` (Destructive & Terminal Guards): Mọi thao tác xác nhận hoặc trả hàng thừa bắt buộc có guard an toàn.

### Design System & Taste Floor (Impeccable `Operate` Mode & `D1–D9`)
- Mode: **`Operate`** (môi trường vận hành công nghiệp, ưu tiên tốc độ quét mắt, tính chính xác và mật độ dữ liệu).
- `D1–D5` (Token Authority & Palette): 100% dùng token ngữ nghĩa cool-slate từ `frontend/src/styles/index.css`. Viền hairline `1px border-slate-200`, không đổ bóng đậm (`no heavy drop-shadows`).
- `D6` (Typography Scale): Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`, hỗ trợ tiếng Việt đầy đủ.
- `D7` (Action Hierarchy): 0 nút Primary (chế độ đọc an toàn `READ_ONLY_BY_CONTRACT`), nút "Làm mới" là nút Outline.
- `D8` (Neutral Baseline): Viền hairline `1px border-slate-200`.
- `D9` (Icon Grammar): Icons Lucide chuẩn hóa stroke 2px, kích thước 16px/20px.

### Table & Data Grid Rules (`T1–T16`)
- `T1`, `T2`, `T3`: Căn phải số lượng suất và số lượng thực xuất bằng `<Num>` font `tabular-nums`; tiêu đề cột `<th>` đồng bộ căn lề 100% với ô `<td>`.
- `T7` (Horizontal/Vertical Freeze): Cố định tiêu đề (`sticky top-0`) khi cuộn dọc và cố định cột mã KHSX/phiếu xuất khi cuộn ngang.
- `T8` (Operational Compact Density): Chiều cao dòng chuẩn cứng `36px–40px` cho toàn bộ các dòng dữ liệu.
- `T11–T12`: Bảng KHSX 6 cột, bảng phiếu xuất 6 cột.

---

## 4. Technical Ground Truth (Backend Contracts & Empty State Resiliency)

### C# Contracts for Chef & Kitchen Production

1. **`ProductionPlanDto` (`backend/src/IPCManagement.Api/Features/Planning/Contracts/ProductionPlanDto.cs`)**:
   - `PlanId` (string), `PlanCode` (string), `PlanDate` (DateOnly string), `CustomerId` (string), `Status` (string), `SentToKitchenAt` (DateTime?), `Lines` (`IReadOnlyList<ProductionPlanLineDto>`).
2. **`InventoryIssueDto` (`backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryDto.cs`)**:
   - `IssueId` (string), `IssueCode` (string), `IssueDate` (DateOnly string), `ShiftName` (string), `WarehouseName` (string), `ReceivedAt` (DateTime?), `Status` (`DRAFT | ISSUED | CONFIRMED`), `Lines` (`IReadOnlyList<InventoryIssueLineDto>`).

---

## 5. UI Architecture & Scoped Pre-Code UI Gate Block

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

## 6. Verification & Test Audit Strategy

### Test Suites & Rules (`Rule TA-1` $\rightarrow$ `TA-5`)

1. **Rule TA-1 (Backend-Grounded Fixtures Only)**:
   - Tất cả fixtures cho Chef trong test bắt buộc phải có đủ trường C# DTOs: `planLineId`, `planCode`, `dishName`, `shiftName`, `plannedServings`, `serviceDate`, `sentToKitchenAt`, `issueId`, `issueCode`, `receivedAt`.
2. **Rule TA-2 (No Self-Mocking)**:
   - Test component `ChefDashboardPage` trên cây DOM thật; chỉ mock network ranh giới `apiClient` / `chefApi`.
3. **Rule TA-4 (4 Kịch bản hành vi bắt buộc)**:
   - **Kịch bản 1 (Success & View Isolation)**: Khi ở `view=plans`, render bảng KHSX; khi ở `view=issues`, render bảng phiếu xuất bàn giao.
   - **Kịch bản 2 (Pagination Navigation)**: Chuyển trang phiếu xuất qua `<nav aria-label="Phân trang phiếu xuất">` gọi đúng `chefApi.getChefDashboardData` với `pageNumber: 2`.
   - **Kịch bản 3 (Empty State Resiliency)**: Khi `plans: []` và `view=plans`, `<StateBoundary>` hiển thị "Chưa có kế hoạch sản xuất" và mô tả chuẩn nghiệp vụ.
   - **Kịch bản 4 (Error & Retry)**: Báo lỗi mạng thật và nút `[Thử lại]` nạp lại đúng danh sách.
4. **Machine Conformance Test**:
   - `scripts/check-conformance-contracts.test.mjs` kiểm tra toàn bộ 25 capabilities của `FR-CHEF` đều đã được disaggregate 1:1 sang operation-grain.
