# Đặc tả kiểm thử hiệu năng và phục hồi MRX

**Trạng thái** Bản thiết kế chờ duyệt thực thi. Đợt đầu là baseline Release trên MySQL clone, theo phạm vi 5 vai trò và 3 khách đã thảo luận.

**Phân hệ** FR-DASH, FR-MENU, FR-WH, FR-CHEF, FR-RECON, FR-CAT, FR-ADMIN.

**Kế hoạch thực thi** [MRX Performance Qualification Implementation Plan](../plans/2026-11-27-mrx-performance-qualification.md).

## Mục tiêu

Đo từ thao tác của người dùng đến khi màn hình hoặc chứng từ phản ánh dữ liệu đúng. Kết quả tách được thời gian trình duyệt, mạng, API, SQL và tạo file. Mỗi phép đo có điều kiện kiểm thử, số mẫu và kiểm tra đối chiếu nghiệp vụ. Kết quả CI, API trả 200 và kết quả tải trước đây chỉ là bằng chứng cho phạm vi đã chạy.

Phạm vi chính là `MATERIAL_RECONCILIATION`, gồm các màn dùng chung được cấp quyền trong chế độ này. Kiểm DEFAULT ở ranh giới quyền và cách ly dữ liệu mode. Dừng ở báo cáo baseline đợt đầu. Đo năng lực tối đa, stress, soak dài, giám sát định kỳ và RUM thuộc các đợt có phạm vi vận hành được duyệt riêng.

## Điều kiện và dữ liệu

| Chiều đo | Đợt baseline |
| --- | --- |
| Bản chạy | API .NET Release và FE từ production build. Ghi HEAD, hash working tree, hash artifacts, host, cấu hình hiệu lực, URL, chế độ, phiên bản MySQL và trình duyệt. Chạy script với đích xác nhận là clone riêng do phiên kiểm sở hữu. |
| Người dùng | 5 danh tính thực khác nhau theo 5 vai trò Admin, Điều phối, Thủ kho, Bếp trưởng, Quản lý. Kiểm danh tính, quyền và mode trước đo. Đăng nhập nằm ngoài cửa sổ đo luồng nghiệp vụ. |
| Khách và lô | ANV, DAV, FU cùng một tuần có dữ liệu định lượng khác nhau. Cần một lô đang hoạt động, một phạm vi khách/tháng trống, một lô đã hoàn tất và dữ liệu có đủ nhiều dòng để vượt ranh giới trang. Ghi số tuần, ca, lô, dòng nguyên liệu, dòng lịch sử, số file và kích thước dữ liệu. |
| Hai phạm vi dữ liệu | Phạm vi nghiệp vụ 3 khách để đối chiếu độc lập. Phạm vi lịch sử lớn dùng xác minh phân trang, dung lượng và truy vấn nếu có snapshot đã duyệt. Thiếu lịch sử lớn thì ghi `NEEDS_EVIDENCE` cho phép đo đó. |
| Trình duyệt | Chrome riêng ở 1440×900 và 390×844. Kiểm thêm 834 và 1024 ở workbench bảng/toolbar nếu có thay đổi bố cục. Windows UniKey Telex kiểm các đường nhập liệu thực. Giữ hồ sơ thiết bị và bộ gõ. |
| Cache và mạng | Đo lần mở với browser context mới, điều hướng quay lại với cache và cửa sổ sau lỗi/phục hồi. Tách trạng thái cache trình duyệt khỏi trạng thái API/MySQL. Mạng chuẩn dùng đo ngưỡng. Mạng yếu và lỗi có chủ đích dùng đo phục hồi. |

Dữ liệu đợt 3 khách trước có thực đơn gốc, số suất thử và hai món thay thế đã ghi nhận trên clone. Dùng làm tham chiếu cho hồ sơ dữ liệu. Nếu dựng lại, ghi nguồn, thay đổi thử và bản chụp trước đo. Giữ nguyên các quyết định NCC, BOM và đơn vị tính còn chờ khách hàng trên nguồn.

## Trục 1 · Backend, API và MySQL

| ID | Phép kiểm | Kịch bản và kết quả cần quan sát |
| --- | --- | --- |
| API-01 | Smoke | Kiểm readiness gồm nội dung JSON, MySQL, mode, danh tính, quyền, lô, dữ liệu và API mục tiêu. Xác nhận từng lớp request có thể đo trước khi chạy tải. |
| API-02 | Load baseline | Dùng `tools/perf/k6/mrx-five-user.js` làm đường tải đọc có 5 danh tính, tối đa 10 phút theo runner hiện có. Ghi tải thực theo từng vai trò/endpoint, số mẫu, p50/p75/p95/p99, lỗi, timeout, 429, lần chạy bị ngắt, CPU/RAM và kết nối/chờ MySQL nếu có phép đo. Kịch bản browser và ghi nghiệp vụ có cửa sổ riêng với tải HTTP. |
| API-03 | Spike | Sau baseline và khi có phê duyệt, tái hiện đầu ca với đọc phiếu, xác nhận xuất và Excel gộp cùng lúc. Đo lưu lượng từng nấc và thời gian quay về dải baseline đã chốt. Ca tranh ghi có chủ đích dùng hai actor thao tác cùng phiên bản lô và đối chiếu phiếu/receipt sau đó. |
| API-04 | Stress | Tăng theo nấc với trần, thời gian giữ, giới hạn kết nối/request và điều kiện dừng được duyệt. Đo tải đề nghị, tải gửi được, tải thành công và phục hồi. Kịch bản đo thông lượng dùng arrival-rate và ghi `dropped_iterations`. |
| API-05 | Soak | Sau baseline, lặp luồng đọc và các ghi thử đã duyệt trong thời lượng đã chốt. Lấy mẫu trong lúc chạy và sau thời gian nghỉ, so sánh RAM, kết nối, handle và lỗi tích lũy ở trạng thái tương đương. |
| API-06 | Profiling | Chọn endpoint từ kết quả, ưu tiên tìm trong hai tab audit, lịch sử giao dịch, định lượng, Excel nhiều khách. Ghép thời gian theo correlation ID nếu có, phân tích số truy vấn, dòng đọc, thời gian và chờ khóa. Với Excel ghi thời gian đến byte đầu, tải xong, kích thước và chi phí bộ nhớ. Chỉ đề xuất index sau khi có SQL và kế hoạch thực thi. |

Tách 409 theo kịch bản cạnh tranh, 401/403 theo kiểm quyền và 429 theo rate limit. Lỗi cố ý chỉ được tính là đạt kiểm nghiệp vụ khi có đúng mã/trạng thái và dữ liệu đối chiếu. Báo p95/p99 cùng số mẫu và phương pháp tính. Thiếu mẫu thì ghi `NEEDS_EVIDENCE` cho kết luận ở đuôi phân phối. Mốc 10–50 tài khoản và khoảng 20 người đang hoạt động thuộc hồ sơ vận hành thiết kế. Tỷ lệ đọc/ghi, cường độ tải và dữ liệu lịch sử lớn cần chủ vận hành chốt để đo sức chứa.

## Trục 2 · Frontend và thực thao tác

| ID | Luồng ưu tiên | Điều kiện kiểm |
| --- | --- | --- |
| FE-01 | Kiểm nhanh mọi route/leaf MRX từ registry | Đối chiếu quyền, route đích, trạng thái cuối và dữ liệu đúng phạm vi. Bao phủ 6 trạng thái theo `docs/DESIGN.md`, ghi rõ trường hợp không áp dụng theo chức năng. Kiểm back, deep link, tải lại. |
| FE-02 | Rà soát, sổ chênh lệch, giao dịch và hai tab kiểm toán | Chuyển khách có lô sang khách không lô, chọn lại lô có dữ liệu, đảo thứ tự phản hồi. Kiểm không còn dòng, số đếm hoặc thao tác của khách cũ. Kiểm gõ, xóa, phân trang, đóng chi tiết và trả focus. |
| FE-03 | Điều phối, Kho và Bếp | Kiểm tra định lượng, xác nhận xuất lần đầu/xuất bổ sung, phiếu nấu, mở/đóng phiếu và tải Excel. Kiểm khóa thao tác khi gửi, trạng thái chờ, khôi phục sau lỗi và bản ghi sau tải lại. |
| FE-04 | Tiếng Việt và tìm kiếm | Gõ qua UniKey trên Windows. Ca `dax` → `dã`, `hieeur` → `hiểu`, tìm có/không dấu, xóa, sửa giữa chuỗi và giữ focus. Kiểm trường dùng URL/API, combobox và ô trong modal. Kiểm composition chuẩn ở bài riêng để bảo toàn cả hai cơ chế nhập. |
| FE-05 | Rendering, bảng lớn, motion và bundle | Đo cuộn/dựng nội dung, long tasks, hiệu ứng và reduced motion trong luồng có dữ liệu. Kiểm dữ liệu trên 50 dòng theo T7, phân trang và ranh giới trang. Kiểm kích thước gzip theo route từ manifest Vite trước khi đề xuất tách mã. |

Nguồn chuẩn nghiệm thu là `NFR-PERF-01/02`, `F1–F6`, `T7` và `E1–E8`. API p75 ≤ 300 ms, khung đúng route đầu tiên < 100 ms và dữ liệu màn hình sẵn sàng < 1 giây theo định nghĩa đo được duyệt. LCP p75 ≤ 2,5 giây, INP p75 ≤ 200 ms, CLS ≤ 0,1. Mốc khung đầu và dữ liệu sẵn sàng yêu cầu dấu thời gian gắn với route, khóa phạm vi và trạng thái hiển thị đúng. FCP, `networkidle` và API 200 là thông tin bổ trợ. Khi chưa có marker đáng tin, báo số quan sát được và giữ trạng thái `NEEDS_EVIDENCE` cho mục tiêu tương ứng. Phép đo trong lab được báo theo thiết bị và điều kiện thử.

## Trục 3 · Mạng, phục hồi và quan sát

| ID | Điều kiện | Đối chiếu nghiệp vụ |
| --- | --- | --- |
| NET-01 | Chậm GET khi đổi khách/lô, phản hồi A về sau B | Màn hình chỉ mở/truy cập dữ liệu B, request A bị hủy hoặc kết quả bị bỏ qua. Cùng dữ liệu đúng sau tải lại. |
| NET-02 | Mất mạng trước khi gửi hoặc lúc đang nhập số lượng | Bản nháp còn trong đúng phạm vi được phép, trạng thái báo lỗi rõ, lệnh thử lại dùng bản nháp hợp lệ. Kiểm riêng 401 theo hợp đồng phiên hiện hành. |
| NET-03 | API đã ghi thành công rồi mất phản hồi ban đầu hoặc bổ sung | Đối chiếu MySQL trước khi thử lại. Lặp cùng lệnh theo hợp đồng idempotency, đọc lại đúng một phiếu và receipt, không phát sinh thêm audit/hiệu ứng nghiệp vụ ngoài dự kiến. |
| NET-04 | Hai thao tác ghi đồng thời và xuất Excel trong lúc refresh | Chỉ chấp nhận kết quả phù hợp với khóa/version, giữ draft của ca 409 theo nghiệp vụ. Excel có đúng khách, nhóm NCC, số lượng, đơn vị và phạm vi ngày/tuần đã chọn. |
| OBS-01 | Synthetic và RUM | Đợt đầu xác minh tín hiệu `/health/live`, JSON `/health/ready` và một hành trình đọc có xác thực. Chỉ lập lịch cảnh báo trên môi trường được duyệt. RUM cần quyết định riêng về dữ liệu, sampling, lưu giữ và đích nhận. |

## Quy tắc nghiệm thu và bằng chứng

1. Kiểm tra dữ liệu đối chiếu độc lập qua HTTP, MySQL và tệp tải thực. Kiểm mã khách/lô, phiên bản, trạng thái, dòng phiếu, audit/receipt và tổng Excel theo từng khách lẫn gộp. Kiểm bất biến `DOM-MODE-1` và tồn kho vật lý theo hợp đồng MRX. Lỗi sai phạm vi, sai số hoặc trùng phiếu chặn nghiệm thu kịch bản liên quan.
2. Ghi từng kịch bản `PASS`, `FAIL`, `NEEDS_EVIDENCE` hoặc `BLOCKED`, kèm điều kiện, mẫu số, chỉ số và bằng chứng. Lỗi dữ liệu đầu vào, bộ chạy, môi trường và sản phẩm có chẩn đoán riêng. Chưa chạy do phụ thuộc thất bại thì ghi lý do.
3. Lưu manifest bản chạy, bộ dữ liệu, danh mục ca, log số đo, ảnh/trace chọn lọc, đối chiếu trước/sau và biên nhận dọn dẹp ở thư mục riêng trong `.artifacts/mrx-evidence/`. Che token, mật khẩu và dữ liệu cá nhân. Đối chiếu dữ liệu nguồn và tiến trình của người dùng trước/sau.
4. Tải ghi, mô phỏng mất phản hồi sau commit và truy vấn SQL thực thi chỉ chạy trên đích đã duyệt. Giữ limiter và RBAC. Hồ sơ trước spike/stress/soak dài ghi trần tải, thời lượng, tiêu chí dừng, người duyệt và phục hồi. Đợt baseline sử dụng điều kiện dừng của runner, 429/5xx bất ngờ, sai dữ liệu hoặc mất readiness thì dừng phép kiểm phụ thuộc.

## Tài liệu chủ sở hữu

- [Nghiệp vụ và NFR](../../DOMAIN.md) · [Thiết kế UI](../../DESIGN.md) · [Kỹ thuật và phương pháp đo](../../ENGINEERING.md) · [Vận hành](../../OPERATIONS.md)
- [Tình huống xấu MRX](2026-11-11-mrx-worst-case-testing-design.md) · [Runbook công cụ đo](../../../tools/perf/RUNBOOK.md)
