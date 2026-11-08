# Audit tab, cấu trúc trang và dữ liệu hiển thị

Ngày audit: 2026-08-21  
Nguồn chuẩn: `docs/DASHBOARD-UI-RULES.md`, `docs/GLOSSARY.md` và code frontend hiện hành.

## Kết luận

- Cấu trúc điều hướng còn 7 nhóm tab. Mỗi tab còn lại đại diện cho một work object, một bước công việc hoặc một loại báo cáo người dùng có thể chọn; không còn nested tab dùng để biểu diễn state kỹ thuật.
- `Cần duyệt` và `Theo vai trò` là hai surface trùng hoàn toàn về nguồn dữ liệu, tìm kiếm, phân trang và hành động. Đã hợp nhất thành `Cần duyệt`.
- `BOM hiện tại` và `Bản xem trước` là state của quy trình import, không phải hai work object. Đã bỏ khỏi điều hướng; state vẫn được thông báo trong nội dung.
- Bốn cách phân tích biến động giá là tham số của cùng một báo cáo. Đã chuyển từ nested tab thành combobox `Góc nhìn phân tích`.
- Hai bảng có mật độ cao và dữ liệu lặp đã được rút gọn theo P4/T12: bảng dòng biến động giá từ 10 xuống 6 cột; bảng biến động theo nhà cung cấp từ 9 xuống 6 cột; bảng vấn đề dữ liệu từ 9 xuống 6 cột.

## Ma trận vị trí tab

| Trang | Tab | Phán định nghiệp vụ | Kết quả |
|---|---|---|---|
| Thực đơn tuần | Kế hoạch tuần, Nhu cầu, Kế hoạch sản xuất, Tổng hợp mua, Giá vốn, Nguyên liệu món | Các lát cắt liên tiếp của cùng work object `Thực đơn tuần`; dùng chung customer/week nhưng phục vụ quyết định khác nhau | Giữ |
| Kho | Luân chuyển, Nhu cầu xuất, Ngoại lệ | Tách ledger, hàng chờ cấp phát và exception workbench; grain và hành động khác nhau | Giữ |
| Duyệt vận hành | Cần duyệt, Lịch sử | Hàng chờ hành động và audit trail là hai mục đích khác nhau | Giữ |
| Duyệt vận hành | Theo vai trò | Trùng `Cần duyệt` cả query, records, filter, pagination và action | Đã bỏ |
| Thu mua | Xử lý thu mua, Mua bổ sung, Báo giá nhà cung cấp | Ba work object/vòng đời khác nhau: đề xuất/đơn mua, cấp bổ sung và báo giá | Giữ |
| Bếp trưởng | Ca sản xuất, Chứng từ bếp | Work object ca sản xuất và chứng từ cấp phát khác nhau | Giữ |
| Báo cáo | 9 loại báo cáo cấp trang | Mỗi lựa chọn thay dataset và mục tiêu phân tích; vẫn deep-link qua `view` | Giữ; góc nhìn con dùng combobox |
| Quản trị dữ liệu | BOM, Hợp đồng, Dữ liệu lỗi, Tồn kho, Thống kê, Nhật ký, Nhân viên | Các tác vụ quản trị độc lập, có quyền/action/dataset khác nhau | Giữ |
| Quản trị BOM | BOM hiện tại, Bản xem trước | State trước/sau kiểm tra file, không phải navigation | Đã bỏ |

## Audit grain và duplicate dữ liệu

| Surface | Trước | Vi phạm/rủi ro | Xử lý |
|---|---:|---|---|
| Biến động giá theo dòng nhập | 10 cột | Đơn vị lặp trong `Số lượng` và `ĐV`; ngày tách khỏi phiếu; thay đổi, đánh giá và action cùng diễn giải một exception | 6 cột: Nguyên liệu, Nguồn nhập, Số lượng, Giá tham chiếu, Giá nhập, Biến động |
| Biến động giá theo nhà cung cấp | 9 cột | Nhà cung cấp tách khỏi định danh phân tích; min/max chiếm hai cột; biến động và đánh giá trùng nghĩa | 6 cột; tên/NCC, khoảng giá và biến động/status được ghép theo quan hệ |
| Vấn đề dữ liệu quản trị | 9 cột + 7 KPI | Các KPI phân loại lặp lại category của bảng; severity và SLA bị chia nhỏ; mô tả tách khỏi loại lỗi; hướng xử lý tách khỏi action | 3 KPI quyết định + bảng 6 cột |
| Tổng hợp mua | Hai schema 8 hoặc 7 cột | Phép đếm tĩnh thấy 15 header nhưng hai nhánh không render đồng thời | Không đổi |
| BOM hiện tại / preview | 8 cột mỗi bảng | Hơi vượt ngưỡng khuyến nghị nhưng các trường là dữ liệu nhập/kiểm tra trực tiếp và action sửa lỗi | Giữ, theo dõi master-detail nếu bổ sung thêm trường |

## Nguyên tắc đã áp dụng

- P1/N1: nhãn và nhóm theo công việc, không theo state kỹ thuật.
- P4/T12: bảng danh sách giữ 5–7 trường quyết định; dữ liệu liên quan được ghép thành primary/secondary text trong cùng ô.
- L1: tên dễ đọc đứng trước; mã/nguồn/ngày là thông tin phụ.
- T4: bỏ dữ liệu lặp giữa cột và trong từng hàng.
- GLOSSARY §2: một cột trạng thái chính; severity/variance phụ được trình bày trong ô quyết định thay vì tạo thêm máy trạng thái cạnh tranh.

## Evidence kiểm chứng

- Production build: `npm run build` — PASS.
- Unit/contract tests: Approval state, Reports permissions, Navigation preferences, UI floorplan scope — 43/43 PASS.
- Probe production throttling: `frontend/docs/perf/probe-h1-preview-report.json`; integrity violations rỗng.

