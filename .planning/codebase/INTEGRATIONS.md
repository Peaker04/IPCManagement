# External Integrations

**Analysis Date:** 2026-07-27

## APIs & External Services

**Application API:**
- IPCManagement ASP.NET Core REST API - the React SPA's only detected runtime service dependency.
  - SDK/Client: Redux Toolkit Query base API in `frontend/src/api/apiSlice.ts`, with feature endpoints injected from `frontend/src/api/` and `frontend/src/features/`.
  - Addressing: same-origin `/api` by default; `VITE_API_BASE_URL` selects a separate backend origin and `VITE_PROXY_TARGET` selects the local Vite proxy target in `frontend/vite.config.ts`.
  - Auth: Bearer access token plus refresh-token flow; frontend prepares the `Authorization` header and handles refresh/session state through `frontend/src/api/apiSlice.ts` and `frontend/src/features/auth/`.

**API Contract Tooling:**
- OpenAPI/Swagger - development discovery and generated frontend contracts.
  - SDK/Client: Swashbuckle.AspNetCore 7.3.1, Swashbuckle CLI 7.3.1, Microsoft.AspNetCore.OpenApi 9.0.16, and openapi-typescript 7.13.0.
  - Artifacts: `frontend/src/shared/api/contracts/openapi.json` and `frontend/src/shared/api/contracts/schema.ts`.
  - Generation: root `package.json` scripts `gen:api:spec`, `gen:api`, and `check:api-contract`.

**Third-Party Business APIs:**
- Not detected. No Stripe, AWS, Azure, Supabase, Firebase, email/SMS, maps, ERP/SAP remote API, or other external service SDK is referenced in `backend/src/IPCManagement.Api/IPCManagement.Api.csproj`, `frontend/package.json`, or application imports.
- SAP Fiori is a UI/design convention in project guidance, not a detected SAP system integration.

## Data Storage

**Databases:**
- MySQL 8.0 or compatible server - authoritative operational store for users, catalog, planning, purchasing, inventory, workflow, audit, and migrations.
  - Connection: ASP.NET Core key `ConnectionStrings:DefaultConnection`, normally supplied as `ConnectionStrings__DefaultConnection`; shape and validation are documented in `docs/CONFIGURATION.md`.
  - Client: Entity Framework Core 9.0.16 with Pomelo.EntityFrameworkCore.MySql 9.0.0 in `backend/src/IPCManagement.Api/DependencyInjection.cs` and `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`.
  - Direct client: MySqlConnector 2.4.0 in `backend/tools/IPCManagement.DatabaseTool/IPCManagement.DatabaseTool.csproj`.
  - Schema management: EF migrations in `backend/src/IPCManagement.Api/Migrations/`, baseline/support SQL in `backend/database/`, and migration/model parity gates in `.github/workflows/verify.yml`.

**File Storage:**
- Local filesystem and embedded resources only; no external object-storage provider is detected.
- The backend embeds the default weekly-menu XLSX template from `backend/src/IPCManagement.Api/Resources/Templates/weekly-menu-template-ANV-default.xlsx` via `backend/src/IPCManagement.Api/IPCManagement.Api.csproj`.
- Serilog writes rolling structured logs to `logs/ipc-.jsonl` from `backend/src/IPCManagement.Api/Program.cs`; retention is 30 files.
- Test/evidence artifacts are local or uploaded by CI from `.artifacts/test-results` in `.github/workflows/verify.yml`.

**Caching:**
- ASP.NET Core process-local `IMemoryCache`, registered in `backend/src/IPCManagement.Api/Program.cs` and used by report services/controllers such as `backend/src/IPCManagement.Api/Features/Reports/Controllers/WorkflowReportsController.cs`.
- Redux Toolkit Query client cache in `frontend/src/api/apiSlice.ts`, with domain-scoped invalidation tags in `frontend/src/api/workflowCacheTags.ts`.
- No Redis, Memcached, CDN cache API, or other distributed cache is detected.

## Authentication & Identity

**Auth Provider:**
- Custom application identity backed by MySQL; no hosted identity provider is detected.
  - Implementation: ASP.NET Core JWT bearer authentication in `backend/src/IPCManagement.Api/Program.cs`, token generation/rotation in `backend/src/IPCManagement.Api/Security/`, BCrypt password hashing, and role/policy authorization in `backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs`.
  - Access token: signed JWT validated against `JwtSettings:SecretKey`, `Issuer`, `Audience`, and lifetime.
  - Refresh token: rotation is handled by backend auth endpoints; browser flow is implemented in `frontend/src/features/auth/` and the RTK Query base layer.
  - Configuration: `JwtSettings__SecretKey`, `JwtSettings__Issuer`, `JwtSettings__Audience`, `JwtSettings__ExpiryMinutes`, and `JwtSettings__RefreshExpiryDays`.
  - Development-only bypass: `VITE_ENABLE_MOCK_LOGIN`; it must remain disabled in production per `docs/CONFIGURATION.md` and `docs/DEPLOYMENT.md`.

## Monitoring & Observability

**Error Tracking:**
- No external error-tracking or APM provider detected. `docs/DEPLOYMENT.md` explicitly notes no Sentry, Datadog, New Relic, or OpenTelemetry integration in current dependencies/configuration.

**Logs:**
- Serilog emits human-readable console logs in Development and compact JSON console logs outside Development in `backend/src/IPCManagement.Api/Program.cs`.
- `UseSerilogRequestLogging` records HTTP access logs; `CorrelationIdMiddleware` in `backend/src/IPCManagement.Api/Middlewares/CorrelationIdMiddleware.cs` provides request correlation.
- An asynchronous rolling CompactJson file sink writes `logs/ipc-.jsonl`, one file per day with retention capped at 30 files.
- Health probes are built in: `/health/live` checks the process and `/health/ready` checks MySQL plus pending migrations in `backend/src/IPCManagement.Api/Program.cs`, `backend/src/IPCManagement.Api/HealthChecks/DatabaseHealthCheck.cs`, and `backend/src/IPCManagement.Api/HealthChecks/MigrationHealthCheck.cs`.
- No external log aggregation, metrics backend, tracing collector, dashboard, or alerting integration is defined in the repository.

## CI/CD & Deployment

**Hosting:**
- Vercel hosts the static frontend according to root `vercel.json`: Vite framework, `npm run build:fe`, output `frontend/dist`, SPA rewrite, and response security headers.
- Vercel deployment is enabled for `main` and `dev` only in `vercel.json`.
- Backend hosting is not selected. `docs/DEPLOYMENT.md` requires a separate .NET/MySQL-capable host; no Dockerfile, container compose file, cloud manifest, or provider-specific backend configuration is detected.
- Shipyard provides local multi-lane orchestration through `shipyard/profiles/IPCManagement/`, not public production hosting.

**CI Pipeline:**
- GitHub Actions workflow `.github/workflows/verify.yml` runs on pushes and pull requests with Ubuntu, .NET 9, Node 20, npm cache, NuGet cache, and a MySQL 8.0 service container.
- Verification includes backend build/tests, generated API contract drift, EF pending-model check, MySQL schema generation/application, real MySQL integration tests, migration replay/model parity, frontend lint, dependency-cruiser, Vitest, and Vite production build.
- `.github/workflows/codeql.yml` runs C# and JavaScript/TypeScript CodeQL on `main` pushes/PRs and a weekly schedule.
- GitHub Actions artifacts store test result files for seven days from `.artifacts/test-results`.
- No GitHub Actions deployment workflow is detected; Vercel deployment is driven by repository integration and `vercel.json`.

## Environment Configuration

**Required env vars:**
- `ConnectionStrings__DefaultConnection` - MySQL connection for the backend.
- `JwtSettings__SecretKey` - JWT signing secret, at least 32 characters and validated at startup.
- `JwtSettings__Issuer` and `JwtSettings__Audience` - JWT validation identities.
- `JwtSettings__ExpiryMinutes` and `JwtSettings__RefreshExpiryDays` - access/refresh lifetimes.
- `Cors__AllowedOrigins__0` (and subsequent indices) - deployed frontend origins outside Development.
- `AllowedHosts` - deployed API host outside Development.
- `VITE_API_BASE_URL` - required for frontend builds when the API is not available at the same origin under `/api`.

**Optional/operational env vars:**
- `ASPNETCORE_ENVIRONMENT` or `DOTNET_ENVIRONMENT` - selects backend environment and production-hardening behavior.
- `ForwardedHeaders__KnownProxies__0` - trusted reverse-proxy IP allowlist; omission causes a startup warning in `backend/src/IPCManagement.Api/Program.cs`.
- `RateLimiting__ApiPermitLimit` - overrides the general per-partition API rate limit.
- `VITE_PROXY_TARGET` - local Vite `/api` proxy destination, defaulting to `http://localhost:5262` in `frontend/vite.config.ts`.
- `VITE_ENABLE_MOCK_LOGIN` - development/UI-test-only login bypass.
- `IPC_TEST_CONNECTION_STRING`, `IPC_RUN_MYSQL_MIGRATION_TESTS`, `IPC_E2E_USERNAME`, `IPC_E2E_PASSWORD`, `IPC_E2E_TEMPLATE_PATH`, and `K6_PASSWORD` - CI, migration replay, E2E, and performance-test settings only.

**Secrets location:**
- Production secrets must be injected through the hosting provider's secret manager or environment, as required by `docs/CONFIGURATION.md` and `docs/DEPLOYMENT.md`.
- Backend example configurations under `backend/src/IPCManagement.Api/appsettings.*.example.json` define configuration shape only; copy to an ignored runtime file and replace placeholders.
- `.env.example` exists at repository root; do not store real credentials in it or commit real `.env`/runtime configuration files.
- GitHub Actions uses ephemeral CI-only database/JWT values in `.github/workflows/verify.yml`; no production secret is defined there.

## Webhooks & Callbacks

**Incoming:**
- None detected. Controllers in `backend/src/IPCManagement.Api/Features/*/Controllers/` expose first-party REST endpoints, not webhook receivers, and no webhook signature-validation package or handler is present.

**Outgoing:**
- None detected. The backend has no configured typed `HttpClient`, webhook dispatcher, email/SMS client, payment client, or third-party callback target in `backend/src/IPCManagement.Api/`.
- The frontend makes only first-party API calls through `frontend/src/api/apiSlice.ts`; download URLs are resolved against `VITE_API_BASE_URL` where needed.

---

*Integration audit: 2026-07-27*
