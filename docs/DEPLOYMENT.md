<!-- generated-by: gsd-doc-writer -->
# Triển khai

## Deployment targets

- **Frontend trên Vercel:** root `vercel.json` là file cấu hình duy nhất — chọn framework Vite, chạy `npm run build:fe`, lấy artifact ở `frontend/dist`, khai rewrite SPA và security header (nosniff, `X-Frame-Options`, Referrer-Policy, HSTS, CSP). `frontend/vercel.json` **đã bị xóa ở P1.6** vì Vercel chỉ đọc file nằm tại Root Directory; rewrite SPA khai trong đó chưa từng có hiệu lực, deep-link sống được là nhờ preset Vite mặc định.
- **Backend ASP.NET Core:** repository có project `backend/src/IPCManagement.Api/IPCManagement.Api.csproj` và các file cấu hình mẫu `backend/src/IPCManagement.Api/appsettings.Demo.example.json`, `backend/src/IPCManagement.Api/appsettings.Lan.example.json`, `backend/src/IPCManagement.Api/appsettings.Production.example.json`, nhưng chưa có Dockerfile hoặc provider-specific backend manifest. Backend cần được deploy riêng trên một host .NET/MySQL phù hợp.

<!-- VERIFY: Tên project/team/domain Vercel và host backend production phải được xác nhận trong tài khoản triển khai thực tế. -->

## Build pipeline

`.github/workflows/verify.yml` là quality gate chạy khi `push` và `pull_request`: setup .NET/Node, `npm ci`, build/test backend, kiểm tra migration/schema MySQL, lint và build frontend. Đây không phải deployment workflow; không có file workflow deploy riêng trong `.github/workflows/`.

Vercel deployment branch policy được khai báo trong root `vercel.json`: `main` và `dev` bật deployment, branch khác tắt theo cấu hình hiện tại. Việc project thực tế đã liên kết với Vercel nào cần được xác nhận ngoài repository.

Root Directory của project trên Vercel là `./` (gốc repository) — **đã xác minh trực tiếp trong Vercel → Settings → Build & Development ngày 26/07/2026**, kèm tuỳ chọn "Include files outside the root directory in the Build Step" đang bật. Đây là căn cứ để chỉ giữ root `vercel.json`: Vercel chỉ đọc file cấu hình nằm tại Root Directory, nên `frontend/vercel.json` trước đây không bao giờ được áp dụng.

## Environment setup

Production backend cần `ConnectionStrings:DefaultConnection`, `JwtSettings:*`, `Cors:AllowedOrigins` và `AllowedHosts`; xem [CONFIGURATION.md](CONFIGURATION.md) để biết shape và validation. Các giá trị secret/domain phải đặt trong secret manager hoặc environment của host.

<!-- VERIFY: Cách inject secret, database host, region, DNS và frontend/backend origin phải được xác nhận theo provider production thực tế. -->

Frontend cần build với `VITE_API_BASE_URL` khi API không cùng origin. Không bật `VITE_ENABLE_MOCK_LOGIN` trong production build.

## Kích hoạt kho vận hành — checkpoint được ủy quyền riêng

Migration `20260824161853_EnforceSingleOperationalWarehouse` chỉ bổ sung `IsOperationalActive` (mặc định `FALSE`), cột sinh nullable `OperationalSingletonKey` và unique index. Chạy migration không chọn hay kích hoạt kho. Executor tự động phải dừng trước mọi lệnh áp dụng migration hoặc thay đổi dữ liệu; chỉ operator có ủy quyền riêng, sau khi xác nhận đúng database/lane và backup, mới được tiếp tục.

Trước khi kích hoạt, operator phải lưu pre-state bất biến gồm database đích, migration lineage, toàn bộ `warehouseId`/`warehouseCode`/`IsOperationalActive`, số hàng và checksum theo từng bảng có FK kho, tồn hiện tại, lot, snapshot và stock movement. Đọc `OperationalWarehouse:WarehouseId` từ cấu hình deployment và xác nhận đó là đúng một ID 16 byte đã tồn tại; không chọn theo tên, mã, thứ tự hoặc `First` và không tạo/merge/reassign warehouse. Cấu hình dùng chuỗi GUID theo `GuidHelper`/API của ứng dụng (`new Guid(bytes).ToString()`), không dùng trực tiếp `BIN_TO_UUID(binary_column)` nếu hai biểu diễn byte-order khác nhau.

Trong một transaction do operator chủ động mở: khóa các hàng `warehouses` liên quan để tránh race; xác nhận không có hàng active và configured ID tồn tại đúng một lần; chỉ đặt `IsOperationalActive = TRUE` cho chính configured ID. Không sửa hàng khác. Sau update nhưng trước commit, yêu cầu đồng thời: đúng một hàng active, ID active byte-exact bằng configured ID, `OperationalSingletonKey = 1` cho hàng đó, mọi hàng inactive có discriminator `NULL`, và các số lượng/checksum ID/FK/tồn/history bằng pre-state. Bất kỳ mismatch hoặc unique-index error nào đều phải `ROLLBACK`; không auto-repair flag, không thử ID khác và không consolidation.

Chỉ commit sau khi operator xác nhận post-check. Sau commit, khởi động backend ở chế độ observation-only: startup resolver chỉ quan sát exact-one/config-match và phải fail closed khi zero/multiple/missing/mismatch; startup không được kích hoạt, retire hoặc sửa hàng. Rollback nghiệp vụ của activation là một transaction được ủy quyền riêng đặt chính configured row về `FALSE`, rồi xác nhận zero active và pre-state identity/history vẫn nguyên vẹn. Việc rollback schema/deploy phải được đánh giá tương thích riêng và không được sửa migration lịch sử.

## Rollback

1. Dừng promotion của deployment đang lỗi và giữ lại build/artifact trước đó.
2. Redeploy commit/build trước đó trên frontend provider.
3. Với backend, deploy lại artifact/image trước đó; không tự ý rollback database migration nếu chưa kiểm tra tương thích schema.
4. Kiểm tra Swagger/health endpoint, đăng nhập và một luồng nghiệp vụ chính sau rollback.

<!-- VERIFY: Quy trình rollback chính thức, retention artifact và lệnh platform-specific cần được xác nhận với đội vận hành. -->

## Monitoring

Backend ghi log Serilog ra console và file rolling `logs/ipc-.log`, giữ tối đa 30 file theo cấu hình trong `Program.cs`. Chưa thấy tích hợp Sentry, Datadog, New Relic hoặc OpenTelemetry trong dependency/config hiện tại.

<!-- VERIFY: Dashboard, alert, log aggregation và uptime monitor production chưa được xác định từ repository. -->
