# Architecture — as-built ownership

Business/grain/lifecycle: [DOMAIN](DOMAIN.md). Setup/config/test methods: [ENGINEERING](ENGINEERING.md). UI grammar: [DESIGN](DESIGN.md). Operational execution: [OPERATIONS](OPERATIONS.md). Current source/generated contracts and behavior tests override stale architecture claims; no historical diagnostic PASS certifies runtime.

## Runtime and module boundaries

React/Vite/TypeScript browser → feature API modules and shared apiClient → ASP.NET Core 9 middleware/controller → feature service/repository/Unit of Work → EF Core/Pomelo → MySQL. Workbench reads use useWorkbenchQuery/serverStateCache and feature-specific workspace hooks; the current app is not composed through a Redux/RTK provider.

| Boundary | Source owner | Contract |
|---|---|---|
| Browser composition | frontend/src/main.tsx, App.tsx, components/workbench/AppShell.tsx, store/authContext.tsx | Router/auth/dirty-navigation providers, eligible navigation, mobile shell and session guards |
| Routes/guards/loading | frontend/src/App.tsx, routes/routeRegistry.ts, ProtectedRoute.tsx, RoleGuard.tsx, navigationEligibility.ts | Public/protected routes, role/mode eligibility, eager MRX pages and lazy non-MRX modules; shared pending presentation belongs to StateBoundary/WorkbenchSkeleton |
| HTTP middleware | backend/src/IPCManagement.Api/Program.cs | Correlation, exceptions, Development Swagger, CORS, authentication, rate limits, authorization; rejection Retry-After from lease metadata |
| DI/persistence | DependencyInjection.cs, Data/IpcManagementContext.cs | MySQL context, feature IEntityTypeConfiguration mappings; models/migrations stay outside feature slice |
| API use cases | backend/src/IPCManagement.Api/Features/ | Admin, Approvals, Auth, Catalog, Coordination, Inventory, Planning, Purchasing, Reports, SampleData controllers/services/contracts/validators |
| Shared wire contract | backend Shared/Contracts; frontend/src/shared/api/contracts/ | Backend metadata → generated OpenAPI/types; prefix api/ |
| Transaction runner | Data/Transactions/IEfTransactionRunner, EfTransactionRunner | Manual transactions only through execution strategy; clear tracking/recheck verifier on retry |
| Catalog cache | Caching/DishCatalogCache.cs | Active/all catalog cache identities and mutation invalidation shared by Catalog/SampleData |
| Stock/demand | MaterialDemandService, MaterialStockPool; InventoryIssueLineResolver | One unit-consistent physical stock pool consumed once; exact source-line issue allowance |
| Reports mapping | frontend/src/api/reportsApiMappers.ts | Canonical mapping; feature facade re-exports, not duplicate implementation |

Frontend app owns multi-feature AdminDataPage/composition. Feature pages use existing model/panel owners; do not rename everything into shared/ or cross-import feature internals. Projects uses lower-level coordination transport/projections, not Coordination internals. Reusable reconciliation UI is components/reconciliation; pure lifecycle/correlation/audit presentation is lib. Compatibility re-exports do not invert dependency direction.

## Trust & Network Boundaries

These are inspected runtime/configuration relationships and required data boundaries, **not** an attestation of live DNS, firewall rules, private/public service reachability or provider account settings. Browser/static frontend must not connect directly to MySQL or receive database/recovery/provider secrets. CORS and UI permission hiding are not network isolation or server authorization.

| Component | Exposure | May call | May not access directly | Secrets/data boundary / current evidence |
|---|---|---|---|---|
| Browser | Static UI and backend HTTP endpoints under their auth/mode/version checks; live origins UNKNOWN | Backend API through shared apiClient, bearer and refresh-cookie transport | MySQL or server/operator recovery files, keys and provider credentials | Vite variables are public build data; session JWT metadata is tab-scoped, refresh cookie HttpOnly. Authorized file selection/import is not direct server filesystem access |
| Frontend build/hosting | Vite dist; Vercel SPA configuration, actual provider include/upload settings NEEDS_EVIDENCE | Build workspace/dependencies; browser code calls API | No DB/admin-recovery secrets in bundle or publicly hosted inputs | vercel.json configures SPA rewrites, not a backend API proxy. Docker ignore rules do not prove Vercel excludes private files |
| Backend API | Container binds HTTP; anonymous health and guarded controllers implemented; live TLS/public/private exposure UNKNOWN | DI-owned MySQL, approved feature services and in-process jobs | Do not grant app runtime operator recovery authority/offsite keys by default | Program configuration validation, JWT/cookie/CORS/middleware and DependencyInjection own server settings. No trusted forwarded-header proxy configured |
| Database | EF runtime and separately authorized operator connections; actual grants/network UNKNOWN | Owned persistence operations within reviewed transaction/source contracts | Browser/static hosting must have no direct DB connection | DB secret belongs server/private operator configuration. API ownership does not mean recovery tools can never connect |
| Background jobs | Registered in-process LifecycleOutboxWorker; effective Enabled/execution UNKNOWN | DI-scoped outbox processor/DB and registered consumer | No external broker/email/realtime access inferred from registration | Current LifecyclePayloadValidationConsumer parses payload; consumer receipt is not external delivery proof. Uses backend trust/privilege context |
| Recovery tools | Private PowerShell/DatabaseTool CLI; no public recovery route established | Explicitly approved DB, run-owned local artifacts and supplied official-provider adapter | Not a browser/static frontend recovery interface; no public dumps/keys/receipts | Exact targets, authorization and independent backup/provider proof belong to OPERATIONS; executable adapter is an additional trust input |
| Private inputs | Local ignored .docs/settings/operator bundles; approved import/tool handling only | Only authorized import/processing at existing owners | No automatic publication/static hosting or migration of raw rows into docs | Ignored is not disposable or publication consent; fixture/export disposition remains ENGINEERING |
| External services | GitHub Actions/CodeQL, Vercel configuration, .NET container registries and generic recovery adapter contract evidenced | Their specifically configured build/scan/static/provider functions | No live backend host, messaging provider or monitoring vendor inferred from names/comments | Docker Render-port comment is not deployment evidence. Provider identity, credentials, retention and network controls NEEDS_EVIDENCE |

Source owners: [Program](../backend/src/IPCManagement.Api/Program.cs), [DI](../backend/src/IPCManagement.Api/DependencyInjection.cs), [apiClient](../frontend/src/api/client.ts), [Vite](../frontend/vite.config.ts), [Vercel config](../vercel.json), [Docker recipe](../Dockerfile), [outbox worker](../backend/src/IPCManagement.Api/Infrastructure/LifecycleOutbox/LifecycleOutboxWorker.cs), [payload consumer](../backend/src/IPCManagement.Api/Infrastructure/LifecycleOutbox/LifecyclePayloadValidationConsumer.cs) and [recovery orchestrator](../scripts/database-recovery/Invoke-DatabaseRecovery.ps1). ENGINEERING owns environment-variable semantics; OPERATIONS owns promotion and live-network evidence. [FLOWS](FLOWS.md) owns actor/navigation/data handoffs, not this transport table.

## Query, request and navigation ownership

Feature API modules under frontend/src/api use the shared client.ts transport. useWorkbenchQuery and serverStateCache own reusable scoped read hydration, request generations, same-key in-flight work and retained-data transitions; feature workspace hooks own their business grain and mutation guards. There is no current apiSlice endpoint-injection namespace to extend.

apiClient coalesces eligible unsignaled GETs by token, mode and URL. authenticatedFetch owns bearer/cookie transport and same-token refresh coordination. Do not infer mutation deduplication from the GET map: interaction owners must retain their own pending guards and the backend's transaction/idempotency contracts.

App.tsx and AppShell own routing and the stable shell. MRX pages are eagerly imported; several DEFAULT pages are lazy modules. StateBoundary and WorkbenchSkeleton reserve cold-load geometry and defer decorative paint; warm transitions keep appropriate existing data with busy/inert guards. A canonical route loading fallback covers pending lazy modules. This does not promise bulk API/code warming by a removed MainLayout.

Readiness/error/empty presentation is owned by the actual query/workspace state and shared boundaries. An empty result follows an authoritative resolved scope; stale or foreign-schema data must not be passed off as current. The former lib/queryView.ts is not an available adapter in this checkout.

frontend/src/styles/index.css is the current shared style/token owner; the former redesign stylesheet tree is absent. Follow DESIGN/UI-KIT and source rather than historical import-order descriptions. Dependencies are checked by frontend/.dependency-cruiser.cjs; old violation counts are not current verification.

## Auth, hosting and persistence mechanics

Backend is direct-host and does not trust X-Forwarded-*; trusted proxies require separate implementation/integration scope. Rate partition uses actual direct connection identity. DbContext configuration does not perform a network version probe; readiness/startup warehouse checks still observe real state.

Access JWT/user metadata are tab-scoped sessionStorage; refresh credential is HttpOnly cookie; startup clears legacy persistent auth metadata. BCrypt uses cost encoded in stored hashes, never reduced to improve latency. AuthService/RefreshTokenRepository use IEfTransactionRunner and MySQL user-row FOR UPDATE ordering for login/rotation/Admin deactivation. Rotation keeps device identity and absolute expiry, replaces same-device session, rechecks inactive state inside transaction. Validated active-session cap defaults to 3; two-connection concurrent cap/deactivate guarantees remain NEEDS_EVIDENCE, not inferred from sequential tests. Default token family is absolute 24h, access 30m; deactivation revokes refresh while issued access has remaining-expiry residual window. IdleSessionGuard defaults 60m plus 2m grace then shared revoke/logout once; configurable values belong to ENGINEERING.

Pomelo retry-enabled execution strategy and the single runner prevent manual transactions outside retry boundaries; IUnitOfWork owns SaveChanges, not transaction creation. Auth cold-path warmup is read-only, never fake user/session creation. Outbox/idempotency creation is transactional; delivery/recovery is separate.

PurchaseReceiptActiveLine lease has unique PurchaseOrderLineId, admitting one DRAFT/PENDING_APPROVAL/APPROVED owner; POSTED/full rejection/audited VOIDED release it. Legacy active-line read fallback remains until reconciled; DB fence arbitrates concurrent writes. VOIDED is reasoned Admin pre-post remediation with audit/lifecycle, no stock movement and no direct SQL deletion. Shared business transition semantics belong to DOMAIN.

## Compatibility boundaries

PresetBomImportPolicy.cs, called by SampleBomImportService, owns existing preset interpretation; SampleDataImportServiceTests has weighting/fallback/scientific parsing examples:
- **LEGACY_COMPATIBILITY_BEHAVIOR:** differing quantities for tier/dish/ingredient groups consolidate positive quantities with positive-serving weights; absent positive weights uses positive-quantity mean. Equal quantities retain first row. Not a generic safe identity merge.
- **LEGACY_COMPATIBILITY_BEHAVIOR:** positive per-serving quantity first; otherwise positive total weight / positive servings, else zero.
- **UNSUPPORTED_HEURISTIC** as a general rule: parsed value >5 is divided by 1,000, smaller positive values retained. Behavior exists for legacy compatibility, not unit/provenance evidence. New inputs require explicit unit/provenance; new development must not infer conversion solely from magnitude. Expanding it needs owner validation.
- **IMPLEMENTATION_DETAIL:** DecimalPolicy rounding, localized/scientific cached parsing, whitespace normalization. Does not authorize fixture publication or override DOMAIN conversion safeguards.

## Machine/tool boundaries

[table-contracts.json](table-contracts.json) is test-read metadata, not a prose owner. Immutable [migration lineage](../tools/db/migration-lineage.json), exact-target SQL/schema and source/test guards remain technical contracts even with historical filenames. Generated API is maintained through ENGINEERING, not hand edits.

Directory.Build.props owns SDK artifacts layout under .artifacts/dotnet and excludes recursive/old output from content; isolated runs use artifacts-path, not relative project-tree BaseOutputPath. Growth diagnostics and route budgets belong to scripts/baselines/CI with their actual severity; they are not business proof. Check source for current thresholds/debt, not counts copied into documentation. PurchasingRouter, ReconciliationInventoryIssueCreator and AuditChangeQueryReader are internal service owners, not parallel DI/public APIs.
