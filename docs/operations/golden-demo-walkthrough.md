# Hướng dẫn tự chạy Golden Path để demo khách hàng

Hướng dẫn này dùng dữ liệu theo một tuần mới, không xóa hoặc nhập lại Golden Path cũ. Tuần demo hiện hành
được ghi trong `MEMORY.md`; trước mỗi buổi demo phải chạy preflight bên dưới. Nếu receipt không phải
`CLEAN_SCOPE_PASS`, chọn một thứ Hai khác chưa có dữ liệu. Không tiếp tục trên scope bẩn.

## 1. Kiểm tra scope sạch

Mở PowerShell tại project root:

```powershell
$env:IPC_MYSQL_PASSWORD = '<mật khẩu MySQL cục bộ>'
powershell -ExecutionPolicy Bypass -File tools/e2e/Test-Phase05GoldenDemoScope.ps1 `
  -WeekStartDate '<YYYY-MM-DD>' `
  -Database ipc_lane7
```

Kết quả bắt buộc:

- `CLEAN_SCOPE_PASS`;
- ANV và DAV đều tồn tại;
- menu, lịch phục vụ, kế hoạch, nhu cầu, Ca phục vụ và phiếu xuất đều bằng `0` trong tuần;
- `mutationAttempted = false` và `protectedLaneConnectionAttempts = 0`.

## 2. Kịch bản trình diễn

| Bước | Vai trò | Màn hình và thao tác | Điều cần nói với khách |
|---|---|---|---|
| 1 | Quản trị viên | Vào **Thực đơn tuần**, chọn ANV, tuần demo và đơn giá; mở nhập thực đơn, chọn file ANV, **Kiểm tra file** rồi **Nhập dữ liệu**. Lặp lại cho DAV bằng file DAV. | Mỗi khách hàng có thực đơn và nguồn file riêng; preview không ghi dữ liệu. |
| 2 | Điều phối | Chọn đúng khách hàng/tuần, kiểm tra sáu ngày rồi hoàn tất kế hoạch và sinh **Nhu cầu nguyên liệu**. | Nhu cầu giữ grain khách hàng × ngày × ca × dòng nguồn. |
| 3 | Quản lý | Vào **Duyệt vận hành**, duyệt nhu cầu của ANV và DAV. | Người tạo không tự duyệt; inbox vẫn giữ các việc chưa hoàn thành. |
| 4 | Thu mua | Tạo **Đề xuất mua hàng**, chọn nhà cung cấp và tạo **Đơn mua**. | Các dòng tương thích có thể gom đơn nhưng vẫn giữ phân bổ ANV/DAV riêng. |
| 5 | Kho | Tạo phiếu nhập, kiểm tra chất lượng, chuyển Quản lý duyệt rồi Quản trị viên **Ghi sổ kho**. | Chỉ bước ghi sổ mới tạo bút toán tồn kho. |
| 6 | Kho | Tạo **Phiếu xuất** theo ngày/ca và giao nguyên liệu cho Bếp. | Mỗi dòng xuất vẫn trỏ về nhu cầu nguồn của đúng khách hàng. |
| 7 | Bếp | Mở checklist, bấm **Nhận** từng nguyên liệu hoặc mở nhóm dòng nguồn, kiểm tra trạng thái **Đã nhận**. | Việc nhận được ghi theo dòng phiếu xuất, không gộp chỉ theo tên nguyên liệu. |
| 8 | Bếp và Quản lý | Bếp ghi số suất thực tế/xác nhận phục vụ; Quản lý kiểm tra rồi đóng từng Ca phục vụ. | Tuần chỉ hoàn tất khi cả ANV và DAV đã đóng độc lập. |

## 3. Ảnh tham chiếu khi thao tác

### Nhập thực đơn: kiểm tra trước khi ghi dữ liệu

![Kiểm tra file thực đơn](../../.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/preview-anv-dav-1365x900.png)

### Hai thực đơn ANV/DAV được ghi độc lập

![Ghi dữ liệu ANV và DAV](../../.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/commit-anv-dav-1365x900.png)

### Điều phối sinh nhu cầu và đọc lại sau tải lại trang

![Nhu cầu ANV](../../.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/stage1/anv-demand-reload-1365x900.png)

### Kho đã tạo phiếu xuất

![Kho sau khi tạo phiếu xuất](../../.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/create-issues/warehouse-after-issues.png)

### Bếp xác nhận đã nhận nguyên liệu

![Bếp sau khi nhận nguyên liệu](../../.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/kitchen-acknowledgement/chef-after-acknowledgement.png)

### Ca phục vụ sẵn sàng đóng và kết quả sau đóng

![Ca sẵn sàng đóng](../../.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/service-runs/chef-ready-to-close.png)

![Quản lý đã đóng ca](../../.artifacts/shipyard-live/phase-05-multi-customer-lifecycle/golden/service-runs/manager-closed.png)

## 4. Quy tắc tránh lặp dữ liệu

- Không dùng lại tuần đã có `menuVersions` hoặc `menuSchedules`.
- Không bấm **Nhập dữ liệu** lần hai khi cùng customer/week/tier đã có version; tải lại trang và kiểm tra trước.
- ANV và DAV phải dùng hai file Golden riêng trong `tools/e2e/fixtures/phase05/`.
- Không reset/seed/cleanup để chuẩn bị demo. Chọn scope tuần mới và giữ lịch sử append-only.
- Sau mỗi bước mutation, chờ trạng thái hoàn tất rồi tải lại đúng customer/week trước khi sang vai trò tiếp theo.
- Nếu UI hiển thị enum, mã kỹ thuật làm nhãn chính, bảng giật khi refetch, console/page error hoặc long task chưa attribution, dừng bước đó và lưu evidence; không tiếp tục chỉ bằng API.

