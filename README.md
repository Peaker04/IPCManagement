# 🍳 IPC Management System

**Hệ thống quản lý bếp ăn công nghiệp** (Industrial & Production Catering Management)

## 📁 Cấu trúc Monorepo

```
IPCManagement/
├── backend/                 # .NET 9 Web API
│   ├── src/
│   │   └── IPCManagement.Api/           # Single-project (monolithic)
│   │       ├── Controllers/             # API Controllers
│   │       ├── Data/                    # DbContext, Repositories, UnitOfWork
│   │       ├── Helpers/                 # ApiResponse, GuidHelper, Mappers
│   │       ├── Middlewares/             # ExceptionMiddleware
│   │       ├── Migrations/              # EF Core Migrations
│   │       ├── Models/                  # Entities, DTOs, Validators
│   │       ├── Security/                # JwtTokenService
│   │       └── Services/                # Business Logic Services
│   └── tests/
│       ├── IPCManagement.Api.Tests/
│       └── IPCManagement.Application.Tests/
├── frontend/                            # React + Vite + TypeScript
│   ├── src/
│   │   ├── app/                         # Redux Store, Hooks
│   │   ├── features/                    # Feature modules (auth, ...)
│   │   └── types/                       # TypeScript type definitions
│   └── ...
├── .husky/                              # Git hooks (commit lint)
├── .gitignore
├── CONTRIBUTING.md
└── README.md
```

## 🚀 Bắt đầu nhanh

### Yêu cầu

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 18+](https://nodejs.org/) (khuyến nghị LTS)
- [MySQL 8+](https://dev.mysql.com/downloads/)

### Backend

Chạy từ thư mục gốc repo:

```bash
dotnet restore backend/src/IPCManagement.Api/IPCManagement.Api.csproj
dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj
dotnet run --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj
```

Hoặc nếu bạn đã `cd backend` trước đó:

```bash
dotnet restore
dotnet build
dotnet run --project src/IPCManagement.Api
```

API sẽ chạy tại: `https://localhost:7004` | `http://localhost:5262`

Swagger UI: `http://localhost:5262/swagger`

Nếu `dotnet run` báo cổng `5262` đã được sử dụng, hãy dừng instance backend đang chạy trước đó hoặc chạy với cổng khác:

```bash
dotnet run --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj --urls http://localhost:5263
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy tại: `http://localhost:5173`

## 🔧 Cấu hình

### Database

Sao chép file cấu hình mẫu và cập nhật thông tin kết nối:

```bash
cd backend/src/IPCManagement.Api
cp appsettings.json.example appsettings.json
```

Cập nhật connection string trong `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "server=localhost;port=3306;database=ipcmanagement;user=root;password=YOUR_PASSWORD;"
  }
}
```

Với database mới, tạo database `ipcmanagement` rồi chạy EF migration từ thư mục gốc repo:

```bash
dotnet ef database update --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj --startup-project backend/src/IPCManagement.Api/IPCManagement.Api.csproj
```

Với database local cũ được tạo từ file SQL/dump trước đây, chạy script `backend/database/Init_EF_History_For_Old_DB.sql` trên database đó trước. Script này đồng bộ bảng `__EFMigrationsHistory` với schema đã có, sau đó chạy lại lệnh `dotnet ef database update` ở trên.

### CORS

Backend đã cấu hình CORS cho phép FE truy cập trong development mode. Xem `appsettings.json` > `Cors.AllowedOrigins`.

### Production readiness

Không dùng trực tiếp `appsettings.json` development cho môi trường thật. Sao chép `backend/src/IPCManagement.Api/appsettings.Production.example.json` thành cấu hình production hoặc set các biến môi trường tương ứng:

```bash
ConnectionStrings__DefaultConnection="server=YOUR_DB_HOST;port=3306;database=ipcmanagement;user=ipc_app;password=YOUR_STRONG_DB_PASSWORD;"
JwtSettings__SecretKey="GENERATE_A_UNIQUE_PRODUCTION_SECRET_KEY_AT_LEAST_32_CHARS"
Cors__AllowedOrigins__0="https://YOUR_FRONTEND_DOMAIN"
AllowedHosts="YOUR_API_DOMAIN"
```

Khi `ASPNETCORE_ENVIRONMENT` không phải `Development`, API sẽ từ chối khởi động nếu vẫn dùng password/secret mẫu, CORS localhost, hoặc `AllowedHosts=*`.

## 📚 Tài liệu domain

Các tài liệu nghiệp vụ bổ sung được đặt trong `docs/`:

- [Business Flow](docs/domain/business-flow.md): luồng từ thực đơn, số suất, định lượng đến mua hàng và kho.
- [Data Model](docs/domain/data-model.md): nhóm bảng MySQL/EF Core và các ràng buộc nghiệp vụ chính.
- [Source Workbooks](docs/domain/source-workbooks.md): ý nghĩa các file Excel/DOCX/SQL trong `.docs`.

Thư mục `.docs/` là nguồn tham chiếu nghiệp vụ, không phải dữ liệu runtime của ứng dụng.

## 🧪 Testing

```bash
# Backend build + tests
npm run build:be
npm run test:be

# Frontend lint + build
npm run lint:fe
npm run build:fe

# Full local verification
npm run verify
```

> Nếu backend đang chạy bằng `dotnet run`, Windows có thể khóa file trong `bin/Debug`.
> Hãy dừng instance backend trước khi chạy `npm run verify`, hoặc chạy test với output riêng nếu cần.

### Frontend mock login

Frontend không tự fallback sang tài khoản mock khi backend lỗi. Nếu chỉ muốn thử giao diện ở development mode, bật rõ ràng:

```bash
VITE_ENABLE_MOCK_LOGIN=true npm run fe
```

Mock dev hỗ trợ `admin/admin` và `staff/staff`; không dùng cho production build.

## 📝 Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | React 19, Vite, TypeScript, Redux Toolkit |
| Backend    | ASP.NET Core 9, C#                  |
| Database   | MySQL 8+ (Pomelo EF Core)           |
| Auth       | JWT Bearer + Refresh Token Rotation |
| Validation | FluentValidation                    |
| Logging    | Serilog (Console + File)            |
| Testing    | xUnit, NSubstitute, FluentAssertions|

## 🔐 Security baseline

- `JwtSettings.SecretKey` phải tối thiểu 32 ký tự.
- Production startup chặn secret/password mẫu, CORS localhost, và wildcard host.
- `JwtSettings.Issuer`, `JwtSettings.Audience`, `ExpiryMinutes`, và `RefreshExpiryDays` được validate lúc khởi động.
- Token lưu trong browser phải được xác thực lại qua `/api/auth/profile` trước khi mở route được bảo vệ.
- API nghiệp vụ dùng authorization policy và rate limit `api-general`.
