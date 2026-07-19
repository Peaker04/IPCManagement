# MVP thao tác trên web

Tài liệu này trả lời câu hỏi: “Sau khi mở web thì phải bấm gì, theo thứ tự nào?”. Đây là luồng demo thực tế của hệ thống, không phải chỉ danh sách API.

## 0. Chuẩn bị bắt buộc

Mở hai terminal tại thư mục gốc repo:

```powershell
dotnet run --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj
npm run fe
```

Kiểm tra:

- API: `http://localhost:5262/swagger`
- Web: `http://localhost:5173`
- Nếu database chưa có dữ liệu demo, chạy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/MVP_DEMO_SEED_RESET.ps1 -BaseUrl http://localhost:5262
```

Demo chuẩn dùng `admin / admin`, khách hàng `DAV`, tuần bắt đầu `2026-06-15`, ngày kiểm tra mẫu `2026-06-18`.

## 1. Đăng nhập và kiểm tra quyền

1. Mở `http://localhost:5173/login`.
2. Nhập `admin` và `admin`.
3. Sau khi vào trang, nhìn menu trái. Các mục bị ẩn là do thiếu permission, không phải lỗi điều hướng.
4. Luồng MVP cần thấy tối thiểu: `Thực đơn tuần`, `Điều phối đơn`, `Duyệt vận hành`, `Thu mua`, `Kho nguyên liệu`, `Bếp trưởng`.

## 2. Nhập thực đơn tuần

1. Vào `Thực đơn tuần`.
2. Chọn khách hàng `DAV` và tuần bắt đầu `15/06/2026`.
3. Bấm thao tác nhập thực đơn.
4. Ở bước `Chọn file`, chọn `.docs/THỰC ĐƠN DRAXLMAIER TỪ NGÀY 15.06 - 20.06.xlsx`.
5. Bấm thêm file, sau đó chuyển sang `Kiểm tra`.
6. Chỉ lưu khi không còn lỗi chặn; cảnh báo phải đọc trước khi quyết định.
7. Bấm `Lưu thực đơn`, rồi tải lại trang để kiểm tra menu đã commit.

Kết quả cần thấy: các ngày/ca/menu được hiển thị trong bảng KHSX; lỗi tên món, ngày, dòng trùng hoặc BOM phải được hiển thị bằng tiếng Việt.

## 3. Nhập và chốt số suất

1. Vào `Điều phối đơn`.
2. Chọn khách hàng, tuần/ngày và ca cần thao tác.
3. Nhập số suất dự kiến ở bảng điều phối.
4. Rời khỏi ô nhập để hệ thống lưu; kiểm tra thông báo thành công/lỗi.
5. Khi dữ liệu đúng, bấm hành động chốt/sign-off của ngày hoặc ca.

Không chuyển sang tạo demand khi số suất còn là bản nháp hoặc chưa sign-off; backend sẽ từ chối để tránh tạo sai định lượng.

## 4. Tạo KHSX và demand nguyên liệu

1. Quay lại `Thực đơn tuần`.
2. Mở khu vực `KHSX và nhu cầu`.
3. Chọn ngày cần kiểm tra, ví dụ `18/06/2026`.
4. Bấm `Tạo demand từ KHSX`.
5. Đọc kết quả: số dòng KHSX, số dòng nguyên liệu, số dòng thiếu, lỗi BOM và lỗi quy đổi đơn vị.
6. Nếu có lỗi BOM/đơn vị, sửa ở `Quản trị dữ liệu` rồi tạo demand lại; không tiếp tục duyệt một demand có lỗi chặn.

Kết quả demo chuẩn: material request `MR-DAV-20260618-FULLDAY`, khoảng 490 dòng demand và có các dòng thiếu để đi tiếp luồng mua hàng.

## 5. Kiểm tra thiếu hụt và đề xuất mua

1. Vẫn ở khu vực demand, đọc bảng nguyên liệu ngày. Bảng này có phân trang; tổng số thiếu lấy từ server.
2. Vào `Thu mua`.
3. Kiểm tra các dòng: nguyên liệu, nhu cầu, tồn hiện tại, số lượng đề xuất mua, nhà cung cấp và trạng thái.
4. Tạo purchase request từ phần đề xuất thiếu. Mốc demo thường là `PR-20260618-FULLDAY`.

## 6. Duyệt vận hành

1. Vào `Duyệt vận hành`.
2. Chọn hàng đợi đề xuất mua/xuất tương ứng.
3. Mở chi tiết, kiểm tra số lượng và lý do.
4. Bấm `Duyệt` hoặc `Từ chối`, nhập lý do khi hệ thống yêu cầu.
5. Quay lại `Thu mua` để thấy trạng thái đã cập nhật.

Nếu không thấy đề xuất, kiểm tra đúng role `purchase.request.approve`, đúng trạng thái request và đã tạo request từ demand.

## 7. Tạo đơn mua và nhận hàng

1. Ở `Thu mua`, mở phần đề xuất đã duyệt.
2. Bấm `Tạo đơn mua hàng`.
3. Trong danh sách đơn mua, mở `Ghi nhận nhận hàng`.
4. Chọn `Kho nhập hàng`, nhập số lượng nhận theo từng dòng, rồi bấm `Ghi nhận`.
5. Kiểm tra trạng thái đơn và tồn kho sau khi nhận.

Không để trống kho nhập hoặc số lượng nhận; hệ thống sẽ không ghi nhận giao dịch.

## 8. Xuất kho, bếp nhận và hoàn tất

1. Vào `Kho nguyên liệu`, kiểm tra tồn hiện tại và các dòng thiếu.
2. Bấm `Tạo phiếu xuất kho`, chọn bắt buộc `Nhu cầu nguyên liệu` và `Kho xuất`, sau đó bấm `Xác nhận tạo phiếu`.
3. Vào `Bếp trưởng`, mở KHSX và checklist nguyên liệu.
4. Xác nhận bếp đã nhận đủ hoặc ghi nhận chênh lệch.
5. Nếu thiếu phát sinh sau khi đã nhận phiếu xuất, bấm `Yêu cầu cấp bổ sung`, chọn dòng nguyên liệu, nhập số lượng và gửi tới kho. Yêu cầu được lưu trạng thái `PENDING`; thao tác này chưa tự trừ tồn hay tạo phiếu xuất mới.
6. Nếu có dư/thừa, dùng luồng trả dư/hao hụt theo phiếu xuất.

## 9. Kiểm tra bằng chứng cuối luồng

- `Tổng quan`: xem điểm tắc và việc cần xử lý.
- `Biến động giá`: xem demand, mua hàng, tồn kho và audit.
- `Quản trị dữ liệu`: chỉ dùng để sửa BOM, nguyên liệu, đơn vị, nhà cung cấp và quy tắc duyệt; không dùng thay cho thao tác nghiệp vụ hằng ngày.

## Khi không thao tác được

| Hiện tượng | Kiểm tra trước |
|---|---|
| Không đăng nhập | API đang chạy, database có user, `/api/auth/profile` trả hợp lệ |
| Vào web nhưng menu trống | User thiếu permission hoặc đang ở role không phù hợp |
| Không có customer/menu | Chạy seed reset hoặc nhập dữ liệu master trước |
| Tạo demand bị chặn | Chưa sign-off số suất, thiếu BOM, sai đơn vị hoặc demand cũ |
| Không thấy nút duyệt | Request chưa được tạo hoặc user thiếu `purchase.request.approve` |
| Build backend bị khóa | Có process `IPCManagement.Api` đang chạy; dừng đúng instance trước build |

## Phạm vi MVP hiện tại

Đã có các mảnh chính của luồng: live API, menu import, số suất/sign-off, demand, thiếu hụt, duyệt, thu mua, kho, bếp và báo cáo. Tuy nhiên, “MVP chạy được trên web” chỉ được xem là đạt khi database đã migrate/seed và từng bước trên được kiểm tra bằng tài khoản có quyền tương ứng.

## Trạng thái đối chiếu FE/BE ngày 19/07/2026

| Bước | Control FE | API BE | Trạng thái |
|---|---|---|---|
| Nhập thực đơn | Wizard `Chọn file` → `Kiểm tra` → `Lưu thực đơn` | Preview, commit, history và rollback | Có thể thao tác |
| Nhập/chốt số suất | Sửa số suất, `Chốt đơn`, `Hoàn tất ca`, `Mở khóa ca` | Servings, lock, sign-off và unlock | Có thể thao tác |
| Tạo demand | `Tạo demand từ KHSX` | `POST /api/material-demand/generate` | Có thể thao tác |
| Tạo đề xuất mua | `Tạo đề xuất mua`, chọn chứng từ nhu cầu | `POST /api/purchase-workflow/from-demand` | Đã nối lại FE ngày 19/07/2026 |
| Chọn nhà cung cấp/gửi duyệt | Tab giá và nhà cung cấp, `Gửi đơn mua` | Update supplier và submit request | Có thể thao tác |
| Duyệt/từ chối | Nút trên từng chứng từ và dialog lý do | Approval inbox và decision | Có thể thao tác |
| Tạo đơn mua/nhận hàng | `Tạo đơn mua hàng`, `Ghi nhận nhận hàng` | Purchase order create/receive | Có thể thao tác |
| Xuất kho/bếp nhận/trả dư | Dialog chọn rõ nhu cầu + kho, ký nhận, trả kho/hao hụt | Inventory issue, confirm receipt và return | Đã nối API; không còn tự chọn dòng đầu tiên |

Quy ước UI sau review: cột chỉ mô tả trạng thái phải dùng nhãn `Hướng xử lý`; nhãn `Thao tác` chỉ dùng khi ô có button/link thật. Bảng lấy một page từ server không được tự phân trang lần thứ hai bên trong component.

Các gap còn mở được theo dõi tại `.planning/quick/260719-mvp-web-flow-gap-review/MVP-GAP-MATRIX.md`. UI kho đã bắt buộc chọn chứng từ/kho; UI yêu cầu bổ sung của bếp chỉ báo thành công sau khi API đã lưu bản ghi thật.
