# Architecture — as-built ownership

Business/grain/lifecycle: [DOMAIN](DOMAIN.md). Setup/config/test methods: [ENGINEERING](ENGINEERING.md). UI grammar: [DESIGN](DESIGN.md). Operational execution: [OPERATIONS](OPERATIONS.md). Current source/generated contracts and behavior tests override stale architecture claims; no historical diagnostic PASS certifies runtime.

## Runtime and module boundaries

React/Vite/TypeScript browser → single RTK Query API → ASP.NET Core 9 middleware/controller → feature service/repository/Unit of Work → EF Core/Pomelo → MySQL.

| Boundary | Source owner | Contract |
|---|---|---|
| Browser composition | frontend/src/main.tsx, App.tsx, app/layout/MainLayout.tsx | Redux/router, permission navigation, mobile shell, idle-session guard |
| Routes/guards/preload | frontend/src/routes/AppRouter.tsx, RoleGuard.tsx, routeLoaders.ts | Public login vs protected routes; same-app sanitized login return, no external/protocol-relative/login-loop return |
| HTTP middleware | backend/src/IPCManagement.Api/Program.cs | Correlation, exceptions, Development Swagger, CORS, authentication, rate limits, authorization; rejection Retry-After from lease metadata |
| DI/persistence | DependencyInjection.cs, Data/IpcManagementContext.cs | MySQL context, feature IEntityTypeConfiguration mappings; models/migrations stay outside feature slice |
| API use cases | backend/src/IPCManagement.Api/Features/ | Admin, Approvals, Auth, Catalog, Coordination, Inventory, Planning, Purchasing, Reports, SampleData controllers/services/contracts/validators |
| Shared wire contract | backend Shared/Contracts; frontend/src/shared/api/contracts/ | Backend metadata → generated OpenAPI/types; prefix api/ |
| Transaction runner | Data/Transactions/IEfTransactionRunner, EfTransactionRunner | Manual transactions only through execution strategy; clear tracking/recheck verifier on retry |
| Catalog cache | Caching/DishCatalogCache.cs | Active/all catalog cache identities and mutation invalidation shared by Catalog/SampleData |
| Stock/demand | MaterialDemandService, MaterialStockPool; InventoryIssueLineResolver | One unit-consistent physical stock pool consumed once; exact source-line issue allowance |
| Reports mapping | frontend/src/api/reportsApiMappers.ts | Canonical mapping; feature facade re-exports, not duplicate implementation |

Frontend app owns multi-feature AdminDataPage/composition. Feature pages use existing model/panel owners; do not rename everything into shared/ or cross-import feature internals. Projects uses lower-level coordination transport/projections, not Coordination internals. Reusable reconciliation UI is components/reconciliation; pure lifecycle/correlation/audit presentation is lib. Compatibility re-exports do not invert dependency direction.

## Query, request and navigation ownership

frontend/src/api/apiSlice.ts is the only base API/cache namespace; feature owners plus workflowDocumentsApi inject endpoints. workflowApi.ts is a registration/re-export compatibility barrel, not another slice/tag/endpoint owner. workflowCacheTags is the registry; dependency-cruiser allowlist is reviewed separately from documentation.

RTK Query coalesces subscribers with same endpoint/key. routeDataPreloaders uses ifOlderThan for intent GET warming. Exact in-flight mutations fingerprint method/URL/params/headers/body/access-token generation and share one promise; different payloads and subsequent sequential calls remain independent. Late 401 from old token retries with current token, not a competing refresh. Interaction owners still have synchronous login/logout/multi-step guards.

MainLayout warms permitted sidebar code sequentially in idle slots, not bulk API data; Data Saver/2G skip bulk warming. Resolved route modules avoid first-render fallback; clicks before warming retain stable fallback. Active panels own their query families and lazy code; deferred rendered views preserve shell/header/sidebar and explicitly pending presentation. The same-key cache/readiness rules of bounded owners still govern retained data.

frontend/src/lib/queryView.ts is opt-in: uninitialized/loading/forbidden/error/ready; ready retains refreshing/truncation metadata, empty only from authoritative ready. Adapter consumers cannot bypass it via query.data ?? []; existing nonpilot handling is not silently converted.

Global CSS order comes from main.tsx: styles/index.css + styles/components, then ui-redesign.css + styles/redesign. Import order and opt-in shared primitive variants are actual implementation contracts, not proof that provisional design tokens are production defaults. App/report/admin model facade hook order preserves React/query timing; dependencies are enforced by frontend/.dependency-cruiser.cjs, not historical violation counts.

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
