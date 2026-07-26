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

## Rollback

1. Dừng promotion của deployment đang lỗi và giữ lại build/artifact trước đó.
2. Redeploy commit/build trước đó trên frontend provider.
3. Với backend, deploy lại artifact/image trước đó; không tự ý rollback database migration nếu chưa kiểm tra tương thích schema.
4. Kiểm tra Swagger/health endpoint, đăng nhập và một luồng nghiệp vụ chính sau rollback.

<!-- VERIFY: Quy trình rollback chính thức, retention artifact và lệnh platform-specific cần được xác nhận với đội vận hành. -->

## Monitoring

Backend ghi log Serilog ra console và file rolling `logs/ipc-.log`, giữ tối đa 30 file theo cấu hình trong `Program.cs`. Chưa thấy tích hợp Sentry, Datadog, New Relic hoặc OpenTelemetry trong dependency/config hiện tại.

<!-- VERIFY: Dashboard, alert, log aggregation và uptime monitor production chưa được xác định từ repository. -->
