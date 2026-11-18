# Phục hồi phân bổ phiếu xuất lịch sử MRX

Khi phiếu xuất cũ có chứng từ hợp lệ nhưng thiếu mục đích, Thủ kho đối chiếu chứng từ và lập đề xuất theo dòng phiếu. Quản lý độc lập duyệt và áp dụng tại Duyệt vận hành. Admin có thể xác nhận trực tiếp, kèm căn cứ và dấu vết Admin. Hồ sơ bị từ chối được giữ lại để tra cứu.

Kho chỉ mở thao tác trên lô đang xuất, đúng ngày phục vụ. Mỗi đề xuất chỉ xử lý một dòng phiếu, dùng đơn vị đã khóa và phân bổ đủ phần chưa xác định. Có thể chia vào nhu cầu gốc, cấp ngoài nhu cầu hoặc dòng nhu cầu phát sinh có đủ căn cứ và đã duyệt trước thời điểm xuất. Tổng theo từng mục đích không vượt phần thiếu có thể chứng minh. Hệ thống đọc lại phiên bản lô, chứng từ, phân bổ và lượng trả khi áp dụng. Dữ liệu trả không đủ để xác định mục đích của một dòng có nhiều phân bổ tiếp tục bị chặn để đối chiếu.

Ghi nhận tạo các dòng phân bổ và lịch sử trong cùng giao dịch. Phiếu gốc, lượng xuất và trả, tồn kho vật lý, suất/BOM đóng băng được giữ nguyên. Sau áp dụng, bảng Kho, Chuẩn bị, báo cáo, Excel và điều kiện chốt đọc phép chiếu hiện có. Việc chốt vẫn là thao tác riêng. DEFAULT và lô đã chốt không mở thao tác phục hồi.

Trung tâm duyệt hiển thị mã phiếu, ngày, khách, nguyên liệu, đơn vị, lượng thiếu căn cứ, từng mục đích, người lập và lý do. Lệnh bị mất phản hồi được kiểm tra lại bằng mã lệnh cũ. Duyệt trùng, nhầm ngày, đổi phiên bản và hủy nhu cầu đang được tham chiếu đều phải có kết quả rõ ràng.
