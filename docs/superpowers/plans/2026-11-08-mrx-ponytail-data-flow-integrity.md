# MRX five-finding data-flow integrity — implementation plan

Date: 2026-11-08

> **For agentic workers:** follow the approved design and execute one owner task at a time with `superpowers:executing-plans`. No subagents, worktrees, commits or runtime changes are authorized by this document. Do not execute this draft before owner design/implementation approval.

**Goal:** resolve all five Ponytail findings, prioritizing persisted quantity, uncertain-write and customer allocation safety before dashboard freshness and query cost.

**Design:** [2026-11-08-mrx-ponytail-data-flow-integrity-design.md](../specs/2026-11-08-mrx-ponytail-data-flow-integrity-design.md)

**Architecture:** current React/TypeScript/API client/cache → ASP.NET Core feature services → EF Core/Pomelo/MySQL. Reuse existing policies, receipts, workbook builder, UI primitives and styling authority. SQLite is an isolated relational regression provider, not a substitute for authorized MySQL acceptance.

**Order:** Gate 0 → P1 → P2 → P3 → P4 → P5 → final verification. P2/P3 may be implemented before schema application; no concurrent writers in this cwd. Each checkbox is future work, not evidence already achieved. `.planning/WORK.md` owns actual task status.

## Gate 0 — approve scope and establish baseline

- [ ] Obtain approval of the design's frozen-rate schema/legacy limitation, sticky unknown-write recovery and coordinated workbook wire change. No guessed approval.
- [ ] Read `AGENTS.md`, `.planning/WORK.md`, domain owners, current source and the applicable debugging, design, test-audit, UI/code-review and TDD skills. Preserve inherited changes and empty index.
- [ ] Record `git status --short --branch`, `git rev-parse HEAD`, `git diff --cached --name-only`; compare against original review HEAD `b2adf6ef05cf9ddf8227d7786965efbba6801521`. Stop on unexpected concurrent owner edits.
- [ ] Inspect current runtimes read-only if relevant; do not stop/restart FE/BE or treat old PID values as current authority.
- [ ] Run focused baseline tests below; record inherited failures/timeouts separately. Do not edit while a relevant test runner remains active.
- [ ] Before any TSX/CSS edit, emit the scoped UI block in chat: routes `/warehouse`, `/chef`, `/weekly-menu` dish inspector and `/`; mode MATERIAL_RECONCILIATION; existing single primary work objects; actual existing ActionGuard/ActionAvailability tokens; six states loading/empty/error/permission-denied/partial/write-reconciliation; existing Modal/InlineBanner/DataGrid/Num/StateBoundary; D6/D7/T7/T8/M1.2/N6 pledges. Read actual guards rather than inventing permission names.
- [ ] No production fixture creation. Synthetic regression fixtures are confined to authorized isolated test databases and HTTP mocks. If test isolation cannot be established, stop and ask.

## File map

All paths below are repository-relative; extend existing owners, not sibling V2 implementations.

| Task | Production files | Strongest regression owners |
|---|---|---|
| P1 | `backend/src/IPCManagement.Api/Models/Entities/ReconciliationBatchContributor.cs`; `Features/Reconciliation/Persistence/ReconciliationEntityConfigurations.cs`; `Features/Reconciliation/Services/{ReconciliationSourceRevisionService,MrxBatchRecomputer,ReconciliationBatchQueryProjector,ReconciliationKitchenExportService}.cs`; new internal `FrozenBomQuantityPolicy.cs`; `Features/Reconciliation/Contracts/ReconciliationContracts.cs`; additive migration/designer/model snapshot under `Migrations/`; FE modal/inspectors/kitchen consumers below | `backend/tests/IPCManagement.Api.Tests/{ReconciliationQuantityImportApplicationPathTests,MrxSourceChangeApplierTests,ReconciliationBatchDishProjectionTests,ReconciliationKitchenExportTests,ReconciliationDailyPersistenceModelTests}.cs`; `frontend/src/__tests__/{Warehouse,Chef}.test.tsx` |
| P2 | `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`; `MrxSupplementalIssueModal.tsx`; `MrxDailyIssueWorkbench.tsx`; existing initial draft storage owner only if needed | `frontend/src/__tests__/Warehouse.test.tsx` |
| P3 | `Features/Reconciliation/Services/{ReconciliationPreparationWorkbookExporter,PreparationWorkbookBuilder}.cs`; `Contracts/ReconciliationContracts.cs`; generated API and `frontend/src/api/mrxApi.ts` only where consumed | `backend/tests/IPCManagement.Api.Tests/{ReconciliationPreparationWorkbookTests,ReconciliationPreparationTests}.cs`; FE API contract owner if a mapper changes |
| P4 | `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx` | `frontend/src/__tests__/MrxDashboard.test.tsx` |
| P5 | `Features/Reconciliation/Services/{ReconciliationReportsService,ReconciliationBatchService,ReconciliationWarehouseRevisionQuery,ReconciliationNetIssueProjection,ReconciliationDailyIssuePolicy}.cs` (last three change only if real bulk reuse requires it) | `backend/tests/IPCManagement.Api.Tests/ReconciliationDashboardAndReportsTests.cs`; existing warehouse daily tests for shared-reader compatibility |

Backend `Features/...` rows resolve under `backend/src/IPCManagement.Api/`. P1/P3 generated contract owners are `frontend/src/shared/api/contracts/{openapi.json,schema.ts}`; no hand-written schema patch.

## P1 — freeze conversion and consume explicit canonical rates

### P1a: intended RED at the real writer→reader boundary

- [ ] Read all callers of `ContributionFrom`, `CreateContributor`, `ReconciliationRevisionContributionFact`, contributor `Identity`, `GrossQtyPerServing` and `BomQuantityPerServing`, including source amendment, kitchen CSV/XLSX and frontend displays. Record the actual call graph in WORK, not a duplicate status file.
- [ ] Extend `ReconciliationQuantityImportApplicationPathTests.cs` with one isolated production-service case: published matching source, BOM 100 g/suất, unit rates 0.001/1, servings 10 → actual preview/commit/draft service → persisted/reloaded contributor → `ListDishesAsync` → canonical 0.1 kg/suất and total 1 kg. Do not seed the contributor fields being tested.
- [ ] Parameterize only the distinct precision risk: 0.0004 g/suất, 1000 servings → canonical 0.0000004 and total 0.0004. Expected constants are independently written, not produced by the converter under test.
- [ ] Run on pre-fix code and preserve the numeric mismatch. A compilation error from a not-yet-added DTO field is not an adequate RED; initially assert the existing externally labeled rate, then move the assertion to the explicit field during the contract repair.
- [ ] Mark `ListDishes_Should_PreserveConvertedRateUntilServingsAreApplied` in `ReconciliationBatchDishProjectionTests.cs` as **F**: keep its historical/precision contract but repair the hand-normalized writer-bypassing fixture. Preserve its other unique ambiguity/history tests; no blanket deletion.

### P1b: minimal additive persistence and shared interpretation

- [ ] Add nullable `FrozenBomUnitToBaseRate`/`FrozenCanonicalUnitToBaseRate`, precision (18,6), to entity/configuration. Preserve raw BOM amount and existing frozen waste/servings/source quantity.
- [ ] Carry both through trailing optional revision contribution fields. Populate actual validated rates in `ContributionFrom`; persist in `CreateContributor`; compare in both identity overloads/record. Inspect all direct constructors and source-revision serialization/roundtrips; update their fixtures without defaulting historical rows to 1.
- [ ] Add the one internal policy proposed in the spec, called by both real readers. Positive frozen rates only; decimal arithmetic; no per-serving six-decimal rounding, live BOM/unit lookup, rounded-total division or zero fallback. Keep waste semantics unchanged: GrossQty is already the source quantity basis; do not add an extra waste multiplier.
- [ ] Produce an additive migration/designer/model snapshot with the installed EF tooling **only after checking its availability/authority**. No tool restore/install, `database update`, startup auto-migrate, backfill SQL or live DB write. Review generated SQL for two nullable columns and no data rewrite; retain target deployment as BLOCKED pending explicit authority.
- [ ] Extend the persistence model contract for field precision/nullability. If isolated provider schema can be generated without touching a real DB, use it; do not claim MySQL application from SQLite EnsureCreated.

### P1c: DTOs and all consumers

- [ ] Add nullable `CanonicalQtyPerServing` plus `QuantityUnavailableReasonCode` to dish material DTO. Keep `GrossQtyPerServing` raw/deprecated for canonical use. New writes expose the computed canonical field; old missing pairs return null + `FROZEN_UNIT_CONVERSION_MISSING`.
- [ ] Make kitchen `BomQuantityPerServing` nullable/canonical, add the reason, use the same policy. Preserve `TotalRequiredQuantity`, servings, identity and frozen-source checks. Kitchen CSV/XLSX number formatting must handle unavailable values without writing `0` or raw kg labels.
- [ ] Generate API artifacts with already installed authorized tooling. **Do not blindly run `npm run gen:api`**: current script includes tool restore and `npx --yes`; stop for approval if packages/tools would be fetched. Inspect generated diff scope and DTO parity.
- [ ] Update `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx` to calculate only from `canonicalQtyPerServing`; any missing material rate blocks the whole dish package, keeps draft and explains direct-line entry. Retain final `normalizeQuantity` and exact daily-line identity.
- [ ] Update `frontend/src/components/workbench/MrxBatchDishesModal.tsx` and `frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx` to show explicit canonical rates; unavailable means `—` with explanation. Search all generated-type/wrapper callers before closing.
- [ ] Extend Warehouse HTTP→DOM→submit regression: canonical 0.1, extra servings 10 → quantity 1 in POST. Legacy missing canonical rate → no by-dish POST; exact direct-line mode remains usable. Do not mock the hook/calculator.
- [ ] Extend one kitchen export case to verify canonical rate + unchanged frozen total in JSON/CSV/XLSX and legacy unavailable presentation. Reuse expected constants; do not reproduce the entire creation scenario again in each format.
- [ ] Extend the existing source-change owner test: new conversion evidence on open-day recompute; locked/invalidated history not rewritten. After current BOM/unit changes, re-read the original contributor and assert its original frozen rate still wins.

### P1 exit

- [ ] Intended RED and GREEN receipts; no fake converted contributor in the writer test; no unexpected DEFAULT physical movement; migration artifact reviewed but deployment status explicit.
- [ ] Confirm legacy tradeoff visibly: historical totals remain readable; automatic by-dish legacy quantity is intentionally unavailable until separately evidenced, not silently repaired.

## P2 — unknown-write fence survives refresh

- [ ] Read the complete hook, initial issue handling, modal close/reopen paths and draft/session storage. Inspect `ApiError`, `authenticatedFetch`, `SESSION_CHANGED` and actual receipt DTOs before choosing the local classifier. Do not redesign global auth for this task.
- [ ] Extend `Warehouse.test.tsx` at HTTP/apiClient boundary: submit once, return 502 (table row also 503), then dispatch existing visibility refresh and return an incremented daily source version. Assert the protected draft/unknown notice remain and second submit cannot issue a POST. Pre-fix RED must be the unlocked duplicate opportunity, not a missing permission/invalid form.
- [ ] Retain one transport-loss case and add a distinct empty-2xx-receipt case. A TypeError-only case cannot prove the original 5xx bug. Exercise initial and supplemental variants only where their current recovery/draft logic differs.
- [ ] Add a file-local shared unknown-outcome predicate, no exported test seam: API 5xx, unclassified/transport failures, SESSION_CHANGED and missing valid receipt are unknown. Definite 400/409 keep their existing correction path; 401/403 remain fail-closed. Avoid importing catalog editor internals.
- [ ] Set the sticky fence before a later read/version can re-enable submit; validate `issueId`/`issueCode` before success/closing. Preserve attempted command ID and entered values; do not clear on background load or overlay close. Keep initial and supplemental banners consistent.
- [ ] Use the existing explicit reload recovery; prevent restored unknown initial draft being automatically offered as a fresh command. New submission requires fresh authoritative history and user action. No replay, new polling/status endpoint or automatic retry.
- [ ] Extend current 400/409 case rather than duplicating: definite rejection retains editable quantities/reason and the explicit safe refresh path. Keep role guards and pending navigation protection.
- [ ] GREEN focused Warehouse suite; review actual outgoing bodies and count attempts. Receipt mocks prove UI safety, not a real committed backend transaction.

## P3 — customer identity through workbook bytes

- [ ] Read every `CustomerColumns`/`CustomerQuantities` consumer, both `PreparationWorkbookBuilder` branches, exporter service and preparation API DTO wrappers. Keep grouping by ingredient/canonical unit/supplier untouched.
- [ ] Extend `ReconciliationPreparationWorkbookTests.cs` using two actual customer IDs/codes with the same allowed name, one ingredient/unit and allocations 2/3. Call real export and load the resulting XLSX with existing installed workbook library. Assert two distinct labeled columns, numeric 2 and 3, total 5. Pre-fix RED must be the merged column/allocation.
- [ ] Extend the case with another selected batch for customer one (0.5): expect 2.5/3, total 5.5. One table/case covers day/week layouts where behavior differs, not a large customer/date matrix.
- [ ] Add ordered `CustomerColumnDefinitions` with CustomerId/code/name; label `code · name`, sort code/ID explicitly. Key row dictionaries by CustomerId. Preserve old display-label list only for presentation compatibility, never as lookup authority.
- [ ] Update both workbook builder layouts to read identities from definitions and labels from code/name. Validate missing/duplicate definitions before serialization; no name-lookup fallback or duplicate-name prohibition.
- [ ] Regenerate relevant API contracts through the authorized installed path; inspect any `mrxApi.ts` mapper or FE contract fixture affected. This is a dictionary-key semantics change requiring coordinated clients, not an invisible compatible patch.
- [ ] GREEN actual XLSX regression plus existing preparation/export tests: sheet titles, menus, supplier boundaries, selected scope, numeric cells and grand totals intact. No new customer rows in any business database.

## P4 — cache hydration is not network completion

- [ ] Read current cache reads/writes/TTL, exact dashboard cache key, generation fence and `withMrxInvalidation`; retain existing same-session invalidation and actor/mode isolation.
- [ ] Extend `MrxDashboard.test.tsx`: current-key cached summary says 4; server now says 1; mount with an expired entry. Assert first cached render and subsequent server result without clicking refresh. Pre-fix RED: no authoritative update/request.
- [ ] A second distinct case covers stale read failure/retry and old-key response arriving after a filter transition. Reuse existing role/null count and loading tests; do not mock the dashboard hook/StateBoundary.
- [ ] Remove the cache-hit-as-final-return branch. Hydrate once per key, start one existing summary+page request on mount/key change, retain same-key facts while refreshing, and apply generation guard to success/error/finalization.
- [ ] Show refresh failure as stale/error with retry and fence the next-work CTA from unverified stale facts. Do not blank controls, show other-key metrics, convert null to zero, add polling, or modify global cache TTL.
- [ ] GREEN focused dashboard suite; verify manual refresh and re-entry after an external change. A continuously open idle tab is not promised realtime updates.

## P5 — all-scope bulk warehouse status

- [ ] Read complete `GetWarehouseDailyAsync` and report call graph, active disposition/revision queries, net-issued logic and status policy. Inventory SQL data families before editing. Preserve existing nullable single-batch result/not-found behavior.
- [ ] Extend `ReconciliationDashboardAndReportsTests.cs` at real EF relational boundary. Use a test-owned `DbCommandInterceptor`, count SELECTs **after seeding**. Compare summary reads for 1 and 100 nonempty IN_PROGRESS batches with equal data-family coverage. Pre-fix RED: count grows with N. No production injection seam or wall-clock threshold.
- [ ] In the same owner, assert explicit expected full-scope counts beyond 20 visible rows and queue cap 10, including role-null metrics/filter boundaries. Distinct state data covers untouched/under/over pending/resolved/returns/complete/legacy; expected results come from business facts, not calling the implementation helper to compute expectations.
- [ ] Add `GetWarehouseDailyManyAsync(IReadOnlyCollection<string>, CancellationToken)` to the existing batch service, returning a keyed dictionary. Bulk-load batches/positive daily lines/ingredient+unit labels/issues/confirmed returns/active dispositions/revision labels by selected IDs; no await/read inside per-batch compose loops. Empty set is cheap and cancellation is honored.
- [ ] Make existing single-batch method delegate to the shared loader for one ID. Share the exact current `ReconciliationNetIssueProjection` and daily/weekly policy; no second summary-only status implementation. If revision labels need a many-batch query, extend the existing revision owner with a real production caller.
- [ ] Change reports to one bulk call for all filtered IN_PROGRESS batches. Preserve whole-scope KPI, role masking, queue links/order and independent pending/source counts. Do not truncate to the dashboard page or parallelize one DbContext's queries.
- [ ] Confirm 1/100 query counts stay equal for the regression family, exact summary facts remain correct, existing single-batch daily and return/disposition tests pass. If target provider translation/parameter limits are unproven, report that separately; no new index/schema/performance SLA claim.

## Final verification and release boundary

Run focused after each task; run broad gates after all approved code changes. Commands are future verification steps, not results of drafting this plan.

```sh
# From repository root, isolated backend output; does not replace the running DLL.
dotnet test backend/IPCManagement.slnx -c Release --no-restore -m:1 -p:UseSharedCompilation=false -p:UseAppHost=false -p:ArtifactsBinOutputName=bin-mrx-integrity-plan --filter 'FullyQualifiedName!~IPCManagement.Api.Tests.Integration&Category!=EvidenceOwned&FullyQualifiedName!~RecoveryScriptContractTests'

# Focused frontend owner suite, then full canonical suite.
npm run test:fe:unit -- --run src/__tests__/Warehouse.test.tsx src/__tests__/Chef.test.tsx src/__tests__/MrxDashboard.test.tsx src/__tests__/ApiContracts.test.ts
npm run test:fe:unit
npm run build:fe
npm run lint:fe
npm run depcruise:fe
npm run check:conformance-contracts
npm run test:conformance-contracts
git diff --check
```

- [ ] For task-focused backend runs, reuse the isolated command with `FullyQualifiedName~<existing class>` and record the exact filter. Keep exclusion limitations explicit; no new skip/allowlist.
- [ ] Full FE previously timed out twice. Diagnose runner/resource ownership with bounded runs and actual logs. Stop only exact review-owned hung test processes after identity confirmation, never a browser/FE/BE by generic process name. Timeout is NEEDS_EVIDENCE, not a pass; do not rerun indefinitely or increase heap/timeouts without evidence.
- [ ] Load mandatory code/UI review skills and test audit; inspect connected callers, nullability, migration SQL and generated DTO parity. Report `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact` without claiming independent review.
- [ ] Discover `operationalPageContracts.test.ts`/`*.contract.test.tsx`; if absent record NOT_PRESENT. Run existing relevant contracts without inventing an exemption or mislabeling unrelated tests as those owners.
- [ ] Generated API checks must avoid unauthorized restore/download and account for inherited generated diffs; broad `git diff --exit-code` against HEAD is not sufficient parity evidence in this dirty checkout. Review the authorized generation delta.
- [ ] Browser fixtures, only if separately authorized, fail closed on unhandled requests in a dedicated loopback browser/profile. Check P1 legacy/available modes, P2 disabled retry + draft/focus, P4 refreshing/stale/error, desktop/tablet and keyboard. Fixture renders do not certify authenticated writes/native200%/real workbooks.
- [ ] Before target deployment obtain exact database/runtime/migration/backup scope. Review nullable schema compatibility and baseline, apply only with explicit owner authority, verify readiness and matching API artifact. No inferred reuse of earlier restart permission.
- [ ] Real acceptance requires separately authorized actor/mode/IDs and a persisted-result→reload observation, actual workbook duplicate-name allocation and read-only provider/load evidence. Without it report NEEDS_EVIDENCE; no synthetic production seed.
- [ ] Update WORK with per-P1–P5 PASS/FAIL/NEEDS_EVIDENCE/BLOCKED, test logs, schema/runtime status and residual historical obligations; return lifecycle to IDLE. Preserve inherited changes, HEAD and empty index. No automatic commit.

## Stop conditions / decisions left to owner

- P1 legacy automatic package entry becomes unavailable without frozen conversion evidence; schema application and any later historical reconciliation require explicit authorization.
- Existing external workbook DTO clients may depend on name-keyed dictionaries; inventory before coordinated P3 rollout. If external consumers cannot upgrade together, stop for a separately designed API version, not a guessed compatibility fallback.
- MySQL provider/concurrency/load, forced logout incident, real workbook acceptance, native200%/print and U12 remain separate; this plan does not close them by unit-test count.
- Unknown write must never be cleared merely because a GET succeeded. If product requires automatic receipt reconciliation instead of explicit reload/history review, that is an additional backend contract requiring a new decision, not hidden scope here.
