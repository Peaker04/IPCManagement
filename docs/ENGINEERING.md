# Engineering — setup, configuration and verification

Executable commands/settings belong to [root manifest](../package.json), [frontend manifest](../frontend/package.json), [CI](../.github/workflows/verify.yml), [global.json](../global.json), source validators and scripts. This owner explains their safe use; [ARCHITECTURE](ARCHITECTURE.md) owns as-built behavior and [OPERATIONS](OPERATIONS.md) deployment/recovery authorization.

## Environment and local run

Use Node 22.19+ with root npm workspace/lockfile; .NET SDK selection and roll-forward are in global.json (9.0.313 minimum 9.0.3xx/latestPatch, not a byte-exact SDK pin). Backend targets .NET 9/MySQL 8.0.36; Microsoft ASP.NET/EF test/runtime packages are serviced coherently. Inspect csproj/tool manifests for current package versions instead of duplicating a servicing inventory here.

From root, `npm ci` and `dotnet restore backend/IPCManagement.slnx` require installation/network authorization. Configure backend from the matching appsettings `.example` files with credentials outside Git. Run `npm run be` and `npm run fe` in separate terminals. Frontend defaults to Vite 5173 and `/api` proxied to `http://localhost:5262`; VITE_PROXY_TARGET can override the proxy. Confirm actual build/listeners and `/health/ready`, not remembered process IDs. Startup may observe existing database state; setup never authorizes migration, seed or warehouse activation.

## Configuration and secrets

ASP.NET configuration uses local appsettings/environment/secret store; tracked Demo/Lan/Production examples describe shape, not usable credentials. Double-underscore environment keys map to nested settings (e.g. ConnectionStrings__DefaultConnection). Vite reads frontend env/import.meta.env and vite.config.ts; frontend build variables are not a secret store.

| Key | Required/default boundary |
|---|---|
| ConnectionStrings:DefaultConnection | Required; no safe credential default; AddBackendServices fails if absent |
| JwtSettings:SecretKey / Issuer / Audience | Required; signing key >=32 characters; no sample/placeholder outside Development |
| JwtSettings:ExpiryMinutes / RefreshExpiryDays | Positive; samples 30 minutes / absolute non-sliding 1 day |
| JwtSettings:MaxActiveRefreshTokens | Samples 3, validated 1..10; concurrent guarantees still need real two-connection evidence |
| Cors:AllowedOrigins / AllowedHosts | Non-Development explicit origins/host; no localhost/sample secrets or wildcard host |
| OperationalWarehouse:WarehouseId | Optional GUID pin to existing active warehouse; omitted resolver still requires exactly one active |
| Pagination:MaxPageSize | Optional; samples 100 |
| ASPNETCORE_ENVIRONMENT | Launch profile Development; selects runtime validation/policies |
| VITE_API_BASE_URL | Default /api; set for separate-origin API builds |
| VITE_PROXY_TARGET | Local dev default http://localhost:5262; not a deployment reverse proxy |
| VITE_ENABLE_MOCK_LOGIN | Off by default; only authorized Development/UI tests, never production |
| VITE_IDLE_TIMEOUT_MINUTES / VITE_IDLE_WARNING_MINUTES | Defaults 60 / 2; nonpositive/invalid values fall back |

DbContext construction uses the configured MySQL version without an implicit network version lookup. Readiness and operational-warehouse startup validation still fail closed on connectivity/migration/zero-multiple-config mismatch. DeploymentConfigurationValidator rejects unsafe non-Development examples/host/CORS. Reverse proxy/forwarded headers require a separate tested trusted-proxy change, not a setting guess. Auth storage, rotation and transaction mechanics are owned by ARCHITECTURE, not restated as a second contract here.

Business timezone is IANA `Asia/Ho_Chi_Minh`: UTC instants render there; date-only/service-date keeps literal calendar date. No per-user timezone or generic i18n policy is implied. Routine auth diagnostics exclude username/full name/User-Agent/device/token/hash prefix/request body; opaque user ID/correlation/remote IP may be retained for security events. Log-file count does not prove a 30-day retention window. Business audit/stock/approval history remains append-only without separate retention authority.

## Development conventions and source ownership

Use existing TS/C# conventions/dependencies. TS unused/fallthrough checks and flat ESLint own linting; `@/*` maps frontend source. No repository formatter is mandated. Keep source-owner changes reviewable; do not remove StrictMode to hide repeated work, create parallel ButtonV2/TableNew/Dialog owners, or introduce hidden writes in onChange. Preserve draft/commit, exact mutation single-flight, direct-fetch double-submit guards and normalized query args.

Backend feature paths and frontend module/dependency rules are in ARCHITECTURE; business precision/grain/permissions in DOMAIN and bounded contracts. CI/growth/route budgets are diagnostics with their declared severity, never permission to weaken behavior to fix a count.

## Build and focused checks

Choose commands by the changed boundary, not a copied mandatory whole-product checklist. Manifest scripts provide builds, core backend/frontend unit, lint/dependency, coverage, API parity, browser/E2E and focused Node checks. Root verify is an aggregate whose prerequisites must be inspected first.

- Core backend selection excludes MySQL integration, EvidenceOwned and recovery-provider tests; it is not whole-product/DB proof. Broad test:be/coverage and recovery/migration/E2E commands have additional exact-target prerequisites.
- CI's disposable MySQL creation/drop steps must never be transplanted onto a user database. Recovery safety tests may use temporary PowerShell targets; their fences remain mandatory.
- Test observable behavior, public/security/storage contracts or credible regressions at one strongest boundary. Prefer extending owner tests, not duplicated matrices. No test-only production exports/wrappers/seams. Use test-audit for test authoring/review; regression fixes must fail pre-fix for the intended reason.
- A failing behavior test is not disposable history. Source/hash/line-count inventories, tool completion and focused results do not certify the whole product. Report scoped PASS/FAIL/NEEDS_EVIDENCE/BLOCKED and unrun prerequisites.

### Test locations

| Location | Role |
|---|---|
| backend/tests | Service/API, permission/mode/version/stock/lineage and migration regressions |
| frontend/src/**/*.test.{ts,tsx} | Colocated unit/rendered behavior |
| frontend/tests/config | Browser configurations |
| frontend/tests/browser/**/*.spec.ts | Playwright and adjacent consumed screenshot baselines; isolated from Vitest |
| frontend/tests/contracts | New cross-module contracts where appropriate; existing root owners need not move |
| frontend/tests/support | Reusable support; browser specs must not import another spec |
| frontend/tests/fixtures | Active browser/contract fixtures, not disposable evidence |
| docs/table-contracts.json | Test-read machine metadata with real source-file/grain identity |

### Generated API

[openapi.json](../frontend/src/shared/api/contracts/openapi.json) comes from backend Swashbuckle metadata; [schema.ts](../frontend/src/shared/api/contracts/schema.ts) derives from it. Do not hand-edit either. After controller/DTO changes run the authorized root gen:api command; CI check:api-contract regenerates and rejects drift. Generation restores tools/writes temporary build and tracked output, so inspect its diff. Existing handwritten frontend types remain until a separately scoped feature migration; no undocumented blanket replacement.

## Browser and persisted verification

Use separate headed Chrome with actual URL/listeners/build, server mode/version/capabilities, actor and confirmed credential source. Do not stop user processes or reuse profiles/tabs/credentials without explicit ownership. Refresh locators after navigation. Loading, refresh, empty, error, denial, conflict and prerequisite are distinct; 403 is never empty. Exercise relevant tabs and trigger/open/confirm/cancel/Escape/outside paths before claiming coverage.

Screenshots are candidate signals; prove claims with source/DOM/keyboard/network assertions. Check clipping/overflow, hierarchy, focus/trap/return, labels, reduced motion, zoom/viewport and async transitions. Persistence proof is control → request → state/DB transition → reload; projections are not physical stock or purchase authority. Mutation requires separate target approval and recoverable backup.

Performance: declare DEV vs production preview, build/source, actor/mode/data, route/action and viewport. Compare identical cold compilation/warm navigation/interaction conditions. Measure requests/latency, long tasks/frame/LoAF/INP/CLS where supported and attribute FE/network/BE/DB costs. No FPS-only, screenshot, parser or DEV-to-production PASS. Use unique ignored output paths; Playwright may clean its output, so never put business/recovery data there. Production probes/SQL authorization belongs to OPERATIONS.

## Private inputs and fixtures

Six `.docs/` inputs (database DOCX, order/BOM workbooks, image and two weekly-menu workbooks) are PRIVATE_INPUT / KEEP locally. Local configuration and recovery bundles/keys are also private. Do not publish them or migrate raw values into docs. Ignored does not mean disposable; preserve active fixtures, image baselines, lineage and business evidence.

`backend/tests/IPCManagement.Api.Tests/Fixtures/IPC. Định lượng 07.2026.xlsx` remains technically consumed but publication unproven, with **PRIVATE_DATA_LEAK_RISK** and **REPLACE_WITH_SYNTHETIC_FIXTURE_REQUIRED**. It equals the populated private BOM input, not a demonstrated blank/sanitized/synthetic template. Commit history/output-copy configuration does not establish consent or licensing; this documentation does not classify it safe/public.

Separately authorized follow-up: build realistic populated but fabricated schema-compatible workbook, without real recipes/prices/customer values; retain import schema, tier independence, technical-count/unit and cached-formula/parsing regressions; migrate canonical tests and verify equivalent coverage before deleting original, with no coverage reduction. Exact ZIP bytes are not asserted, but synthetic behavior cannot certify the original business dataset. Original fixture/tests remain protected until that task. Diagram/font licenses also do not certify export publication; distribution requires owner approval.
