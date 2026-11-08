# Đặc Tả Thiết Kế: Chuẩn Hóa Giao Diện Điều Hành Bếp Ăn & Đáp Ứng Đa Màn Hình

**Ngày lập:** 18/10/2026  
**Trạng thái:** Chờ Chủ sở hữu (Owner) Phê Duyệt (PENDING OWNER APPROVAL)  
**Tài liệu cha:** `docs/DESIGN.md`, `docs/UI-KIT.md`, `AGENTS.md`  
**Chuyên gia thiết kế:** Senior Frontend UI/UX Architect  
**Phạm vi:** Toàn bộ 14 Routes, 10 UI Primitives, 5 Composite Workbenches, Chuẩn hóa từ điển tiếng Việt nghiệp vụ Suất ăn Công nghiệp, và Bố cục Responsive Flex theo các độ phân giải tiêu chuẩn.

---

## 1. Mục Tiêu & Triết Lý Thiết Kế

1. **Thoát ly hoàn toàn ngôn từ máy móc / rò rỉ lập trình (`UXR-04` / `DOM-LANG-1`)**: Loại bỏ triệt để các từ ngữ kiểm thử (`persisted`, `authoritative`, `backend`), dịch thuật nửa vời (`Kilogram`, `ORDERED`), đưa vào từ vựng tự nhiên, chuẩn mực của ngành dịch vụ suất ăn công nghiệp Việt Nam (Industrial Catering & Food Service Logistics).
2. **Bố cục co giãn thông minh (Responsive & Density Flexing)**: Bảo toàn nguyên tắc 3-Zone Flat Workbench (`WorkspaceHeader` 56px, `TelemetrySubbar` 44px, `DataGrid/SplitView` 85% khung nhìn), tự động co giãn theo 4 độ phân giải tiêu chuẩn (Desktop 1440px, Desktop 1280px, Laptop/Tablet 1024px, Tablet 768px), không đè chữ, không cắt cụt số tiền hay mã chứng từ.
3. **Phân cấp hành động đơn nhất (`Rule D7`)**: Xóa bỏ hiện tượng cạnh tranh 2 nút Primary tại trang Phê duyệt (`/approvals`); mỗi vùng làm việc chỉ có duy nhất 1 nút Primary.
4. **Chữa lành bẫy trạng thái rỗng và lỗi chế độ (`Rule E1–E8`, `DOM-MODE-1`)**: Phân biệt bản chất lỗi 409 giữa tranh chấp đồng thời và sai chế độ vận hành; nâng cao độ tương phản icon empty state (từ 1.25:1 lên >= 3:1) và luôn có nút CTA hành động dẫn đường cho người vận hành.

---

## 2. Từ Điển Chuẩn Hóa Thuật Ngữ Nghiệp Vụ Bếp Ăn Công Nghiệp (Vietnamese Catering Lexicon)

| Ngữ cảnh hiện tại (Máy móc / Lỗi) | Vị trí xuất hiện | Thuật ngữ chuẩn hóa nghiệp vụ | Giải thích ý nghĩa nghiệp vụ |
|---|---|---|---|
| `756 nguyên liệu persisted` | `/admin-data` (Header) | `756 nguyên liệu danh mục` | Số lượng nguyên liệu trong danh mục định mức |
| `195 món ăn persisted` | `/admin-data` (Header) | `195 món ăn tiêu chuẩn` | Số lượng món ăn tiêu chuẩn của bếp ăn |
| `756 mặt hàng authoritative` | `/admin-data` (Subbar) | `Tổng số: 756 mặt hàng chính thức` | Dữ liệu chính thức được duyệt sử dụng |
| `Món ăn persisted` | `/meal-orders` (Cột bảng) | `Món ăn theo thực đơn ca` | Danh sách món ăn được duyệt phục vụ trong ca |
| `dòng kế hoạch persisted` | `/meal-orders` (Empty state)| `kế hoạch suất ăn được chốt` | Kế hoạch số lượng suất ăn đã được xác nhận |
| `{n} quy tắc persisted` | `/settings/approval-rules` | `{n} quy tắc phê duyệt hiệu lực` | Quy trình duyệt áp dụng cho các hạn mức |
| `Backend chưa có quy tắc persisted...` | `/settings/approval-rules` | `Chưa thiết lập quy tắc duyệt cho loại chứng từ này.` | Hướng dẫn cấu hình hệ thống |
| `Kilogram`, `Kilograms` | `/admin-data`, `/approvals` | `kg` | Đơn vị đo lường khối lượng chuẩn Việt Nam |
| `Kho đang hoạt` (vỡ dòng) | `/warehouse` (Header) | `Kho đang hoạt động` (`whitespace-nowrap`) | Trạng thái kho sẵn sàng nhập/xuất |
| `Chưa có nguồn tồn kho hiện tại...` | `/warehouse` (Empty state) | Thêm nút CTA: `[Xem phiếu nhập kho]` `[Xem phiếu xuất kho]` | Cung cấp lối thoát điều hướng |
| `Xung đột dữ liệu đồng thời (409)` khi ở DEFAULT | `/reconciliation` | `Phân hệ yêu cầu Chế độ Đối soát (MRX)` kèm nút `[Chuyển chế độ vận hành]` | Phân biệt chính xác `DOM-MODE-1` với Concurrency |
| Thiếu trạng thái trên bảng đơn PO | `/purchasing` (Master table) | Thêm cột `Trạng thái`: `Dự thảo`, `Đã đặt hàng`, `Nhận một phần`, `Đã nhận đủ` | Khả năng quét nhanh trạng thái PO |

---

## 3. Quy Chuẩn Flex Responsive Theo Các Màn Hình Tiêu Chuẩn

```
+-----------------------------------------------------------------------------------------+
|                                    APP SHELL                                            |
| +----------------------+ +------------------------------------------------------------+ |
| |   SIDEBAR V2 (N6)    | | WORKSPACE HEADER (Zone 1 - 56px)                           | |
| |                      | | Tiêu đề + Ngữ cảnh (Khách/Tuần/Kho) + Tối đa 1 Nút Primary | |
| | - Logo & Trạng thái  | +------------------------------------------------------------+ |
| | - 14 Routes / Leaf   | | TELEMETRY SUBBAR (Zone 2 - 44px)                           | |
| | - Guide line phân cấp| | Bộ chuyển view / ngày + Dải chỉ số phẳng (Inline Pills)   | |
| |                      | +------------------------------------------------------------+ |
| | Độ rộng:             | | ZONE 3: 85% VIEWPORT (calc(100dvh - 100px))                | |
| | Desktop: 240px       | | Single DataGrid HOẶC SplitView (Master 65% / Detail 35%)   | |
| | Laptop:  220px       | | - thead sticky cố định, 1 thanh cuộn dọc duy nhất          | |
| | Tablet:  64px (icon) | | - Cột 1 sticky cố định, các cột số dùng tabular-nums       | |
| | Mobile:  Drawer 0px  | | - Bảng min-width bảo vệ, cuộn ngang tự nhiên không đè chữ  | |
| +----------------------+ +------------------------------------------------------------+ |
+-----------------------------------------------------------------------------------------+
```

### 1. Màn hình Máy tính Bàn Tiêu chuẩn (Desktop >= 1440px)
- **Sidebar**: Mở rộng cố định `w-60` (240px).
- **SplitView**: Master Table chiếm `w-8/12` (66.6%), Detail Panel chiếm `w-4/12` (33.3%).
- **DataGrid**: Hiển thị đầy đủ tất cả các cột với độ rộng thoải mái: Cột Mã (140px-180px), Tên hàng (240px-320px), Số lượng/Đơn giá (120px-160px), Trạng thái (110px-130px). Tuyệt đối không cắt cụt số tiền hay mã chứng từ.

### 2. Màn hình Laptop Tiêu chuẩn (Desktop 1280px – 1439px)
- **Sidebar**: `w-56` (224px) hoặc cho phép thu gọn thành `w-16` (64px) bằng nút hamburger.
- **SplitView**: Master Table chiếm `w-7/12` (58.3%), Detail Panel chiếm `w-5/12` (41.7%).
- **DataGrid**: Bảng áp dụng `min-w-[760px]`. Cột định danh đầu tiên (`colIdx === 0`) cố định `sticky left-0 bg-slate-100`. Cột `QUY MÔ` trong Approvals có độ rộng tối thiểu 130px đảm bảo số `2.558,82 kg` không chạm viền.

### 3. Màn hình Laptop Nhỏ / Tablet Ngang (1024px – 1279px)
- **Sidebar**: Tự động thu gọn thành thanh icon `w-16` (64px) có tooltip tên phân hệ, giải phóng không gian cho vùng làm việc chính.
- **SplitView**: Tự động chuyển đổi: Nếu người dùng chưa chọn bản ghi, Master chiếm 100%; khi nhấp chọn 1 bản ghi, Detail Panel trượt ra từ cạnh phải chiếm 45% hoặc Master/Detail chia 55% / 45%.
- **DataGrid**: Bảng có thanh cuộn ngang mượt mà, tiêu đề cột ngắn gọn súc tích (`Giá trị` thay vì `GIÁ TRỊ / KHỐI LƯỢNG`).

### 4. Màn hình Tablet Dọc / Màn hình Công nghiệp (768px – 1023px)
- **Sidebar**: Thanh icon `w-16` hoặc Drawer trượt ẩn có nút kích hoạt.
- **Header & Subbar**: Các bộ chọn (Select khách hàng, Input ngày) co giãn `flex-wrap` hoặc cuộn ngang với `scrollbar-none`.
- **DataGrid**: Kích thước chữ duy trì đúng `12px–13px` (`Rule D6`), chiều cao dòng `40px` (`Rule T8`).

---

## 4. Đặc Tả Từng Phân Hệ Cụ Thể

### 4.1. Dashboard (`/`)
- Tái cấu trúc 5 ô chỉ số tại Zone 2:
  - Cấu trúc: Hàng 1 nhãn chữ nhỏ (`text-xs text-slate-500 font-medium`), Hàng 2 số lượng to in đậm (`text-base font-bold text-slate-900 font-mono`) kèm nhãn trạng thái tinh gọn.
  - Loại bỏ các badge nổi đè chữ.
- Nâng cấp Empty State: Thay thế khối xám nhạt bằng icon `Inbox` hoặc `CheckCircle2` màu `stroke-slate-400` rõ ràng.

### 4.2. Hàng Đợi Phê Duyệt (`/approvals`)
- **Giải quyết Rule D7**:
  - Tại `WorkspaceHeader`: Chuyển nút `Phê duyệt yêu cầu đang chọn` thành nút Outline phụ hoặc loại bỏ hoàn toàn khỏi Header.
  - Tại `Detail Drawer`: Nút `Phê duyệt hồ sơ` là **Primary Action duy nhất** (nơi người dùng có đủ thông tin để ra quyết định an toàn).
- **Tỷ lệ cột**: Tăng min-width cho cột `QUY MÔ` (130px), rút gọn tiêu đề cột thành `Quy mô (kg/₫)`.
- **Chuẩn hóa ĐVT**: Chuyển đổi toàn bộ `Kilogram` thành `kg`.

### 4.3. Thu Mua & Đề Xuất PO (`/purchasing`)
- **Bổ sung cột Trạng thái trên Master Table**:
  - Cột mới: `Trạng thái` (width: 14%, min-width: 110px) đặt cạnh `Tổng tiền`.
  - Hiển thị Badge: `Dự thảo` (neutral), `Đã đặt hàng` (warning), `Nhận một phần` (warning), `Đã nhận đủ` (success).
- **Mở rộng cột Mã PO**: Cho phép chip mã PO hiển thị đầy đủ hoặc hiển thị 16 ký tự đầu kèm icon copy nhanh.

### 4.4. Kho Nguyên Liệu (`/warehouse`)
- **Sửa lỗi vỡ dòng Badge**: Thêm `whitespace-nowrap shrink-0` vào thẻ `Kho đang hoạt động`.
- **Bổ sung CTA cho Tồn kho rỗng**: Khi ở view `stock` chưa có snapshot, hiển thị 2 nút CTA: `[Xem phiếu xuất kho]` và `[Xem phiếu nhập kho]`.

### 4.5. Đối Soát Nguyên Liệu (`/reconciliation`)
- **Tái cấu trúc StateBoundary cho lỗi 409**:
  - Nếu `error.message` chứa ngữ cảnh sai chế độ (DEFAULT mode): Hiển thị tiêu đề *"Phân hệ yêu cầu Chế độ Đối soát nguyên liệu (MRX)"*, mô tả *"Hệ thống đang chạy ở Chế độ Mặc định. Vui lòng chuyển sang Chế độ MRX trong phần Thiết lập nâng cao để kích hoạt tính năng này."*, nút CTA *"Chuyển chế độ vận hành"*.
  - Nếu là 409 Concurrency thật (trùng version token): Giữ nguyên thông báo xung đột dữ liệu.

### 4.6. Quản Trị Dữ Liệu (`/admin-data`)
- **Phân bổ lại tỷ lệ cột Danh mục Nguyên liệu (Tổng chính xác 100%)**:
  - Mã nguyên liệu: 15% (min-w 130px)
  - Tên nguyên liệu: 27% (min-w 200px)
  - ĐVT: 8% (min-w 60px)
  - Kho quản lý: 16% (min-w 130px)
  - Đơn giá tham chiếu: 14% (min-w 120px)
  - Loại hàng: 10% (min-w 95px)
  - Trạng thái: 10% (min-w 105px)
  - *Kết quả*: Badge `Đang áp dụng` (95px) và `Tươi sống` (85px) hiển thị nguyên vẹn 100%, không bị cắt chữ `Đang áp dụn`.

### 4.7. Điều Phối Đơn Ăn (`/meal-orders`) & Quy Trình Duyệt (`/settings/approval-rules`)
- Chuẩn hóa tổng % các cột về đúng 100%.
- Thay thế toàn bộ chữ `persisted` thành tiếng Việt nghiệp vụ.
