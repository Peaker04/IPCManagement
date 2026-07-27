# Technology Stack

**Analysis Date:** 2026-07-27

## Languages

**Primary:**
- C# 13 / .NET 9 - ASP.NET Core API, domain logic, EF Core persistence, migrations, database tooling, and xUnit tests in `backend/src/IPCManagement.Api/`, `backend/tools/IPCManagement.DatabaseTool/`, and `backend/tests/`.
- TypeScript 6.0 - React application, Redux/RTK Query data layer, generated OpenAPI types, Vitest tests, and Playwright tests in `frontend/src/` and `frontend/tests/`.

**Secondary:**
- JavaScript (ES modules) - root tooling and frontend lint/build configuration in `package.json`, `commitlint.config.js`, `frontend/eslint.config.js`, and `frontend/vite.config.ts`.
- CSS - Tailwind CSS 4 entry point plus application styles in `frontend/src/styles/` and `frontend/src/index.css`.
- SQL/MySQL dialect - baseline and migration support scripts in `backend/database/` plus SQL emitted by EF migrations in `backend/src/IPCManagement.Api/Migrations/`.
- PowerShell - local E2E and maintenance automation in `scripts/`.
- Bash/YAML - Shipyard lifecycle hooks in `shipyard/profiles/IPCManagement/hooks/` and GitHub Actions in `.github/workflows/`.

## Runtime

**Environment:**
- .NET SDK/runtime 9.0; all backend projects target `net9.0` in `backend/src/IPCManagement.Api/IPCManagement.Api.csproj`, `backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj`, and `backend/tests/*/*.csproj`.
- Node.js 20 in CI, configured by `.github/workflows/verify.yml`; use Node 20 locally to match CI even though `README.md` only states Node 18+.
- Browser runtime for the SPA; Vite development server defaults to port 5173 in `frontend/vite.config.ts`.
- MySQL 8.0 service in CI via `.github/workflows/verify.yml`; production requires MySQL 8 or a Pomelo-compatible server.

**Package Manager:**
- npm workspaces, with root workspace `frontend` declared in `package.json`.
- Lockfile: present at `package-lock.json` (lockfileVersion 3); use `npm ci` for reproducible installs.
- NuGet packages are resolved through project files; no central package-management file is detected.
- Local .NET tools are pinned in `dotnet-tools.json`.

## Frameworks

**Core:**
- ASP.NET Core 9 (`Microsoft.NET.Sdk.Web`, `Microsoft.AspNetCore.*` 9.0.16) - REST API, middleware, JWT bearer authentication, authorization policies, rate limiting, health checks, response compression, and OpenAPI in `backend/src/IPCManagement.Api/Program.cs`.
- Entity Framework Core 9.0.16 with Pomelo.EntityFrameworkCore.MySql 9.0.0 - MySQL ORM, schema model, and migrations in `backend/src/IPCManagement.Api/Data/` and `backend/src/IPCManagement.Api/Migrations/`.
- React 19.2.6 and React DOM 19.2.6 - SPA UI rooted at `frontend/src/main.tsx`.
- Redux Toolkit 2.12.0, React Redux 9.3.0, and RTK Query - global/session state and API cache through `frontend/src/app/store.ts` and `frontend/src/api/apiSlice.ts`.
- React Router DOM 7.17.0 - client-side routing in `frontend/src/app/`.
- Tailwind CSS 4.3.0 with `@tailwindcss/vite` 4.3.0 - build-time styling integration in `frontend/vite.config.ts`.
- Base UI 1.5.0, shadcn 4.11.0, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.6.0, tw-animate-css 1.4.0, and lucide-react 1.17.0 - UI primitives, variants, class composition, animation utilities, and icons in `frontend/src/components/`.

**Testing:**
- xUnit 2.9.2 with Microsoft.NET.Test.Sdk 17.12.0 - backend unit and integration tests in `backend/tests/`.
- FluentAssertions 8.10.0 and NSubstitute 5.3.0 - backend assertions and test doubles.
- Microsoft.AspNetCore.Mvc.Testing 9.0.16 - in-process API integration hosting in `backend/tests/IPCManagement.Api.Tests/`.
- EF Core InMemory and SQLite 9.0.16 - test persistence substitutes in `backend/tests/IPCManagement.Api.Tests/`.
- Vitest 4.1.10, jsdom 29.1.1, and Testing Library - frontend unit/component tests co-located under `frontend/src/**/*.test.{ts,tsx}`.
- Playwright 1.60.0 - Chromium E2E, control-surface, performance, smoke, and visual suites under `frontend/tests/`, configured by `frontend/playwright.config.ts`.
- coverlet.collector 6.0.2, Vitest V8 coverage 4.1.10, and ReportGenerator 5.5.10 - coverage collection/reporting through `backend/coverage.runsettings`, `frontend/vite.config.ts`, and `dotnet-tools.json`.

**Build/Dev:**
- Vite 8.0.12 with `@vitejs/plugin-react` 6.0.1 - frontend dev server and production bundler via `frontend/vite.config.ts`.
- TypeScript project references - frontend type-check/build settings in `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, and `frontend/tsconfig.node.json`.
- ESLint 10.3.0, typescript-eslint 8.59.2, React Hooks plugin 7.1.1, and React Refresh plugin 0.5.2 - frontend static analysis via `frontend/eslint.config.js`.
- dependency-cruiser 18.1.0 - frontend dependency-boundary enforcement via `frontend/.dependency-cruiser.cjs` and `frontend/.dependency-cruiser-known-violations.json`.
- Swashbuckle.AspNetCore/CLI 7.3.1 and openapi-typescript 7.13.0 - deterministic `openapi.json` and TypeScript contract generation through root scripts `gen:api` and `check:api-contract` in `package.json`.
- Husky 9.1.7 and Commitlint 21.0.2 - Git hooks and Conventional Commit validation via `.husky/` and `commitlint.config.js`.

## Key Dependencies

**Critical:**
- `Pomelo.EntityFrameworkCore.MySql` 9.0.0 - maps the EF Core domain model to MySQL; configured in `backend/src/IPCManagement.Api/DependencyInjection.cs`.
- `Microsoft.AspNetCore.Authentication.JwtBearer` 9.0.16 and `System.IdentityModel.Tokens.Jwt` 8.12.1 - access-token validation and JWT generation in `backend/src/IPCManagement.Api/Program.cs` and `backend/src/IPCManagement.Api/Security/`.
- `BCrypt.Net-Next` 4.2.0 - password hashing for the custom authentication system.
- `FluentValidation.AspNetCore` 11.3.0 - automatic request validation; validators are assembly-scanned in `backend/src/IPCManagement.Api/Program.cs`.
- `@reduxjs/toolkit` 2.12.0 - shared HTTP/cache layer and endpoint injection in `frontend/src/api/apiSlice.ts` and `frontend/src/api/`.
- `date-fns` 4.4.0 - frontend date calculations and formatting.

**Infrastructure:**
- `Serilog.AspNetCore` 8.0.3 and `Serilog.Sinks.Async` 1.5.0 - structured request/application logging to console and rolling JSONL files in `backend/src/IPCManagement.Api/Program.cs`.
- ASP.NET Core in-memory cache - report/cache acceleration registered with `AddMemoryCache` in `backend/src/IPCManagement.Api/Program.cs`; this is process-local, not distributed.
- ASP.NET Core response compression - Brotli/HTTPS responses configured in `backend/src/IPCManagement.Api/Program.cs`.
- `MySqlConnector` 2.4.0 - direct database access for `backend/tools/IPCManagement.DatabaseTool/`.

## Configuration

**Environment:**
- Backend configuration uses ASP.NET Core configuration binding: JSON runtime files plus double-underscore environment overrides. Required production keys are documented in `docs/CONFIGURATION.md`: `ConnectionStrings__DefaultConnection`, `JwtSettings__SecretKey`, `JwtSettings__Issuer`, `JwtSettings__Audience`, `JwtSettings__ExpiryMinutes`, `JwtSettings__RefreshExpiryDays`, `Cors__AllowedOrigins__0`, and `AllowedHosts`.
- Optional backend settings include `ASPNETCORE_ENVIRONMENT`/`DOTNET_ENVIRONMENT`, `ForwardedHeaders__KnownProxies`, `RateLimiting__ApiPermitLimit`, and pagination settings used by `backend/src/IPCManagement.Api/Program.cs` and options classes.
- Frontend build/runtime keys are `VITE_API_BASE_URL`, `VITE_PROXY_TARGET`, and development-only `VITE_ENABLE_MOCK_LOGIN`, referenced in `frontend/src/api/apiSlice.ts`, `frontend/src/features/auth/`, `frontend/vite.config.ts`, and `frontend/playwright.config.ts`.
- Test/automation-only keys include `IPC_TEST_CONNECTION_STRING`, `IPC_RUN_MYSQL_MIGRATION_TESTS`, `IPC_E2E_USERNAME`, `IPC_E2E_PASSWORD`, `IPC_E2E_TEMPLATE_PATH`, and `K6_PASSWORD`, referenced by `.github/workflows/verify.yml`, backend integration tests, `scripts/`, and `docs/DEVELOPMENT.md`.
- `.env.example` is present at repository root; its contents must not be copied into generated documentation. Real secrets belong in environment variables or the hosting secret manager, per `docs/CONFIGURATION.md`.

**Build:**
- Root orchestration and workspace scripts: `package.json`.
- Frontend bundling/test configuration: `frontend/vite.config.ts`.
- TypeScript configuration: `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`.
- Backend project configuration: `backend/src/IPCManagement.Api/IPCManagement.Api.csproj` and `backend/IPCManagement.slnx`.
- CI quality/security gates: `.github/workflows/verify.yml` and `.github/workflows/codeql.yml`.
- Frontend deployment: root `vercel.json`; backend has no Dockerfile or provider-specific deployment manifest.

## Platform Requirements

**Development:**
- Git, .NET 9 SDK, Node.js 20 with npm, and MySQL 8.0 as specified in `docs/GETTING-STARTED.md` and `.github/workflows/verify.yml`.
- Run `npm ci`, restore/build the backend, configure a non-secret local backend runtime file or environment variables, then use `npm run be` and `npm run fe` from `package.json`.
- Default local endpoints are API `http://localhost:5262`, HTTPS API `https://localhost:7004`, Swagger `http://localhost:5262/swagger`, and frontend `http://localhost:5173`, per `backend/src/IPCManagement.Api/Properties/launchSettings.json` and `docs/GETTING-STARTED.md`.
- Shipyard uses per-lane API/frontend/database settings and hooks under `shipyard/profiles/IPCManagement/`; it builds .NET Release plus the Vite frontend, then runs source-backed processes.

**Production:**
- Frontend targets Vercel as a static Vite SPA, built from repository root into `frontend/dist` with SPA rewrites and security headers in `vercel.json`.
- Backend requires a separate .NET 9-capable host plus reachable MySQL, TLS/reverse proxy configuration, forwarded-header proxy allowlisting, production CORS origins, JWT settings, and host validation; no backend hosting provider is selected in `docs/DEPLOYMENT.md`.
- Generated API contracts in `frontend/src/shared/api/contracts/openapi.json` and `frontend/src/shared/api/contracts/schema.ts` must remain synchronized through `npm run check:api-contract`.

---

*Stack analysis: 2026-07-27*
