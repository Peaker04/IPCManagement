# Reports & Dashboard Capability Conformance Design

**Date:** 2026-10-18  
**Status:** Proposed for Owner Approval  
**Scope:** `FR-REP` (Operational Reports & Analytics) and `FR-DASH` (Operational Command Dashboard) Conformance, Backend Ground Truth Alignment, Elimination of Hardcoded Dates, Restoration of Error Recovery in Reports, Operation-Grain Capability Disaggregation, and 100% Existing UI Kit Reuse  
**State Owner:** `.planning/WORK.md`  
**Parent Spec:** `docs/superpowers/specs/2026-10-17-requirements-to-runtime-conformance-design.md`

---

## 1. Intent & The "Why"

The Dashboard (`/`) and Operational Reports (`/reports`) routes provide real-time visibility into daily production bottlenecks, inventory consumption, price variances, and procurement forecasts.

Earlier remediation passes (GF-R20, GF-R27) replaced synthetic meal-cost calculations with authoritative paged contracts (`ingredient-demand/aggregate/page`, `receipt-price-variance/page`, `current-stock/page`), aligned URL leaves (`?view=demand|prices|stock`), and added server pagination.

However, several critical conformance gaps remain:
1. **Hardcoded Date in Dashboard Header:** In `DashboardPage.tsx`, the workspace header statically hardcodes `Thứ Hai, 21/09/2026` instead of dynamically computing the current business date in Vietnamese timezone (`Asia/Ho_Chi_Minh`).
2. **Missing Error Retry in Reports:** In `ReportsPage.tsx`, the `WorkspaceHeader` omits the standard "Làm mới" outline action button, and `StateBoundary` is not provided an `onRetry` handler, leaving users without an accessible recovery path when network errors occur.
3. **Bundled Write Capabilities in Machine Inventory:** `REP.DATA_QUALITY.WRITE` currently bundles 7 distinct actions across data quality dispositions, unit normalization reviews, and report cleanup into a single capability.
4. **Strict UI Kit Compliance:** 100% of the UI must use established primitives (`WorkspaceHeader`, `TelemetrySubbar`, `DataGrid`, `StateBoundary`, `Select`, `Button`, `Badge`, `Num`, `IdentifierText`) without inventing custom components or writing ad-hoc CSS.

---

## 2. Mandatory UI Kit & Design System Authority (Zero Inventions)

**CỐT LÕI BẮT BUỘC:** 100% mã giao diện BẮT BUỘC phải tái sử dụng trực tiếp các thành phần có sẵn trong Catalog dự án (`docs/UI-KIT.md`, `frontend/src/components/ui/`, `frontend/src/components/workbench/`). **TUYỆT ĐỐI CẤM TỰ CHẾ, TỰ PHÁT MINH COMPONENT MỚI HOẶC VIẾT CSS RIÊNG.**

### Danh mục thành phần có sẵn được phép sử dụng:

1. **Khung bố cục 3-Zone OperationalFrame (`frontend/src/components/workbench/`)**:
   - `WorkspaceHeader` (Zone 1 - 56px): Tiêu đề trang + bộ chọn kỳ/khách hàng + nút outline "Làm mới" (`D7`). Nút Primary duy nhất "Mở bàn giao ca" trên Dashboard.
   - `TelemetrySubbar` (Zone 2 - 44px): Chỉ báo phạm vi nghiệp vụ và inline telemetry pills (`Num` font `tabular-nums`, không dùng thẻ KPI card 120px cồng kềnh).
   - `DataGrid`, `type ColumnDef` (Zone 3): Bảng dữ liệu phẳng, chiều cao dòng 36–40px (`T8`), header cố định (`T7`), hover hàng nhẹ nhàng.
   - `StateBoundary`: Quản lý tập trung 6 trạng thái UI (`loading`, `empty`, `error`, `permission-denied`, `partial`, `write-reconciliation`), tích hợp `WorkbenchSkeleton` (table 6x8) và nút thử lại khi lỗi.
2. **UI Primitives chuẩn hóa (`frontend/src/components/ui/`)**:
   - `Button`: `variant="outline"` cho thao tác làm mới và các nút phân trang (`size="xs"`); `variant="default"` duy nhất cho action chính trên Dashboard (`D7`).
   - `Badge`: Hiển thị trạng thái hoàn tất (`neutral`, `danger`).
   - `Num`: Định dạng số lượng và tiền tệ bằng `format="currency"` và `format="quantity"` căn phải, font `tabular-nums` (`T1`, `T3`).
   - `IdentifierText`: Hiển thị mã phiếu nhập, mã nguyên liệu dạng monospace (`L1`, `L7`).
   - `Select`: Bộ chọn khách hàng báo cáo (`w-60`).
3. **Quy định cấm tuyệt đối**:
   - **CẤM** tạo file component mới (không tạo ReportViewer, không tạo CustomChart, không tạo BadgeV2).
   - **CẤM** viết thêm bất kỳ class CSS tùy tiện, style inline `style={{...}}`, hoặc mã hex màu nào ngoài `frontend/src/styles/index.css`.
   - **CẤM** tạo các khối thẻ hộp lồng hộp (Zero Box-in-Box), không dùng thẻ `<details>`.

---

## 3. Requirements & Governance Matrix (`FR`, `NFR`, `UXR`, `D`, `T`, `M`, `N`)

### Functional Requirements (FR)
- `FR-DASH`: Bàn điều hành tổng quan: theo dõi điểm tắc luồng vận hành hôm nay, tiến độ KHSX các ca, cảnh báo thiếu nguyên liệu tức thời.
- `FR-REP`: Báo cáo vận hành: báo cáo nhu cầu nguyên liệu, biến động giá nhập, báo cáo tồn kho định kỳ.
- `DOM-MODE-1`: Chế độ `DEFAULT` (`SHARED_MASTER_DATA`), cách ly hoàn toàn với `MATERIAL_RECONCILIATION`.

### UI Non-Functional Requirements (NFR-UI)
- `NFR-UI-01` (Table Scalability & Viewport): Phân trang server compact 25 dòng cho báo cáo nhu cầu, biến động giá, tồn kho.
- `NFR-UI-02` (Triple-Layer RBAC Defense): Route (`RoleGuard`), Navigation (`CANONICAL_ROUTES`), Action (`ActionGuard`).
- `NFR-UI-03` (Strict Formatting Primitives): Số lượng và tiền tệ dùng `<Num>`, mã chứng từ dùng `<IdentifierText>`, thời gian cập nhật dùng `formatVietnameseDateTime`.
- `NFR-UI-04` (Accessibility WCAG 2.2 AA): Tỷ lệ tương phản text >= 4.5:1, nút điều khiển >= 3:1. Hỗ trợ phím Tab/Enter/Esc, outline focus rõ nét (`focus-visible:ring-2`), aria-label đầy đủ.
- `NFR-UI-05` (Motion & Zero CLS): Hiệu ứng <= 150ms, tôn trọng `prefers-reduced-motion`, skeleton loading đồng dạng (CLS <= 0.1).

### User Experience Requirements (UXR)
- `UXR-01` (3-Zone Workbench Foundation): Header 56px, Telemetry 44px, Data Area.
- `UXR-02` (Operational Density): Ưu tiên hiển thị tối đa dữ liệu nghiệp vụ hữu ích trong 1 màn hình cuộn, không padding thừa.
- `UXR-04` (Vietnamese Domain Microcopy - `DOM-LANG-1`): 100% tiếng Việt chuẩn hóa ("Bàn điều hành hôm nay", "Báo cáo vận hành", "Nhu cầu nguyên liệu", "Biến động giá nhập", "Tồn kho hiện tại"...).

### Design System & Taste Floor (Impeccable `Operate` Mode & `D1–D9`)
- Mode: **`Operate`** (môi trường vận hành công nghiệp, ưu tiên tốc độ quét mắt, tính chính xác và mật độ dữ liệu).
- `D1–D5` (Token Authority & Palette): 100% dùng token ngữ nghĩa cool-slate từ `frontend/src/styles/index.css`. Viền hairline `1px border-slate-200`, không đổ bóng đậm (`no heavy drop-shadows`).
- `D6` (Typography Scale): Cỡ chữ tối thiểu `12px` (`text-xs`), tiêu đề `18px/16px/14px`, hỗ trợ tiếng Việt đầy đủ.
- `D7` (Action Hierarchy): Tối đa 1 nút Primary trên một vùng làm việc. Nút "Mở bàn giao ca" là nút Primary duy nhất trên Dashboard; trên Reports có 0 nút Primary (chỉ có nút outline "Làm mới").
- `D8` (Neutral Baseline): Viền hairline `1px border-slate-200`.
- `D9` (Icon Grammar): Icons Lucide chuẩn hóa stroke 2px, kích thước 16px/20px.

### Table & Data Grid Rules (`T1–T16`)
- `T1`, `T2`, `T3`: Căn phải số lượng, đơn giá và tiền tệ bằng `<Num>` font `tabular-nums`; tiêu đề cột `<th>` đồng bộ căn lề 100% với ô `<td>`.
- `T7` (Horizontal/Vertical Freeze): Cố định tiêu đề (`sticky top-0`) khi cuộn dọc và cố định cột mã phiếu khi cuộn ngang.
- `T8` (Operational Compact Density): Chiều cao dòng chuẩn cứng `36px–40px` cho toàn bộ các dòng dữ liệu.

---

## 4. Technical Ground Truth (Backend Contracts & Dynamic Authority)

### A. Dynamic Business Date in `DashboardPage.tsx`
- **Hiện trạng:**
  ```tsx
  <span className="text-sm text-slate-700 font-medium">Thứ Hai, 21/09/2026</span>
  ```
- **Sửa đúng theo chuẩn Vietnamese Business Timezone (`Asia/Ho_Chi_Minh`):**
  Tính toán động thứ trong tuần và ngày tháng năm theo thời gian thực tế:
  ```tsx
  function todayInVietnamese(): string {
    const now = new Date();
    const dayName = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long' }).format(now);
    const dateStr = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dateStr}`;
  }
  ```
  Tuyệt đối không hardcode con số `Thứ Hai, 21/09/2026`.

### B. Reload & Retry Authority in `ReportsPage.tsx`
- Bổ sung nút "Làm mới" (`Button variant="outline" size="default"`) trong `WorkspaceHeader`.
- Truyền callback `onRetry={reload}` vào `StateBoundary` để người dùng có nút [Thử lại] khi gặp lỗi mạng.

---

## 5. UI Architecture & Scoped Pre-Code UI Gate Blocks

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

## 6. Machine Inventory Disaggregation (`docs/conformance-contracts.json`)

Tách toàn bộ 7 Backend actions thuộc `REP.DATA_QUALITY.WRITE` thành các capabilities độc lập:

| Grouped Capability Cũ | Disaggregated Capabilities Mới | Operations | Actions Ánh Xạ | Ghi chú & Gaps |
|---|---|---|---|---|
| `REP.DATA_QUALITY.WRITE` | • `REP.DATA_QUALITY.READ`<br>• `REP.DATA_QUALITY.CREATE`<br>• `REP.DATA_QUALITY.REVIEW`<br>• `REP.DATA_QUALITY.APPLY`<br>• `REP.DATA_QUALITY.CLEANUP`<br>• `REP.DATA_QUALITY.REMEDIATE`<br>• `REP.UNIT_NORMALIZATION.DECIDE` | `read`<br>`create`<br>`terminal`<br>`terminal`<br>`terminal`<br>`update`<br>`terminal` | `DataQualityDispositions.Get`<br>`DataQualityDispositions.Create`<br>`DataQualityDispositions.Review`<br>`DataQualityDispositions.Apply`<br>`WorkflowReports.CleanupDataQuality`<br>`WorkflowReports.UpdateDataQualityIssueRemediation`<br>`UnitNormalizationReviews.Decide` | Phân loại `PARTIAL`. Quản lý chất lượng dữ liệu và chuẩn hóa đơn vị tính. |

---

## 7. Verification & Test Audit Strategy

### Test Suites & Rules (`Rule TA-1` $\rightarrow$ `TA-5`)

1. **Rule TA-1 (Backend-Grounded Fixtures Only)**:
   - Tất cả fixtures cho Dashboard và Reports trong test bắt buộc phải có đủ trường C# DTOs: `totalRequiredQty`, `currentStockQty`, `receiptCode`, `unitPrice`, `referencePrice`, `lastUpdated`.
2. **Rule TA-2 (No Self-Mocking)**:
   - Test component `DashboardPage` và `ReportsPage` trên cây DOM thật; chỉ mock network ranh giới `apiClient` / `dashboardApi` / `reportsApi`.
3. **Rule TA-4 (4 Kịch bản hành vi bắt buộc)**:
   - **Kịch bản 1 (Dynamic Business Date on Dashboard)**: Kiểm chứng ngày hiển thị trên Header của Dashboard được sinh động theo thời gian hiện tại, không chứa chuỗi tĩnh "21/09/2026".
   - **Kịch bản 2 (Reports Refresh & Retry)**: Bấm nút "Làm mới" hoặc nút "Thử lại" khi có lỗi sẽ nạp lại dữ liệu đúng kỳ và view đã chọn.
   - **Kịch bản 3 (Reports Server Pagination)**: Chuyển trang qua `<nav aria-label="Phân trang báo cáo">` gọi đúng `reportsApi` với `pageNumber: 2`.
   - **Kịch bản 4 (Empty State)**: Khi không có dữ liệu, hiển thị đúng empty state thông qua `StateBoundary`.
4. **Machine Conformance Test**:
   - `scripts/check-conformance-contracts.test.mjs` kiểm tra toàn bộ 7 capabilities mới của Data Quality được ánh xạ 1:1, không còn grouped capability nào.
