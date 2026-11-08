# MRX Complete UAT Remediation Implementation Plan

**Required follow-up:** `2026-11-07-mrx-followup-compact-scope-and-inspection.md` and its linked design add R16–R21 (approved selector A, inspection formatting/code/action, cross-route weekly scope and frozen hierarchy). Read both plans; the follow-up supersedes only the affected composition/scope-return decisions, never R01–R15 or U00–U12. WORK owns actual approval/execution status, not historical proposal wording.

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans, directly in current checkout. Execute only the scope explicitly approved by the owner and recorded in WORK; this document alone grants no new authority. No delegation, new worktree, staging or commit. WORK is the sole live checklist; all checkboxes here are static work instructions.

**Goal:** Resolve every R01–R15 requirement, including two standalone sidebar views and actual visual/business-flow acceptance, without another partial-completion report.

**Architecture:** Existing route registry/capability/surface owners, one canonical quantity-source calculator and existing workbench primitives. Independent paged read views replace the embedded quantity-summary tabs. Existing import/source/batch commands keep their protections; the owner's confirmed MRX stock decision below supersedes historical physical-stock assumptions.

**Tech Stack:** .NET9/EF Core, React/TypeScript, installed xUnit/Vitest/Playwright, existing UI kit and native browser file/crypto APIs.

**Spec:** `docs/superpowers/specs/2026-11-07-mrx-uat-complete-remediation-design.md` (R01–R15 and U00–U12).

## Owner correction — preparation/export and confirmed MRX stock decision A

Owner explicitly confirmed **A: MRX assumes sufficient stock and records reconciliation quantities only**. No physical-stock lookup/admission, automatic provision, ADJUSTMENT or ISSUE movement/current-stock update is permitted for new MRX issues. DEFAULT stock validation/posting is unchanged. Keep old issue-linked movements and command receipts readable/replayable, never erase or rewrite them. This supersedes earlier instructions here and in linked follow-ups to retain MRX stock guards or stock-writing coordinated preparation.

- R26 scope: `ReconciliationInventoryIssueCreator` is shared by daily initial/supplemental and retained coordinated commands. Remove only physical-stock effects/dependency/shortage audit from that MRX owner; preserve canonical warehouse identity, mode/version/transaction/replay, exact daily lineage, quantity/reason validation, dispositions, issue documents and audit. Migrate both actual constructor callers (`InventoryIssueService`, `ReconciliationPreparationService`) and their fixtures.
- Regression owner: extend the existing relational issue/detail/replay case to prove absent/zero/insufficient/sufficient physical stock cannot affect MRX initial or supplemental issue, persisted stock stays exact and movements remain absent; preserve lineage, variance audit, lifecycle/version and exactly-once tests. Existing DEFAULT shortage/real-ledger tests remain unchanged. Update the real architecture-oracle reference after renaming that case, not discovery exemptions. Migrate G1/G3/G4/G5/G6 issued-quantity oracles from expected stock decrement/provision to unchanged physical snapshots plus persisted issue-line quantities; no live E2E authority inferred.
- Update `docs/domain/material-reconciliation.md`, `docs/DOMAIN.md`, `docs/FLOWS.md` and exact canonical statement digest as needed. No schema migration, data correction, credentials, runtime restart, package install, stage/commit or delegation authorized.
- Verification: focused issue/preparation/DEFAULT/storage/architecture owners, core solution `dotnet test ... -p:ArtifactsBinOutputName=bin-mrx-logical` under the established non-integration/non-EvidenceOwned filter; conformance validation and diff-check. Source/automated success does not prove the running old DLL changed.
- **Binding owner correction approved after implementation review:** preparation selects **Ngày or Cả tuần**, not week-only. Same existing `/warehouse?view=mrx-preparation`; exact day stays unchanged, whole-week normalizes selected date to Monday only for request range. Retain independently selected batches until date/scope changes; controls reset selection and refuse stale cached data. Excel full export is **one worksheet**, menus (customer/date/shift/variant/dish/servings) at top, then materials visibly separated by actual supplier with same-unit customer allocation and totals below. Do not split menu into another sheet or substitute a menu/material-only UI choice for day/week. Retained API `includeMenus=false` may preserve old two-sheet consumers; UI always includes menus. Frozen kitchen authority reused; no issue command. This overrides conflicting week-only/three-sheet text below. Required RED→GREEN: existing workbook regression asserts sheet1 menu rows before supplier headings, one full sheet, numeric servings/quantity, exact Sunday/day exclusion; existing Warehouse export owner asserts day/week query+mode switching and no POST. Fresh browser fixtures show both scope choices, actual full workbook acceptance still needs real actor/file/runtime authority.
- R22–R25 implementation: preserve header/world/primitives, title `Chuẩn bị nguyên liệu theo tuần`, existing date primitive normalized to Monday with label `Tuần chuẩn bị`; same existing GET accepts `weekStartDate` (exactly one of day/week), DTO ServiceDate is scope start and weekly sums retain exact daily allocation IDs. Export scope uses Monday and selected batch IDs, external Select `Nội dung Excel` gives full-menu+materials vs materials-only; remove supplier textbox and all preparation mutation/success/outcome states. Issued/READY/history batches remain independently selectable for read/export, never auto-issued. Header scope/export row separate from ingredient-only find; popup search remains a distinct explicit customer-selection task, one blocking overlay maximum.
- Extend existing workbook query with `IncludeMenus` (default false for retained API consumers). Full export uses existing `ReconciliationKitchenExportService.GetAsync` frozen projection per scoped selected batch, groups once by actual date/shift/variant/dish identity/servings into third menu sheet with customer identity; fail closed on missing/ambiguous frozen lineage. Existing supplier ingredient grouping and numeric cells remain. Optional ingredient-only workbook keeps existing two-sheet compatibility. Reject absent/contradictory date scope and non-Monday week; preserve exact customer/batch and no writes.
- Regression boundaries: existing Warehouse network-boundary export test owns week/query/options/selection/search/auth denial/no POST; replace retired coordinated-UI matrix with read/export state/retry/no mutation, not deleted safety silently. Extend actual preparation read tests for whole-week/week-edge exact-unit sums and workbook tests for menus, late-week rows, supplier grouping, numeric servings, no writes and invalid scope. Migrate browser and actual campaign code or clearly keep already-retired command campaigns not runnable until migrated; no skips/exemptions.
- R22–R25 remain required: remove the two dashboard lines; resolve competing search presentation; preparation read/export only, not auto-fill-and-issue; weekly menu/material workbook with supplier grouping and external export-direction controls. Those UI/export changes require their scoped Impeccable pre-code and rendered gates, not implied complete by R26 backend repair.
- R27 and U00–U12 remain open at their actual evidence boundaries, including native200%, native print/cancel and real actor/file/persistence acceptance. WORK alone owns live progress.

## Global constraints

- All new views MRX-only; DEFAULT remains isolated. Preserve locks/completed records, role/permission/approval, audit reasons, frozen facts, atomic imports and unknown-outcome protection.
- Exactly25000/30000/34000 through existing MenuPriceTierPolicy/metadata; no fabricated price/unit/BOM/serving fallback. Historical Mondays remain valid where scope permits.
- Source/automated/rendered/live/owner acceptance are separate. Spec approval and tests do not close UAT.
- Styling authority index.css; existing primitives only. D6>=12px, D7 one primary per work context, T6 actual merged-cell centering, T7 sticky header/identifier, T8 ordinary36–40px/editable44px, M1.2 safe blocking/focus, N6 nested sidebar only.
- Preserve dirty checkout/index. No installs/restores/migrations/seeds/real writes/runtime restart/relay changes/delegation/commit implicitly authorized by this plan.
- Backend Release --no-restore -m:1 -p:UseSharedCompilation=false. Measure resources/process locks before heavy work; use established isolated bin-uat output and UseAppHost=false when needed. Never terminate owner processes to make build pass.
- Every repair gets the smallest credible existing-owner regression if behavior changes, with intended pre-fix failure. Pure copy/spacing does not require class/string tests; use rendered acceptance. No component/hook-under-test mock, fixture-fabricated behavior or exemption padding.

## Review focus

1. Cold deep links and refresh on two new pages must not redirect to preparation, require a prior preview ticket or leak a previous scope (T1/T2; U01/U07).
2. Clicking the new sidebar while source edits/reason or writes are pending must not silently discard them; canceled navigation preserves exact focus/draft (T5; U06).
3. Source changes between pages, same ingredient at different recipe rates/units and same named dish in different variants must remain distinguishable (T1/T2/T6/T8; U07/U09).
4. One import entry must retain intentional NEW scope versus REIMPORT current scope, including completed batch, late lookup and publication retry (T3; U02/U05).
5. Visible merged/group controls and cooked filtered print scope must work at actual zoom, long text and print-cancel, not just in jsdom (T4/T8/T10; U06/U09/U10).

## File map

- Navigation: frontend/src/routes/{routeRegistry.ts,workbenchSurfaceRegistry.ts,navigationEligibility.ts}; frontend/src/features/weekly-menu/WeeklyMenuPage.tsx; backend/src/IPCManagement.Api/Features/SystemOperation/Services/SystemOperationEligibility.cs. Change navigationEligibility only if real behavior requires it; no parallel menu list in AppShell.
- Read contracts: backend/src/IPCManagement.Api/Features/Reconciliation/{Contracts/QuantityInspectionDto.cs (new),Controllers/ReconciliationBatchesController.cs,Services/ReconciliationQuantityImportService.cs}; frontend/src/api/mrxApi.ts; generated frontend/src/shared/api/contracts/{openapi.json,schema.ts}.
- Two read views: new frontend/src/features/weekly-menu/{MrxQuantityInspectionPage.tsx,hooks/useMrxQuantityInspection.ts}; reuse/move actual table/detail pieces from MrxBatchPreviewSection.tsx and MrxShiftDishesModal.tsx instead of copying their transforms. Delete superseded container only after real callers/unique tests migrate.
- Import: frontend/src/features/weekly-menu/{WeeklyMenuImportModal.tsx,WeeklyMenuImportPreview.tsx,MrxBatchWorkbench.tsx,branches/MrxBatchHeaderBranch.tsx,hooks/useWeeklyMenuImportItems.ts}.
- Source/dirty: frontend/src/features/weekly-menu/{MrxSourceEditGrid.tsx,MrxSourceChangePanel.tsx,MrxBatchWorkbench.tsx,hooks/useMrxSourceEdit.ts}; existing components/workbench/{dirty-navigation-context.ts,DirtyNavigation.tsx} only if actual shared mechanism needs repair; no new global draft store.
- Localization/frozen: frontend/src/constants/mrxConstants.ts; frontend/src/components/workbench/MrxBatchDishesModal.tsx; affected source/preview/plan/chef presentation owners.
- Warehouse: frontend/src/features/warehouse/{MrxMultiCustomerPreparationWorkbench.tsx,branches/MrxPrepAllocationsBranch.tsx,branches/MrxPrepHeaderBranch.tsx}.
- Chef: frontend/src/features/chef/{MrxCookingWorkbench.tsx,branches/MrxCookingHeaderBranch.tsx,branches/MrxCookingDishListBranch.tsx}.
- Machine contracts: docs/{conformance-contracts.json,table-contracts.json,backend-action-index.json}; docs/domain/weekly-menu.md. No baseline/allowlist expansion to hide failing delivery.
- Owner tests: frontend/src/__tests__/{AppShell,Auth,WeeklyMenu,MrxSourceEdit,MrxSourceEditFoundation,Reconciliation,Warehouse,Chef,ApiContracts,FullMrxModernizationSmoke}.test.ts[x]; backend/tests/IPCManagement.Api.Tests/{ReconciliationQuantityImportApplicationPathTests,ReconciliationQuantityImportReachabilityTests,SystemOperationCapabilityProfileTests}.cs plus real endpoint authorization owner. New focused browser spec frontend/tests/browser/mrx-menu-remediation.spec.ts only for distinct geometry/navigation coverage, using actual current auth fixtures, no fake live credentials. New bounded config frontend/tests/config/playwright.mrx-remediation.config.ts uses only that spec, installed headed Chrome, explicit baseURL, one worker and NO webServer/globalSetup/globalTeardown/seed/login bypass; do not inherit default auto-start/mock-login behavior.

## Task1 — Canonical read-only inspection API (R10)

**Interfaces:** Add `QuantityInspectionPageDto<T>(string MenuVersionId, string ContentFingerprint, int FingerprintFormatVersion, IReadOnlyList<string> Diagnostics, PagedResponseDto<T> Page)`. New material summary has IngredientId/Code/Name, CanonicalUnitId/Name, RequiredQuantity and Contributions. Each contribution carries actual ServiceDate, Shift, QuantityPlanLineId, DishId/Name/Slot, FinalServings and existing QuantityImportMaterialContributionDto; never a new guessed rate. Shift-plan item is `(DateOnly ServiceDate, string PlanCode, QuantityImportPlanLineDto Line)`.

Service public methods `GetMaterialInspectionAsync(string menuVersionId, PagedRequestDto request, CancellationToken token = default)` and `GetPlanInspectionAsync(...)` return the respective typed envelope. Both reuse the existing LoadSnapshotAsync/Map/fingerprint owner. No PreviewAsync call, commit-ticket allocation, SaveChanges or transaction/state mutation for these GETs. Keep Preview/Commit signatures unchanged.

Controller GETs are `quantity-import/materials` and `quantity-import/plans`, same ReconciliationSourceReadAccess policy. Proposed capability IDs RECON.SOURCE_MATERIALS.READ / RECON.SOURCE_PLANS.READ map to actual methods; same source permission, no role expansion. Validate menuVersionId via existing ID policy. Existing published/completed-source validation remains authoritative.

- [ ] Extend real quantity-import owner with read-only material/shift projections: independent exact quantities and contributor rates/units, page counts after aggregation/search, stable sorting, invalid/prerequisite paths and zero added/modified/persisted business records/tickets. Assert no token exists in read DTO by its actual contract, not source grep. Preserve current Preview/Commit tests.
- [ ] Run `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj -c Release --no-restore -m:1 -p:UseSharedCompilation=false -p:UseAppHost=false -p:ArtifactsBinOutputName=bin-uat --filter 'FullyQualifiedName~ReconciliationQuantityImport'`; capture genuine missing-interface/behavior RED without treating fixture compile typos as behavioral proof.
- [ ] Implement at existing source calculator; aggregate ingredient+canonical-unit first, then search/count/page; sort material Name/Id/Unit and plan ServiceDate/Shift/LineId. Preserve all distinct rate/unit facts in contributions. Default frontend page50, standard server clamp1..100. Do not sum a meal per dish or quantity across units.
- [ ] Re-run owner and endpoint permission/mode tests; generate actual OpenAPI/schema/action index with installed tools only. Register two read actions/surfaces, not invented permission tokens. No DB migration or feature-boundary exception.

## Task2 — Deliver two real sidebar views atomically (R10, R06)

**Interfaces:** `MrxQuantityInspectionPage({ view }: { view: 'materials' | 'plans' })`; hook `useMrxQuantityInspection({ customerId, weekStartDate, view, pageNumber, pageSize, searchKeyword, enabled })` exposes validated current source, typed inspection page, existing state-boundary inputs and retry. Frontend mrxApi calls exact T1 GETs, generated types. No mutation commands or hidden whole-workbench mount. Source and data cache identity include mode/customer/week/menuVersion/view/page/search; response fingerprint handles changed read generation.

- [ ] Extend AppShell/Auth and WeeklyMenu owner at real router/network boundary:3 leaves, correct active item, cold direct URLs/F5, preserved customer/week, non-MRX/denied rejection, failed API+retry, no previous-key detail, no redirect back to mrx-batch. Existing fixture responses must match new C# envelopes.
- [ ] Run those owners for RED; implement registry leaves `mrx.materials`/`mrx.plans` and URLs from spec, allowed MRX view dispatch, actual backend pageTabs, source/capability contracts and skeleton geometry. Preserve14 top-level routes. Scope forwarding is only for weekly leaves and strips transient action/token/unrelated batchId.
- [ ] Implement spec materials/plan layouts with real server pagination/search, source-fingerprint context, diagnostics and clear draft/current-vs-frozen label. Read incomplete source as blocker, not empty success. Source-version change resets page/detail; late reads cannot restore other scope; fingerprint change during paging resets/reloads with notice.
- [ ] Remove quantity-summary accordion/tabs from MrxBatchWorkbench. Keep commit/freeze/transfer prerequisites/diagnostics on preparation; migrate sole precision/unit assertions from obsolete container to replacement owner, do not just delete meaningful coverage. Reuse shift-dish detail and retain lineage facts.
- [ ] Run frontend owners and T1 capability profiles. Do not label READY delivery in report until route→authorized read→actual view exists; final browser acceptance remains separate.

## Task3 — One import entry, correct draft/new-scope intent (R01/R02/R11)

**Interfaces:** Existing importer gains `initialScopeIntent: 'current-week' | 'new-week'`, defaulting to existing caller intent; fixed current customer/week passed separately as today. Scope selector is internal to same modal, not two page-level import buttons. Current-week switch must invoke the same preview/revision invalidation as editing scope; no second store. Completed context cannot choose current-week mode. Existing DEFAULT caller retains previous behavior unless explicitly choosing scope intent.

- [ ] Extend real importer/router owner: one entry opens modal; current-week stays fixed; new-week recovers matching draft/manual intent; switch invalidates token/late lookup; completed batch only new-menu; dirty/pending cancel, file queue, group order, accepted-publication retry do not duplicate commit.
- [ ] Run MrxSourceEdit/WeeklyMenu RED only for new behavior; retain already-passing history/recovery cases rather than manufacturing failures.
- [ ] Consolidate visible controls at header and existing modal; remove old reimport toolbar duplicate. Use spec exact action copy and preserve SHA256/customer/tier/history ambiguity rules. Saved-week helper stays within existing field and readonly calendar until Đổi tuần; truthful upload queue remains.
- [ ] Re-run importer/WeeklyMenu/API owners; preparation/source dirty guard from T5 must cover opening/switching, not bypass it. Record R01/R02 historical behavior as reverified or still NEEDS_EVIDENCE, not assumed PASS.

## Task4 — Correct weekly preview and merged/edit-cell composition (R03/R07/R08)

- [ ] Read real import row/merge contracts and existing matrix cases. Extend existing occurrence/duplicate-slot owner only where grouping changes behavior; assert weekly day-column menu, every real occurrence/last date, known variant from slot not dish name and accessible secondary source diagnostics. No dummy servings/editScope adapter or dedup by name.
- [ ] Run MrxSourceEdit and MrxSourceEditFoundation for intended RED where behavior changes. Announce scoped UI gate before TSX/CSS.
- [ ] Implement preview matrix in WeeklyMenuImportPreview with existing pure data model only where its actual input fits. Keep all week days; bound table horizontally, not arbitrarily cut day/rows. Match outside matrix reading direction. Exactly one modal vertical body owner.
- [ ] Center semantic merged cells in source view; center compact group caption/picker/subordinate split control as a block. Preserve row/column spans, pending disabled state, compatible lock boundaries, group-versus-single targets and proper text wrapping. Do not change merge algorithm merely to alter alignment.
- [ ] Run actual matrix owner; use U03/U06 geometry as evidence for CSS-only changes instead of adding class assertions. Source detector alone cannot close these rows.

## Task5 — Early validation, main ordering and safe new navigation (R04/R05/R06/R12)

- [ ] Extend existing source entry owner only for unprotected contracts: missing-before-request/zero/one real preview already have an owner; add real sidebar navigation and customer/week cancel/discard/pending behavior using existing dirty provider. No business-hook mocking.
- [ ] Run WeeklyMenu/MrxSourceEdit RED for navigation loss before wiring. Read current dirty-navigation-context.ts and provider before using registerDirty/requestNavigation; do not invent context APIs or global flags.
- [ ] Register actual source/reason dirty state and pending guard; protect sidebar and local scope changes, supported back/forward/reload exits. Cancel keeps values+focus; accepted discard resets only local state; accepted write clears dirty registration after actual reload. Modal/source cannot stack competing discard dialogs.
- [ ] Keep main order and one source/lifecycle strip per spec. Retain source-version/locks/diagnostics/next command after T2 removes summary. Keep early completeness, actual preview return and clear initial-entry note explanation; never remove backend audit reason or generate one automatically. Sync Lập lô đối soát copy in source and machine action contract.
- [ ] Re-run focused owners and existing role/locked/completed/409/unknown-outcome cases; U04/U05/U06 remains required on real UI.

## Task6 — Single shift-language authority and frozen facts (R09/R13)

- [ ] Trace all affected known-shift renderers, including constants, modal filter, service schedule, impact, preview, new plans and chef. Set presentation labels exactly Sáng/Chiều; retain enum payload and external exports unless their independent contract explicitly requires change. Remove affected duplicated literals, not a repository-wide unrelated rename.
- [ ] Preserve existing frozen-date/rate/count owner. Only extend if a real new grouping bug is found: same ingredient+unit with differing day/rate cannot collapse or sum per-serving rates. Missing/unknown units and lineage remain honest.
- [ ] Apply compact list/detail treatment without removing facts; group only facts with proven compatible identity/lineage. No current master recipe fallback. Copy-only changes need no new redundant test.
- [ ] Run Reconciliation/WeeklyMenu/MrxSourceEdit owners; U07 actual short labels, date/rate provenance, selection/search/empty/denial/focus must pass before closure.

## Task7 — Preparation layout, not just moved wrappers (R14)

- [ ] Read whole existing coordinated-issue selection/export/unknown-outcome owners before changes. Only extend interaction coverage if movement changes actual behavior, not CSS classes.
- [ ] Declare warehouse UI gate; implement spec header/customer-selection/filter-row/grid composition with existing components. Search and supplier-for-Excel must be visually distinct; hide nonfunctional export/grid chrome in prerequisite empty state without hiding required selection.
- [ ] Retain stock/atomic selection/hidden selected batches/existing-issue disabled and actual day authority. Do not change stock commands/transactions or automatically select ineligible batches for a nicer view.
- [ ] Run Warehouse owner. Render none/one/many/long-name selections and no-selection/outcome-unknown in U08; pure automatic test green does not certify redesign.

## Task8 — Cooking two-row header and preserved detail/printing (R15)

**Interface:** MrxCookingHeaderBranch accepts existing-action ReactNode and renders it in WorkspaceHeader.actions; Workbench retains actual download/print callbacks and guards. Row2 combines existing LocalFindBar with contextual counts; remove redundant telemetry-only row, no duplicated input/search state. Keep full-batch export wording.

- [ ] Preserve/extend existing Chef variant/selection/search/export owner to prove controls still reachable and correct endpoint/scope. Do not re-test every class.
- [ ] Declare chef UI gate; consolidate header/body per spec. Retain real SplitView key and selection reset, unique-meal totals, full ingredient detail and unknown-unit label. Long filters/labels wrap within rows, not offscreen.
- [ ] Keep beforeprint rendering all currently filtered groups; verify afterprint/cancel restores selected detail; no narrowed CSV/XLSX scope. Do not claim print acceptance from emitted beforeprint alone.
- [ ] Run Chef owner; U09/U10 actual top-row actions/row2 search, variants, zero-result, long-name/zoom and print-preview/cancel remain mandatory.

## Task9 — Coherent contracts and automated gates (all R)

- [ ] Load ipc-code-review/ipc-ui-review/test-audit and verification-before-completion. Self-review source vs EVERY R row and file map; separate fixes/retained behavior/gaps. No independent-review claim (delegation not authorized).
- [ ] Inspect actual table/conformance/surface schema; add consumed records for two new paged views and real action mappings. Update source and docs as one contract; no placeholder-ready surface, blanket exemption or wrong mrx.batch geometry on new pages.
- [ ] Sequential FE focused owners then full `npm run test:unit -w frontend -- --maxWorkers=1`; lint/build/depcruise; root check:conformance-contracts/check:architecture-growth; git diff --check. Inspect logs, counts, failures and skips; do not reuse earlier451 as fresh result.
- [ ] Backend full core solution: `dotnet test backend/IPCManagement.slnx -c Release --no-restore -m:1 -p:UseSharedCompilation=false -p:UseAppHost=false -p:ArtifactsBinOutputName=bin-uat --filter 'FullyQualifiedName!~IPCManagement.Api.Tests.Integration&Category!=EvidenceOwned&FullyQualifiedName!~RecoveryScriptContractTests'`. Integration/provider/stock/migration campaigns are NOT implied; if their boundary changed require explicit owned target, otherwise retain existing owner evidence with age disclosed.
- [ ] Locate actual operationalPageContracts/*.contract owners; absence is NOT_PRESENT, never manufacture substitute proof. Installed Impeccable detector on changed UI is source-only evidence. No automatic dependency/tool download.
- [ ] Inspect fresh disk/RAM/process/build locks. Before live UAT arrange explicitly approved matching-runtime startup if backend read/capability additions are not served. No test→runtime binary mismatch.

## Task10 — Real UAT and truthful closure (all R, U00–U12)

- [ ] Complete U00 permission/build/actor/mode/scope/file preflight. Current frontend/playwright.config.ts is confirmed to auto-start Vite with VITE_ENABLE_MOCK_LOGIN=true and reuseExistingServer; do NOT use it for this acceptance lane. Add/inspect the dedicated launchless config described in file map. Installed-only fixture command from root after its authorization: `node node_modules/@playwright/test/cli.js test --config=frontend/tests/config/playwright.mrx-remediation.config.ts --headed --workers=1`. Isolated network-fixture tests are labelled BROWSER_FIXTURE, not REAL_UAT. Live read checks use confirmed real actor; owner-led business writes are not replaced by mocked success. No generic DB setup/teardown on owner target.
- [ ] Execute spec U01–U11 in a dedicated authorized profile with real build where permitted. Record first batched screenshot/DOM/focus pass at1440×900,1024×768 and actual200% browser zoom. Screen density claims require measured rendered bounds, not TSX class greps.
- [ ] Owner-led or separately authorized U12 actual business writes: exact file/customer/week/tier, request/result, final reload/version/quantity and unchanged old frozen facts. Do not import/create batches/issue stock solely to manufacture PASS. Unauthorized cases remain BLOCKED/NEEDS_EVIDENCE and named in handoff.
- [ ] Compare every screenshot to corresponding original defect and required outcome, not only to a new self-chosen layout. Batch corrections at existing owners; one confirmation pass, no open-ended polish loop. Any new mismatch becomes a named R-linked finding, never silently dropped.
- [ ] WORK closure table for R01–R15: source change path; automated test result (or pure layout N/A reason); rendered evidence; actual request/reload evidence where applicable; owner acceptance; final status. Code-complete may be reported separately, whole request complete only if all required rows accepted. No unsupported global PASS or fake screenshot/receipt.
- [ ] Return IDLE, disclose all FAIL/NEEDS_EVIDENCE/BLOCKED and outbox/runtime limits; leave authorized runtime available. No staging/commit/cleanup/subagent launch.

## Static coverage self-review

R01/R02/R11→T3+U02; R03/R07/R08→T4+U03/U06; R04/R05/R06/R12→T5+U04/U05/U06; R09/R13→T6+U07; R10→T1/T2+U01/U07; R14→T7+U08; R15→T8+U09. T9/T10 apply to ALL rows; U10/U11 are risk-based shared geometry/state checks, U12 only authorized persistence-dependent criteria. No requirement is closed merely by this mapping.

Meaningful new scope exposed by inspection: two small paged read APIs instead of reusing commit-ticket POSTs for sidebar visits; dirty-source navigation registration before introducing those leaves; updated machine contracts and geometry. These are part of the proposed approval, not hidden implementation or an excuse to redesign unrelated infrastructure. Owner review must confirm the consolidated result before execution.
