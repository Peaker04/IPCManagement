# Ma trận gap luồng MVP trên web

Ngày review: 19/07/2026

## Kết luận

Luồng chính từ thực đơn đến nhận/trả nguyên liệu đã có endpoint BE. Gap làm người dùng không đi tiếp được nằm chủ yếu ở FE: endpoint tạo đề xuất mua chưa được expose, bảng server-page bị phân trang lần hai và một số nhãn `Tiếp theo` trông giống thao tác nhưng chỉ là text. Ba điểm này đã được xử lý trong lát cắt hiện tại.

## Đối chiếu từng bước

| Bước MVP | FE | BE | Kết luận | Việc còn lại |
|---|---|---|---|---|
| Đăng nhập/quyền | Route guard và menu theo permission | Login/profile/permission | Đủ | UAT bằng role thật |
| Import thực đơn | Wizard upload/validate/commit | Preview/commit/rollback | Đủ | UAT file mẫu |
| Số suất/sign-off | Toolbar có lock/sign-off/unlock | Coordination endpoints | Đủ | UAT trạng thái chuyển tiếp |
| Sinh demand | Nút thật và feedback | Generate/staleness | Đủ | UAT BOM lỗi và stale demand |
| Tạo đề xuất mua | Dialog chọn material request | `purchase-workflow/from-demand` | Đã sửa | Thêm endpoint danh sách candidate gọn hơn nếu dữ liệu vượt 100 dòng/page |
| Chọn NCC/gửi duyệt | Tab supplier và submit | Supplier patch/submit | Đủ | UAT validation giá/NCC |
| Duyệt | Action từng record | Inbox/decision/history | Đủ | UAT reject reason và permission |
| PO/nhận hàng | Action theo request/order | Create/receive/cancel | Đủ | UAT partial receipt |
| Xuất kho | Nút tạo issue | Create inventory issue | Chưa rõ lựa chọn | P1: dialog chọn material request và warehouse, không dùng dòng đầu tiên ngầm định |
| Bếp nhận/trả | Ký nhận và return/waste | Confirm receipt/return | Đủ cho nhận/trả | P1: yêu cầu bổ sung hiện chỉ lưu React state, không được báo như đã lưu hệ thống |
| Dashboard/báo cáo | Link theo route, báo cáo có server paging | Workflow reports | Đủ để quan sát | UAT với dataset lớn |

## Quy tắc refactor tiếp theo

1. Xóa UI cũ chỉ khi route/API replacement đã xác định hoặc UI cũ thực sự không còn caller.
2. Không dùng text dưới cột `Thao tác`. Text tư vấn dùng `Hướng xử lý`; thao tác phải là button/link có loading, success và error state.
3. Một bảng chỉ có một chủ sở hữu phân trang. Với API server-page, component bảng chỉ render `items`; page cha render pager.
4. Không hiển thị toast thành công cho dữ liệu chỉ nằm trong local state.
5. File đang bị caller ở commit gốc không được xóa riêng lẻ. `SwimlaneProgress.tsx` hiện không còn dùng trong working tree nhưng commit gốc của dashboard vẫn tham chiếu; chỉ xóa sau khi dashboard refactor được commit cùng dependency update.

## Thứ tự xử lý còn lại

1. Refactor `WarehousePage`: dialog chọn chứng từ demand + warehouse, validate các dòng trước khi tạo issue.
2. Chốt contract BE cho supplemental issue; sau đó thay local state trong `ChefDashboardPage` bằng mutation thật hoặc gỡ control khỏi production UI.
3. Tách `PurchasingPage`, `WeeklyMenuPage` và `ChefDashboardPage` thành feature sections để giảm file lớn và test từng hành động độc lập.
4. Chạy UAT end-to-end với seed DAV tuần 15/06/2026 và ghi bằng chứng cho từng mutation.
