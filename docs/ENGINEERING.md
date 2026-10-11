# Engineering — setup, configuration and verification

Executable commands/settings belong to [root manifest](../package.json), [frontend manifest](../frontend/package.json), [CI](../.github/workflows/verify.yml), [global.json](../global.json), source validators and scripts. This owner explains their safe use; [ARCHITECTURE](ARCHITECTURE.md) owns as-built behavior and [OPERATIONS](OPERATIONS.md) deployment/recovery authorization.

## Delivery workflow

`FLOW / PLAN → DESIGN → ARCHITECTURE / CODE → VERIFY → RELEASE → OPERATE → FEEDBACK` is a delivery loop, not an automatic deployment pipeline. Keep task-specific decisions/acceptance in WORK, stable cross-feature navigation/data paths in [FLOWS](FLOWS.md), and business invariants in DOMAIN/bounded owners. A small bug does not need its own flow/spec/report file. Mark genuinely unaffected gates not applicable with a scope reason; do not manufacture artifacts for every phase.

| Gate | Required boundary / existing owner |
|---|---|
| FLOW / PLAN | Understand current versus requested actor/action/result, permission, data/state and failure paths; use FLOWS + DOMAIN/bounded contract, then record scoped intake in WORK |
| DESIGN | For affected UI, resolve the scoped pre-code gate in DESIGN; a mockup cannot select business behavior or permission |
| ARCHITECTURE / CODE | Trace actual callers, API/persistence/trust owners in ARCHITECTURE; implement only authorized scope at existing owners |
| VERIFY | Select risk-based lanes below and map evidence to flow acceptance; unit green alone is not feature completion |
| RELEASE | OPERATIONS owns current versus target promotion, exact artifact/environment and human authorization; CHANGELOG owns released history, not task completion |
| OPERATE | Observe the authorized build/environment, technical and business signals against OPERATIONS; existing targets are not measured achievement |
| FEEDBACK | Route an incident/user report to fresh WORK intake; correct stable truth at its canonical owner. Change ROADMAP only for an owner-approved new/removed/reprioritized outcome or acceptance boundary, or an evidenced achieved outcome—not bug/refactor/validator/task progress |

### Feature intake contract

Before meaningful implementation, establish **Actor; Trigger; Expected outcome; Permission; Current behavior; Requested behavior; Data/state affected; Failure paths; Acceptance criteria**. Derive known facts from current source/tests before asking the owner. Record the task-specific answers and source/oracle in WORK, not a new per-feature history system. Missing or contradictory required facts are UNKNOWN / OPEN QUESTION; resolve the affected boundary before coding rather than silently selecting policy.

Acceptance identifies the flow/bounded contract, actor/mode/scope, allowed action, expected state/data result, meaningful denial/failure behavior, selected verification lanes and independent oracle. Persisted outcomes require the control → request → transition → reload boundary, not only component text or a successful HTTP response. Future runtime/DB checks still require OPERATIONS authorization.

### Release history ownership

[CHANGELOG](../CHANGELOG.md) is human-readable released history, not AI memory. Use Unreleased Added/Changed/Fixed/Security headings only for release-relevant user behavior or significant operational/security/migration changes; confirmed releases receive an identified version/date. Unreleased is pending publication, not proof of release. Do not backfill releases from package versions, Git commits or guessed provider state. Do not log internal audits, skill evaluations, documentation cleanup, temporary WORK steps or behavior-preserving refactors. Git retains detailed history; this delivery-documentation change creates no changelog entry.

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
| VITE_API_BASE_URL | Optional origin/base prefix **without trailing /api**; apiSlice appends /api. Omitted transport defaults to /api; separate-origin deployment must verify actual routing |
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

### Seven risk-based verification lanes

Select affected lanes from the flow/intake risks; record why others are not applicable. These are evidence boundaries, not seven mandatory suites. Reuse the strongest existing owner for each contract; extend it only when behavior at risk lacks proof. Command examples are selections, **not executed results**; inspect the manifest, test body and target prerequisites first.

| Lane | Select when / existing owner example | What proves the boundary / remaining prerequisite |
|---|---|---|
| 1. Unit | Pure arithmetic/transformation changes; WorkflowReportCalculatorTests | Focused inputs/results; does not prove report transport, authorization or physical stock |
| 2. Domain/contract | Grain/status/allowance/frozen-lineage decisions change; ReconciliationDailyLineagePolicyTests | Bounded policy and credible regression oracle; missing legacy lineage is a blocker, not permission to fabricate records |
| 3. Integration/data | EF/provider constraints, transaction/retry/replay/migration or write effects change; LifecycleOutboxProcessorTests and Integration owners | Relational receipt/order/retry and provider-specific state proof. SQLite is not MySQL concurrency. MySQL integration needs an approved disposable target, IPC_TEST_CONNECTION_STRING, matching schema/build and explicit seed/mode authority; absent local config can skip tests |
| 4. API/auth/mode/version | Permissions, DTOs, request protection, stale scope/mode or API shape change; AuthorizationPoliciesTests/SystemOperationCapabilityProfileTests plus affected endpoint owner | Policy/profile tests do not alone prove real bearer/middleware denial. Select endpoint success/denial/conflict proof; DTO changes need authorized API parity generation with its restore/write prerequisites |
| 5. Component/accessibility | Controls, dialogs, loading/error/denial/focus or action states change; ConfirmDialog.test.tsx and affected rendered owner | jsdom interactions and accessible names; real geometry/keyboard focus/overflow needs relevant browser proof. A screenshot alone is not accessibility acceptance |
| 6. E2E/business flow | Actor handoff, persisted workflow or feature completion changes; affected browser spec plus real state oracle | Actual actor/mode/scope → control/request → transition → reload/denial. coordination-business.spec.ts mocks auth/API: it proves rendered intent, not DB persistence. Nominal WorkflowLifecycleE2ETests currently authenticate/read plans, not the whole menu-to-stock flow; select missing real boundary explicitly |
| 7. Operational/security/performance/recovery | Deployment/config, health/relay, load, security/stock integrity or recovery changes; HealthResponseWriterTests/DeploymentConfigurationValidatorTests and authorized runbook | Static guard/unit proof is not deployed alert, provider restore, load/RPO/RTO qualification or immutable business-history proof. Select actual URL/build/actor/data/host/DB/provider oracle only with separate OPERATIONS authorization; never weaken auth/rate limits to pass |

Example focused selections from root: `npm run test:be -- --filter FullyQualifiedName~WorkflowReportCalculatorTests`; substitute the existing domain/endpoint/relational owner rather than broadly running tests with DB/provider prerequisites. Component example: `npm run test:unit -w frontend -- src/components/common/ConfirmDialog.test.tsx`. CI's separate MySQL selection is `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-build --filter "FullyQualifiedName~IPCManagement.Api.Tests.Integration"`; do not transplant its disposable database creation/drop onto a user target. Browser commands require authorized isolated headed Chrome and actual server/profile inspection; default Playwright can start mock-login Vite/reuse an existing server.

Root `verify` and hosted CI are different compositions: core CI excludes Integration/EvidenceOwned/RecoveryScriptContractTests, runs MySQL/replay/model comparison separately, and does not establish full browser acceptance/deployment. CI model comparison has scoped omissions (including SQL defaults/index identity); green is not full schema identity. Installed prerequisites, nonzero executed count, skips and known inherited failures belong in the scoped result. **Feature completion requires mapped business-flow acceptance**, not merely unit/API/lint green.

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
