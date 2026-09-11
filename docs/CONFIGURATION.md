<!-- generated-by: gsd-doc-writer -->
# Cấu hình

## Runtime servicing baseline

- `global.json` selects SDK `9.0.313` as the minimum in the 9.0.3xx feature band and permits a newer installed patch through `latestPatch`; it prevents silently building with an installed .NET 10 SDK but is not a byte-for-byte SDK pin. CI independently requests the supported `9.0.x` channel.
- ASP.NET Core and EF Core package family is serviced coherently at `9.0.20`; test packages `Microsoft.AspNetCore.Mvc.Testing`, EF InMemory and SQLite match `9.0.20`.
- `System.IdentityModel.Tokens.Jwt` is `8.19.2`, the minimum coherent dependency required by JwtBearer 9.0.20. Pomelo remains `9.0.0`; no unrelated dependency upgrade or target-framework change was made.
- CI installs `dotnet-ef 9.0.20`. Package servicing never authorizes schema/data migration by itself.

## Nguồn cấu hình

Backend đọc cấu hình ASP.NET Core từ `backend/src/IPCManagement.Api/appsettings.json`, `backend/src/IPCManagement.Api/appsettings.Development.json` và các file mẫu `backend/src/IPCManagement.Api/appsettings.Demo.example.json`, `backend/src/IPCManagement.Api/appsettings.Lan.example.json`, `backend/src/IPCManagement.Api/appsettings.Production.example.json`. Frontend đọc biến Vite từ `frontend/.env.example`, `frontend/vite.config.ts` và `import.meta.env` trong source.

## Settings và biến môi trường

| Variable/Key | Required | Default/ghi chú | Mô tả |
|---|---|---|---|
| `ConnectionStrings:DefaultConnection` | Required | Không có default an toàn | Connection string MySQL cho `IpcManagementContext`. |
| `JwtSettings:SecretKey` | Required | Không dùng secret mẫu ngoài Development | JWT signing key, tối thiểu 32 ký tự. |
| `JwtSettings:Issuer` | Required | Không nên đổi tùy tiện | JWT issuer. |
| `JwtSettings:Audience` | Required | Không nên đổi tùy tiện | JWT audience. |
| `JwtSettings:ExpiryMinutes` | Required | `30` trong các file mẫu | Thời gian sống access token. |
| `JwtSettings:RefreshExpiryDays` | Required | `1` (24 giờ) trong config/mẫu | Thời gian sống tuyệt đối của refresh-token family; rotation kế thừa expiry gốc, không sliding. |
| `JwtSettings:MaxActiveRefreshTokens` | Required | `3`, hợp lệ `1..10` | Qualification target cho active sessions/user. Login/refresh/deactivate serialize bằng MySQL user-row lock; concurrent guarantee còn NEEDS_EVIDENCE tới two-connection gate. |
| `Cors:AllowedOrigins` | Required ngoài Development | Development cho phép origin rộng hơn | Danh sách origin frontend được phép ở môi trường không phải Development. |
| `AllowedHosts` | Required ngoài Development | `*` chỉ phù hợp Development | Host mà backend chấp nhận khi deploy. |
| `Pagination:MaxPageSize` | Optional | `100` trong file mẫu | Giới hạn page size backend. |
| `ASPNETCORE_ENVIRONMENT` | Optional | `Development` trong launch profile | Chọn nhánh cấu hình và policy deploy. |
| `VITE_API_BASE_URL` | Optional | Trống, frontend dùng `/api` | Base URL backend khi frontend deploy tách origin. |
| `VITE_PROXY_TARGET` | Optional | `http://localhost:5262` | Target proxy `/api` của Vite dev server; không phải reverse proxy của backend deployment. |
| `VITE_ENABLE_MOCK_LOGIN` | Optional | Tắt | Chỉ bật mock login trong Development/UI test; không dùng production. |
| `VITE_IDLE_TIMEOUT_MINUTES` | Optional | `60` | Số phút không có keyboard/pointer/touch activity trước khi hiện cảnh báo idle. Giá trị không dương/invalid dùng fallback. |
| `VITE_IDLE_WARNING_MINUTES` | Optional | `2` | Grace period cảnh báo trước khi gọi logout/revoke đúng một lần. |
| `E2E_SERVICE_DATE` | Optional | `2026-07-20` trong Shipyard profile | Ngày phục vụ cho happy-path E2E của lane. |
| `E2E_CUSTOMER_CODE` | Optional | `ANV` | Mã khách hàng dùng khi chạy Shipyard E2E. |
| `E2E_PRICE_TIER_AMOUNT` | Optional | `25000` | Định mức giá thực đơn dùng khi preview/commit E2E. |
| `E2E_WEEKLY_MENU_TEMPLATE_PATH` | Optional | Template ANV mặc định trong thư mục Pictures của máy test | Đường dẫn workbook đầu vào cho Shipyard E2E. |

Tên `ConnectionStrings__DefaultConnection`, `JwtSettings__SecretKey`, `Cors__AllowedOrigins__0` và tương tự có thể dùng dạng environment variable theo quy tắc double-underscore của ASP.NET Core.

Auth giữ BCrypt cost đã encode trong từng password hash; không hạ work factor để tối ưu latency. Access JWT và
user metadata được lưu tab-scoped trong `sessionStorage`, không dùng `localStorage`; refresh credential chỉ thuộc
HttpOnly cookie. Startup xóa auth metadata legacy khỏi persistent storage. Current source dùng validated configurable cap target 3; login/refresh/Admin deactivate lấy cùng MySQL user-row
lock trước session mutation, và login mới thay token cũ cùng `User-Agent`/device. Sequential/unit gates PASS;
concurrent cap và deactivate interleavings vẫn NEEDS_EVIDENCE trên disposable MySQL. Refresh rotation giữ nguyên `DeviceInfo` và phải từ chối tài khoản đã khóa cả trước lẫn trong
transaction; không tạo successor cho tài khoản inactive. Access token mặc định 30 phút; refresh family tuyệt đối không sliding 24 giờ; idle mặc định 60 phút + cảnh báo
2 phút; deactivate qua Admin employee update/status thu hồi mọi refresh token chưa revoked trong cùng SaveChanges.
Access JWT đã phát hành vẫn có residual window tối đa phần còn lại của 30 phút.

## Required và optional

`DependencyInjection.AddBackendServices` sẽ fail nếu `DefaultConnection` không được cấu hình. `Program.cs` bind/validate `JwtSettings` khi startup; `SecretKey` phải đạt tối thiểu 32 ký tự và `ExpiryMinutes`/`RefreshExpiryDays` phải lớn hơn 0. Ngoài Development, `DeploymentConfigurationValidator` còn chặn password/secret mẫu, placeholder, CORS localhost và `AllowedHosts=*`.

Các key pagination có default trong options; frontend `VITE_API_BASE_URL` và `VITE_PROXY_TARGET` có fallback dành cho local development. Backend deployment hiện dùng direct-host và không đọc `X-Forwarded-For`/`X-Forwarded-Proto`; rate limiting phân vùng theo địa chỉ kết nối trực tiếp. Nếu sau này đặt backend sau reverse proxy, phải triển khai một thay đổi riêng với allowlist proxy tin cậy và integration tests trước khi bật forwarded headers. Khi giá trị phụ thuộc hosting, domain, DNS hoặc secret manager thì phải cấu hình ở nền tảng triển khai, không ghi vào repository.

## Format file cấu hình

Ví dụ tối thiểu về shape JSON, không chứa giá trị credential thật:

```json
{
  "ConnectionStrings": { "DefaultConnection": "<mysql-connection-string>" },
  "JwtSettings": {
    "SecretKey": "<secret-at-least-32-characters>",
    "Issuer": "IPCManagementAPI",
    "Audience": "IPCManagementClient",
    "ExpiryMinutes": 30,
    "RefreshExpiryDays": 1,
    "MaxActiveRefreshTokens": 3
  },
  "Cors": { "AllowedOrigins": ["<frontend-origin>"] },
  "AllowedHosts": "<api-host>",
  "Pagination": { "MaxPageSize": 100 }
}
```

## Per-environment overrides

- `Development`: dùng launch profile trong `backend/src/IPCManagement.Api/Properties/launchSettings.json`, Swagger bật và CORS được nới lỏng trong `backend/src/IPCManagement.Api/Program.cs`.
- `Demo`: copy `backend/src/IPCManagement.Api/appsettings.Demo.example.json` thành file runtime tương ứng, thay toàn bộ `CHANGE_ME_*` và host nội bộ.
- `Lan`: copy `backend/src/IPCManagement.Api/appsettings.Lan.example.json`, thay IP/host/database/secret và chạy với `ASPNETCORE_ENVIRONMENT=Lan`.
- `Production`: copy `backend/src/IPCManagement.Api/appsettings.Production.example.json` hoặc dùng environment variables/secret manager; không sử dụng password local, secret Development, CORS localhost hay wildcard host.
- Frontend: file env local của frontend là override local; Vite proxy chỉ dành cho dev, còn deploy cần `VITE_API_BASE_URL` phù hợp nếu API không cùng origin.

Timezone nghiệp vụ canonical là IANA `Asia/Ho_Chi_Minh`: instant trao đổi/lưu dưới UTC rồi render theo timezone này;
date-only và service-date giữ literal calendar date. Không dùng per-user timezone hoặc framework i18n trong policy hiện hành.

Diagnostic/security log có retention target 30 ngày nhưng `retainedFileCountLimit` không tự chứng minh host giữ đúng
30 ngày. Routine auth log không chứa username/full name/User-Agent/device/token/hash prefix/request body; opaque user ID,
correlation ID và remote IP cho security event được phép. Business audit/stock/approval history vẫn append-only cho tới
khi có retention authority riêng.

Không sao chép giá trị thật từ file cấu hình backend, `.env` hoặc secret manager vào docs, issue, log hay commit.
