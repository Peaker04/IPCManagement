# Ma trận gap luồng MVP trên web

Ngày review: 19/07/2026

## Kết luận

Luồng chính từ thực đơn đến nhận/trả nguyên liệu đã có endpoint BE. Các blocker FE phân trang kép, nhãn thao tác giả, thiếu mutation tạo đề xuất mua và lựa chọn kho ngầm định đã được xử lý. Control yêu cầu bổ sung chỉ lưu local state đã được gỡ khỏi production UI.

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
| Xuất kho | Dialog bắt buộc chọn nhu cầu và kho | Create inventory issue | Đã sửa | UAT nhiều kho/chứng từ |
| Bếp nhận/trả/bổ sung | Ký nhận, return/waste và dialog yêu cầu cấp bổ sung | Confirm receipt/return; POST supplemental request lưu `PENDING` | Đủ để bếp gửi yêu cầu thật | Bổ sung bước kho xử lý/đóng yêu cầu nếu mở rộng sau MVP |
| Dashboard/báo cáo | Link theo route, báo cáo có server paging | Workflow reports | Đủ để quan sát | UAT với dataset lớn |

## Quy tắc refactor tiếp theo

1. Xóa UI cũ chỉ khi route/API replacement đã xác định hoặc UI cũ thực sự không còn caller.
2. Không dùng text dưới cột `Thao tác`. Text tư vấn dùng `Hướng xử lý`; thao tác phải là button/link có loading, success và error state.
3. Một bảng chỉ có một chủ sở hữu phân trang. Với API server-page, component bảng chỉ render `items`; page cha render pager.
4. Không hiển thị toast thành công cho dữ liệu chỉ nằm trong local state.
5. File đang bị caller ở commit gốc không được xóa riêng lẻ. `SwimlaneProgress.tsx` hiện không còn dùng trong working tree nhưng commit gốc của dashboard vẫn tham chiếu; chỉ xóa sau khi dashboard refactor được commit cùng dependency update.

## Thứ tự xử lý còn lại

1. Bổ sung endpoint candidate distinct có server paging cho material request thay vì gom tối đa 100 dòng ở client.
2. Đã chốt contract và nối mutation lưu supplemental request `PENDING`; không dùng local state làm bằng chứng thành công.
3. Tách `PurchasingPage`, `WeeklyMenuPage` và `ChefDashboardPage` thành feature sections để giảm file lớn và test từng hành động độc lập.
4. Chạy UAT end-to-end với seed DAV tuần 15/06/2026 và ghi bằng chứng cho từng mutation.
