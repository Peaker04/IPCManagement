# Menu Import, Contextual Dates and Canonical Price Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Direct parent only; no delegated implementer/reviewer, worktree, staging or commit is authorized. Checkboxes describe static execution steps; `.planning/WORK.md` remains the sole live task tracker.

**Goal:** Deliver context-aware date validation, real multi-customer menu preview/import, and one authoritative 25k/30k/34k price policy that selects the correct BOM without fabricated defaults or historical rewrites.

**Architecture:** Keep the current date primitive, importer, customer-contract service, batch transaction and BOM selection owners. Backend publishes its canonical tier list; FE consumes it through the existing query/cache mechanism. New multi-file scopes commit atomically; existing MRX batches retain the single source-change path and explicitly reject unsupported tier changes.

**Tech Stack:** Existing React/TypeScript/Vite/Vitest, ASP.NET Core 9/EF Core, xUnit and existing relational test fixtures. No dependencies or schema changes.

**Spec:** `docs/superpowers/specs/2026-11-06-menu-import-date-tier-coverage-design.md`.

## Global Constraints

- Current supported amounts are exactly **25000, 30000, 34000 VND**; no arbitrary user-entered tiers or new pricing administration subsystem.
- No global minimum of today. No silent Tuesday-to-Monday conversion. Date-only transport remains literal ISO and UI remains Vietnamese.
- DOM-MODE-1, existing RBAC, source approvals, completed/day locks, frozen facts, split servings and dirty-close protection remain mandatory.
- No package installation, delegation, staging/commit, seed/migration, mode switch or real business writes. Preserve inherited work and running FE/BE.
- One importer, one modal system, existing tokens; no parallel API/cache/store or test-only production seams.
- Additive endpoint/types must be generated with installed tools, never hand-edited. Missing tooling/disk prerequisites are BLOCKED, not an installation grant.
- Execute gates only after checking disk/memory; last C: measurement was 0.39GB free. Do not delete user files to make tests run.

## Review Focus

1. A malformed typed date while an old valid date/preview exists must block submit rather than reuse the old value — Task 2 primitive/importer tests.
2. A delayed preview after a file/scope edit must not re-enable commit, even if it resolves successfully — Task 5 real importer test.
3. A new MRX batch appearing between preview and atomic commit must reject the entire group, not bypass the single source-change path — Task 4 transaction-boundary test.
4. Identical dishes with a different selected tier must not be classified as an unchanged successful MRX reimport — Task 4 existing-batch test.
5. Commit success followed by publication failure must not invite duplicate import; it must report the saved draft and offer its scope — Task 5 result-state test.

## File responsibilities and dependency order

Backend roots below are `backend/src/IPCManagement.Api/`; backend tests are `backend/tests/IPCManagement.Api.Tests/`. No new backend feature/store is needed.

- Tier authority: `Features/Catalog/Services/DishBomPolicy.cs`; consumers `Helpers/BomSelectionResolver.cs`, `Features/Catalog/Services/{DishBomService,DishBomImportParser,DishCatalogMapper,DishCatalogDiagnosticsService}.cs`, `Features/SampleData/Services/{WeeklyMenuImportService,WeeklyMenuTemplateWorkbookBuilder}.cs`. Audit any other live tier whitelist, excluding migration/seed/history and unrelated numeric constants.
- Tier transport: existing `Features/Catalog/Controllers/DishesController.cs`, `frontend/src/api/bomApi.ts`, new `frontend/src/hooks/useSupportedPriceTiers.ts`. Generated API contracts are outputs only.
- Date owner: `frontend/src/components/ui/vietnamese-date-input.tsx`, existing date utilities, importer/week header callers and `Features/SampleData/{Controllers/WeeklyMenuImportsController*,Controllers/WeeklyMenuBatchImportsController.cs,Services/WeeklyMenuImportValidationPolicy.cs}`. Daily bounds belong to existing warehouse header/workspace owners, not a global date rule.
- Customer prices: `Features/Coordination/Services/CustomerContractService.cs`, `frontend/src/features/admin/{CreateCustomerModal.tsx,branches/AdminCustomersBranch.tsx}`, existing `customerApi.ts`.
- Import source/transactions: existing SampleData single/batch controllers, `WeeklyMenuImportService.cs`, `WeeklyMenuImportPersistence.cs`, `WeeklyMenuServiceContracts.cs` only if interface changes prove necessary.
- Import interaction: existing `WeeklyMenuImportModal.tsx`, new feature-local `hooks/useWeeklyMenuImportItems.ts` for actual multi-item/request state and `WeeklyMenuImportPreview.tsx` for server-row presentation. Existing MRX workbench/hook and DEFAULT page remain callback/caller owners. Do not split history into a second importer.
- Other FE tier consumers: `components/workbench/{DishBomEditorModal,DishBomBatchImportModal}.tsx`; remove duplicate allowed lists and missing-price-to-25k filters, not real persisted tier values.

Order: Task 1 enables Task 3 and Task 5; Task 2 and Task 4 establish safe admission before Task 5 exposes group commits; Task 6 verifies the complete boundary.

### Task 1: Publish and consume the canonical supported tiers

**Files:** Tier authority/transport owners listed above; `frontend/src/shared/api/contracts/{openapi.json,schema.ts}` generated; backend `DishCatalogTests.cs`, `ReconciliationBomSelectionTests.cs`, `WeeklyMenuImportParserTests.cs`; FE `ApiContracts.test.ts`, existing BOM modal tests.

**Interfaces:** Preserve `DishBomPolicy.SupportedPriceTiers` and its normalization contract. Add `DishesController.GetBomPriceTiers(): IActionResult` at `GET bom-price-tiers`, returning `ApiResponse<IReadOnlyList<decimal>>` under `CatalogReadAccess`. Add `bomApi.getSupportedPriceTiers(): Promise<number[]>`. New `useSupportedPriceTiers()` returns `{ tiers: number[]; isLoading: boolean; error: Error | null; retry: () => Promise<void> }`, with the existing query/cache owner and no hardcoded failure fallback.

- [ ] Extend the actual API/controller boundary test to assert the authenticated read contract returns exactly `[25000m, 30000m, 34000m]`; preserve existing unsupported-tier, normalized-price, tier-sheet and customer/effective-date tests. Extend the FE API transport test for `/Dishes/bom-price-tiers`; do not test source-string inventories.
- [ ] Run intended RED using the existing backend test project with `--no-restore --filter "FullyQualifiedName~DishCatalogTests|FullyQualifiedName~ReconciliationBomSelectionTests|FullyQualifiedName~WeeklyMenuImportParserTests"`; run FE `ApiContracts.test.ts`. Missing symbols/transport for this new public contract are intended failures, unrelated setup failures are not.
- [ ] Centralize allowed-tier membership/template enumeration in `DishBomPolicy`; preserve existing rounding and caller exception translation. Add read transport and the FE query hook. Update BOM editor/import controls to use it; failed metadata cannot create a fake valid 25k selection. Verify intended import actors already meet `CatalogReadAccess`; do not grant permissions.
- [ ] Regenerate contracts using installed tools only: build with `dotnet build backend/src/IPCManagement.Api/IPCManagement.Api.csproj --no-restore -c Release -p:UseAppHost=false -o .artifacts/contract-build/api`; use installed Swagger CLI to output OpenAPI, then the installed openapi-typescript 7.13.0 CLI with `--immutable --alphabetize`. Do not run root `gen:api` blindly because it restores/downloads tools. If either tool is absent, stop at this dependency barrier and request authorization rather than editing generated files. Run `npm run extract:backend-actions` for the genuine additive action; inspect resulting metadata changes, not exemptions.
- [ ] Run focused tests GREEN, including existing `BomApi.test.ts`, `DishBomBatchImportModal.test.tsx` and `DishBomEditorModal.test.tsx`. Existing valid saved selections and wrong-tier exclusion must remain intact. Record tooling blockers separately from code results.

### Task 2: Enforce dates at the correct form and server boundaries

**Files:** Existing date primitive/utils; `WeeklyMenuImportModal.tsx`, `WeeklyMenuPage.tsx`, `branches/MrxBatchHeaderBranch.tsx`; `features/warehouse/branches/MrxDailyHeaderBranch.tsx` and its workspace caller if validity must block daily mutations. Backend date admission/validation owners in the map. Tests: existing `Primitives.test.tsx`, `WeeklyMenu.test.tsx`, `MrxSourceEdit.test.tsx`, backend `WeeklyMenuImportsControllerContractTests.cs`, `WeeklyMenuBatchImportsControllerTests.cs`, `WeeklyMenuImportParserTests.cs`.

**Interfaces:** Extend `VietnameseDateInputProps` with `isDateAllowed?: (isoDate: string) => boolean`, `validationMessage?: string`, `onValidationChange?: (message: string | null) => void`; use inherited optional min/max. Preserve `value: string`, `onChange?: (isoDate: string) => void` and existing callers without constraints. Existing import validation policy provides `ParseRequestedWeekStart(string? value): DateOnly?` for mutation/template boundaries; absent stays optional, malformed/non-Monday supplied dates throw a meaningful argument/business error. Parsed workbook start is checked separately in `Build`.

- [ ] Extend the primitive interaction cases: real date/invalid date, Monday-specific caller rejects `13/10/2026` but accepts historical `12/10/2026`, unconstrained service-date caller accepts `13/10/2026`, min/max apply to calendar/Today/text. Assert emitted ISO values and accessible error, not implementation classes. Extend importer test: invalid draft after a valid preview blocks commit and invalidates the token.
- [ ] Add server boundary assertions: malformed supplied date is not treated as missing; Tuesday import is rejected; historical Monday remains allowed by date policy; workbook/request mismatch still fails. Use one owner for each rejection instead of duplicating every date across controllers/parser/UI.
- [ ] Run the named focused FE/backend suites RED. Valid historical data must reach the relevant date policy rather than pass/fail because of unrelated role/lock checks.
- [ ] Implement primitive admission, visible error/ARIA linkage and validity callback. Only valid commits emit `onChange`. Wire Monday admission into new import/template/week selection and actual daily batch bounds into warehouse date selection. Do not put a future-date rule in the primitive. Keep legacy/history scopes readable and preserve service-day selectors with no Monday restriction. Ensure invalid text cannot authorize a mutation using the previously accepted controlled value.
- [ ] Implement server admission before reading/committing files and validate inferred workbook week starts. Keep read-query handling separate from new-write Monday policy; do not silently normalize or rewrite old scopes.
- [ ] Run focused GREEN plus existing `Warehouse.test.tsx`, `Chef.test.tsx`, `MealOrders.test.tsx`, `Reports.test.tsx` and Render1/cache owners as compatibility coverage. Assert scope bounds at the server daily-write owner if existing coverage lacks them; do not invent a server-clock rule.

### Task 3: Remove fabricated/default customer prices

**Files:** Existing customer service and FE create/list/API owners; tests `WorkflowGenerationTests.ContractsAndProduction.cs`, `CustomerContractPolicyTests.cs`, `frontend/src/__tests__/AdminCustomersBranch.test.tsx`.

**Interfaces:** Preserve existing wire DTOs (`defaultMenuPrice` is already nullable in the read/create contract). Create requires an explicitly selected supported price at the service boundary; update omission preserves a valid existing contract. `ResolveDefaultMenuPrice` becomes nullable for read derivation: only one distinct supported schedule tier can be derived, never an average or empty-set 25k.

- [ ] Extend real service tests: missing/unsupported create price creates neither customer nor contract; create with 30000 succeeds; no-contract mixed/absent schedules map to null; one supported schedule tier maps to that tier. The old successful create fixture uses 50000: intentionally revise the valid-price case to 30000 and retain 50000 as a rejection test, not a deleted assertion or hidden exception.
- [ ] Extend the FE customer owner case to require explicit supported selection and assert 30000 in the real transport body; missing list price displays `Chưa cấu hình`, not 25k. Metadata failure blocks create with retry. Keep existing dirty discard and failed-submit retry assertions.
- [ ] Run backend filter `FullyQualifiedName~WorkflowGenerationTests|FullyQualifiedName~CustomerContractPolicyTests` and FE `AdminCustomersBranch.test.tsx` RED.
- [ ] Validate create price before tracking entities. Remove server empty-price/average fabrication; distinguish read derivation, update omission and new-contract validation. Preserve duplicate code, active shifts/dates, audit, week-tier invariants and locked schedule protections. Remove FE preselected/default 25k and list truthy fallback; use Task 1 query for supported choices. No schema change, legacy data rewrite or contract-driven repricing of an imported week.
- [ ] Run GREEN. Re-run existing frozen application-path case when changing any schedule-affecting service logic; assert no historical/frozen facts change. Keep historical invalid persisted price visible as invalid/unconfigured, not normalized into a supported tier.

### Task 4: Close MRX tier and atomic batch admission gaps

**Files:** Existing `WeeklyMenuImportService.cs`, batch controller/contracts as necessary; tests `WeeklyMenuImportBatchTests.cs`, `WeeklyMenuBatchImportsControllerTests.cs`, `WeeklyMenuImportPreviewTicketStoreTests.cs`, existing MRX source-change/application-path tests.

**Interfaces:** Preserve single `CommitWeeklyMenuImportAsync` and batch multipart API. Existing-MRX analysis receives the requested normalized tier in addition to plan/customer. It rejects selected-tier mismatch against persisted schedule/authoritative week tier before no-change classification. Batch path admits only scopes without an MRX batch and repeats that guard under its transaction/retry boundary; no actor-policy bypass or alternate applier.

- [ ] Extend the existing reimport harness with identical dishes/requested 30000 against a persisted 25000 MRX week: expect a clear rejection, zero version/schedule/contributor/revision change. Existing same-tier locked-identical, changed-locked and coordinator-pending cases remain their primary owners.
- [ ] Extend existing batch relational coverage: one item has an existing MRX batch -> zero writes for all; a batch appears after preview/preparation -> the protected commit check rejects all. Keep current rollback/retry/no-duplicates, positional alignment, duplicate scope and consumed-token tests; extend rather than copy them.
- [ ] Run backend filter `FullyQualifiedName~WeeklyMenuImportBatchTests|FullyQualifiedName~WeeklyMenuBatchImportsControllerTests|FullyQualifiedName~WeeklyMenuImportPreviewTicketStoreTests` RED. The race probe must exercise the real transaction/preflight owner, not a mock whose body implements the expected rejection. Do not add test-only production callbacks.
- [ ] Add explicit tier mismatch and batch-existing-scope admission at the existing owners. Report customer/week and direct the user to single reimport. Preserve single gateway/role flow and all date locks. Use the existing transaction runner/fences, not a second transaction framework; recheck on retries. If the existing database locking primitive cannot prove the concurrent creation fence, stop and report the exact relational/runtime evidence gap rather than claiming safety from a sequential test.
- [ ] Run GREEN plus existing MRX source-edit and frozen import application-path suites. SQLite rollback proof is not MySQL concurrency certification; no provider target or DB mutation is implicitly authorized.

### Task 5: Deliver the scoped multi-file preview and result lifecycle

**Files:** Existing `WeeklyMenuImportModal.tsx`, `frontend/src/api/weeklyMenuApi.ts`, MRX hook/workbench and DEFAULT page only for real callback integration; new `features/weekly-menu/hooks/useWeeklyMenuImportItems.ts`, new `features/weekly-menu/WeeklyMenuImportPreview.tsx`. Tests: existing `MrxSourceEdit.test.tsx`, `WeeklyMenu.test.tsx`, `ApiContracts.test.ts`.

**Interfaces:**
- Keep `onImportSuccess(scope?: { customerId: string; weekStartDate: string }): void`; rollback remains no-scope.
- `weeklyMenuApi.commitWeeklyMenuImportBatch(formData: FormData): Promise<WeeklyMenuImportResult[]>`, using the existing commit-batch endpoint and existing cache invalidation. `WeeklyMenuImportResult` uses the generated non-null result DTO, not a fabricated UI API shape.
- Local `ImportScope = { customerId: string; weekStartDate: string; priceTierAmount: number }`. Stable item IDs are UI identity, not business IDs. Hook owns item files/scopes, per-item revisions/previews/errors and pending/results; modal owns presentation/history/exits. Hook operations: `addFiles(files: File[]): void`, `updateItem(id: string, patch: Partial<ImportScope>): void`, `removeItem(id: string): void`, `previewItem(id: string): Promise<void>`, `commitItems(autoPublish: boolean): Promise<WeeklyMenuImportResult[] | null>`; null means no accepted commit, never synthetic success.
- Preview component receives one server result and its chosen scope; it renders normalized menu rows using existing table/formatting primitives, no parser or backend emulation in the browser.

- [ ] Extend real importer/router cases with two distinct customers/weeks/tiers: preview actual rows, verify both multipart scopes/token positions, one batch commit, choose a committed result and open that exact MRX scope. Mock only HTTP/API transport and grounded DTOs, not the new hook/modal/state boundary.
- [ ] Add one stale-response regression (edit scope while its preview is pending), one atomic failure/retry case retaining all file inputs, and one post-commit publication failure case proving committed status/open-week action/no second commit. Extend existing dirty/pending-close case to multiple files rather than duplicating all modal exits.
- [ ] Run named FE suites RED. Confirm failures are missing group/preview/lifecycle behavior, not incomplete DTOs or missing auth eligibility fixtures.
- [ ] Implement item/request state in the feature hook and render item scope controls in the existing modal. One file follows existing API; 2..10 files follow atomic batch. Reject duplicate customer/week, invalid dates, unsupported/unavailable tiers and expired/invalidated previews before submit; server remains authoritative. Every file/scope edit invalidates its preview immediately and late responses cannot restore it.
- [ ] Render real date/shift/variant/slot menu preview and source diagnostics in `WeeklyMenuImportPreview`. Preserve duplicate dish occurrences and missing split-serving state. Do not create fake servings or equate a valid menu import with complete BOM/preparation.
- [ ] Show committed scope results for groups. Disable auto-publish for multiple files with an explanation; retain single optional publication, report publication failure separately after accepted import, and prohibit duplicate commit of accepted results. Refresh/invalidate existing cache owners on accepted writes. Choosing a result passes its scope; closing final results without selecting preserves the inspected scope and refreshes it if affected. Retain history rollback and DEFAULT refresh semantics.
- [ ] Run GREEN plus `MrxDashboard.test.tsx`, `Render1CacheHitVerification.test.tsx`, existing BOM modal/customer tests. Before any TSX/CSS edit emit the scoped UI gate for /weekly-menu and /admin-data, current work objects/modes/guards/states/primitives; use only existing semantic styles and one blocking modal.

### Task 6: Prove pricing-to-BOM and close the scoped verification

**Files:** Existing `ReconciliationBomSelectionTests.cs`, `ReconciliationQuantityImportApplicationPathTests.cs` and the nearest existing initial-import relational owner; bounded canonical docs only if observable contracts need updating (`docs/domain/weekly-menu.md`, `docs/domain/material-reconciliation.md`). `.planning/WORK.md` is the only live status owner.

**Interfaces:** No new production seam. Exercise persisted `MenuSchedule.MenuPrice` and real BOM projection/quantity owner from Tasks 1/4/5; no formula copied into the frontend test oracle.

- [ ] Extend strongest existing import/projection case with independently specified published BOM quantities at two supported tiers, same dish/customer/date. Assert imported selected tier is persisted, selected ingredient quantity is correct and wrong-tier quantity is absent; retain customer override/effective-date behavior without a combinatorial matrix. Existing split-serving/conversion/frozen tests remain their owners.
- [ ] Run the relevant backend case RED before any remaining owner correction, then GREEN. If it already passes, retain existing proof or extend the existing case only for the distinct missing boundary; do not manufacture a failing test for a pure refactor.
- [ ] Run focused backend suites with `--no-restore`, then scoped or core backend suite according to available safe prerequisites. Run `npm run test:fe:unit`, `npm run lint:fe`, `npm run build:fe`, `npm run depcruise:fe`, `npm run check:conformance-contracts`, `npm run check:architecture-growth`. Run backend build with `--no-restore`; no automatic restore/install. Check generated API output and true action metadata without padding baselines. Exact absent operationalPageContracts/contract suites are NEEDS_EVIDENCE/not present, not substitute green claims.
- [ ] Load/apply ipc-code-review, ipc-ui-review and test-audit gates. Review all changed callers, pending exits, policy failure states, stale results, legacy reads, tier association and locked facts. Record skill report columns: Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact. Run scoped diff checks and Impeccable source detector; distinguish source checks from rendered proof.
- [ ] Update relevant canonical contract prose only for approved changed behavior, then WORK with per-criterion PASS/FAIL/BLOCKED/NEEDS_EVIDENCE and IDLE. No commit/deploy or unapproved process restart. Backend source changes are not evidence that the currently running older DLL serves new API.
- [ ] Hand off real UAT prerequisites and actions: adequate disk, authorized updated BE runtime/confirmed actor+mode, real Monday file with customer/week/tier, preview content, multi-scope atomic failure/success, reload chosen scope, alternate-tier BOM quantity and frozen old batch unchanged. Separate browser/provider/write authorization is required; never synthesize production records to manufacture PASS.

## Self-review and execution handoff

Coverage map: spec sections 1 -> Task 1; 2 -> Task 3; 3 -> Task 2; 4 -> Task 5; 5 -> Tasks 4/5; pricing/proof -> Task 6. All five Review Focus conditions have named owners. Existing batch tier-change and group reimport are explicit unsupported boundaries rather than silent success; user should review these choices before execution.

Plan is ready for direct-parent review, not an execution grant. Confirm this captures the approved scope, including atomic new-scope groups, single existing-batch reimport and explicit tier-change rejection. Once approved, execute inline with the existing WORK checklist; do not launch subagents or install tools to bypass prerequisites.
