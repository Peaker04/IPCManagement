<!-- generated-by: gsd-doc-writer -->
# Cấu hình

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
| `JwtSettings:RefreshExpiryDays` | Required | `30` trong các file mẫu | Thời gian sống refresh token. |
| `Cors:AllowedOrigins` | Required ngoài Development | Development cho phép origin rộng hơn | Danh sách origin frontend được phép ở môi trường không phải Development. |
| `AllowedHosts` | Required ngoài Development | `*` chỉ phù hợp Development | Host mà backend chấp nhận khi deploy. |
| `Pagination:MaxPageSize` | Optional | `100` trong file mẫu | Giới hạn page size backend. |
| `ASPNETCORE_ENVIRONMENT` | Optional | `Development` trong launch profile | Chọn nhánh cấu hình và policy deploy. |
| `VITE_API_BASE_URL` | Optional | Trống, frontend dùng `/api` | Base URL backend khi frontend deploy tách origin. |
| `VITE_PROXY_TARGET` | Optional | `http://localhost:5262` | Target proxy `/api` của Vite dev server. |
| `VITE_ENABLE_MOCK_LOGIN` | Optional | Tắt | Chỉ bật mock login trong Development/UI test; không dùng production. |
| `E2E_SERVICE_DATE` | Optional | `2026-07-20` trong Shipyard profile | Ngày phục vụ cho happy-path E2E của lane. |
| `E2E_CUSTOMER_CODE` | Optional | `ANV` | Mã khách hàng dùng khi chạy Shipyard E2E. |
| `E2E_PRICE_TIER_AMOUNT` | Optional | `25000` | Định mức giá thực đơn dùng khi preview/commit E2E. |
| `E2E_WEEKLY_MENU_TEMPLATE_PATH` | Optional | Template ANV mặc định trong thư mục Pictures của máy test | Đường dẫn workbook đầu vào cho Shipyard E2E. |

Tên `ConnectionStrings__DefaultConnection`, `JwtSettings__SecretKey`, `Cors__AllowedOrigins__0` và tương tự có thể dùng dạng environment variable theo quy tắc double-underscore của ASP.NET Core.

Auth giữ BCrypt cost đã encode trong từng password hash; không hạ work factor để tối ưu latency. Session policy
hiện là tối đa 10 refresh token active/user và một token mới thay token cũ của cùng `User-Agent`/device.

## Required và optional

`DependencyInjection.AddBackendServices` sẽ fail nếu `DefaultConnection` không được cấu hình. `Program.cs` bind/validate `JwtSettings` khi startup; `SecretKey` phải đạt tối thiểu 32 ký tự và `ExpiryMinutes`/`RefreshExpiryDays` phải lớn hơn 0. Ngoài Development, `DeploymentConfigurationValidator` còn chặn password/secret mẫu, placeholder, CORS localhost và `AllowedHosts=*`.

Các key pagination có default trong options; frontend `VITE_API_BASE_URL` và `VITE_PROXY_TARGET` có fallback dành cho local development. Khi giá trị phụ thuộc hosting, domain, DNS hoặc secret manager thì phải cấu hình ở nền tảng triển khai, không ghi vào repository.

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
    "RefreshExpiryDays": 30
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

Không sao chép giá trị thật từ file cấu hình backend, `.env` hoặc secret manager vào docs, issue, log hay commit.
