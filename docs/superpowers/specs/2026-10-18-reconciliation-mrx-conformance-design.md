# Material Reconciliation (MRX) Capability Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** `FR-RECON` (Material Reconciliation MRX) Conformance, Strict Operational Mode Isolation (`DOM-MODE-1`), Operation-Grain Capability Disaggregation, Action Guard Alignment, and 100% Existing UI Kit Reuse  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Intent & The "Why"

The Material Reconciliation (`/reconciliation`) route implements the core audit and variance control loop between warehouse issuance and physical consumption under the `MATERIAL_RECONCILIATION` operational mode.

Earlier remediation passes (GF-R32, Foundation B) established conflict preservation on batch completion and mode-guarded disabling via `ActionGuard`. However, important capability and machine conformance gaps remain:
1. **Bundled Write Capabilities in Machine Inventory:** 
   - `RECON.BATCH.LIFECYCLE` bundles 6 distinct lifecycle commands (`Create`, `PreviewQuantityImport`, `CommitQuantityImport`, `Ready`, `TransferToWarehouse`, `Complete`).
   - `RECON.ACTUALS` bundles 1 read query and 4 mutation actions (`DispositionCategories`, `Purchased`, `Issued`, `Disposition`, `DailyLines.Disposition`).
2. **Action Guard Capability Precision:** On `ReconciliationPage.tsx`, the completion modal action button uses `<ActionGuard capabilityId="RECON.BATCH.LIFECYCLE" ...>`. It must be aligned to the exact operation-grain capability `RECON.BATCH.COMPLETE`.
3. **Hard Mode Isolation (`DOM-MODE-1`):** In accordance with Hard Invariant 2, `DEFAULT != MATERIAL_RECONCILIATION`. Batch completion requires `MATERIAL_RECONCILIATION` mode and `ReconciliationWriteAccess` token, failing closed if called in `DEFAULT` mode.
4. **Strict UI Kit Compliance:** 100% of the UI must use established primitives (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `VietnameseDateInput`, `Button`, `Badge`, `Num`, `IdentifierText`, `Modal`, `ActionGuard`) without inventing custom components or writing ad-hoc CSS.

---

## 2. Mandatory UI Kit & Design System Authority (Zero Inventions)

**CỐT LÕI BẮT BUỘC:** 100% mã giao diện BẮT BUỘC phải tái sử dụng trực tiếp các thành phần có sẵn trong Catalog dự án (`docs/UI-KIT.md`, `frontend/src/components/ui/`, `frontend/src/components/workbench/`). **TUYỆT ĐỐI CẤM TỰ CHẾ, TỰ PHÁT MINH COMPONENT MỚI HOẶC VIẾT CSS RIÊNG.**

### Danh mục thành phần có sẵn được phép sử dụng:

1. **Khung bố cục 3-Zone OperationalFrame (`frontend/src/components/workbench/`)**:
   - `WorkspaceHeader` (Zone 1 - 56px): Tiêu đề trang + bộ chọn khách hàng/ngày + badge trạng thái lô + nút outline "Làm mới". Nút Primary duy nhất "Chốt đối soát ca" bọc trong `ActionGuard` (`D7`).
   - `TelemetrySubbar` (Zone 2 - 44px): Chỉ báo phạm vi nghiệp vụ và inline telemetry pills (`Num` font `tabular-nums`, không dùng thẻ KPI card 120px cồng kềnh).
   - `DataGrid`, `type ColumnDef` (Zone 3): Bảng dữ liệu phẳng 7 cột, chiều cao dòng 36–40px (`T8`), header cố định (`T7`), hover hàng nhẹ nhàng.
   - `StateBoundary`: Quản lý tập trung 6 trạng thái UI (`loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`), tích hợp `WorkbenchSkeleton` (table 7x8) và xử lý xung đột 409 qua inline alert.
2. **UI Primitives chuẩn hóa (`frontend/src/components/ui/`)**:
   - `Button`: `variant="outline"` cho thao tác làm mới và hủy; `variant="default"` duy nhất cho nút chốt ca (`D7`).
   - `Badge`: Hiển thị trạng thái lô và trạng thái dòng đối soát (`success`, `info`, `warning`, `neutral`).
   - `Num`: Định dạng số lượng nhu cầu, thực xuất, chênh lệch bằng `format="quantity"`, font `tabular-nums` (`T1`, `T3`).
   - `IdentifierText`: Hiển thị mã nguyên liệu dạng monospace (`L1`, `L7`), hỗ trợ hover sao chép.
   - `Select`: Bộ chọn khách hàng đối soát (`w-64`).
   - `VietnameseDateInput`: Bộ chọn ngày đối soát (`w-40`).
   - `Modal`: Hộp thoại xác nhận hoàn tất lô đối soát, tối đa 1 modal chặn (`M1.2`).
   - `ActionGuard`: Bọc nút chốt đối soát với capability `RECON.BATCH.COMPLETE`, role `ADMIN`/`MANAGER`, permission `ReconciliationWriteAccess`, và bắt buộc `allowedModes={['MATERIAL_RECONCILIATION']}`.
3. **Quy định cấm tuyệt đối**:
   - **CẤM** tạo file component mới (không tạo ReconGrid, không tạo VarianceCard, không tạo BadgeV2).
   - **CẤM** viết thêm bất kỳ class CSS tùy tiện, style inline `style={{...}}`, hoặc mã hex màu nào ngoài `frontend/src/styles/index.css`.
   - **CẤM** tạo các khối thẻ hộp lồng hộp (Zero Box-in-Box), không dùng thẻ `<details>`.

---

## 3. Requirements & Governance Matrix (`FR`, `NFR`, `UXR`, `D`, `T`, `M`, `N`)

### Functional Requirements (FR)
- `FR-RECON`: Đối soát lượng xuất kho sổ sách với lượng tiêu hao thực tế của ca nấu ăn, lập biên bản xử lý sai lệch, chốt hoàn tất lô.
- `BR-GLOBAL-02`: Quantitative Traceability Chain từ Đề xuất mua $\rightarrow$ PO $\rightarrow$ Nhập kho $\rightarrow$ Xuất kho $\rightarrow$ Bàn giao $\rightarrow$ Đối soát.
- `DOM-MODE-1`: Chế độ `MATERIAL_RECONCILIATION`. Bất biến: dữ liệu đối soát không hòa trộn với luồng công việc của `DEFAULT`.

### UI Non-Functional Requirements (NFR-UI)
- `NFR-UI-01` (Table Scalability & Viewport): Bảng đối soát ngày cuộn mượt mà với 85% chiều cao khung nhìn.
- `NFR-UI-02` (Triple-Layer RBAC Defense): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard capabilityId="RECON.BATCH.COMPLETE"`).
- `NFR-UI-03` (Strict Formatting Primitives): Số lượng dùng `<Num format="quantity">`, mã chứng từ dùng `<IdentifierText>`, ngày tháng dùng `formatVietnameseDate`.
- `NFR-UI-04` (Accessibility WCAG 2.2 AA): Tỷ lệ tương phản text >= 4.5:1, nút điều khiển >= 3:1. Hỗ trợ phím Tab/Enter/Esc, outline focus rõ nét (`focus-visible:ring-2`), aria-label đầy đủ.
- `NFR-UI-05` (Motion & Zero CLS): Hiệu ứng <= 150ms, tôn trọng `prefers-reduced-motion`, skeleton loading table 7x8 đồng dạng (CLS <= 0.1).

### User Experience Requirements (UXR)
- `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Data Area.
- `UXR-02` (Operational Density): Ưu tiên hiển thị tối đa dữ liệu nghiệp vụ hữu ích trong 1 màn hình cuộn, không padding thừa.
- `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt chuẩn hóa ("Đối soát nguyên liệu", "Mã nguyên liệu", "Tên nguyên liệu thực phẩm", "Nhu cầu đã khóa", "Đã xuất theo sổ", "Chênh lệch xuất", "Chốt đối soát ca"...).
- `UXR-05` (Destructive & Terminal Guards): Thao tác chốt lô bắt buộc phải có modal xác nhận rõ ràng; nếu gặp HTTP 409 conflict thì giữ nguyên dòng dữ liệu trên màn hình và cung cấp nút "Tải lại dữ liệu mới nhất".

### Design System & Taste Floor (Impeccable `Operate` Mode & `D1–D9`)
- Mode: **`Operate`** (môi trường vận hành công nghiệp, ưu tiên tốc độ quét mắt, tính chính xác và mật độ dữ liệu).
- `D1–D5` (Token Authority & Palette): 100% dùng token ngữ nghĩa cool-slate từ `frontend/src/styles/index.css`. Viền hairline `1px border-slate-200`, không đổ bóng đậm (`no heavy drop-shadows`).
- `D6` (Typography Scale): Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`, hỗ trợ tiếng Việt đầy đủ.
- `D7` (Action Hierarchy): Tối đa 1 nút Primary trên một vùng làm việc. Nút "Chốt đối soát ca" là nút Primary duy nhất; nút "Làm mới" là nút Outline.
- `D8` (Neutral Baseline): Viền hairline `1px border-slate-200`.
- `D9` (Icon Grammar): Icons Lucide chuẩn hóa stroke 2px, kích thước 16px/20px.

### Table & Data Grid Rules (`T1–T16`)
- `T1`, `T2`, `T3`: Căn phải số lượng nhu cầu, số lượng xuất và chênh lệch bằng `<Num>` font `tabular-nums`; tiêu đề cột `<th>` đồng bộ căn lề 100% với ô `<td>`.
- `T7` (Horizontal/Vertical Freeze): Cố định tiêu đề (`sticky top-0`) khi cuộn dọc và cố định cột mã nguyên liệu khi cuộn ngang.
- `T8` (Operational Compact Density): Chiều cao dòng chuẩn cứng `36px–40px` cho toàn bộ các dòng dữ liệu.
- `T11–T12`: Bảng đối soát 7 cột: Mã, Tên, ĐVT, Nhu cầu đã khóa, Đã xuất theo sổ, Chênh lệch xuất, Trạng thái dòng.

---

## 4. Technical Ground Truth (Backend Contracts & Concurrency Authority)

### A. Action Guard Alignment on `ReconciliationPage.tsx`
- **Hiện trạng:**
  ```tsx
  <ActionGuard capabilityId="RECON.BATCH.LIFECYCLE" ...>
  ```
- **Sửa đúng theo Operation-Grain:**
  ```tsx
  <ActionGuard capabilityId="RECON.BATCH.COMPLETE" ...>
  ```
  Đồng bộ hóa với `docs/conformance-contracts.json` (action `complete-batch` thuộc capability `RECON.BATCH.COMPLETE`).

### B. C# Contracts for Reconciliation

1. **`ReconciliationBatchDto` (`backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationDto.cs`)**:
   - `BatchId` (string), `BatchCode` (string), `Status` (`DRAFT | READY | TRANSFERRED | IN_PROGRESS | COMPLETED | WEEK_COMPLETE`), `Version` (long), `StartDate` (DateOnly string), `EndDate` (DateOnly string), `CustomerId` (string), `CustomerCode` (string), `Lines` (`IReadOnlyList<ReconciliationBatchLineDto>`).
2. **`CompleteBatchRequest` (`backend/src/IPCManagement.Api/Features/Reconciliation/Contracts/ReconciliationDto.cs`)**:
   - `ExpectedVersion` (long). Backend kiểm tra concurrency token qua EF Core RowVersion; nếu phiên bản không khớp thì ném `DbUpdateConcurrencyException` và trả về HTTP 409 Conflict.

---

## 5. UI Architecture & Scoped Pre-Code UI Gate Block

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

## 6. Machine Inventory Disaggregation (`docs/conformance-contracts.json`)

Tách toàn bộ 11 Backend actions thuộc Reconciliation thành các capabilities độc lập:

| Grouped Capability Cũ | Disaggregated Capabilities Mới | Operations | Actions Ánh Xạ | Ghi chú & Gaps |
|---|---|---|---|---|
| `RECON.BATCH.LIFECYCLE` | • `RECON.BATCH.CREATE`<br>• `RECON.BATCH.PREVIEW_IMPORT`<br>• `RECON.BATCH.COMMIT_IMPORT`<br>• `RECON.BATCH.READY`<br>• `RECON.BATCH.TRANSFER_WAREHOUSE`<br>• `RECON.BATCH.COMPLETE` | `create`<br>`create`<br>`terminal`<br>`terminal`<br>`terminal`<br>`terminal` | `ReconciliationBatches.Create`<br>`ReconciliationBatches.PreviewQuantityImport`<br>`ReconciliationBatches.CommitQuantityImport`<br>`ReconciliationBatches.Ready`<br>`ReconciliationBatches.TransferToWarehouse`<br>`ReconciliationBatches.Complete` | `RECON.BATCH.COMPLETE` là `READY` mapped to `reconciliation.batch` action `complete-batch`. Các capabilities khác là `PARTIAL`. |
| `RECON.ACTUALS` | • `RECON.DISPOSITION.READ`<br>• `RECON.ACTUALS.PURCHASED`<br>• `RECON.ACTUALS.ISSUED`<br>• `RECON.ACTUALS.DISPOSITION`<br>• `RECON.DAILY_LINES.DISPOSITION` | `read`<br>`update`<br>`update`<br>`update`<br>`update` | `ReconciliationActuals.DispositionCategories`<br>`ReconciliationActuals.Purchased`<br>`ReconciliationActuals.Issued`<br>`ReconciliationActuals.Disposition`<br>`ReconciliationDailyLines.Disposition` | `RECON.DISPOSITION.READ` là `READY`. Các mutation ghi nhận thực tế là `PARTIAL`. |

---

## 7. Verification & Test Audit Strategy

### Test Suites & Rules (`Rule TA-1` $\rightarrow$ `TA-5`)

1. **Rule TA-1 (Backend-Grounded Fixtures Only)**:
   - Tất cả fixtures cho Reconciliation trong test bắt buộc phải có đủ trường C# DTOs: `batchId`, `batchCode`, `status`, `version`, `lines: [{ batchLineId, materialCode, materialName, unit, requiredQuantity, issuedQuantity, issuedRequiredDifference, status }]`.
2. **Rule TA-2 (No Self-Mocking)**:
   - Test component `ReconciliationPage` trên cây DOM thật; chỉ mock network ranh giới `apiClient` / `reconciliationApi`.
3. **Rule TA-4 (4 Kịch bản hành vi bắt buộc)**:
   - **Kịch bản 1 (Success & MRX Mode)**: Render đúng các cột bảng đối soát khi đang ở chế độ `MATERIAL_RECONCILIATION`.
   - **Kịch bản 2 (Mode Isolation Guard)**: Khi server ở chế độ `DEFAULT`, nút "Chốt đối soát ca" bị disable và hiển thị lý do "Chỉ khả dụng trong chế độ đối soát nguyên liệu".
   - **Kịch bản 3 (HTTP 409 Conflict Recovery)**: Khi mutation hoàn tất văng lỗi 409, giữ nguyên dữ liệu các dòng trên màn hình, hiển thị alert xung đột và nút "Tải lại dữ liệu mới nhất".
   - **Kịch bản 4 (HTTP 403 Permission Denied)**: Báo lỗi phân quyền rõ ràng qua `StateBoundary`.
4. **Machine Conformance Test**:
   - `scripts/check-conformance-contracts.test.mjs` kiểm tra toàn bộ 11 actions mới được ánh xạ 1:1, không còn grouped capability nào.

---

## 8. What is Left to the Builder

The builder (executing agent) will:
1. Update `scripts/check-conformance-contracts.test.mjs` with RED test asserting operation-grain disaggregation of Reconciliation capabilities.
2. Update `docs/conformance-contracts.json` to disaggregate all grouped capabilities and align surface `reconciliation.batch` action `complete-batch` to `RECON.BATCH.COMPLETE`.
3. Update `ReconciliationPage.tsx` to align `<ActionGuard capabilityId="RECON.BATCH.COMPLETE" ...>`.
4. Run full non-mutating verification suite (`conformance`, `unit`, `lint`, `build`, `depcruise`, `diff-check`).
5. Apply 3 mandatory review gates (`ipc-test-audit`, `ipc-ui-review`, `ipc-code-review`) and record in `.planning/WORK.md`.
