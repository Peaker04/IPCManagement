# Workbook MRX cho thu mua và bếp

Phạm vi FR-WH, FR-RECON và FR-MENU. File đầy đủ có hai sheet. Nhu cầu nguyên liệu hiển thị tên, ĐVT và tổng nhu cầu. Nhóm và NCC ở đầu cụm. Khách hàng và ngày hoặc tuần nằm ở đầu sheet. Tên nguyên liệu trùng định danh được bổ sung mã phân biệt. Lượng là nhu cầu từ MRX.

Thực đơn cho bếp hiển thị khách, ngày, ca, loại thực đơn, món, số suất từ nguồn đóng băng. Phân biệt món trùng tên bằng mã khi cần. Giữ riêng mỗi lô ở mô hình dữ liệu; nếu dòng bếp có cùng ngữ cảnh và món nhưng khác lô thì ghi ký hiệu lô ngắn trên các dòng liên quan. Giữ legacy includeMenus=false.

Nghiệm thu trên clone với ba khách cùng tuần. Đối chiếu tổng lượng theo nguyên liệu, đơn vị và NCC với các lượt xuất riêng. Kiểm tra phạm vi bỏ chọn, món BOM nhiều thành phần, ngày/tuần, và XLSX tải từ trình duyệt. Xác minh Open XML và mở Excel thường.
