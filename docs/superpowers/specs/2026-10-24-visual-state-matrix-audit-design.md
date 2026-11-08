# Đặc Tả Kỹ Thuật: Đồng Bộ Kiến Trúc Component & Kiểm Chứng Thị Giác 6 Trạng Thái Từng Màn Hình (Visual State Matrix Specification)

**Dự án:** [Peaker04/IPCManagement (`feature/greenfield-fe-3zone-workbench`)](https://github.com/Peaker04/IPCManagement/tree/feature/greenfield-fe-3zone-workbench)  
**Ngày lập:** 2026-10-24  
**Chủ đề:** 
1. Giải quyết triệt để sự mâu thuẫn kiến trúc giữa tài liệu cũ (45 file `components/common/`) và thực tế mã nguồn (3-Zone Flat Workbench `components/workbench/` + 10 UI Primitives).
2. Thiết lập quy chuẩn kiểm chứng thị giác thực tế không dựa trên console pass (Ground Truth Visual Evidence) bằng việc ép buộc và chụp ảnh thật 6 trạng thái UI cho từng route trên trình duyệt Chromium.

---

## 1. Đồng Bộ Kiến Trúc: Sự Chuyển Đổi Từ 45 Files `components/common/` Sang 3-Zone Flat Workbench

Tài liệu `spec.md` cũ (viết khi phân tích nhánh `cleanup/revert-sidebar-v2`) mô tả việc phân chia 45 file trong `components/common/` thành 5 nhóm trách nhiệm. Nhánh `feature/greenfield-fe-3zone-workbench` đã tiến hành tái cấu trúc triệt để (Clean-Core Rebuild) thay thế mô hình 45 file phẳng cồng kềnh bằng kiến trúc **3-Zone Flat Workbench (Zero AI-Slop)**.

Dưới đây là bảng ánh xạ hợp nhất chính thức (Canonical Architectural Mapping) giữa 5 nhóm cũ và hệ thống mới:

| Nhóm cũ trong `common/` (45 files) | Thành phần cũ | Thành phần chuẩn hóa mới (3-Zone Architecture) | Vị trí thư mục mới | Vai trò & Trách nhiệm chuẩn hóa |
| :--- | :--- | :--- | :--- | :--- |
| **Nhóm A: Layout & Shell** (9 components) | `OperationalFrame`, `CommandBar`, `PageBanner`, `ContextStrip`, `SectionPanel`, `DocumentRail`, `SideRail`, `PageStepper` | `AppShell`<br>`WorkspaceHeader` (Zone 1 - cao 48px)<br>`TelemetrySubbar` (Zone 2 - cao 40px) | `frontend/src/components/workbench/` | Thay thế các thanh công cụ, header, banner rời rạc bằng Header chuẩn 48px (tiêu đề + bộ chọn ngữ cảnh + tối đa 1 nút primary) và Subbar 40px (telemetry strip 1 dòng duy nhất, cấm hộp KPI 120px). |
| **Nhóm B: Table & Pagination** (8 components) | `TableViewport`, `PaginatedTableFrame`, `PaginationBar`, `CursorPaginationBar`, `TablePreferencesControl`, `TableSkeleton`, `SkeletonTableRow`, `TableEmptyState` | `DataGrid`<br>`SplitView`<br>`WorkbenchSkeleton` | `frontend/src/components/workbench/` | Thay thế các wrapper bảng lồng nhau bằng `DataGrid` (Zone 3) chiếm $\ge 85\%$ dvh, 1 thanh cuộn dọc duy nhất, `thead` sticky cố định (`Rule T7`), dòng compact 36–40px (`Rule T8`), phân trang server tích hợp. |
| **Nhóm C: State & Feedback** (9 components) | `QueryViewBoundary`, `QueryErrorAlert`, `EmptyState`, `InlineAlert`, `InfoNote`, `FieldError`, `ToastProvider`, `ServiceRunBlockerPanel`, `DiagnosticPanel` | `StateBoundary`<br>`ReconciliationBlockerStrip` | `frontend/src/components/workbench/` & `features/reconciliation/` | Quản lý tập trung đủ 6 trạng thái UI: `loading` (skeleton đúng hình học), `empty` (4 kịch bản), `error` (kèm retry), `permission-denied` (403), `write-reconciliation` (409 conflict reload), `partial`. |
| **Nhóm D: Formatting & Guards** (9 components) | `Num`, `IdentifierText`, `StatusBadge`, `NotificationBadge`, `ActionGuard`, `ActionAvailability`, `SearchField`, `FieldRow`, `ViewSwitcher`, `KeepAliveTabPanel`, `RefreshStatus` | 10 UI Primitives chuẩn WCAG AA: `Button`, `Input`, `Select`, `Badge`, `Checkbox`, `Num`, `IdentifierText`, `VietnameseDateInput`, `Modal`, `Tabs`, `ActionGuard` | `frontend/src/components/ui/` | Chuyển toàn bộ các thành phần định dạng và bảo vệ quyền sang thư mục primitives chuẩn, không dùng CSS ad-hoc. |
| **Nhóm E: Domain Components** (5 components đặt nhầm) | `StockMovementTable`<br>`DemandSummary`<br>`ApprovalQueue`<br>`RoleInbox`<br>`ExceptionLane` | Đã chuyển về đúng Feature Folders tương ứng | `features/warehouse/`<br>`features/weekly-menu/views/`<br>`features/approvals/`<br>`features/dashboard/`<br>`features/reconciliation/` | Không để component mang nghiệp vụ đặc thù nằm ở tầng dùng chung; code nghiệp vụ nào nằm trọn trong thư mục feature đó. |

---

## 2. Quy Chuẩn Thẩm Định Thị Giác 6 Trạng Thái Màn Hình (Visual State Matrix Contract)

Để loại bỏ hoàn toàn việc "chạy test ầm ầm qua mặt console", mỗi Route màn hình phải được kiểm chứng bằng **Bằng chứng thị giác thật (Ground Truth Visual Evidence)** thông qua kịch bản tự động hóa Playwright Chromium.

### 2.1. Ma Trận 6 Trạng Thái Bắt Buộc & Phương Pháp Ép Trạng Thái (Forced State Injection)

| Mã trạng thái | Tên trạng thái | Phương pháp ép trạng thái qua Network Mock (`page.route()`) | Tiêu chí thẩm định thị giác (Visual Inspection Criteria) | Tệp ảnh xuất xưởng |
| :--- | :--- | :--- | :--- | :--- |
| **`STATE-01`** | **Loading (Skeleton)** | Làm trễ request API 1.500ms (`await new Promise(r => setTimeout(r, 1500))`) | • Khung skeleton giữ nguyên vị trí, số cột và chiều cao của bảng thật.<br>• Chỉ số giật layout CLS $\le 0.05$.<br>• Không hiển thị vòng quay loading toàn trang vô nghĩa. | `01-loading-skeleton.png` |
| **`STATE-02`** | **Empty (Trống dữ liệu)** | Chặn API trả về `{ totalCount: 0, items: [] }` | • Hiển thị biểu tượng trống trang nhã, tiêu đề `emptyTitle` và mô tả `emptyDescription` tiếng Việt chuẩn.<br>• BẮT BUỘC có nút CTA dẫn đường (không phải ngõ cụt).<br>• Bảng dữ liệu trống được ẩn đi sạch sẽ. | `02-empty-state.png` |
| **`STATE-03`** | **Error (Lỗi API 500)** | Chặn API trả về `HTTP 500 Internal Server Error` | • Hiển thị banner/hộp cảnh báo lỗi lịch sự kèm thông điệp lỗi rõ ràng.<br>• BẮT BUỘC có nút bấm `[Thử lại]` để gọi lại request mà không cần F5 toàn trang. | `03-error-retry.png` |
| **`STATE-04`** | **Permission Denied (403)** | Chặn API trả về `HTTP 403 Forbidden` | • Hiển thị cảnh báo từ chối quyền truy cập hoặc màn hình 403 rõ ràng.<br>• Có nút điều hướng an toàn quay về trạm làm việc chính của vai trò. | `04-permission-denied.png` |
| **`STATE-05`** | **Conflict / Write-Recon (409)** | Chặn mutation submit trả về `HTTP 409 Conflict` | • Dữ liệu trên bảng KHÔNG bị văng mất.<br>• Hiển thị alert xung đột dữ liệu đồng thời kèm nút bấm `[Tải lại dữ liệu mới nhất]`. | `05-conflict-reload.png` |
| **`STATE-06`** | **Active Success (Vận hành chuẩn)** | Nạp dữ liệu đầy đủ từ database thật hoặc response chuẩn | • Header 48px/56px và Subbar 40px/44px chuẩn kích thước.<br>• Bảng dữ liệu có sticky thead và frozen column.<br>• Đầy đủ số liệu định dạng `<Num>`, mã `<IdentifierText>`, ngày Việt Nam. | `06-active-workbench.png` |

---

## 3. Cấu Trúc Báo Cáo Nghiệm Thu Thị Giác (Artifact Structure)

Sau khi chạy kiểm chứng 1 route, kết quả được xuất vào thư mục:
```
.artifacts/visual-state-audits/<tên-route>/
├── 01-loading-skeleton.png
├── 02-empty-state.png
├── 03-error-retry.png
├── 04-permission-denied.png
├── 05-conflict-reload.png
├── 06-active-workbench.png
└── AUDIT-REPORT.md
```

Tệp `AUDIT-REPORT.md` ghi nhận:
- Bảng đối chiếu 6 trạng thái kèm kích thước ảnh (Retina 2x: 2560x1600).
- Chỉ số Layout Shift (CLS) đo được trong lúc chuyển trạng thái.
- Trạng thái các nút tương tác (Selector, Input, Modal, Button).
- Link trực tiếp tới từng file ảnh để người dùng tự mở kiểm tra bằng mắt.
