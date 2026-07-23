<!-- generated-by: gsd-doc-writer -->
# Getting Started

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| .NET SDK | 9.0+ | Backend runtime and build |
| Node.js | 18+ | Frontend development |
| MySQL | 8.0+ | Database server |
| Git | any recent | Version control |

## Installation Steps

### 1. Clone the repository

```bash
git clone https://github.com/Peaker04/IPCManagement.git
cd IPCManagement
```

### 2. Backend Setup

```bash
# Navigate to backend
cd backend/src/IPCManagement.Api

# Copy configuration template
cp appsettings.json.example appsettings.json

# Edit appsettings.json with your database credentials
# Update ConnectionStrings.DefaultConnection with your MySQL password
```

### 3. Database Setup

```bash
# Create database (if not exists)
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ipcmanagement;"

# Run EF migrations
dotnet ef database update --project IPCManagement.Api.csproj
```

### 4. Frontend Setup

```bash
# From project root
cd frontend
npm install
```

## First Run

### Start Backend

```bash
# From project root
npm run be

# Or from backend directory
cd backend/src/IPCManagement.Api
dotnet run
```

API runs at: `http://localhost:5262`
Swagger UI: `http://localhost:5262/swagger`

### Start Frontend

```bash
# From project root
npm run fe

# Or from frontend directory
cd frontend
npm run dev
```

Frontend runs at: `http://localhost:5173`

## Common Setup Issues

### Port Already in Use

If port 5262 is occupied:
```bash
dotnet run --project backend/src/IPCManagement.Api --urls http://localhost:5263
```

### Database Connection Failed

Verify MySQL is running and credentials in `appsettings.json` are correct:
```json
"ConnectionStrings": {
  "DefaultConnection": "server=localhost;port=3306;database=ipcmanagement;user=root;password=YOUR_PASSWORD;"
}
```

### EF Migration Issues

For existing databases created before EF migrations:
```bash
# Run the init script first
mysql -u root -p ipcmanagement < backend/database/Init_EF_History_For_Old_DB.sql
dotnet ef database update --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj
```

## Next Steps

- Read [DEVELOPMENT.md](DEVELOPMENT.md) for local development workflow
- Read [TESTING.md](TESTING.md) for testing guidelines
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design
