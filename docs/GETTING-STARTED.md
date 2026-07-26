<!-- generated-by: gsd-doc-writer -->
# Bắt đầu dự án

## Prerequisites

- Git.
- .NET SDK `9.0` để build/chạy backend.
- Node.js và npm; CI đang dùng Node.js `20`, nên dùng Node.js 20 LTS để giảm sai khác môi trường.
- MySQL `8.0` hoặc tương thích. Backend dùng Pomelo EF Core và connection string `DefaultConnection`.

## Cài đặt

1. Clone repository:

   ```bash
   git clone https://github.com/Peaker04/IPCManagement.git
   cd IPCManagement
   ```

2. Cài npm dependencies cho root workspace và `frontend`:

   ```bash
   npm ci
   ```

3. Restore và build backend:

   ```bash
   dotnet restore backend/src/IPCManagement.Api/IPCManagement.Api.csproj
   dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj
   ```

4. Chuẩn bị MySQL và cấu hình backend. Dùng một trong các file mẫu `backend/src/IPCManagement.Api/appsettings.Demo.example.json`, `backend/src/IPCManagement.Api/appsettings.Lan.example.json` hoặc `backend/src/IPCManagement.Api/appsettings.Production.example.json`; thay connection string, JWT secret, CORS origin và host theo môi trường. Không đưa credential thật vào Git.

## First run

Mở hai terminal từ thư mục gốc:

```bash
npm run be
```

```bash
npm run fe
```

Backend Development mặc định lắng nghe `http://localhost:5262` và `https://localhost:7004`; Swagger ở `http://localhost:5262/swagger`. Frontend Vite ở `http://localhost:5173`.

Nếu frontend cần gọi backend ở host khác, đặt `VITE_API_BASE_URL` trong file env local của frontend. Khi để trống, frontend dùng `/api` và Vite proxy tới `http://localhost:5262` theo `frontend/vite.config.ts`.

## Common setup issues

- **Không kết nối được database:** kiểm tra MySQL đang chạy và `ConnectionStrings:DefaultConnection` trỏ đúng database/user/password; migration có thể chạy bằng EF CLI sau khi cài tool tương ứng.
- **Cổng `5262` hoặc `5173` đã được dùng:** dừng process cũ hoặc đổi port khi chạy backend/frontend.
- **Frontend bị 401/403:** kiểm tra backend đang chạy, user có permission phù hợp và session/token còn hợp lệ. `VITE_ENABLE_MOCK_LOGIN=true` chỉ dành cho Development và test UI.
- **Production không khởi động:** `DeploymentConfigurationValidator` sẽ chặn secret mẫu, password local/demo, CORS localhost, wildcard `AllowedHosts` hoặc placeholder chưa thay.

## Next steps

- Đọc [ARCHITECTURE.md](ARCHITECTURE.md) để hiểu boundary và data flow.
- Đọc [DEVELOPMENT.md](DEVELOPMENT.md) để biết scripts, style và PR workflow.
- Đọc [TESTING.md](TESTING.md) trước khi sửa code hoặc cập nhật snapshot.
- Đọc [CONFIGURATION.md](CONFIGURATION.md) và [DEPLOYMENT.md](DEPLOYMENT.md) khi đổi môi trường.
- Dùng [MVP_WEB_FLOW.md](MVP_WEB_FLOW.md) nếu cần chạy demo nghiệp vụ end-to-end.
