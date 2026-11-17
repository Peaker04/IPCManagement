# Đặc tả MRX — Xuất bổ sung và đồng bộ số liệu

Ngày 17/11/2026. Trạng thái **đã duyệt triển khai riêng cho MRX**. Phạm vi gồm Kho, Bếp, Chuẩn bị/Excel, Đối soát và Duyệt vận hành trong MRX. Căn cứ là truy vết code và ba ảnh người dùng cung cấp. Ca lệch số dưới đây là giả thiết kiểm thử suy ra từ công thức hiện tại, chưa phải kết quả tái hiện trên database.

## Mục tiêu và ràng buộc

- Một dòng nguyên liệu hợp lệ và lý do hợp lệ đủ để gửi phiếu xuất bổ sung. Người dùng phải biết điều kiện nào còn thiếu.
- Cùng lô, ngày và dòng nguyên liệu phải có cùng số thực xuất và cùng kết luận còn thiếu theo mục đích trên các trang liên quan.
- Giữ nguyên số suất và BOM gốc đã đóng băng, các khóa ngày/lô, quyền theo vai trò và lịch sử Admin ghi trực tiếp. MRX tách biệt DEFAULT. Sổ xuất MRX và tồn kho vật lý là hai phạm vi nghiệp vụ riêng.
- Dùng thành phần UI, token và mẫu trạng thái hiện có. Impeccable là bước kiểm duyệt FE trước chỉnh sửa và khi đối chiếu ảnh thực tế. Không thêm dependency hoặc migration cho thiết kế này.

## A1. Một phép tính nghiệp vụ dùng chung

Khóa đối chiếu là `batchId × serviceDate × dailyLineId`, với nguyên liệu và đơn vị chuẩn từ dòng đóng băng. Đọc số phiếu liên kết và lượng hoàn trả đã xác nhận theo quy tắc hiện hành. Dùng phân bổ đã ghi để xác định phần thực hiện định mức gốc, phần thực hiện **từng** đề nghị đã duyệt và phần cấp ngoài nhu cầu. Dùng lại các owner tính net và fulfillment hiện có.

| Giá trị | Ý nghĩa |
|---|---|
| Nhu cầu | Định mức gốc cộng nhu cầu phát sinh đã duyệt hoặc Admin ghi trực tiếp. |
| Tổng thực xuất ròng | Lượng xuất liên kết trừ lượng trả đã xác nhận, gồm cả cấp ngoài nhu cầu. |
| Còn thiếu | Thiếu gốc cộng phần thiếu từng nhu cầu đã duyệt trên cùng dòng và đơn vị. Dữ liệu không đủ căn cứ phân bổ phải hiện là chưa xác định. |
| Cấp ngoài nhu cầu | Lượng xuất được ghi riêng. Không bù cho gốc hoặc đề nghị và không tăng suất Bếp. |
| Chênh lệch số học | Thực xuất ròng trừ nhu cầu. Dùng để đối chiếu chứng từ, không thay thế kết luận còn thiếu theo mục đích. |

Ca bắt buộc: nhu cầu gốc 10 kg, nhu cầu đã duyệt 2 kg, xuất 10 kg cho gốc và 2 kg cấp ngoài. Hiển thị thực xuất 12 kg, chênh lệch số học 0, cấp ngoài 2 kg, còn thiếu theo đề nghị 2 kg. Kết quả chuẩn bị và workbook hiển thị phần thiếu. Sổ chênh lệch giữ được dòng bất thường dù chênh lệch số học bằng 0. Bếp dùng số suất đã được xác nhận. Chưa được chốt tuần khi thiếu theo mục đích. Không cộng bù giữa mục đích, ngày, khách hàng, nguyên liệu hoặc đơn vị. Với số liệu tổng hợp, chỉ cộng các đại lượng có cùng đơn vị và ý nghĩa, hoặc dùng số dòng cần xử lý thay cho một tổng vật lý không có đơn vị xác định.

- **Kho và Đối soát:** giữ được thực xuất và chứng từ, phản ánh phần thiếu theo mục đích, nhận diện trường hợp thiếu căn cứ và yêu cầu giải trình hợp lệ. Phiếu mới và trả hàng chỉ ảnh hưởng dòng liên kết theo quy tắc hiện hành.
- **Chuẩn bị/Excel:** UI và file dùng cùng số liệu theo phạm vi đã chọn. Giữ phần định mức gốc và từng đề nghị đã duyệt phân biệt được. Trạng thái đầy đủ của dòng gốc không lấy trực tiếp từ tổng thực xuất gồm cấp ngoài. Sự kiện chỉnh nguồn và phiếu thực xuất có định danh, nguyên nhân riêng, không bị đếm hai lần.
- **Bếp:** màn hình và phiếu nấu lấy suất gốc cộng suất phát sinh đã xác nhận. Xuất bù, cấp ngoài và trả hàng chỉ thay đổi số liệu giao nhận khi màn hình có hiển thị số đó.
- **Duyệt và chốt:** đề nghị chờ duyệt có hồ sơ riêng. Hồ sơ sẵn sàng chốt theo điều kiện hiện có và lệnh chốt kiểm tra lại trong giao dịch. Ngày đã có phiếu xuất vẫn khóa sửa nguồn. Chỉ mở xuất bổ sung hợp lệ khi lô còn mở. Lô đã chốt dùng để tra cứu. Hồ sơ cũ thiếu căn cứ giữ luồng tương thích, không tự phân bổ hay sửa chứng từ.

## A2. Dữ liệu mới sau thao tác

Sau ACK thành công của xuất ban đầu, xuất bổ sung, trả hàng đã xác nhận hoặc quyết định nhu cầu, cập nhật trang hiện tại và đánh dấu các lượt đọc phụ thuộc cần lấy lại dữ liệu. Invalidation theo mode và phạm vi thực tế, gồm phần tổng hợp ngày/tuần nếu có cùng dữ liệu. Trang đã mở trong phiên khác cần đọc lại khi quay lại tab hoặc bấm Làm mới. Không cam kết cập nhật tức thì khi tab vẫn đứng yên. Khi phản hồi cũ đến muộn, không để ghi đè trạng thái sau thao tác mới. Nếu chưa biết lệnh đã thành công, tiếp tục cơ chế khôi phục lệnh hiện có và không tự báo đã ghi.

## A3. Chọn nguyên liệu cần xuất

- **Cấp ngoài nhu cầu:** tìm/chọn theo tên hoặc mã trong các dòng hợp lệ của lô và ngày. Hiện danh sách đã chọn và lượng nhập. Gõ tìm hoặc đổi trang danh sách không làm mất dòng đã chọn.
- **Bù gốc / nhu cầu đã duyệt:** ưu tiên dòng còn thiếu của đúng mục đích. Cho xuất một phần hoặc nhiều đợt. Chặn số không hợp lệ, vượt lượng còn thiếu khi có giới hạn, và dữ liệu phân bổ chưa rõ. Dữ liệu mới làm nháp không còn hợp lệ cần được chỉ rõ trước khi gửi.
- Đặt lý do và phản hồi điều kiện còn thiếu gần thao tác. Phiếu chỉ gửi dòng có lượng hợp lệ do người dùng chọn. Giữ cơ chế nháp, khóa khi đang ghi, bảo vệ phiên bản và đối chiếu khi chưa rõ kết quả.

## A4. Bốn menu và Tùy chọn

**Đã xác nhận:** Sáng mặn, Sáng chay, Chiều mặn và Chiều chay tăng cùng số suất cho tất cả món trong menu đóng băng đã chọn của đúng lô/ngày. Tùy chọn mở chọn từng món, ca và loại suất.

Khi chọn cả nhóm, xem trước tên hoặc số món, suất tăng và nguyên liệu tính từ BOM. Menu rỗng hoặc có món bị chặn BOM phải báo rõ, không âm thầm bỏ món để tạo nhu cầu thiếu. Dùng khóa `dishId × shiftName × menuVariant`. Một lựa chọn chỉ được tính một lần. Khi trùng giữa menu và Tùy chọn, hiển thị cảnh báo và yêu cầu bỏ lựa chọn trùng trước khi lưu để giữ ý định về số suất. Dùng hợp đồng gửi danh sách món hiện có và kiểm tra server hiện có. Cùng món ở ca hoặc loại suất khác là lựa chọn riêng. Admin ghi nhận trực tiếp, Thủ kho gửi duyệt, Quản lý/Admin quyết định theo quyền hiện hành.

## A5. Chuyển chi tiết duyệt không nháy

Giữ danh sách, khung chi tiết và vùng thao tác khi chuyển A → B → C. Cập nhật dấu chọn ngay và hiển thị tín hiệu tải gọn. Nếu giữ nội dung trước trong khi chờ, phải nhận diện đó là hồ sơ trước và khóa mọi hành động sử dụng dữ liệu ấy. Chi tiết, lịch sử và nút chỉ hiện cho đúng mode, phạm vi hàng đợi, loại và mã hồ sơ. Phản hồi muộn của A/B không thay C. Lỗi tải có nút thử lại cho C. Kiểm tra cả split trên desktop và chuyển danh sách/chi tiết trên màn hẹp.
