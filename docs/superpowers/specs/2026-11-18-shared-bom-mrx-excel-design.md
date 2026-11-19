# BOM dùng chung và hai file Excel MRX

**Ngày** 18/11/2026 · **Phạm vi** FR-CAT, FR-MENU, FR-WH, FR-CHEF, FR-RECON · **Thực hiện** native trong IPCManagement.

**Khóa phạm vi triển khai** BOM mới, Excel Kho và Excel Bếp trong tài liệu này chỉ áp dụng ở `MATERIAL_RECONCILIATION`. Triển khai BOM trước. Trang BOM MRX cho tải toàn bộ BOM dùng chung của một mốc tại mỗi lần tải để người dùng chỉnh đủ ba mốc. Luồng DEFAULT giữ hợp đồng cũ.

## 1. Quyết định thiết kế

Các thao tác bổ sung BOM mới trong luồng chuẩn ghi vào danh mục dùng chung. BOM vẫn có ba mốc giá do máy chủ quản lý, hiện là 25.000, 30.000 và 34.000 ₫. Mỗi công thức thuộc đúng một mốc giá. Khách hàng, tuần và phiên bản thực đơn xác định phạm vi kiểm tra thiếu BOM. Ngày phục vụ xác định ngày cần công thức có hiệu lực.

Hai trang MRX phục vụ hai công việc. Kho xuất nhu cầu nguyên liệu gom theo **NCC thực tế**. Bếp xuất phiếu nấu theo thứ/ngày, ca, khách hàng, thực đơn và món. Danh sách khách hàng sắp gửi dùng để kiểm tra lại nguyên liệu thuộc NCC nào và hiển thị đúng nhóm NCC trong file Kho. Đây là đầu vào của cùng hạng mục xuất Kho.

### Các phương án đã xem xét

| Phương án | Hệ quả |
|---|---|
| Sửa nhãn, giữ modal theo khách và file hai sheet ở Kho | Ít sửa giao diện nhưng vẫn có thể ghi BOM riêng hoặc sai mốc. Bếp tiếp tục phải tải từng lô. |
| Dùng ngữ cảnh tuần để bổ sung BOM chung, xuất riêng theo vai trò | **Đã chọn.** Tái sử dụng owner BOM và dữ liệu đóng băng. Cần phân biệt phạm vi đọc thực đơn với phạm vi ghi BOM và mở rộng xuất Bếp theo các lô được chọn. |
| Chuyển toàn bộ dữ liệu sang BOM chung ngay | Phải xử lý các công thức riêng đã có hiệu lực và tác động đến thực đơn tương lai. Đây là quyết định dữ liệu riêng của chủ nghiệp vụ. |

**Mặc định chuyển tiếp đề xuất:** resolver tiếp tục đọc BOM riêng lịch sử theo thứ tự ưu tiên hiện tại. Thao tác bổ sung chuẩn ghi BOM chung. Giữ hợp đồng đọc/xuất đang dùng cho client cũ trong lúc chuyển nút trên hai trang. Mọi thay đổi precedence, chuyển dữ liệu riêng hoặc thay hợp đồng legacy cần quyết định riêng. Giữ cô lập DEFAULT/MRX, quyền hiện hữu, lịch sử và nguồn đóng băng. Phân nhóm NCC áp dụng cho file Kho MRX.

## 2. Thực đơn → bổ sung BOM

- **BOM-01.** Sau khi lưu thực đơn MRX và tải đúng phiên bản tuần, hiển thị trạng thái thành công và badge `3 món thiếu BOM` khi máy chủ xác nhận. Đếm món phân biệt theo ID, liệt kê ngày/ca bị ảnh hưởng. Máy chủ phân biệt thiếu công thức có hiệu lực, lỗi định lượng khác và trạng thái chưa kiểm tra được. Có thể kiểm tra độ phủ công thức trước khi nhập đủ số suất. Việc chốt định lượng vẫn dùng luồng preview/commit hiện có.
- **BOM-02.** Thao tác chính `Bổ sung BOM` mở một modal theo tuần. Ngữ cảnh đọc khóa theo khách hàng, tuần, phiên bản thực đơn và mốc giá từ lịch đã lưu. Thiếu, trộn hoặc sai mốc giá làm rõ lý do và khóa ghi. Form hiện `Dùng chung` và ngày hiệu lực đề xuất từ ngày phục vụ thiếu. Nút ghi chỉ hiện khi route, capability và quyền ghi Catalog hiện có cho phép. Người có quyền đọc tuần xem được chi tiết để chuyển cho người có quyền bổ sung.
- **BOM-03.** Kiểm tra BOM hiện hành theo resolver hiện có. Khi ghi, máy chủ đọc lại đúng phạm vi tuần và giới hạn món/ngày theo danh sách thiếu đã xác minh. Với mỗi món, chọn khoảng bao phủ ngày thiếu và tôn trọng các ranh giới phiên bản đã có. Khoảng có xung đột hoặc các ngày thiếu không liên tục được xử lý tường minh theo các khoảng hợp lệ. Thiếu dữ liệu/ngày trùng, preview cũ, tuần đổi phiên bản hoặc một ghi song song phải dẫn đến kiểm tra lại, giữ file/draft nếu còn phù hợp. Giữ quy tắc version/status và transaction hiện tại. Không viết lại nguồn các lô đã đóng băng. Sau commit, làm mới catalog và kiểm tra lại đúng phạm vi thực đơn, giữ tuần/khách và vị trí làm việc.
- **BOM-04.** Tại trang BOM, quy trình chuẩn mở đúng mốc đang lọc hoặc yêu cầu chọn một mốc khi chưa xác định. Một nút chính `Nhập BOM Excel`. Trong quy trình, `Tải mẫu món thiếu` hoặc `Tải mẫu món đang chọn` có phạm vi ghi rõ, tiếp theo là `Tải file đã điền lên` và `Xác nhận nhập`. Tách `Xuất toàn bộ BOM` thành lệnh phụ rõ nghĩa. Giữ editor từng món trên owner hiện hữu và dùng phạm vi chung cho tạo mới chuẩn.
- **BOM-05.** Mẫu có cột mã món hiển thị, tên món, nguyên liệu, ĐVT, định lượng/suất và các trường tùy chọn hiện hữu. Mỗi dòng dữ liệu gắn một mã món và một nguyên liệu. Nội dung theo tuần chỉ có món cần bổ sung, xếp món mới trong lần nhập nếu có bằng chứng bền vững, sau đó theo ngày phục vụ sớm nhất và mã món. Mỗi món thiếu BOM có năm dòng trống cho từng khoảng hiệu lực. Mã món hiển thị một dòng. Hai cột ngày hiệu lực được ẩn và giữ trong file để nhập lại. Người dùng chèn, sao chép và xóa dòng trong tab nhập. Dòng hướng dẫn tra được mã món và, khi cần, phân biệt các khoảng thiếu của cùng mã. Máy chủ kiểm tra khóa món/khoảng ngày, nguyên liệu, đơn vị, dòng trùng và số lượng theo giới hạn upload hiện hữu. Xóa dòng trong Excel chỉ loại nó khỏi lần nhập. Xem trước hiện rõ tạo mới, cập nhật, bỏ qua và lỗi đến từng dòng. File cũ tiếp tục đi qua parser hiện hữu theo hợp đồng cũ.

## 3. Excel Kho và Bếp

- **XLS-01.** `/warehouse?view=mrx-preparation` hiển thị `Xuất nhu cầu theo NCC`. File dùng ngày hoặc tuần và đúng tập lô đã chọn. Sheet nhu cầu ghi phạm vi/khách ở đầu, rồi **NCC → Nguyên liệu · ĐVT · Tổng cần chuẩn bị**. Cộng theo định danh NCC, nguyên liệu và đơn vị. Lượng theo NCC ứng với từng ngày phục vụ trước khi cộng tuần. Giữ riêng các dòng có mã nguyên liệu khác dù tên giống. Có cụm **Cần xác minh NCC** với lý do thiếu hoặc nhiều NCC. Mỗi lượng xuất hiện đúng một lần. Dữ liệu từ định lượng MRX đã đóng băng, không phát sinh chứng từ hay thay tồn.
- **XLS-02.** Kiểm tra file danh sách do khách cung cấp theo định danh NCC và nguyên liệu/đơn vị. Mã có thể ánh xạ trực tiếp khi khớp duy nhất. Tên hoặc alias chỉ hỗ trợ tìm ứng viên. Ghi nhận file/hash, sheet/dòng, mã NCC, mã nguyên liệu và kết quả từng dòng. Trường hợp trùng, thiếu mã, ĐVT sai, khác dữ liệu hiệu lực hoặc chưa rõ ngày áp dụng phải có quyết định có căn cứ. Khi chưa nhận danh sách, file Kho vẫn nhóm bằng quan hệ NCC đã xác định từ báo giá hiệu lực hiện có và hiển thị ngoại lệ. Dùng báo cáo đối soát/đường quản trị hiện hữu khi phù hợp. Thay đổi dữ liệu áp dụng chỉ khi mapping và phạm vi ghi đã được duyệt. Đợt nghiệm thu với danh sách khách phải đối chiếu nguyên liệu vào đúng nhóm NCC và giữ tổng lượng. Danh sách này không thay đổi ba mốc giá BOM, nhóm chuẩn bị nguyên liệu hay dữ liệu giá báo.
- **XLS-03.** `/chef?view=mrx-cooking` hiển thị `Xuất phiếu nấu Excel`. Mặc định chọn lô đang xem và ca đang lọc. Người dùng có thể chọn một hoặc nhiều lô trong tuần, ngày cụ thể hoặc cả tuần, ca Sáng/Chiều/Cả ngày. Thứ tự là **thứ/ngày → ca → khách hàng → Mặn/Chay → món**. Số suất xuất hiện một lần mỗi cụm món. Các dòng dưới ghi nguyên liệu, ĐVT, định lượng/suất và tổng cần. Khách nằm ở cột/cụm cố định, kể cả khi chọn nhiều khách. Giữ riêng các lô cùng khách khi cần phân biệt. Thiếu lineage thì máy chủ chỉ rõ lô không đủ điều kiện và báo lỗi trước khi trả file. Định lượng/suất thiếu dữ kiện quy đổi hiển thị trạng thái thiếu theo rule hiện tại. Nguồn là dữ liệu đóng băng của từng lô, với điều chỉnh nguồn hợp lệ trong MRX nếu có. Khổ A4 ngang, một trang theo chiều rộng, lặp dòng đầu cột. CSV/in cũ giữ hành vi và nhãn phạm vi rõ ràng.
- **XLS-04.** Kho và Bếp giữ quyền export MRX riêng ở API. Dữ liệu đang tải, phạm vi đã cũ hoặc thiếu quyền khóa xuất. Nút ghi rõ phạm vi áp dụng. Hợp đồng workbook Kho cũ `includeMenus=true|false` và URL tải theo một lô của Bếp tiếp tục đáp ứng caller cũ. File Bếp phục vụ sản xuất, không chứa NCC, giá hay dữ liệu thu mua.

Mẫu một bảng đã duyệt thay phần trình bày của XLS-03. Mỗi cụm giữ riêng ngày, ca và loại thực đơn. Các khách có cùng công thức đóng băng dùng chung một danh sách nguyên liệu. Tên món, tổng suất, số suất mỗi khách hoặc lô và ghi chú gộp theo cụm. Khách có công thức khác nằm ở cụm khác. Cột ghi chú nằm ngoài cùng bên phải. Khi số cột khách vượt chiều rộng phù hợp để in A4, phần phân bổ chuyển thành các dòng trong một cột và giữ lượng nguyên liệu chỉ một lần.

## 4. Nghiệm thu

| Ca kiểm tra | Kết quả cần thấy |
|---|---|
| Mốc 25.000 / 30.000 / 34.000 ₫, tuần có khách khác và món trùng qua nhiều ca | Đúng mốc theo lịch, badge đếm món một lần, form ghi dùng chung đúng phạm vi. Đổi tuần hoặc giá làm mất hiệu lực preview cũ. |
| Có BOM riêng cũ, lỗi khác loại và người dùng không có quyền ghi | Resolver trả đúng công thức đang hiệu lực. Lỗi có nhãn đúng nguyên nhân. UI/API tôn trọng quyền ghi. |
| 1, 8 và 12 nguyên liệu, chèn/xóa ở giữa và cuối | Excel thật mở/lưu bình thường, nhập đúng dữ liệu dòng thêm, thể hiện đúng lỗi và giữ dòng lịch sử. |
| Ba khách cùng ngày/tuần, một khách bị bỏ chọn và một khách có hai lô | Tổng nhu cầu theo nguyên liệu và ĐVT khớp tổng xuất riêng. Bếp chỉ chứa đúng lô, ngày và ca được chọn. |
| Danh sách chưa có, xác định một NCC, nhiều NCC, NCC đổi giữa tuần | Mỗi lượng xuất đúng một lần. Dòng chưa rõ vào mục cần xác minh. Kiểm tra xác nhận với danh sách thật khi nhận được. |
| File Kho, file Bếp, hợp đồng cũ và quyền theo mode | Excel mở không cảnh báo, in đọc được, đối chiếu tính cộng được từ dữ liệu thật hoặc clone được cấp quyền. API cũ giữ hợp đồng. Sổ kho và lô đóng băng giữ nguyên qua lượt xuất. |

Tài liệu gốc cần cập nhật khi thực hiện gồm `docs/domain/weekly-menu.md` và `docs/domain/material-reconciliation.md`. Thiết kế FE dùng Impeccable ở chế độ Operate, UI gate của repo, primitive hiện hành và token trong `frontend/src/styles/index.css`.
