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

```bash
cd backend
dotnet restore
dotnet build
dotnet run --project src/IPCManagement.Api
```

API sẽ chạy tại: `https://localhost:7xxx` | `http://localhost:5xxx`

Swagger UI: `http://localhost:5xxx/swagger`

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

### CORS

Backend đã cấu hình CORS cho phép FE truy cập trong development mode. Xem `appsettings.json` > `Cors.AllowedOrigins`.

## 🧪 Testing

```bash
# Backend tests
cd backend
dotnet test

# Frontend lint
cd frontend
npm run lint
```

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
