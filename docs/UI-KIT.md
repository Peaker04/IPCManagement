# UI Kit & Component Catalog — IPC Management (Zero AI-Slop Workbench)

> Authority chain: `docs/DESIGN.md` (Presentation Contract) → file này (3-Zone Flat Workbench Catalog) → `frontend/src/styles/index.css` (Design Tokens).
> Tiêu chuẩn kiểm thử và browser verification: tham chiếu [ENGINEERING](ENGINEERING.md).

---

## 1. Triết Lý Thiết Kế: 3-Zone Flat Workbench (Zero AI-Slop)

Hệ thống vận hành công nghiệp loại bỏ hoàn toàn mô hình giao diện "AI Slop" cũ (thẻ lồng thẻ, hộp KPI cồng kềnh 120px, bộ lọc đóng khung chiếm hết diện tích). Thay vào đó, toàn bộ màn hình là một mặt phẳng liên tục, phân tách bằng đường kẻ hairline `1px solid var(--border-subtle)`:

1. **Luật 1 (`Zero Box-in-Box`)**: Cấm tuyệt đối bọc bộ lọc trong 1 hộp trắng, KPI trong 3 hộp trắng, rồi bảng trong 1 hộp trắng nữa. Không dùng shadows nhiều lớp hay thẻ `<details>` che khuất luồng công việc.
2. **Luật 2 (`85% Viewport for Data`)**: Dành trọn tối thiểu 85% chiều cao khung nhìn (`calc(100dvh - 88px)`) cho bảng dữ liệu chính với duy nhất 1 thanh cuộn dọc mượt mà.
3. **Luật 3 (`Compact Operational Density`)**: Dòng bảng cao `36px–40px` (`Rule T8`), số liệu dùng font `tabular-nums` căn phải, mã đối tượng dùng font monospace có nút copy nhanh.

### 1.1. Bảng Ánh Xạ Hợp Nhất 5 Nhóm Component Cũ Sang 3-Zone Flat Workbench

Toàn bộ 45+ file rời rạc trước đây trong thư mục `components/common/` đã được tái cấu trúc triệt để thành mô hình 3-Zone Flat Workbench và UI Primitives chuẩn:

| Nhóm chức năng cũ trong `common/` | Thành phần cũ | Thành phần thay thế chuẩn hóa (3-Zone) | Vị trí thư mục chuẩn |
| :--- | :--- | :--- | :--- |
| **Nhóm A: Layout & Shell** (9 components) | `OperationalFrame`, `CommandBar`, `PageBanner`, `ContextStrip`, `SectionPanel`, `DocumentRail`, `SideRail`, `PageStepper` | `AppShell`<br>`WorkspaceHeader` (Zone 1: h-12 / 48px)<br>`TelemetrySubbar` (Zone 2: h-10 / 40px) | `frontend/src/components/workbench/` |
| **Nhóm B: Table & Pagination** (8 components) | `TableViewport`, `PaginatedTableFrame`, `PaginationBar`, `CursorPaginationBar`, `TablePreferencesControl`, `TableSkeleton`, `SkeletonTableRow`, `TableEmptyState` | `DataGrid` (Zone 3: sticky header, inline pagination)<br>`SplitView` (Master-Detail)<br>`WorkbenchSkeleton` | `frontend/src/components/workbench/` |
| **Nhóm C: State & Feedback** (9 components) | `QueryViewBoundary`, `QueryErrorAlert`, `EmptyState`, `InlineAlert`, `InfoNote`, `FieldError`, `ToastProvider`, `ServiceRunBlockerPanel`, `DiagnosticPanel` | `StateBoundary` (quản trị đủ 6 trạng thái UI)<br>`ReconciliationBlockerStrip` | `frontend/src/components/workbench/`<br>`frontend/src/features/reconciliation/` |
| **Nhóm D: Formatting & Guards** (9 components) | `Num`, `IdentifierText`, `StatusBadge`, `NotificationBadge`, `ActionGuard`, `ActionAvailability`, `SearchField`, `FieldRow`, `ViewSwitcher`, `KeepAliveTabPanel`, `RefreshStatus` | 10 UI Primitives chuẩn WCAG AA: `Button`, `Input`, `Select`, `Badge`, `Checkbox`, `Num`, `IdentifierText`, `VietnameseDateInput`, `Modal`, `Tabs`, `ActionGuard` | `frontend/src/components/ui/` |
| **Nhóm E: Domain Components** (5 components đặt nhầm) | `StockMovementTable`<br>`DemandSummary`<br>`ApprovalQueue`<br>`RoleInbox`<br>`ExceptionLane` | Chuyển về đúng phân hệ nghiệp vụ sở hữu | `features/warehouse/`<br>`features/weekly-menu/views/`<br>`features/approvals/`<br>`features/dashboard/`<br>`features/reconciliation/` |

---

## 2. 10 UI Primitives (`frontend/src/components/ui/`)

Các primitives cơ bản đạt chuẩn WCAG 2.1 AA, quản lý tương tác và khả năng tiếp cận:

| Component | File Path | Props chính | Quy tắc ràng buộc |
|---|---|---|---|
| `Button` | `components/ui/button.tsx` | variant: `default`, `outline`, `ghost`, `destructive`, `link`; size: `xs`, `sm`, `default` | `D7` (tối đa 1 primary/khu vực), chiều cao chuẩn 32px (h-8) |
| `Input` | `components/ui/input.tsx` | type: `text`, `number`, `search`; size: `sm`, `default` | `D6` (font >= 12px), border hairline, focus ring chuẩn |
| `Select` | `components/ui/select.tsx` | options: `{value, label}[]`, size: `sm` | `I1–I4`, h-8 trong header/telemetry bar |
| `Badge` | `components/ui/badge.tsx` | variant: `default`, `neutral`, `success`, `warning`, `danger`, `info` | Pill phẳng, không đổ bóng, nhãn ngắn gọn |
| `Checkbox` | `components/ui/checkbox.tsx` | checked: boolean / `indeterminate` | Hỗ trợ phím Space/Enter, focus rõ ràng |
| `Num` | `components/ui/num.tsx` | value: number, format: `currency`, `quantity`, `percent` | `T1`, `T3`: Font `tabular-nums`, căn phải, phân cách hàng nghìn `.` |
| `IdentifierText` | `components/ui/identifier-text.tsx` | code: string, copyable: boolean | `L1`, `L7`: Monospace, hover hiển thị icon copy |
| `VietnameseDateInput` | `components/ui/vietnamese-date-input.tsx` | value: `string` (dd/MM/yyyy) | Định dạng ngày Việt Nam tự nhiên, validation ngày hợp lệ |
| `Modal` | `components/ui/modal.tsx` | isOpen, onClose, title, children, footer | `M1.2`: Tối đa 1 modal chặn, focus trap, Escape để đóng |
| `Tabs` | `components/ui/tabs.tsx` | items: `{id, label, count?}[]`, activeId, onChange | Segmented switch phẳng, `h-8`, hỗ trợ phím mũi tên |

---

## 3. 5 Khung Bố Cục Phẳng (`frontend/src/components/workbench/`)

### 1. `AppShell` (`components/workbench/AppShell.tsx`)
- **Cấu trúc**:
  - Sidebar trái `w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col h-dvh`: Chứa logo, các nhóm chức năng có nút thu gọn accessible `<button type="button" aria-expanded>`, và danh sách 14 canonical routes bằng `<NavLink aria-current="page">`.
  - Khung làm việc phải `flex-1 min-w-0 h-dvh flex flex-col overflow-hidden bg-slate-50/50`.

### 2. `WorkspaceHeader` (`components/workbench/WorkspaceHeader.tsx`) — Zone 1
- **Kích thước**: Cao đúng **`48px`** (`h-12 shrink-0 border-b border-slate-200 bg-white px-4 flex items-center justify-between gap-3`).
- **Nội dung**:
  - *Bên trái*: Tiêu đề trang (`text-sm font-semibold text-slate-900`) + Bộ chọn ngữ cảnh vận hành nằm ngang (Khách hàng select `w-52`, Tuần bắt đầu date input `w-36`, Pill định mức ca `Định mức: 25.000 ₫`).
  - *Bên phải*: Tối đa **1 nút primary** (`Rule D7`) + 1 nút outline tiện ích (`h-8`).

### 3. `TelemetrySubbar` (`components/workbench/TelemetrySubbar.tsx`) — Zone 2
- **Kích thước**: Cao đúng **`40px`** (`h-10 shrink-0 border-b border-slate-200 bg-slate-50 px-4 flex items-center justify-between gap-3`).
- **Nội dung**:
  - *Bên trái*: Bộ chuyển ngày nhanh `[<] Thứ Hai, 21/09/2026 (1/6) [>]` hoặc Segmented View Switcher.
  - *Bên phải*: **Inline Telemetry Pills** nằm ngang trên 1 dòng duy nhất (`KHSX: 14 dòng` · `Ca: 2/2` · `Chờ xuất: 29/29` · `Chờ duyệt`). **Cấm tuyệt đối các hộp KPI Card cao 120px!**

### 4. `DataGrid` (`components/workbench/DataGrid.tsx`) — Zone 3 (Single Grid)
- **Kích thước**: Chiếm trọn **`85% chiều cao khung nhìn`** (`flex-1 min-h-0 overflow-auto`).
- **Quy cách**:
  - Duy nhất 1 thanh cuộn dọc mượt mà cho toàn bảng.
  - `thead` cố định (`sticky top-0 z-10 bg-slate-100 border-b border-slate-200`).
  - Dòng dữ liệu cao `36px–40px` (`Rule T8`), hover nhẹ nhàng `hover:bg-slate-50/80`.
  - Cột số căn phải qua `<Num>`, mã qua `<IdentifierText>`.

### 5. `SplitView` (`components/workbench/SplitView.tsx`) — Zone 3 (Master-Detail)
- **Kích thước**: Chiếm trọn `flex-1 min-h-0 overflow-hidden flex`.
- **Cấu trúc**:
  - Cột chính (Master table) chiếm 60–65% chiều rộng, cuộn dọc độc lập.
  - Cột chi tiết (Detail panel) chiếm 35–40% chiều rộng, phân cách bằng đường kẻ `border-l border-slate-200`, có header tabs chuyển đổi ngữ cảnh gọn gàng.

### Thành phần bổ trợ: `StateBoundary` (`components/workbench/StateBoundary.tsx`)
Quản lý 6 trạng thái UI sắc nét:
- `loading`: Skeleton phẳng phải giữ route/work-object context và khớp `geometryContract` đã khai báo (toolbar, số cột, master-detail, vùng cuộn); skeleton không được chứa bản ghi giả, số liệu nghiệp vụ giả hoặc ngụ ý success.
- `empty`: 4 kịch bản rõ ràng:
  1. *True Empty*: Chưa có bản ghi nào, có nút tạo mới.
  2. *Prerequisite Blocked*: Thiếu dữ liệu từ bước trước, có nút hướng dẫn chuyển sang bước trước.
  3. *Partial Data*: Dữ liệu đang hoàn thiện dở dang.
  4. *Filter Empty*: Bộ lọc không tìm thấy kết quả, có nút xóa bộ lọc.
- `error`: Thông báo lỗi mạng/hệ thống kèm nút "Thử lại".
- `permission-denied`: Trạng thái 403 khi không đủ quyền.
