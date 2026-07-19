# Technology Stack

**Analysis Date:** 2026-07-08 (updated)

## Languages

**Primary:**
- C# 13 / .NET 9 target - Backend Web API in `backend/src/IPCManagement.Api/IPCManagement.Api.csproj`.
- TypeScript 6.0 - Frontend React application in `frontend/src/**/*.ts` and `frontend/src/**/*.tsx`.

**Secondary:**
- JavaScript ES modules - Root tooling in `package.json`, `commitlint.config.js`, and frontend build config in `frontend/vite.config.ts`.
- CSS - Application styles in `frontend/src/styles/index.css` and `frontend/src/styles/App.css`.
- JSON - Runtime/configuration files including `backend/src/IPCManagement.Api/appsettings.json`, `backend/src/IPCManagement.Api/appsettings.json.example`, `backend/src/IPCManagement.Api/Properties/launchSettings.json`, `frontend/tsconfig.json`, and package manifests.

## Runtime

**Environment:**
- .NET 9 runtime / ASP.NET Core - `backend/src/IPCManagement.Api/IPCManagement.Api.csproj` targets `net9.0`; `README.md` lists .NET 9 SDK as a requirement.
- Node.js 18+ - `README.md` lists Node.js 18+ for frontend development and root workspace scripts in `package.json`.
- Browser runtime - React SPA bootstraps through `frontend/src/main.tsx` and `frontend/index.html`.
- MySQL 8+ server - `README.md` lists MySQL 8+ and backend EF Core uses Pomelo MySQL in `backend/src/IPCManagement.Api/DependencyInjection.cs`.

**Package Manager:**
- npm workspaces - Root `package.json` declares `workspaces: ["frontend"]`.
- Lockfile: present at `package-lock.json`.
- NuGet - Backend dependencies are declared in `backend/src/IPCManagement.Api/IPCManagement.Api.csproj` and test project files under `backend/tests/**`.

## Frameworks

**Core:**
- ASP.NET Core 9.0 - HTTP API host, controllers, middleware, auth, CORS, rate limiting, and Swagger setup in `backend/src/IPCManagement.Api/Program.cs`.
- Entity Framework Core 9.0.16 - ORM and DbContext in `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`.
- Pomelo.EntityFrameworkCore.MySql 9.0.0 - MySQL EF provider configured in `backend/src/IPCManagement.Api/DependencyInjection.cs`.
- React 19.2.6 - Frontend UI runtime declared in `frontend/package.json`.
- Vite 8.0.12 - Frontend dev server and build tool declared in `frontend/package.json` and configured in `frontend/vite.config.ts`.
- Redux Toolkit 2.12.0 / RTK Query - App state and API calls in `frontend/src/app/store.ts` and `frontend/src/api/apiSlice.ts`.
- React Router DOM 7.17.0 - Client routing declared in `frontend/package.json` and route files under `frontend/src/routes/`.

**Testing:**
- xUnit 2.9.2 - Backend test runner in `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`.
- FluentAssertions 8.10.0 - Backend assertion library in `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`.
- NSubstitute 5.3.0 - Backend mocking library in `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`.
- Microsoft.AspNetCore.Mvc.Testing 9.0.16 - ASP.NET integration test support in `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`.
- coverlet.collector 6.0.2 - Coverage collector in `backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj`.
- Playwright 1.60.0 - Frontend E2E/smoke/visual test runner in `frontend/playwright.config.ts`; test files in `frontend/tests/`.

**Build/Dev:**
- TypeScript project references - Root frontend config in `frontend/tsconfig.json`; app/node configs in `frontend/tsconfig.app.json` and `frontend/tsconfig.node.json`.
- ESLint 10.3.0 with TypeScript ESLint 8.59.2 - Frontend linting in `frontend/eslint.config.js`.
- Tailwind CSS 4.3.0 with `@tailwindcss/vite` 4.3.0 - Vite plugin registered in `frontend/vite.config.ts`.
- shadcn 4.11.0, Base UI, class-variance-authority, clsx, tailwind-merge, lucide-react - UI component and styling support declared in `frontend/package.json`.
- Husky 9.1.7 and Commitlint 21.0.2 - Git hook and commit message tooling declared in root `package.json` and `commitlint.config.js`.

## Key Dependencies

**Critical:**
- `Microsoft.AspNetCore.Authentication.JwtBearer` 9.0.16 - JWT authentication middleware configured in `backend/src/IPCManagement.Api/Program.cs`.
- `System.IdentityModel.Tokens.Jwt` 8.12.1 - Token generation/validation used by `backend/src/IPCManagement.Api/Security/JwtTokenService.cs`.
- `BCrypt.Net-Next` 4.2.0 - Password hashing support used by the auth domain in `backend/src/IPCManagement.Api/Services/AuthService.cs`.
- `Microsoft.EntityFrameworkCore` 9.0.16 and `Pomelo.EntityFrameworkCore.MySql` 9.0.0 - Database access path for repositories and services under `backend/src/IPCManagement.Api/Data/`.
- `@reduxjs/toolkit` 2.12.0 and `react-redux` 9.3.0 - State/API infrastructure in `frontend/src/app/store.ts` and `frontend/src/api/apiSlice.ts`.
- `react` 19.2.6 and `react-dom` 19.2.6 - Main frontend render stack in `frontend/src/main.tsx`.

**Infrastructure:**
- `Serilog.AspNetCore` 8.0.3 - Console and rolling file logging configured in `backend/src/IPCManagement.Api/Program.cs`; logs write under `backend/src/IPCManagement.Api/logs/` at runtime.
- `Swashbuckle.AspNetCore` 7.3.1 and `Microsoft.AspNetCore.OpenApi` 9.0.16 - Swagger/OpenAPI endpoints configured in `backend/src/IPCManagement.Api/Program.cs`.
- `FluentValidation.AspNetCore` 11.3.0 - Automatic model validation registered in `backend/src/IPCManagement.Api/Program.cs`; validators live in `backend/src/IPCManagement.Api/Models/Validators/`.
- `date-fns` 4.4.0 - Frontend date utility dependency declared in `frontend/package.json`.
- `lucide-react` 1.17.0 - Frontend icon library declared in `frontend/package.json`.

## Configuration

**Environment:**
- Backend runtime config uses ASP.NET Core configuration providers with JSON files in `backend/src/IPCManagement.Api/appsettings.json`, `backend/src/IPCManagement.Api/appsettings.Development.json`, and sample keys in `backend/src/IPCManagement.Api/appsettings.json.example`.
- Required backend sections are `ConnectionStrings:DefaultConnection`, `JwtSettings:SecretKey`, `JwtSettings:Issuer`, `JwtSettings:Audience`, `JwtSettings:ExpiryMinutes`, `JwtSettings:RefreshExpiryDays`, `Cors:AllowedOrigins`, and `Pagination:MaxPageSize`.
- Launch profiles in `backend/src/IPCManagement.Api/Properties/launchSettings.json` set `ASPNETCORE_ENVIRONMENT=Development` and serve HTTP on `http://localhost:5262` plus HTTPS on `https://localhost:7004`.
- Frontend API calls use a relative `/api` base URL in `frontend/src/api/apiSlice.ts`; Vite proxies `/api` to `http://localhost:5262` in `frontend/vite.config.ts`.
- No `.env`, `.env.*`, or `*.env` files were detected during the scan.

**Build:**
- Root npm scripts in `package.json`: `npm run fe` (Vite), `npm run be` (.NET API), `npm run build:be`, `npm run test:be` (xUnit), `npm run lint:fe`, `npm run build:fe`, `npm run verify` (full build+test+lint chain), `npm run commitlint`.
- Frontend scripts in `frontend/package.json`: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`, `npm run test:smoke`, `npm run test:visual`, `npm run test:visual:update`.
- Backend commands: `dotnet restore backend/src/IPCManagement.Api/IPCManagement.Api.csproj`, `dotnet build`, `dotnet run --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj`.
- Backend solution file is `backend/IPCManagement.slnx`; project file is `backend/src/IPCManagement.Api/IPCManagement.Api.csproj`.
- Deployment manifests: `vercel.json` at repo root (API rewrites) and `frontend/vercel.json` (SPA routing).
- Frontend Vite config is `frontend/vite.config.ts`; frontend TypeScript configs are `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, and `frontend/tsconfig.node.json`.

## Platform Requirements

**Development:**
- Install .NET 9 SDK, Node.js 18+, npm, and MySQL 8+ as documented in `README.md`.
- Start backend on `http://localhost:5262` using `npm run be` from root or `dotnet run --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj`.
- Start frontend on `http://localhost:5173` using `npm run fe` from root or `npm run dev` from `frontend/`.
- Configure `backend/src/IPCManagement.Api/appsettings.json` from `backend/src/IPCManagement.Api/appsettings.json.example` before running database-backed API features.

**Production:**
- Deployment: `vercel.json` manifests present at root and `frontend/`.
- ASP.NET Core production mode restricts CORS, rejects sample passwords/secrets, và disallows wildcard `AllowedHosts`.
- Frontend production build: `npm run build:fe`; Vite outputs to `frontend/dist/`.
- **No mock data**: Frontend không còn mock arrays hay seed data; mọi dữ liệu đều từ live API.

---

*Stack analysis: refreshed 2026-07-19. See `INTEGRATIONS.md`, `TESTING.md` and `CONCERNS.md` for current workflow/runtime evidence.*
