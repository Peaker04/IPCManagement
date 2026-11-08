# Auth 500 & Session Refresh Must-Fix Closure Design (`M1–M2`)

**Date:** 2026-11-08  
**Scope:** `FR-RECON`, `FR-AUTH`, `FR-SYS` (`M1`, `M2` only — Should-fix `#3–#5` and Nice-to-have `#6` are explicitly deferred per user instruction)  
**Operational Mode:** `DEFAULT` & `MATERIAL_RECONCILIATION` (`DOM-MODE-1` preserved)

---

## 1. Context & Problem Statement

Following the `/ponytail-audit` investigation into HTTP 500 errors during active usage and unexpected session drops back to `/login`, two **Must-Fix (`M1`, `M2`)** root causes were identified and authorized for immediate closure:

1. **`M1` — Unapplied Database Migration & Missing Development Startup Migration Guard (`FR-RECON` / `FR-SYS`):**
   - The MySQL database (`ipcmanagement`) was missing EF Core migration `20261107183023_FreezeMrxBomConversionRates`, which adds `FrozenBomUnitToBaseRate` and `FrozenCanonicalUnitToBaseRate` to `reconciliationbatchcontributors`.
   - Every query or command touching `ReconciliationBatchContributors` (`GET /dishes`, `GET /kitchen-cooking`, `GET /variance-register`, `GET /export-workbook`, `POST /quantity-import/commit`) crashed with `MySqlException (0x80004005): Unknown column 'r0.FrozenBomUnitToBaseRate' in 'field list'`, surfacing as `HTTP 500` via `ExceptionMiddleware`.
   - Although `/health/ready` ([`MigrationHealthCheck.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/backend/src/IPCManagement.Api/HealthChecks/MigrationHealthCheck.cs)) reported `503 Service Unavailable`, [`Program.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/backend/src/IPCManagement.Api/Program.cs) did not automatically apply pending relational migrations on startup in `Development`.

2. **`M2` — Same-Origin Auth Cookie Transport & Development CORS Credentials (`FR-AUTH`):**
   - `AuthController` stores the `refreshToken` in an `HttpOnly; SameSite=Strict; Path=/api/auth` cookie.
   - While `refreshAccessToken()` in [`frontend/src/api/client.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/api/client.ts) explicitly passed `credentials: 'same-origin'`, `authenticatedFetch()` did not explicitly set `credentials: options.credentials ?? 'same-origin'` on `/auth/*` requests (`/auth/login`, `/auth/revoke`, `/auth/logout`), and `FrontendPolicy` in [`Program.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/backend/src/IPCManagement.Api/Program.cs) used `AllowAnyOrigin()` in `Development` (which does not support credentialed cross-origin requests if configured Origins are used).

---

## 2. Explicit Scope Boundary

- **In Scope (`Must Fix` only):**
  - **`M1` (`AC-M1`):**
    1. Apply pending EF Core migrations (`20261107183023_FreezeMrxBomConversionRates`) to the MySQL database.
    2. Add `MigrationHealthCheck.EnsureDevelopmentMigrationsAppliedAsync(IpcDbContext, ILogger, CancellationToken)` and invoke it during `Development` startup in [`Program.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/backend/src/IPCManagement.Api/Program.cs) so relational databases in `Development` automatically apply pending migrations before serving traffic.
    3. Verify `/health/ready` reports `migrations: Healthy` and MRX endpoints (`GET /api/reconciliation/batches/{batchId}/dishes`) no longer throw HTTP 500.
  - **`M2` (`AC-M2`):**
    1. Update `authenticatedFetch` in [`frontend/src/api/client.ts`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/frontend/src/api/client.ts) so `/auth/*` requests (`isAuthRequest`) explicitly set `credentials: options.credentials ?? 'same-origin'` while preserving exact call signatures for non-auth requests (`FileDownload.test.ts` and `ApiContracts.test.ts`).
    2. Update `FrontendPolicy` in [`Program.cs`](file:///d:/ki7/PRN222%20Doanh%20Nghiệp/IPCManagement/backend/src/IPCManagement.Api/Program.cs) in `Development` to use `SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials().WithExposedHeaders(CorrelationIdMiddleware.HeaderName)` so credentialed cookie transport works reliably in local development.

- **Out of Scope (Deferred until explicitly requested by user):**
  - Should-fix `#3`: `OperationCanceledException` handling in `ExceptionMiddleware.cs`.
  - Should-fix `#4`: `requireSameSession` cross-tab refresh adoption in `client.ts`.
  - Should-fix `#5`: `SessionExpiredModal` grace path before hard `/login` redirect.
  - Nice-to-have `#6`: `AuthService` per-user refresh semaphore timeout adjustment.

---

## 3. Acceptance Criteria

- **`AC-M1`:**
  - `MigrationHealthCheckTests` verifies `EnsureDevelopmentMigrationsAppliedAsync` behavior (no-op when no pending migrations exist; applies migrations and logs when pending migrations exist).
  - Live `GET http://localhost:5262/health/ready` returns `migrations.status === "Healthy"`.
  - Live MRX endpoints (`/dishes`, `/kitchen-cooking`, `/variance-register`) execute without `Unknown column 'r0.FrozenBomUnitToBaseRate'` HTTP 500 errors.
- **`AC-M2`:**
  - `ApiContracts.test.ts` verifies `/auth/login` and `/auth/revoke` requests pass `credentials: 'same-origin'` against `${window.location.origin}/api/auth/*`.
  - `FileDownload.test.ts`, `Auth.test.tsx`, `npm run lint:fe`, and `npm run build:fe` pass with zero regressions.
