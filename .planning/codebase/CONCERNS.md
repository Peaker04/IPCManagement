# Codebase Concerns

**Analysis Date:** 2026-07-27

## Tech Debt

**Oversized backend orchestration services:**
- Issue: Several vertical slices still concentrate unrelated queries, state transitions, exports, audit writes, and repair operations in one class. `WorkflowReportService` is 3,633 lines, `CoordinationService` is 2,416 lines, `DishService` is 1,620 lines, `PurchaseRequestWorkflowService` is 1,385 lines, and `MaterialDemandService` is 1,280 lines.
- Files: `backend/src/IPCManagement.Api/Features/Reports/Services/WorkflowReportService.cs`, `backend/src/IPCManagement.Api/Features/Coordination/Services/CoordinationService.cs`, `backend/src/IPCManagement.Api/Features/Catalog/Services/DishService.cs`, `backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseRequestWorkflowService.cs`, `backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs`
- Impact: A change to one report or workflow can disturb unrelated behavior, transaction boundaries are difficult to audit, and focused tests require large fixtures. GitNexus exposes dozens of methods from `CoordinationService` across contract, menu, forecast, lock, sign-off, adjustment, and export flows, confirming that the class is a multi-use dependency rather than a single use-case handler.
- Fix approach: Keep the feature folders, but split by use case inside each slice: query/read models, command handlers, transaction coordinators, and pure policy/calculation classes. Extract one behavior at a time with characterization tests; do not move all files in one mechanical VSA rewrite. Keep migrations untouched during placement refactors.

**Post-refactor frontend boundary remains centralized:**
- Issue: Feature pages and page-model hooks exist, but the RTK Query definition remains a 1,955-line cross-domain endpoint registry. Its `endpoints` function spans roughly lines 985-1940, while the generated contract schema is 13,340 lines.
- Files: `frontend/src/api/workflowApi.ts`, `frontend/src/shared/api/contracts/schema.ts`, `frontend/src/features/reports/pages/ReportsPage.tsx`, `frontend/src/features/reports/pages/useReportsPageModel.ts`
- Impact: Every domain imports through a broad API module, tag invalidation and response transformation changes have a wide review surface, and merge conflicts grow as vertical slices add endpoints. The generated schema is acceptable as generated output, but it must not become the place for handwritten domain behavior.
- Fix approach: Preserve the shared base API, then inject endpoints from feature-owned modules such as `frontend/src/features/reports/api/` and `frontend/src/features/purchasing/api/`. Keep generated contracts in `frontend/src/shared/api/contracts/`; add a generation header/check and never hand-edit that file.

**DbContext is a schema and policy hotspot:**
- Issue: `IpcManagementContext` is 2,563 lines and contains the model configuration for a large operational schema in one file.
- Files: `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`, `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`
- Impact: Entity mapping changes collide, relationship/index review is difficult, and schema drift can hide among unrelated configuration.
- Fix approach: Move mappings incrementally to `IEntityTypeConfiguration<T>` classes under feature-owned `Data/Configurations/` directories while keeping `IpcManagementContext` as the registration root. Validate every extraction with the migration/model schema gate in `.github/workflows/verify.yml`.

**Exception taxonomy is incomplete:**
- Issue: `InvalidOperationException` is temporarily mapped to HTTP 400 and logged as `Unclassified exception`; the middleware contains an explicit P1.2b TODO. Domain services still throw this general runtime exception for business conflicts and missing workflow prerequisites.
- Files: `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`, `backend/src/IPCManagement.Api/Features/Coordination/Services/CoordinationService.cs`, `backend/src/IPCManagement.Api/Features/Admin/Services/AdminEmployeeService.cs`, `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.CustomMenu.cs`
- Impact: Real programmer/infrastructure failures can be mislabeled as client errors, while clients cannot reliably distinguish validation, conflict, and server failure.
- Fix approach: Inventory the `Unclassified exception` logs and convert each business case to `BusinessRuleException`, `ResourceConflictException`, `ArgumentException`, or `KeyNotFoundException`. Only then remove the special 400 mapping so unexpected `InvalidOperationException` returns 500.

**Migration history is not fully reproducible:**
- Issue: The live database history contains two migration IDs with no corresponding repository migration files. `Init_EF_History_For_Old_DB.sql` also contains three historical IDs that were consolidated into another migration.
- Files: `backend/database/Init_EF_History_For_Old_DB.sql`, `backend/src/IPCManagement.Api/Migrations/`, `docs/CURRENT-STATE.md`
- Impact: A developer can reach the current model from the baseline, but cannot reproduce the exact lineage of the principal database or confidently reason about every historical deployment.
- Fix approach: Decide and document a canonical baseline. Either restore no-op, metadata-correct historical migrations or formally squash lineage with a verified cutover procedure. Never delete or synthesize history against the principal lane without rehearsal on a full data clone.

**Baseline and migration verification has intentional blind spots:**
- Issue: The CI schema comparison excludes SQL defaults, index names, and `stocktakes.activeWarehouseKey`; two populated-clone `Migration_upgrade_*` tests are not enabled in CI.
- Files: `.github/workflows/verify.yml`, `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs`, `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs`, `backend/src/IPCManagement.Api/Migrations/20260726120000_AddStocktakeActiveWarehouseUnique.cs`
- Impact: A default-only regression, index-name-dependent script, generated-column change, or populated-data migration regression can pass the current gate.
- Fix approach: Add targeted assertions for intentional defaults and generated columns, compare index column coverage rather than names, and create a deterministic pre-migration fixture so both upgrade tests run in CI.

**Large tests mirror production monoliths:**
- Issue: `WorkflowGenerationTests.cs` is 6,744 lines, with extensive inline schema construction; other workflow suites exceed 1,000 lines.
- Files: `backend/tests/IPCManagement.Api.Tests/WorkflowGenerationTests.cs`, `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs`, `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs`, `backend/tests/IPCManagement.Api.Tests/CoordinationTransactionTests.cs`
- Impact: Test intent is hard to locate, fixture drift is likely, and changes to one vertical slice cause broad compilation and review churn.
- Fix approach: Split suites by capability and reuse explicit fixture builders. Keep real-MySQL migration tests separate from SQLite/InMemory unit tests so provider-specific guarantees remain visible.

## Known Bugs

**BOM import returns HTTP 500 for malformed workbook:**
- Symptoms: A corrupt/non-ZIP `.xlsx` reaches `InvalidDataException` and falls through the default exception branch instead of returning a user-facing file-read diagnostic.
- Files: `backend/src/IPCManagement.Api/Features/SampleData/Services/XlsxWorkbookReader.cs`, `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.cs`, `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.CustomMenu.cs`, `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`
- Trigger: Upload a malformed workbook through the BOM import path. The weekly-menu path already translates equivalent read failures to `FILE_READ_ERROR`; the BOM path does not.
- Workaround: Validate/open the workbook before upload. Implement the same bounded `InvalidDataException`/`IOException`/`XmlException` translation used by the weekly-menu import without weakening `XlsxSecurityLimits`.

**Some frontend failures still render as empty data:**
- Symptoms: Failed admin or approval requests can resolve to empty arrays/default values, making unavailable data look like a legitimate empty state.
- Files: `frontend/src/features/admin/pages/AdminDataPage.tsx`, `frontend/src/features/approvals/pages/ApprovalPage.tsx`, `frontend/src/features/approvals/pages/ApprovalRulesPage.tsx`, `frontend/eslint.config.js`
- Trigger: Make one of the remaining 15 query call sites fail; the relevant lint rule remains warning-level for these areas.
- Workaround: Inspect network/error state. Replace fallback-to-empty expressions with explicit loading/error/success state and raise the lint rule to error after the remaining sites are removed.

**No dedicated confirmation for high-impact mutations:**
- Symptoms: BOM commit does not show a dedicated summary confirmation for tier, customer, effective date, and row count; employee activation/deactivation invokes its mutation directly.
- Files: `frontend/src/features/admin/pages/AdminDataPage.tsx`, `frontend/src/features/projects/weekly-menu/`, `frontend/src/api/workflowApi.ts`
- Trigger: Commit a BOM import or toggle an employee's active state.
- Workaround: Review values in the surrounding page before acting. Add typed confirmation dialogs that repeat the affected identity, scope, and permission/login impact.

## Security Considerations

**Forwarded-header trust fails open when proxy allowlist is absent:**
- Risk: With no `ForwardedHeaders:KnownProxies`, the API clears default proxy/network allowlists and trusts any `X-Forwarded-For`. A directly reachable API client can spoof its address and weaken IP-partitioned rate limiting/audit attribution.
- Files: `backend/src/IPCManagement.Api/Program.cs`, `backend/src/IPCManagement.Api/Helpers/DeploymentConfigurationValidator.cs`, `docs/CONFIGURATION.md`
- Current mitigation: Startup emits a warning and production architecture is expected to place the API behind a trusted reverse proxy.
- Recommendations: Fail production startup when the proxy allowlist is empty unless an explicit, narrowly named direct-trust override is enabled. Firewall the API from public direct access and test forwarded-header behavior in deployment smoke checks.

**Access token is browser-readable:**
- Risk: The frontend persists authentication state via browser storage, so any XSS in the origin can read the bearer token. The refresh token's cookie controls do not protect an access token stored in JavaScript-accessible storage.
- Files: `frontend/src/features/auth/authStorage.ts`, `frontend/src/api/apiSlice.ts`, `backend/src/IPCManagement.Api/Features/Auth/Controllers/AuthController.cs`, `backend/src/IPCManagement.Api/Program.cs`
- Current mitigation: Refresh tokens use cookie policy, bearer tokens are validated server-side, deployment applies security headers, and no `dangerouslySetInnerHTML` usage was detected under `frontend/src/`.
- Recommendations: Prefer an in-memory access token with refresh via HttpOnly cookie, enforce a strict CSP, keep dependencies audited, and avoid adding raw HTML rendering paths.

**Operational backup remains manual:**
- Risk: A destructive SQL run already dropped production-local tables; recovery succeeded because binlogs and an old snapshot happened to be available, not because a tested backup policy existed.
- Files: `backend/database/IPCmanagement.sql`, `docs/CURRENT-STATE.md`, `docs/DEPLOYMENT.md`
- Current mitigation: The baseline script no longer embeds `USE`, aborts if no database is selected or the target is non-empty, MySQL row binlogs support PITR, and fresh-install migration tests run in CI.
- Recommendations: Automate encrypted backups, retention, restore drills, and restore-point lineage metadata. Require an explicit disposable database name for destructive database scripts and retain the recovery artifacts until a verified backup/restore cycle succeeds.

**Authorization depends on consistent endpoint metadata and warehouse scope checks:**
- Risk: The application contains both role/permission authorization and service-level warehouse scoping. A new controller action that omits either layer can expose cross-warehouse data or mutations.
- Files: `backend/src/IPCManagement.Api/Program.cs`, `backend/src/IPCManagement.Api/Security/`, `backend/src/IPCManagement.Api/Features/Inventory/Services/SupplementalMaterialRequestService.cs`, `backend/tests/IPCManagement.Api.Tests/WarehousesAuthorizationIntegrationTests.cs`
- Current mitigation: Controllers use authorization policies and inventory services validate scoped warehouse IDs; integration coverage exists for warehouse authorization.
- Recommendations: Add a reflection-based test that every non-health API action has explicit authorization metadata, centralize warehouse scoping in query/policy helpers, and add negative cross-warehouse tests for each new vertical slice.

## Performance Bottlenecks

**Sample import status performs sequential counts:**
- Problem: `GetSampleImportStatusAsync` executes 10 independent table counts sequentially.
- Files: `backend/src/IPCManagement.Api/Features/Catalog/Services/DishService.cs`
- Cause: Lines around 299-315 await each `CountAsync` individually, including seven workflow tables added together.
- Improvement path: Replace this status endpoint with one projected SQL result, cached/maintained summary data, or carefully parallel reads using separate DbContext instances. Do not issue parallel operations on the same EF Core context.

**Report service issues many independent materializations:**
- Problem: The 3,633-line report service contains a high density of `ToListAsync` calls across reporting and data-quality workflows.
- Files: `backend/src/IPCManagement.Api/Features/Reports/Services/WorkflowReportService.cs`, `backend/src/IPCManagement.Api/Features/Reports/Controllers/WorkflowReportsController.cs`
- Cause: One service owns many report shapes and repair commands, encouraging repeated reads and in-memory joins. Pagination exists for some endpoints but is not a universal boundary.
- Improvement path: Profile each endpoint with `tools/perf/`, add query-count and bounded-result regression tests, project only required columns, and split report queries so hot paths can be optimized independently. Preserve document/line grain and aggregate by IDs/unit/scope rather than names.

**Import paths preload complete catalogs:**
- Problem: Sample/BOM import loads entire Units, Suppliers, Ingredients, Dishes, BOM lines, and sometimes adjustments into memory.
- Files: `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.cs`, `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.CustomMenu.cs`
- Cause: Import reconciliation uses broad `ToListAsync` catalog snapshots for lookup and comparison.
- Improvement path: Extract keys from the workbook first, query only matching records in bounded batches, retain dictionary lookup semantics, and add a high-cardinality import benchmark plus memory ceiling.

## Fragile Areas

**Transaction/retry boundary:**
- Files: `backend/src/IPCManagement.Api/DependencyInjection.cs`, `backend/src/IPCManagement.Api/Data/UnitOfWork.cs`, `backend/src/IPCManagement.Api/Features/Coordination/Services/CoordinationService.cs`, and the 18 source files containing `BeginTransactionAsync`
- Why fragile: The code currently has 26 transaction starts across 15 files and none is wrapped in `Database.CreateExecutionStrategy().ExecuteAsync(...)`. `EnableRetryOnFailure` is intentionally disabled; enabling it now can retry outside an explicit transaction boundary and create partial or duplicate effects.
- Safe modification: First wrap `UnitOfWork.BeginTransactionAsync` consumers and all direct transaction blocks in execution-strategy delegates, with idempotency/concurrency tests. Only then enable transient retry and test injected failures at every save/commit boundary.
- Test coverage: Transaction rollback tests exist for inventory and coordination, but retry execution-strategy behavior is not covered end-to-end.

**Supplemental fulfillment stock mutation:**
- Files: `backend/src/IPCManagement.Api/Features/Inventory/Services/SupplementalMaterialRequestService.cs`, `backend/src/IPCManagement.Api/Features/Inventory/Services/StockLedgerService.cs`
- Why fragile: `FulfillAsync` calls `RemoveStockWithCheckAsync`, whose `ExecuteUpdateAsync` writes immediately. The current-state handoff explicitly flags the need to prove that the stock decrement and request/audit updates share one transaction.
- Safe modification: Make the transaction boundary visible at the use-case entry point, inject failures after stock removal, and verify rollback of stock, movement ledger, request status, and audit rows together.
- Test coverage: Add a real relational-provider failure-injection test; EF InMemory cannot prove `ExecuteUpdateAsync` transaction behavior.

**Database bootstrap and migration tooling:**
- Files: `backend/database/IPCmanagement.sql`, `backend/database/Init_EF_History_For_Old_DB.sql`, `backend/src/IPCManagement.Api/Migrations/`, `.github/workflows/verify.yml`
- Why fragile: Baseline SQL plus incremental EF migrations is a dual source of schema truth. Handwritten migrations without `.Designer.cs` or inline `[Migration]` are invisible to EF, and removing a migration whose designer is missing can corrupt the snapshot.
- Safe modification: Rehearse against a cloned populated database, require migration metadata, run fresh baseline+migrations and model-schema comparison, and inspect data counts/checksums before swapping any lane.
- Test coverage: Fresh-install tests are active; populated upgrade fixtures, defaults, index names, and the generated stocktake column remain incomplete.

**Spreadsheet parsing and mapping:**
- Files: `backend/src/IPCManagement.Api/Features/SampleData/Services/XlsxWorkbookReader.cs`, `backend/src/IPCManagement.Api/Features/SampleData/Services/XlsxSecurityLimits.cs`, `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.CustomMenu.cs`, `frontend/src/features/projects/weekly-menu/`
- Why fragile: Workbook structure is customer-specific, mapping must retain source-cell provenance, and preview/save/error semantics differ. Generic exception handling or name-based aggregation can silently change business meaning.
- Safe modification: Preserve bounded XML/ZIP parsing, source A1 coordinates, explicit mapping roles, read-only preview, error-block/warning-visible behavior, and document/line grain. Test corrupt files, merged cells, range boundaries, keyboard/A1 mapping, and customer-specific layouts.
- Test coverage: Parser coverage is extensive in `backend/tests/IPCManagement.Api.Tests/WeeklyMenuImportParserTests.cs`; the BOM-friendly corrupt-file error and full headed browser mapping interaction remain gaps.

**Generated contracts and migration designers:**
- Files: `frontend/src/shared/api/contracts/schema.ts`, `backend/src/IPCManagement.Api/Migrations/*.Designer.cs`, `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`
- Why fragile: These are the largest files in the repository and are mechanically derived. Manual cleanup creates drift that can be overwritten or produce false schema confidence.
- Safe modification: Change the source model/OpenAPI or EF model, regenerate, and review the semantic diff. Keep handwritten helpers outside generated files.
- Test coverage: Frontend typecheck/build and EF pending-model/schema checks cover gross drift; add a clean-regeneration diff gate if generation is expected to be deterministic.

## Scaling Limits

**Single relational database and synchronous request workflows:**
- Current capacity: No numeric production capacity is established; current evidence covers a small local lane and warm smoke timings, not sustained concurrent load.
- Limit: Report aggregation, imports, and multi-step workflow commands all share the API process and MySQL database. Long transactions and broad reads will contend as operational history grows.
- Scaling path: Establish SLOs and k6 baselines, add query-count/cardinality tests, move expensive exports/import processing to durable background jobs only when measured thresholds justify it, and keep command idempotency before adding workers.

**Audit/report tables grow without an archival boundary:**
- Current capacity: Not documented; audit and workflow report queries already support broad operational views.
- Limit: `auditlogs`, stock movements, import history, and workflow documents grow continuously, increasing index size and report latency.
- Scaling path: Define retention versus immutable audit obligations, use cursor pagination and date-scope requirements, add composite indexes from measured query plans, and archive only with explicit compliance/restore rules.

## Dependencies at Risk

**EF Core/MySQL transient retry is configured off:**
- Risk: The application cannot safely enable provider retry while explicit transaction blocks lack execution strategies; transient database faults surface directly.
- Impact: Enabling retries prematurely risks duplicate/partial business operations, while leaving them off reduces resilience during brief network/database failures.
- Migration plan: Complete the transaction-boundary remediation documented in `backend/src/IPCManagement.Api/DependencyInjection.cs`, then enable and validate retry with fault-injection tests.

**GitHub CodeQL on private repository:**
- Risk: SARIF upload can fail when GitHub Advanced Security is unavailable for the repository plan/settings.
- Impact: The verification workflow can remain red despite successful compilation/tests, or security scanning may be disabled to restore green CI.
- Migration plan: Enable the required GitHub security capability or choose a supported scanner/output path; keep the decision explicit in `.github/workflows/verify.yml` and `docs/TESTING.md`.

## Missing Critical Features

**Automated backup and restore verification:**
- Problem: There is no scheduled, monitored backup/restore process; PITR recovery currently depends on manually retained binlogs and artifacts.
- Blocks: Safe destructive migration rehearsals and a credible recovery-time/recovery-point guarantee.

**Deterministic populated-database migration fixture:**
- Problem: CI cannot construct the pre-migration populated lane required by the two `Migration_upgrade_*` tests.
- Blocks: Automated proof that schema evolution preserves legacy receipt/supplier data, not merely that a fresh schema can be created.

## Test Coverage Gaps

**Execution strategy and transient transaction retries:**
- What's not tested: Retried execution of all explicit transaction flows and idempotency after transient failures.
- Files: `backend/src/IPCManagement.Api/DependencyInjection.cs`, `backend/src/IPCManagement.Api/Data/UnitOfWork.cs`, `backend/src/IPCManagement.Api/Features/Coordination/Services/CoordinationService.cs`
- Risk: Partial writes or duplicated workflow/audit records when retry is enabled.
- Priority: High

**Supplemental fulfillment atomicity:**
- What's not tested: Real-database rollback when failure occurs after `RemoveStockWithCheckAsync` but before request/audit completion.
- Files: `backend/src/IPCManagement.Api/Features/Inventory/Services/SupplementalMaterialRequestService.cs`, `backend/src/IPCManagement.Api/Features/Inventory/Services/StockLedgerService.cs`
- Risk: Stock is decremented without a matching fulfilled request or auditable ledger state.
- Priority: High

**Malformed BOM workbook UX:**
- What's not tested: End-to-end translation and browser rendering of corrupt BOM workbook errors.
- Files: `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.cs`, `frontend/src/features/projects/weekly-menu/`
- Risk: User-correctable input appears as a server outage and can hide the actual recovery action.
- Priority: High

**Migration upgrade and excluded schema attributes:**
- What's not tested: Two populated-clone upgrades, SQL defaults, index naming assumptions, and `stocktakes.activeWarehouseKey` in the main schema equality gate.
- Files: `.github/workflows/verify.yml`, `backend/tests/IPCManagement.Api.Tests/PurchaseHistoryReconciliationTests.cs`, `backend/tests/IPCManagement.Api.Tests/SupplierDecisionWorkflowTests.cs`
- Risk: Data-preservation and schema regressions pass CI.
- Priority: High

**Remaining frontend error states and confirmations:**
- What's not tested: Explicit error rendering at 15 fallback call sites and confirmation content for BOM commit and employee activation/deactivation.
- Files: `frontend/src/features/admin/pages/AdminDataPage.tsx`, `frontend/src/features/approvals/pages/ApprovalPage.tsx`, `frontend/src/features/approvals/pages/ApprovalRulesPage.tsx`
- Risk: Operators mistake failed dependencies for empty/healthy data or execute high-impact changes without confirming scope.
- Priority: Medium

**Capacity and long-history behavior:**
- What's not tested: Sustained concurrent imports/reports, high-cardinality catalogs, and long audit/stock history query plans.
- Files: `backend/src/IPCManagement.Api/Features/Reports/Services/WorkflowReportService.cs`, `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.cs`, `tools/perf/`
- Risk: Query count, memory use, and latency grow nonlinearly beyond the small local dataset.
- Priority: Medium

---

*Concerns audit: 2026-07-27*
