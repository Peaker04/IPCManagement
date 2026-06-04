# 🍳 IPC Management System

**Hệ thống quản lý bếp ăn công nghiệp** (Industrial & Production Catering Management)

## 📁 Cấu trúc Monorepo

```
IPCManagement/
├── backend/                 # .NET 9 Web API (Clean Architecture)
│   ├── src/
│   │   ├── IPCManagement.Api/           # Controllers, Middlewares
│   │   ├── IPCManagement.Application/   # DTOs, Services, Interfaces
│   │   ├── IPCManagement.Domain/        # Domain Entities
│   │   └── IPCManagement.Infrastructure/# EF Core, Repositories, Security
│   └── tests/
│       ├── IPCManagement.Api.Tests/
│       └── IPCManagement.Application.Tests/
├── frontend/                # React + Vite + TypeScript
│   ├── src/
│   └── ...
├── .gitignore
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

Cập nhật connection string trong `backend/src/IPCManagement.Api/appsettings.json`:

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

# Frontend tests
cd frontend
npm test
```

## 📝 Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Frontend   | React, Vite, TypeScript             |
| Backend    | ASP.NET Core 9, C#                  |
| Database   | MySQL 8+ (Pomelo EF Core)           |
| Auth       | JWT Bearer Authentication           |
| Testing    | xUnit, NSubstitute, FluentAssertions|
