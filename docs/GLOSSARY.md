# IPCManagement UI/UX glossary

Đây là từ điển nhãn nghiệp vụ dùng khi viết label, heading, button, tab, status và thông báo trong UI.
Nếu một thuật ngữ chưa có ở đây, đối chiếu [`DOMAIN.md`](DOMAIN.md) và bổ sung trước khi dùng rộng rãi.

| Thuật ngữ chuẩn | Không dùng thay thế | Nghĩa/ngữ cảnh |
|---|---|---|
| Điều phối | Coordinator ở nhãn người dùng | Vai trò chọn khách hàng/tuần, chốt số suất và kích hoạt nhu cầu |
| Thu mua | Purchasing/Procurement trong nhãn người dùng | Vai trò xử lý thiếu, báo giá, đề xuất và đơn mua |
| Kho | Warehouse trong nhãn người dùng | Vai trò nhận hàng, ghi movement, tồn kho và xuất kho |
| Bếp | Chef/Kitchen trong nhãn người dùng | Vai trò xem kế hoạch, kiểm đếm và xác nhận phiếu xuất |
| Quản lý | Manager trong nhãn người dùng | Vai trò hậu kiểm/phê duyệt theo separation of duties |
| Quản trị viên | Admin trong nhãn người dùng | Vai trò quản trị dữ liệu, quyền và thực thi được phép |
| Thực đơn tuần | Weekly menu | Work object theo customer và week |
| Nhu cầu nguyên liệu | Demand | Lượng nguyên liệu cần theo ngày/ca và scope phục vụ |
| Đề xuất mua hàng | Purchase request | Đề xuất phát sinh từ phần thiếu, chờ xử lý/phê duyệt |
| Đơn mua | Purchase order | Cam kết mua đã được tạo từ quy trình thu mua |
| Phiếu nhập | Receipt | Chứng từ hàng được Kho tiếp nhận và kiểm tra |
| Phiếu xuất | Inventory issue | Chứng từ Kho cấp nguyên liệu cho Bếp |
| Cấp bổ sung | Supplemental | Vòng cấp tiếp khi Bếp thiếu so với phiếu đã nhận |
| Dòng nguồn | Source-line | Dòng chứng từ gốc mà action nghiệp vụ tác động |
| Bút toán tồn kho | Movement | Một lần thay đổi tồn kho bất biến, có nguồn và actor |
| Chờ duyệt | Pending approval | Trạng thái chờ người có quyền thực hiện bước phê duyệt |
| Bản nháp | Draft | Đối tượng chưa được chốt hoặc gửi vào workflow |
| Đã hoàn tất | Completed | Workflow đã đi hết bước nghiệp vụ cần thiết |
| Bị từ chối | Rejected | Quyết định chặn đối tượng, luôn nêu được lý do |
| Cần đối soát chứng từ | Reconciliation required | Có dữ liệu/chứng từ vật lý cần kiểm tra trước khi tiếp tục |
| Đang tải | Loading | Chưa có snapshot dữ liệu cho query scope hiện tại |
| Đang cập nhật | Refreshing | Đang refetch nhưng giữ snapshot đang hiển thị |
| Không có dữ liệu | Empty | Query thành công nhưng không có bản ghi phù hợp scope |
| Không có quyền | Forbidden | Người dùng không có permission cho route hoặc query |

## Quy tắc dùng thuật ngữ

- Nhãn hiển thị ưu tiên tiếng Việt và ngôn ngữ công việc; enum/API key chỉ dùng trong code hoặc technical detail.
- Một khái niệm dùng một tên, một status label và một tone semantic trên toàn app.
- Không dùng tên bảng, tên cột, UUID, hash hoặc status kỹ thuật làm heading/label chính.
- Khi cần hiển thị mã, đặt tên dễ đọc trước, mã sau và cung cấp thao tác sao chép.
