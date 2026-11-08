# Auth 500 & Session Refresh Must-Fix Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 2 Must-Fix items (`M1`, `M2`) from the `/ponytail-audit` investigation: synchronize the missing `20261107183023_FreezeMrxBomConversionRates` database migration with a Development startup auto-migration guard (`M1`), and enforce explicit `credentials: 'same-origin'` cookie transport on `/api/auth/*` requests with credential-capable Development CORS (`M2`).

**Architecture:** Surgical fixes at existing owners ([`MigrationHealthCheck.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/backend/src/IPCManagement.Api/HealthChecks/MigrationHealthCheck.cs), [`Program.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/backend/src/IPCManagement.Api/Program.cs), and [`client.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/api/client.ts)) backed by unit/contract tests in [`MigrationHealthCheckTests.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/backend/tests/IPCManagement.Api.Tests/MigrationHealthCheckTests.cs) and [`ApiContracts.test.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/__tests__/ApiContracts.test.ts). All Should-fix (`#3–#5`) and Nice-to-have (`#6`) audit items remain untouched.

**Tech Stack:** ASP.NET Core 9.0, EF Core (Pomelo MySQL), xUnit, React 18, TypeScript, Vitest.

---

### Task 1: Database Migration Synchronization & Development Startup Migration Guard (`M1` / `AC-M1`)

**Files:**
- Modify: `backend/src/IPCManagement.Api/HealthChecks/MigrationHealthCheck.cs`
- Modify: `backend/src/IPCManagement.Api/Program.cs`
- Test: `backend/tests/IPCManagement.Api.Tests/MigrationHealthCheckTests.cs`

- [ ] **Step 1: Write failing unit tests in `MigrationHealthCheckTests.cs` (RED)**
  Add tests for `MigrationHealthCheck.EnsurePendingMigrationsAppliedAsync` verifying that:
  1. When `getPendingMigrations` returns pending migrations, `migrateAsync` is invoked once and returns the applied migration names.
  2. When `getPendingMigrations` returns an empty list, `migrateAsync` is not invoked and returns an empty list.

- [ ] **Step 2: Run `dotnet test` on `MigrationHealthCheckTests` to confirm compilation/test failure (RED)**
  Run: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~MigrationHealthCheckTests"`

- [ ] **Step 3: Implement `EnsurePendingMigrationsAppliedAsync` in `MigrationHealthCheck.cs` and wire into `Program.cs` in Development (GREEN)**
  - In `MigrationHealthCheck.cs`, add `EnsurePendingMigrationsAppliedAsync(IpcDbContext, ILogger, CancellationToken)` and an overload accepting delegates `(Func<CancellationToken, Task<IEnumerable<string>>> getPendingMigrations, Func<CancellationToken, Task> migrateAsync, ILogger logger, CancellationToken ct)` for deterministic unit testing.
  - In `Program.cs`, inside the startup validation scope, if `app.Environment.IsDevelopment()` and `startupDb.Database.IsRelational()`, invoke `await MigrationHealthCheck.EnsurePendingMigrationsAppliedAsync(startupDb, app.Logger)`.

- [ ] **Step 4: Run `MigrationHealthCheckTests` and restart Backend dev server to apply `20261107183023_FreezeMrxBomConversionRates` (GREEN)**
  - Stop running Backend daemon briefly so `IPCManagement.Api.dll` is unlocked, run `MigrationHealthCheckTests`, restart `npm run be`, and verify `curl.exe -s -i http://localhost:5262/health/ready` reports `migrations: Healthy`.

---

### Task 2: Same-Origin Cookie Credentials on `/api/auth/*` & Development CORS Credentials (`M2` / `AC-M2`)

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `backend/src/IPCManagement.Api/Program.cs`
- Test: `frontend/src/__tests__/ApiContracts.test.ts`

- [ ] **Step 1: Write failing contract test in `ApiContracts.test.ts` (RED)**
  Add a test verifying that calling `authApi.login` (`/auth/login`) and `authApi.logout` (`/auth/revoke`) through `authenticatedFetch` dispatches `fetch` to `${window.location.origin}/api/auth/...` with `credentials: 'same-origin'`.

- [ ] **Step 2: Run Vitest on `ApiContracts.test.ts` to observe failure (RED)**
  Run: `npx vitest run src/__tests__/ApiContracts.test.ts` (in `frontend/`)

- [ ] **Step 3: Implement explicit `credentials: options.credentials ?? 'same-origin'` for `/auth/*` in `client.ts` and `AllowCredentials()` in Development CORS in `Program.cs` (GREEN)**
  - In `frontend/src/api/client.ts`, hoist `isAuthRequest` before `send` and include `...(isAuthRequest ? { credentials: options.credentials ?? 'same-origin' } : {})` in the `fetch` init object so `/auth/login`, `/auth/revoke`, and `/auth/logout` always include same-origin cookie credentials while non-auth calls keep their exact option shape.
  - In `backend/src/IPCManagement.Api/Program.cs`, update `FrontendPolicy` in `Development` to use `SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials().WithExposedHeaders(CorrelationIdMiddleware.HeaderName)`.

- [ ] **Step 4: Run Frontend contract tests, lint, and build to verify zero regressions (GREEN)**
  Run:
  - `npx vitest run src/__tests__/ApiContracts.test.ts src/__tests__/FileDownload.test.ts src/__tests__/Auth.test.tsx`
  - `npm run lint:fe`
  - `npm run build:fe`
