# Purchasing & Approvals Capability Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** `FR-PUR` (Purchasing & Suppliers) and `FR-APPR` (Operational Approvals) Conformance, Backend Ground Truth Alignment, Elimination of Hardcoded Partner Counts, Operation-Grain Capability Disaggregation, and 100% Existing UI Kit Reuse  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Intent & The "Why"

The Purchasing (`/purchasing`) and Approvals (`/approvals`) routes govern the flow of financial commitments, supplier engagement, and document sign-offs across the canteen operation.

Earlier remediation passes (GF-R21, GF-R24, GF-R30, GF-R31) removed fabricated telemetry ("SLA khẩn: 2", "Đã duyệt hôm nay: 42") and established HTTP 409 conflict reconciliation. However, critical capability and UI conformance gaps remain:
1. **Hardcoded Partner Counts:** In `PurchasingPage.tsx`, the supplier filter selector hardcodes `(35 đối tác)` in the label (`Tất cả nhà cung cấp (35 đối tác)`) instead of reflecting the dynamic count of persisted suppliers loaded from `/api/suppliers`.
2. **Bundled Write Capabilities in Machine Inventory:** Over 20 distinct HTTP actions are currently bundled into coarse capabilities:
   - `APPR.INBOX.READ` groups both pending inbox queries and historical approval audits (`ApprovalHistory.GetHistory`).
   - `PUR.REQUEST.WORKFLOW` groups demand generation, line supplier confirmation, and request submission.
   - `PUR.ORDER.LIFECYCLE` groups order creation from requests and order cancellation.
   - `PUR.QUOTATION.WRITE` groups quotation creation, updates, and deactivation.
   - `PUR.RECEIPT.LIFECYCLE` groups 6 distinct warehouse receipt actions (record, inspect, post, correct, rework, void).
   - `WH.SUPPLEMENTAL_REQUEST` groups 6 distinct supplemental request actions (create, fulfill, reject, route).
3. **Strict UI Kit Compliance:** Both routes use the `SplitWorkbench` (60/40) pattern. 100% of the UI must use established primitives (`WorkspaceHeader`, `TelemetrySubbar`, `SplitView`, `DataGrid`, `StateBoundary`, `Select`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, `ActionGuard`) without inventing custom wrappers or writing ad-hoc CSS.

---

## 2. Mandatory UI Kit & Design System Authority (Zero Inventions)

**CỐT LÕI BẮT BUỘC:** 100% mã giao diện BẮT BUỘC phải tái sử dụng trực tiếp các thành phần có sẵn trong Catalog dự án (`docs/UI-KIT.md`, `frontend/src/components/ui/`, `frontend/src/components/workbench/`). **TUYỆT ĐỐI CẤM TỰ CHẾ, TỰ PHÁT MINH COMPONENT MỚI HOẶC VIẾT CSS RIÊNG.**

### Danh mục thành phần có sẵn được phép sử dụng:

1. **Khung bố cục 3-Zone SplitWorkbench (`frontend/src/components/workbench/`)**:
   - `WorkspaceHeader` (Zone 1 - 56px): Tiêu đề trang + bộ chọn nhà cung cấp / loại duyệt + badge đếm số lượng persisted + nút thao tác outline "Làm mới". Nút Primary duy nhất cho quyết định phê duyệt (`D7`).
   - `TelemetrySubbar` (Zone 2 - 44px): Bộ lọc Tabs trạng thái và inline telemetry pills (`Num` font `tabular-nums`, không dùng thẻ KPI card 120px cồng kềnh).
   - `SplitView` (Zone 3 - Master-Detail 60/40):
     - Cột trái (60%): `DataGrid` danh sách đơn PO / hồ sơ chờ duyệt, chiều cao dòng 36–40px (`T8`), header cố định (`T7`).
     - Cột phải (40%): Chi tiết đơn PO hoặc Drawer thẩm định quyết định duyệt, có phân cách `border-l border-slate-200`.
   - `StateBoundary`: Quản lý tập trung 6 trạng thái UI (`loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`), tích hợp `WorkbenchSkeleton` (split 60/40) và nút thử lại khi lỗi.
2. **UI Primitives chuẩn hóa (`frontend/src/components/ui/`)**:
   - `Button`: `variant="outline"` cho thao tác thứ cấp và làm mới; `variant="default"` duy nhất cho nút duyệt (`D7`).
   - `Badge`: Hiển thị trạng thái đơn (`DRAFT`, `APPROVED`, `SENT`, `RECEIVED`, `CANCELLED`) với biến thể ngữ nghĩa (`neutral`, `info`, `success`, `danger`).
   - `Num`: Định dạng tiền tệ `format="currency"` căn phải, số lượng `format="quantity"` (`T1`, `T3`).
   - `IdentifierText`: Hiển thị mã đơn PO, mã phiếu nhập, mã hồ sơ duyệt dạng monospace (`L1`, `L7`), hỗ trợ hover sao chép.
   - `Select`: Bộ chọn nhà cung cấp / loại chứng từ trong header (`h-9`).
   - `Tabs`: Bộ chuyển đổi trạng thái đơn PO và loại duyệt (`size="sm"`).
   - `Modal`: Hộp thoại xác nhận duyệt hoặc từ chối (bắt buộc nhập lý do từ chối theo `BR-GLOBAL-03`), tối đa 1 modal chặn (`M1.2`).
   - `ActionGuard`: Bọc nút hành động duyệt với quyền `APPR.DECISION`.
3. **Quy định cấm tuyệt đối**:
   - **CẤM** tạo file component mới (không tạo CustomSplitView, không tạo PoCard, không tạo BadgeV2).
   - **CẤM** viết thêm bất kỳ class CSS tùy tiện, style inline `style={{...}}`, hoặc mã hex màu nào ngoài `frontend/src/styles/index.css`.
   - **CẤM** tạo các khối thẻ hộp lồng hộp (Zero Box-in-Box), không dùng thẻ `<details>`.

---

## 3. Requirements & Governance Matrix (`FR`, `NFR`, `UXR`, `D`, `T`, `M`, `N`)

### Functional Requirements (FR)
- `FR-PUR`: Quản lý nhu cầu thiếu hụt, đơn mua hàng PO, thông tin nhà cung cấp, đối chiếu giá mua.
- `FR-APPR`: Trung tâm phê duyệt tập trung các đề xuất mua hàng (PR), báo giá NCC, phiếu nhập kho.
- `BR-GLOBAL-02`: Quantitative Traceability Chain từ đề xuất mua $\rightarrow$ PO $\rightarrow$ Phiếu nhập kho.
- `BR-GLOBAL-03`: Quyết định từ chối phê duyệt bắt buộc phải nhập lý do giải trình.
- `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.

### UI Non-Functional Requirements (NFR-UI)
- `NFR-UI-01` (Table Scalability & Viewport): Danh sách master cuộn độc lập với detail panel trong khung nhìn `SplitView`.
- `NFR-UI-02` (Triple-Layer RBAC Defense): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard capabilityId="APPR.DECISION"`).
- `NFR-UI-03` (Strict Formatting Primitives): 100% tiền tệ dùng `<Num format="currency">`, mã chứng từ dùng `<IdentifierText>`, thời gian SLA dùng `formatVietnameseDateTime`.
- `NFR-UI-04` (Accessibility WCAG 2.2 AA): Tỷ lệ tương phản text >= 4.5:1, nút điều khiển >= 3:1. Hỗ trợ phím Tab/Enter/Esc, outline focus rõ nét (`focus-visible:ring-2`), aria-label đầy đủ.
- `NFR-UI-05` (Motion & Zero CLS): Hiệu ứng <= 150ms, tôn trọng `prefers-reduced-motion`, skeleton loading split 60/40 đồng dạng (CLS <= 0.1).

### User Experience Requirements (UXR)
- `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Split Data Area (60/40).
- `UXR-02` (Operational Density): Ưu tiên hiển thị tối đa dữ liệu nghiệp vụ hữu ích trong 1 màn hình cuộn, không padding thừa.
- `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt chuẩn hóa ("Đơn mua hàng PO", "Nhà cung cấp", "Tổng tiền", "Hạn SLA", "Duyệt yêu cầu đang chọn"...).
- `UXR-05` (Destructive & Terminal Guards): Thao tác từ chối phê duyệt bắt buộc xác nhận và yêu cầu lý do qua Modal.

### Design System & Taste Floor (Impeccable `Operate` Mode & `D1–D9`)
- Mode: **`Operate`** (môi trường vận hành công nghiệp, ưu tiên tốc độ quét mắt, tính chính xác và mật độ dữ liệu).
- `D1–D5` (Token Authority & Palette): 100% dùng token ngữ nghĩa cool-slate từ `frontend/src/styles/index.css`. Viền hairline `1px border-slate-200`, không đổ bóng đậm (`no heavy drop-shadows`).
- `D6` (Typography Scale): Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`, hỗ trợ tiếng Việt đầy đủ.
- `D7` (Action Hierarchy): Tối đa 1 nút Primary trên một vùng làm việc. Nút "Phê duyệt yêu cầu đang chọn" là nút Primary duy nhất; nút "Làm mới" là nút Outline.
- `D8` (Neutral Baseline): Viền hairline `1px border-slate-200`.
- `D9` (Icon Grammar): Icons Lucide chuẩn hóa stroke 2px, kích thước 16px/20px.

### Table & Data Grid Rules (`T1–T16`)
- `T1`, `T2`, `T3`: Căn phải toàn bộ số lượng/tiền tệ bằng `<Num>` và font `tabular-nums`; tiêu đề cột `<th>` đồng bộ căn lề 100% với ô `<td>`.
- `T7` (Horizontal/Vertical Freeze): Cố định tiêu đề (`sticky top-0`) khi cuộn dọc và cố định cột mã PO/hồ sơ khi cuộn ngang.
- `T8` (Operational Compact Density): Chiều cao dòng chuẩn cứng `36px–40px` cho toàn bộ các dòng dữ liệu.
- `T11–T12`: Bảng master PO 6 cột, bảng master phê duyệt 6 cột.

---

## 4. Technical Ground Truth (Backend Contracts & Elimination of Hardcoding)

### A. Elimination of Hardcoded Partner Count in `PurchasingPage.tsx`
- **Hiện trạng:**
  ```tsx
  { value: 'ALL', label: 'Tất cả nhà cung cấp (35 đối tác)' }
  ```
- **Sửa đúng theo C# Backend Truth:**
  Tính toán động theo số lượng nhà cung cấp thực tế được tải từ `/api/suppliers`:
  ```tsx
  {
    value: 'ALL',
    label: suppliers.length > 0
      ? `Tất cả nhà cung cấp (${suppliers.length} đối tác)`
      : 'Tất cả nhà cung cấp',
  }
  ```
  Tuyệt đối không hardcode con số `(35 đối tác)`.

### B. C# Contracts for Purchasing & Approvals

1. **`PurchaseOrderDto` (`backend/src/IPCManagement.Api/Features/Purchasing/Contracts/PurchaseOrderDto.cs`)**:
   - `PurchaseOrderId` (string), `PurchaseOrderCode` (string), `PurchaseRequestId` (string), `PurchaseRequestCode` (string), `SupplierId` (string), `SupplierName` (string), `OrderDate` (DateOnly string), `Status` (`DRAFT | APPROVED | SENT | RECEIVED | CANCELLED`), `Lines` (`IReadOnlyList<PurchaseOrderLineDto>`).
2. **`ApprovalInboxDto` (`backend/src/IPCManagement.Api/Features/Approvals/Contracts/ApprovalInboxDto.cs`)**:
   - `InboxItemId` (string), `TargetType` (`material-demand | purchase-order | warehouse-receipt`), `TargetId` (string), `TargetCode` (string), `Title` (string), `ItemType` (string), `Source` (string), `SubmittedBy` (string), `SlaDeadline` (DateTime), `TotalValue` (decimal?), `TotalQuantity` (decimal?), `Status` (`PENDING | APPROVED | REJECTED`).

---

## 5. UI Architecture & Scoped Pre-Code UI Gate Blocks

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

## 6. Machine Inventory Disaggregation (`docs/conformance-contracts.json`)

Tách toàn bộ 23 Backend actions thuộc Purchasing và Approvals thành các capabilities độc lập:

| Grouped Capability Cũ | Disaggregated Capabilities Mới | Operations | Actions Ánh Xạ | Ghi chú & Gaps |
|---|---|---|---|---|
| `APPR.INBOX.READ` | • `APPR.INBOX.READ`<br>• `APPR.HISTORY.READ` | `read`, `read` | `Approvals.GetInbox`<br>`ApprovalHistory.GetHistory` | `APPR.INBOX.READ` là `READY` mapped to `approval.inbox`. `APPR.HISTORY.READ` là `PARTIAL`. |
| `PUR.REQUEST.WORKFLOW` | • `PUR.WORKFLOW.GENERATE`<br>• `PUR.WORKFLOW.CONFIRM_SUPPLIER`<br>• `PUR.WORKFLOW.SUBMIT` | `create`, `update`, `terminal` | `PurchaseWorkflow.GenerateFromDemand`<br>`PurchaseWorkflow.ConfirmLineSupplier`<br>`PurchaseWorkflow.Submit` | Phân loại `PARTIAL`. Workbench workflow surfaces chưa map. |
| `PUR.ORDER.LIFECYCLE` | • `PUR.ORDER.CREATE_FROM_REQUEST`<br>• `PUR.ORDER.CANCEL` | `create`, `terminal` | `PurchaseOrders.CreateFromRequest`<br>`PurchaseOrders.Cancel` | Phân loại `PARTIAL`. |
| `PUR.QUOTATION.WRITE` | • `PUR.QUOTATION.CREATE`<br>• `PUR.QUOTATION.UPDATE`<br>• `PUR.QUOTATION.DEACTIVATE` | `create`, `update`, `terminal` | `SupplierQuotations.Create`<br>`SupplierQuotations.Update`<br>`SupplierQuotations.Deactivate` | Phân loại `PARTIAL`. |
| `PUR.RECEIPT.LIFECYCLE` | 6 operation-grain capabilities: `RECORD`, `ACCEPT_QUALITY`, `POST`, `CORRECTION`, `REWORK`, `VOID` | `create`, `update`, `terminal` | Tương ứng 6 actions trong `WarehousePurchaseReceipts` | Phân loại `PARTIAL`. Phục vụ kho nhận hàng từ PO. |
| `WH.SUPPLEMENTAL_REQUEST` | 6 operation-grain capabilities: `READ`, `GET_BY_ID`, `CREATE`, `FULFILL`, `REJECT`, `ROUTE_TO_PURCHASING` | `read`, `read`, `create`, `terminal` | Tương ứng 6 actions trong `SupplementalMaterialRequests` | Phân loại `PARTIAL`. |

---

## 7. Verification & Test Audit Strategy

### Test Suites & Rules (`Rule TA-1` $\rightarrow$ `TA-5`)

1. **Rule TA-1 (Backend-Grounded Fixtures Only)**:
   - Tất cả fixtures cho Purchasing và Approvals trong test bắt buộc phải có đủ trường C# DTOs: `purchaseOrderId`, `purchaseOrderCode`, `supplierId`, `supplierName`, `orderDate`, `totalAmount`, `inboxItemId`, `targetType`, `slaDeadline`.
2. **Rule TA-2 (No Self-Mocking)**:
   - Test component `PurchasingPage` và `ApprovalPage` trên cây DOM thật; chỉ mock network ranh giới `apiClient` / `purchasingApi` / `approvalsApi`.
3. **Rule TA-4 (4 Kịch bản hành vi bắt buộc)**:
   - **Kịch bản 1 (Dynamic Partner Count & Filtering)**: Khi `suppliers` có 5 đối tác, kiểm chứng nhãn bộ chọn hiển thị đúng "Tất cả nhà cung cấp (5 đối tác)", không hiển thị "(35 đối tác)".
   - **Kịch bản 2 (Approval Decision & BR-GLOBAL-03)**: Kiểm chứng bấm từ chối mà không nhập lý do thì bị chặn hiển thị thông báo lỗi; nhập lý do và xác nhận sẽ gửi đúng request payload.
   - **Kịch bản 3 (Empty State)**: Khi không có đơn PO hoặc hàng đợi duyệt trống, `<StateBoundary>` hiển thị empty state chuẩn.
   - **Kịch bản 4 (Error & Retry)**: Báo lỗi mạng thật và nút `[Thử lại]` nạp lại đúng danh sách.
4. **Machine Conformance Test**:
   - `scripts/check-conformance-contracts.test.mjs` kiểm tra toàn bộ các actions mới được ánh xạ 1:1, không còn grouped capability nào.

---

## 8. What is Left to the Builder

The builder (executing agent) will:
1. Update `scripts/check-conformance-contracts.test.mjs` with RED test asserting operation-grain disaggregation of Purchasing and Approvals capabilities.
2. Update `docs/conformance-contracts.json` to disaggregate all grouped capabilities and resolve requirement references.
3. Fix hardcoding in `PurchasingPage.tsx` (`(35 đối tác)` $\rightarrow$ dynamic `suppliers.length`).
4. Audit and enhance test coverage in `frontend/src/__tests__/Purchasing.test.tsx` and `Approvals.test.tsx`.
5. Run full non-mutating verification suite (`conformance`, `unit`, `lint`, `build`, `depcruise`, `diff-check`).
6. Apply 3 mandatory review gates (`ipc-test-audit`, `ipc-ui-review`, `ipc-code-review`) and record in `.planning/WORK.md`.
