# Warehouse & Inventory Capability Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** `FR-WH` (Warehouse & Inventory Management) Conformance, Backend Ground Truth Alignment, Elimination of Hardcoded UI Assumptions, Operation-Grain Capability Disaggregation, and 100% Existing UI Kit Reuse  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Intent & The "Why"

The Warehouse route (`/warehouse`) governs inventory management, warehouse receipts from POs, issue handoffs to the kitchen, return of leftover materials, and physical stock card integrity.

While earlier remediation passes (GF-R21, GF-R24) removed fixed operational dates and unbacked issue modals, significant conformance and architectural gaps remain:
1. **Flawed Empty State Logic in UI:** In `WarehousePage.tsx`, the outer `StateBoundary` hardcodes `isEmpty={false}`. When `issues` or `receipts` has 0 rows, the component renders an empty `DataGrid` header without the standard empty state explanation, failing `Rule TA-4` and accessibility requirements.
2. **Bundled Write Capabilities in Machine Inventory:** Over 25 distinct HTTP actions in `Features/Inventory` are bundled into coarse, multi-action capabilities (`WH.ISSUE` with 4 actions, `WH.RECEIPT` with 4 actions, `WH.RETURN` with 6 actions, `WH.STOCKTAKE` with 7 actions, `WH.LEGACY_LINEAGE` with 5 actions).
3. **Immutable Stock Lineage Invariants:** Current stock on `/warehouse?view=stock` cannot be fabricated from receipt/issue math with zero initial stock; it must originate from an authoritative snapshot.
4. **Strict UI Kit Compliance:** The route uses the `OperationalFrame` pattern. 100% of the UI must use established primitives (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `Button`, `Badge`, `IdentifierText`) without inventing custom wrappers or writing ad-hoc CSS.

---

## 2. Mandatory UI Kit & Design System Authority (Zero Inventions)

**CỐT LÕI BẮT BUỘC:** 100% mã giao diện BẮT BUỘC phải tái sử dụng trực tiếp các thành phần có sẵn trong Catalog dự án (`docs/UI-KIT.md`, `frontend/src/components/ui/`, `frontend/src/components/workbench/`). **TUYỆT ĐỐI CẤM TỰ CHẾ, TỰ PHÁT MINH COMPONENT MỚI HOẶC VIẾT CSS RIÊNG.**

### Danh mục thành phần có sẵn được phép sử dụng:

1. **Khung bố cục 3-Zone OperationalFrame (`frontend/src/components/workbench/`)**:
   - `WorkspaceHeader` (Zone 1 - 56px): Tiêu đề trang + bộ chọn kho vận hành + badge trạng thái kho + nút thao tác outline "Làm mới". 0 nút Primary (`D7`).
   - `TelemetrySubbar` (Zone 2 - 44px): Chỉ báo phạm vi nghiệp vụ và inline telemetry pills (`Num` font `tabular-nums`, không dùng thẻ KPI card 120px cồng kềnh).
   - `DataGrid`, `type ColumnDef` (Zone 3): Bảng dữ liệu phẳng, chiều cao dòng 36–40px (`T8`), header cố định (`T7`), hover hàng nhẹ nhàng.
   - `StateBoundary`: Quản lý tập trung 6 trạng thái UI (`loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`), tích hợp `WorkbenchSkeleton` (table 6x8) và nút thử lại khi lỗi.
2. **UI Primitives chuẩn hóa (`frontend/src/components/ui/`)**:
   - `Button`: `variant="outline"` cho thao tác làm mới và các tiện ích (`D7`).
   - `Badge`: Hiển thị trạng thái chứng từ (`DRAFT`, `ISSUED`, `CONFIRMED`, `POSTED`) với biến thể ngữ nghĩa (`neutral`, `info`, `success`).
   - `IdentifierText`: Hiển thị mã phiếu xuất, mã phiếu nhập dạng monospace (`L1`, `L7`), hỗ trợ hover sao chép.
   - `Select`: Bộ chọn kho vận hành trong header (`h-9`).
3. **Quy định cấm tuyệt đối**:
   - **CẤM** tạo file component mới (không tạo WarehouseCard, không tạo CustomIssueTable, không tạo BadgeV2).
   - **CẤM** viết thêm bất kỳ class CSS tùy tiện, style inline `style={{...}}`, hoặc mã hex màu nào ngoài `frontend/src/styles/index.css`.
   - **CẤM** tạo các khối thẻ hộp lồng hộp (Zero Box-in-Box), không dùng thẻ `<details>`.

---

## 3. Requirements & Governance Matrix (`FR`, `NFR`, `UXR`, `D`, `T`, `M`, `N`)

### Functional Requirements (FR)
- `FR-WH`: Quản lý tồn kho tức thời, lập và duyệt phiếu nhập/xuất kho, ghi sổ thẻ kho bất biến.
- `BR-GLOBAL-02`: Quantitative Traceability Chain từ Đề xuất mua $\rightarrow$ PO $\rightarrow$ Phiếu nhập kho $\rightarrow$ Phiếu xuất kho $\rightarrow$ Đối soát.
- `BR-GLOBAL-03`: Phiếu xuất kho bắt buộc phải có căn cứ từ yêu cầu vật tư đã duyệt.
- `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.

### UI Non-Functional Requirements (NFR-UI)
- `NFR-UI-01` (Table Scalability & Viewport): Danh sách phiếu xuất/nhập cuộn độc lập trong khung nhìn `OperationalFrame`.
- `NFR-UI-02` (Triple-Layer RBAC Defense): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
- `NFR-UI-03` (Strict Formatting Primitives): Mã chứng từ dùng `<IdentifierText>`, ngày tháng dùng `formatVietnameseDate`.
- `NFR-UI-04` (Accessibility WCAG 2.2 AA): Tỷ lệ tương phản text >= 4.5:1, nút điều khiển >= 3:1. Hỗ trợ phím Tab/Enter/Esc, outline focus rõ nét (`focus-visible:ring-2`), aria-label đầy đủ.
- `NFR-UI-05` (Motion & Zero CLS): Hiệu ứng <= 150ms, tôn trọng `prefers-reduced-motion`, skeleton loading table 6x8 đồng dạng (CLS <= 0.1).

### User Experience Requirements (UXR)
- `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Data Area.
- `UXR-02` (Operational Density): Ưu tiên hiển thị tối đa dữ liệu nghiệp vụ hữu ích trong 1 màn hình cuộn, không padding thừa.
- `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt chuẩn hóa ("Kho nguyên liệu & Nhập xuất", "Mã phiếu xuất", "Mã phiếu nhập", "Kho xuất hàng", "Kho tiếp nhận"...).
- `UXR-05` (Destructive & Terminal Guards): Mọi thao tác xuất kho bắt buộc phải có căn cứ xuất từ kế hoạch/yêu cầu đã duyệt.

### Design System & Taste Floor (Impeccable `Operate` Mode & `D1–D9`)
- Mode: **`Operate`** (môi trường vận hành công nghiệp, ưu tiên tốc độ quét mắt, tính chính xác và mật độ dữ liệu).
- `D1–D5` (Token Authority & Palette): 100% dùng token ngữ nghĩa cool-slate từ `frontend/src/styles/index.css`. Viền hairline `1px border-slate-200`, không đổ bóng đậm (`no heavy drop-shadows`).
- `D6` (Typography Scale): Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`.
- `D7` (Action Hierarchy): 0 nút Primary (chế độ đọc an toàn `READ_ONLY_BY_CONTRACT`), nút "Làm mới" là nút Outline.
- `D8` (Neutral Baseline): Viền hairline `1px border-slate-200`.
- `D9` (Icon Grammar): Icons Lucide chuẩn hóa stroke 2px, kích thước 16px/20px.

### Table & Data Grid Rules (`T1–T16`)
- `T1`, `T2`, `T3`: Căn giữa số lượng dòng, căn trái mã và tên kho; tiêu đề cột `<th>` đồng bộ căn lề 100% với ô `<td>`.
- `T7` (Horizontal/Vertical Freeze): Cố định tiêu đề (`sticky top-0`) khi cuộn dọc và cố định cột mã phiếu khi cuộn ngang.
- `T8` (Operational Compact Density): Chiều cao dòng chuẩn cứng `36px–40px` cho toàn bộ các dòng dữ liệu.
- `T11–T12`: Bảng phiếu xuất 6 cột, bảng phiếu nhập 6 cột.

---

## 4. Technical Ground Truth (Backend Contracts & Empty State Resiliency)

### A. Empty State Logic in `WarehousePage.tsx`
- **Hiện trạng:**
  ```tsx
  <StateBoundary isLoading={isLoading} error={error} onRetry={loadData} isEmpty={false}>
  ```
- **Sửa đúng theo tiêu chuẩn TA-4:**
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

### B. C# Contracts for Warehouse & Inventory

1. **`WarehouseDto` (`backend/src/IPCManagement.Api/Features/Inventory/Contracts/WarehouseDto.cs`)**:
   - `WarehouseId` (string), `WarehouseCode` (string), `WarehouseName` (string), `Location` (string?), `IsActive` (bool).
2. **`InventoryIssueDto` (`backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryIssueDto.cs`)**:
   - `IssueId` (string), `IssueCode` (string), `IssueDate` (DateOnly string), `ShiftName` (string), `WarehouseName` (string), `Status` (`DRAFT | ISSUED | CONFIRMED`), `Lines` (`IReadOnlyList<InventoryIssueLineDto>`).
3. **`InventoryReceiptDto` (`backend/src/IPCManagement.Api/Features/Inventory/Contracts/InventoryReceiptDto.cs`)**:
   - `ReceiptId` (string), `ReceiptCode` (string), `ReceiptDate` (DateOnly string), `SupplierName` (string), `WarehouseName` (string), `Status` (`DRAFT | APPROVED | POSTED`), `Lines` (`IReadOnlyList<InventoryReceiptLineDto>`).

---

## 5. UI Architecture & Scoped Pre-Code UI Gate Block

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

## 6. Machine Inventory Disaggregation (`docs/conformance-contracts.json`)

Tách toàn bộ 26 Backend actions thuộc Warehouse và Inventory thành các capabilities độc lập:

| Grouped Capability Cũ | Disaggregated Capabilities Mới | Operations | Actions Ánh Xạ | Ghi chú & Gaps |
|---|---|---|---|---|
| `WH.ISSUE` | • `WH.ISSUE.READ`<br>• `WH.ISSUE.CREATE`<br>• `WH.ISSUE.CONFIRM` | `read`, `create`, `terminal` | `InventoryIssues.GetAll`<br>`InventoryIssues.GetById`<br>`InventoryIssues.Create`<br>`InventoryIssues.ConfirmReceipt` | `WH.ISSUE.READ` là `READY` mapped to `warehouse.issues`. Create và confirm là `PARTIAL`. |
| `WH.RECEIPT` | • `WH.RECEIPT.READ`<br>• `WH.RECEIPT.CREATE`<br>• `WH.RECEIPT.CREATE_FROM_PURCHASE` | `read`, `create`, `create` | `InventoryReceipts.GetAll`<br>`InventoryReceipts.GetById`<br>`InventoryReceipts.Create`<br>`InventoryReceipts.CreateFromPurchase` | `WH.RECEIPT.READ` là `READY` mapped to `warehouse.receipts`. Create là `PARTIAL`. |
| `WH.RETURN` | • `WH.RETURN.READ`<br>• `WH.RETURN.CREATE`<br>• `WH.RETURN.CONFIRM`<br>• `WH.RETURN.DISPOSITION` | `read`, `create`, `terminal`, `create` | `InventoryReturns.GetAll`<br>`InventoryReturns.GetById`<br>`InventoryReturns.GetAllocationBalances`<br>`InventoryReturns.Create`<br>`InventoryReturns.ConfirmReceipt`<br>`InventoryReturns.CreateAllocationDisposition` | Phân loại `PARTIAL`. Phục vụ bếp hoàn trả hàng thừa ca. |
| `WH.STOCKTAKE` | • `WH.STOCKTAKE.READ`<br>• `WH.STOCKTAKE.CREATE`<br>• `WH.STOCKTAKE.UPDATE_ACTUAL`<br>• `WH.STOCKTAKE.SUBMIT`<br>• `WH.STOCKTAKE.APPROVE`<br>• `WH.STOCKTAKE.REJECT` | `read`, `create`, `update`, `terminal`, `terminal`, `terminal` | `Stocktakes.GetById`<br>`Stocktakes.GetPaged`<br>`Stocktakes.Create`<br>`Stocktakes.UpdateActualQty`<br>`Stocktakes.Submit`<br>`Stocktakes.Approve`<br>`Stocktakes.Reject` | Phân loại `PARTIAL`. Kiểm kê kho định kỳ. |
| `WH.LEGACY_LINEAGE` | • `WH.LEGACY_LINEAGE.READ`<br>• `WH.LEGACY_LINEAGE.CREATE`<br>• `WH.LEGACY_LINEAGE.REVIEW`<br>• `WH.LEGACY_LINEAGE.APPLY` | `read`, `create`, `terminal`, `terminal` | `LegacyLineageDispositions.Get`<br>`LegacyLineageDispositions.GetCandidates`<br>`LegacyLineageDispositions.Create`<br>`LegacyLineageDispositions.Review`<br>`LegacyLineageDispositions.Apply` | Phân loại `PARTIAL`. Xử lý dữ liệu kế thừa. |

---

## 7. Verification & Test Audit Strategy

### Test Suites & Rules (`Rule TA-1` $\rightarrow$ `TA-5`)

1. **Rule TA-1 (Backend-Grounded Fixtures Only)**:
   - Tất cả fixtures cho Warehouse trong test bắt buộc phải có đủ trường C# DTOs: `issueId`, `issueCode`, `issueDate`, `shiftName`, `warehouseName`, `receiptId`, `receiptCode`, `receiptDate`, `supplierName`.
2. **Rule TA-2 (No Self-Mocking)**:
   - Test component `WarehousePage` trên cây DOM thật; chỉ mock network ranh giới `apiClient` / `warehouseApi`.
3. **Rule TA-4 (4 Kịch bản hành vi bắt buộc)**:
   - **Kịch bản 1 (Success & View Isolation)**: Khi ở `view=issues`, kiểm chứng render đúng các cột phiếu xuất; khi ở `view=receipts`, render đúng các cột phiếu nhập.
   - **Kịch bản 2 (Empty State Resiliency)**: Khi `issues: []` và `view=issues`, `<StateBoundary>` hiển thị "Chưa có phiếu xuất kho". Khi `receipts: []` và `view=receipts`, hiển thị "Chưa có phiếu nhập kho".
   - **Kịch bản 3 (Stock Tab Precondition Blocked)**: View `stock` hiển thị thông báo chặn nguồn dữ liệu rõ ràng, từ chối bịa đặt tồn kho từ phép tính nhập trừ xuất.
   - **Kịch bản 4 (Error & Retry)**: Báo lỗi mạng thật và nút `[Thử lại]` nạp lại đúng danh sách.
4. **Machine Conformance Test**:
   - `scripts/check-conformance-contracts.test.mjs` kiểm tra toàn bộ 26 actions mới được ánh xạ 1:1, không còn grouped capability nào.

---

## 8. What is Left to the Builder

The builder (executing agent) will:
1. Update `scripts/check-conformance-contracts.test.mjs` with RED test asserting operation-grain disaggregation of Warehouse and Inventory capabilities.
2. Update `docs/conformance-contracts.json` to disaggregate all grouped capabilities and resolve requirement references.
3. Fix empty state logic in `WarehousePage.tsx` (`isEmpty={...}` dynamic condition with proper emptyTitle and emptyDescription).
4. Audit and enhance test coverage in `frontend/src/__tests__/Warehouse.test.tsx`.
5. Run full non-mutating verification suite (`conformance`, `unit`, `lint`, `build`, `depcruise`, `diff-check`).
6. Apply 3 mandatory review gates (`ipc-test-audit`, `ipc-ui-review`, `ipc-code-review`) and record in `.planning/WORK.md`.
