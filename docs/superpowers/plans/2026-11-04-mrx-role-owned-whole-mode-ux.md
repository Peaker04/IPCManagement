# MRX Whole-Mode Role-Owned FE/BE Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, directly in the existing checkout. No subagent/reviewer/worktree/commit authority is granted. Checkboxes below define deliverables; actual task status lives only in `.planning/WORK.md`.

**Goal:** Repair the entire MRX user experience around real role responsibilities, truthful business facts and safe recovery, rather than making tests accept current FE/BE behavior.
**Architecture:** Retain existing React workbenches, route/action guards and ASP.NET feature owners. Repair read contracts where operational decisions lack facts; preserve protected write transactions, immutable lineage and DEFAULT/MRX separation. Shared consistency follows the whole-mode design, not a new universal workspace/framework.
**Tech Stack:** Installed React19/TypeScript6/Vite8, existing UI primitives, ASP.NET Core9/EF Core/Pomelo/MySQL, installed Vitest/Testing Library/xUnit/Playwright.
**Spec:** `docs/superpowers/specs/2026-11-04-mrx-role-owned-whole-mode-ux-design.md` — approved by Owner's latest “Duyệt”.
**Plan approval:** APPROVED BY OWNER. Subsequent explicit approval resumes bounded local tests/lint/typecheck/build and installed-tool contract generation. Implementation progress is recorded only in `.planning/WORK.md`; browser/campaign/DB/install/deploy remain unadmitted.

## Global Constraints

- Native sequential/single writer in inherited dirty `feature/ui-interaction-data-states`; intake HEAD `b2adf6ef05cf9ddf8227d7786965efbba6801521`, staging empty. No reset/restore/clean, install, delegation, new worktree, stage/commit/push/deploy.
- **Standing pause remains:** do not execute any test/build/lint/browser/Preflight/campaign/DB command in this plan without explicit resumed authority. All commands below are FUTURE checks, not orders to run now. Do not bypass required verification by declaring unverified edits accepted.
- `DEFAULT != MATERIAL_RECONCILIATION`; no cross-mode workflow/lineage/audit. Existing role/permission boundaries and intentional-global permitted customer reads remain; Manager is not Admin and does not gain Warehouse/Chef operations.
- Quantities use 6-decimal final precision, preserve rate precision, null is not zero, unknown unit is not kg. No mixed-unit sums presented as one quantity.
- All styling authority stays `frontend/src/styles/index.css`; no inline styles/ad-hoc colors/new token families. Reuse existing primitives/composites, not parallel variants.
- D6≥12px, D7 one primary per work context, T7 frozen header/identity, T8 compact36–40px, M1 single blocking overlay, N6 sidebar leaves. Long decision review belongs in the work area, short confirmations in a modal.
- No fabricated production master/stock/supplier data, fallback API success, fake evidence, skipped tests or exemption padding. No test-only production exports/seams.
- Keep R6/43refs, retained campaign/DB/credentials and immutable issue/stock/audit history. Do not restart/Finish/Abort/drop/reclone or repeat main cutover. No quantitative/endurance/k6/JWT/off-host/release scope. Native200% stays WAIVED_BY_OWNER, never PASS.
- Mandatory skills at execution: executing-plans; ipc-debugging for each defect; test-audit/ipc-test-audit before tests; ipc-code-review and ipc-ui-review at relevant gates; impeccable craft-floor immediately before UI edits. Emit scoped pre-code UI gate per surface before TSX/CSS edits.

## Review Focus

1. **Wrong scope in a valid cache:** batch A→cached B→page2 or a delayed A response must never appear as B. Owner regression: Task8.
2. **Small positive quantities and ambiguous BOM mapping:** 0.000123 must survive one-serving calculation; one missing mapping blocks the whole package, not a silently reduced issue. Owner regression: Task5.
3. **Role aliases/multiple roles:** a broad batch-read capability is not station authority; effective permitted destination and data must agree. Owner regressions: Tasks1–2; no cross-product role matrix.
4. **Stale source review:** submitted snapshot and current locks are different facts; preview success cannot bypass transactional day-lock/version checks. Owner regressions: Task3.
5. **Unknown write result/scope switch:** while a coordinated request is pending or uncertain, changing date must not offer another issue against misleading state. Owner regression: Task6.

## File Structure and ownership

Paths are repository-relative. Modify current owners, do not move modules merely for this plan.

| Area | Production owners | Primary test owners |
|---|---|---|
| Navigation/handoffs | `frontend/src/routes/{routeRegistry,navigationEligibility}.ts`; `features/weekly-menu/{MrxBatchWorkbench.tsx,hooks/useMrxBatchWorkspace.ts}`; `features/reconciliation/{ReconciliationPage,ReconciliationBlockerStrip}.tsx`; Warehouse/Chef empty boundaries | `frontend/src/__tests__/{AppShell,WeeklyMenu,Reconciliation,Warehouse,Chef}.test.tsx` — only distinct changed contracts |
| Dashboard | `frontend/src/features/dashboard/ReconciliationDashboardPage.tsx`; `frontend/src/api/mrxApi.ts`; `frontend/src/features/reconciliation/hooks/useReconciliationWorkspace.ts`; BE `Features/Reconciliation/{Controllers/ReconciliationReportsController.cs,Services/ReconciliationReportsService.cs,Contracts/ReconciliationContracts.cs}` | BE `ReconciliationDashboardAndReportsTests.cs`; new FE `frontend/src/__tests__/MrxDashboard.test.tsx` (existing Dashboard.test.tsx covers DEFAULT, not this component) |
| Source decisions | FE `features/weekly-menu/{MrxPendingRequestsPanel,MrxSourceChangePanel,MrxBatchWorkbench}.tsx`, source hooks and API; BE `Features/SampleData/{Contracts/MenuAmendmentDto.cs,Services/MrxMenuAmendmentCoordinator.cs,Services/WeeklyMenuServiceContracts.cs,Services/MenuAmendmentService.cs,Controllers/WeeklyMenuImportsController.Amendments.cs}`; `Features/Reconciliation/Services/MrxSourceChangeApplier.cs` | `MrxSourceEdit.test.tsx`, `WeeklyMenu.test.tsx`; BE `MrxMenuAmendmentTests.cs`, `MrxSourceChangeApplierTests.cs` |
| Import/BOM | FE `features/weekly-menu/WeeklyMenuImportModal.tsx`; `components/workbench/{DishBomBatchImportModal,DishBomEditorModal}.tsx`; `features/admin/branches/AdminBomBranch.tsx` | `WeeklyMenu.test.tsx`, `DishBomBatchImportModal.test.tsx`, `AdminBomBranch.test.tsx`; existing BE workbook/parser tests only if their contracts change |
| Warehouse | FE `features/warehouse/{MrxSupplementalIssueModal,MrxDailyIssueWorkbench,MrxMultiCustomerPreparationWorkbench,MrxSourceDeltaWorkbench}.tsx`, `hooks/useMrxDailyWorkspace.ts`, relevant `branches/*`; existing BE Inventory issue/return and batch-dish projection owners | `Warehouse.test.tsx`; BE `ReconciliationBatchDishProjectionTests.cs`, `ReconciliationPreparationTests.cs`, `ReconciliationWarehouseIssueApplicationPathTests.cs`, legacy owner tests |
| Chef | FE `features/chef/MrxCookingWorkbench.tsx`, `branches/MrxCookingHeaderBranch.tsx`; BE `Features/Reconciliation/Services/ReconciliationKitchenExportService.cs` and contracts only for actual needed facts | `Chef.test.tsx`; BE `ReconciliationKitchenExportTests.cs` |
| Manager/reports | FE `features/reconciliation/{ReconciliationDispositionModal,ReconciliationCompletionModal,ReconciliationReportTables}.tsx`, `useReconciliationReports.ts`, `branches/*`, `reconciliationColumns.tsx` | `Reconciliation.test.tsx`; existing BE daily-lineage/completion/report tests |
| Shared verification | Existing modal/Num/StateBoundary/ActionGuard; generated `frontend/src/shared/api/contracts/{openapi.json,schema.ts}`; canonical `docs/{DOMAIN,FLOWS,DESIGN}.md` and MRX contract only where behavior requires | Existing real semantic/guard suites; existing G1–G6 evidence owners, not new QA framework |

Only proposed new production file: `frontend/src/features/weekly-menu/MrxSourceChangeReview.tsx`, a genuine shared page-body review used by submit preview and Manager review; do not create it if the existing `MrxSourceChangePanel` can host both without coupling mutation owners. New FE dashboard test is justified by a distinct component with no owner test, not by wanting another suite.

## Verification recipes — not authorized to execute yet

- **FE(X):** `npm run test:fe:unit -- --run X --maxWorkers=1`, with X as one or a few exact `src/__tests__/*.test.tsx` paths consumed by the repository heap-aware frontend runner. Confirm runner forwarding from `scripts/frontend-unit-runner-args.mjs` before the first authorized execution; do not replace with an unrestricted parallel runner.
- **BE(X):** `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter "FullyQualifiedName~X"`. Use focused existing owner classes, not integration/EvidenceOwned campaigns.
- **Static/full gate:** `npm run verify`; generated parity as described in Task11; `git diff --check`. Known inherited warnings/failures remain disclosed, not suppressed.
- For each defect: first demonstrate expected behavioral failure through the existing production boundary before introducing new signatures/DTOs, then the same case after repair. A compile failure from a new interface is not the intended bug regression. An assertion tied only to source strings/layout classes is not the oracle. Unit/network fixtures must match actual C# DTOs; do not mock the component/hook/StateBoundary being verified.

---

### Task1 — Role-owned navigation and handoff states (UX03)

**Files:** navigation and handoff owners in the ownership table. **Depends on:** none.
**Interfaces:** consume existing `isRouteEligible(CANONICAL_ROUTES, pathname, search, user, operationalMode)`, `useAuth` and ActionGuard; preserve existing batch command APIs. Produce role-appropriate CTA or wait state at each existing surface, no new permission or role-switching helper.

- [ ] Extend existing strongest page cases: Coordinator after transfer sees successful handoff/refresh but no Warehouse/Manager link; Manager blocked by unissued date sees scope/responsible role but no Warehouse/Chef CTA; Warehouse legacy boundary does not lead to source authoring. Keep authorized Admin links and Manager source operations. Add one multiple-role/alias route case only if existing route coverage misses that distinct contract.
- [ ] Run FE(WeeklyMenu.test.tsx, Reconciliation.test.tsx, Warehouse.test.tsx) and relevant AppShell guard owner case; verify failure is the forbidden invitation, not missing auth fixture data.
- [ ] Repair existing primary-action branches, success banners and empty/blocker callbacks using target eligibility rather than broad `RECON.BATCH.READ`. Keep normal wait quiet with a persisted status and own refresh/select action.
- [ ] Repeat focused checks. Exit: neither hidden navigation nor API403 is used as a substitute for a truthful handoff; no new roles/permissions.

### Task2 — Truthful, scoped, role-aware dashboard FE/BE (UX01–02)

**Files:** dashboard group above including summary caller in `useReconciliationWorkspace.ts`. **Depends on:** Task1 destination rule.
**Interfaces (concrete additive query/DTO contract):**
- Add `MrxOperationalSummaryQuery` with `string? CustomerId`, `DateOnly? WeekFrom`, `DateOnly? WeekTo`; inclusive **week-start date** bounds, invalid ranges return400. Existing no-query HTTP read remains valid.
- Service signature: `Task<MrxOperationalSummaryDto> GetOperationalSummaryAsync(MrxOperationalSummaryQuery query, IReadOnlyCollection<string> actorRoles, CancellationToken token = default)`; controller passes trusted roles, not caller-supplied roles.
- Keep existing five count property names; make unauthorized count fields nullable, not fabricated0. Add queue-item `OwnerRole`, `ActionKind` (`OWN_ACTION|WAITING|READ_ONLY`), nullable `TargetUrl`; retain identifiers/time/title. Unauthorized queue data is not serialized merely because FE can hide it.
- FE `mrxApi.getOperationalSummary(query?)` sends same filter. Cache key includes actor/mode/filter. Migrate the dashboard and generated types; remove the unused summary read/state/return from `useReconciliationWorkspace.ts` after confirming its page never consumes it (current inspected caller does not). Do not preserve an unnecessary global request just to have a second consumer or mount the currently unused `ReconciliationQueueCards` to justify it.

- [ ] Extend BE `OperationalSummary_Returns_Exact_Counts_And_Links_To_Real_Work_Objects`: use distinct actual source requests, transferred/READY/completed batches and overage lines. Assert pending request statuses PENDING_REVIEW/RECONCILIATION_REQUIRED counted correctly; READY is not awaiting-Warehouse transfer, COMPLETED is not completion-ready; customer/week exclusions and real counts beyond one displayed page. Add the role projection row: Chef gets no variance/stock detail; Manager has no issue-command URL.
- [ ] Add MRX dashboard owner DOM/network case: summary counts 3/4/2/1 deliberately differ from loaded-row counts; show each correct entity label, filters change HTTP scope, a non-Admin sees only eligible links, error→retry is not empty. Mock network only with the real DTO.
- [ ] Run BE(ReconciliationDashboardAndReportsTests) and FE(MrxDashboard.test.tsx); observe intended count/role/scope failures.
- [ ] Implement filtered server counts/projections; bounded queue items disclose their display limit and total, not a fictitious complete list. Replace universal clickable four-step cards with own-work list and quiet handoff status. Remove the unneeded 20-batch-derived KPI path; never calculate global totals from page items.
- [ ] Remove the unconsumed Manager-workspace summary request/state, so it cannot refill a global dashboard cache with another scope. If another real consumer is discovered, migrate that consumer's nullable fields/cache key instead of deleting a live contract. Repeat focused checks. No broad authorization-policy weakening; if existing read entitlement cannot safely support a role projection, stop at that boundary for an explicit policy ruling.

### Task3 — Source decisions as a readable work area and complete handoff (UX04–05)

**Files:** source group above; optional genuine `MrxSourceChangeReview.tsx`. **Depends on:** Task1; Task2 projection vocabulary only.
**Interfaces:** retain existing submit/apply/decision payloads. Add read contract `MrxMenuChangeReviewDto` containing exact amendment/customer/week/status/reason/createdAt, submitted `ImpactLines`, `SubmittedMaterialImpact`, and separately `CurrentLockedDates`, `IsStale`, `ApplicabilityCode`; names/codes captured at new preview/submit on impact lines (`OldDishCode/OldDishName/NewDishCode/NewDishName`, nullable for legacy). Never infer historical names from current catalog without an explicit current-catalog label.
- Read `GET /api/coordination/weekly-menu/amendments/{amendmentId}/mrx-review`, ReconciliationOnly + existing source-edit authority. Service `GetMrxReviewAsync(string amendmentId, CancellationToken token)` returns snapshot and current applicability, no write.
- For Coordinator feedback add bounded read `GET .../amendments/mrx-submissions?customerId=&weekStartDate=&pageNumber=&pageSize=` under existing source-read authority. `GetMrxSubmissionsAsync(query, actorUserId, actorRoles, token)` restricts ordinary Coordinator to own submissions, Manager/Admin retain existing authorized source scope; returns real statuses and rejection/correction reason from exact amendment/audit owner. This is not a new global inbox or notification workflow.

- [ ] Extend existing BE source/amendment owner case: same-name different-ID dish identity survives review; submitted facts remain unchanged while an issued date becomes locked; decision still rejects atomically. Verify Coordinator can read own rejected/correction result but cannot read decision-only review or another actor's submission via this new endpoint.
- [ ] Extend existing FE rejection/approval case in `MrxSourceEdit.test.tsx` and integration page case in `WeeklyMenu.test.tsx`: show dish old/new and Mặn/Chay separately, Vietnamese ca, no meaningless servings-only substitute for dish change; selecting reject exposes required reason; API error retains review/draft; submitted Coordinator result shows its real status.
- [ ] Run BE(MrxMenuAmendmentTests|MrxSourceChangeApplierTests via separate filters as needed), FE(MrxSourceEdit.test.tsx, WeeklyMenu.test.tsx); record intended failures.
- [ ] Implement DTO/read owners and preserve snapshot/current separation; mutation rechecks stay in existing protected applier. Replace long pending-review modal with existing work-area review, URL preserves amendment scope. Share presentational review only across real preview/review callers; keep each mutation at its original owner.
- [ ] Keep final confirmation/rejection input short, one blocking overlay, focus returns to the request row. Repeat focused checks. Contract generation follows Task11 before integrated type/build claims.

### Task4 — Import/BOM prerequisites, long-content hierarchy and scope safety

**Files:** import/BOM owners above; existing `bomApi.ts`/`weeklyMenuApi.ts` and BE parser/controllers only if an actual boundary mismatch requires it. **Depends on:** Task1 and Task3 source review.
**Interfaces:** retain real XLSX template/preview/commit/token contracts, existing price tiers25000/30000/34000 and customer scope; these domain tiers are not automatically “bad hardcode”. No replacement master-data workflow.

- [ ] Extend existing `DishBomBatchImportModal.test.tsx`: start a deferred preview under customerA/tier25000, switch scope before it resolves, then resolve A; old result must not enable commit under the new scope. The synchronous handlers already clear preview, so do not claim that path is broken or add a redundant regression for it. A failed customer load is visible/retryable, not a silent GLOBAL fallback. Use genuine DTO shapes, no fake production rows.
- [ ] Extend existing weekly import history case: explicit legacy snapshot-unavailable differs from500/403/network error; failed read offers retry; stale response from customerA cannot populate customerB history. Keep rollback snapshots immutable.
- [ ] Run FE(DishBomBatchImportModal.test.tsx, WeeklyMenu.test.tsx), establish behavioral failures, then repair scope-keyed preview/history and honest load errors.
- [ ] Arrange scope/file→preview/errors→commit as primary sequence. Put long history/snapshot/diagnostics in the existing work area when needed, not another stacked modal. Keep short file/confirm dialog and existing modal primitive; invalidate preview on any file/customer/tier/week change. Pending write prevents scope change/close.
- [ ] In source missing-BOM state show exact missing scope and responsible existing role. Offer management/edit only to an actor already authorized; otherwise show waiting/recheck without losing source. Repeat focused owner tests and the existing AdminBomBranch case for its actually changed boundary.

### Task5 — Warehouse truthful quantities, complete supplemental packages and catalog states (UX06–07,12)

**Files:** `MrxSupplementalIssueModal.tsx`, `useMrxDailyWorkspace.ts`, `MrxDailyIssueWorkbench.tsx`, relevant line branches; existing batch-dish projection if needed. **Depends on:** Task1.
**Interfaces:** keep `onSubmit(customLines?: Array<{dailyLineId:string;quantity:number;reason:string}>)` and canonical issue API. Both calculation preview and payload use the same local production calculation; do not export a calculator solely for tests. Match BE `DecimalPolicy.RoundQuantity` scale6/away-from-zero at final quantity, no premature rounding of rate; inspect decimal midpoint behavior before claiming parity.

- [ ] Extend Warehouse supplemental interaction case through HTTP payload: rate0.000123 ×1 yields quantity0.000123, never disappears; one missing/ambiguous daily mapping blocks the whole package and shows why. Direct frozen ingredient entry remains available after by-dish read error/retry.
- [ ] Add scope-switch row to the same owner case: pending dishesA resolves after batchB selected, neither A choice nor A rate is usable. Unknown unit remains unknown, missing issued value does not become committed0; weekly grouping includes unit identity.
- [ ] Run FE(Warehouse.test.tsx) and BE(ReconciliationBatchDishProjectionTests) for any changed mapping contract; demonstrate specific failures before repair.
- [ ] Replace3-decimal/min0.001 assumptions, prevent partial package filtering and validate positive finite result/reason at current batch/date. Distinguish direct mode and by-dish mode, one primary submit for active mode. Do not label current-BOM projection as frozen if its actual contract uses current BOM.
- [ ] Key catalog/selection/error to batch, reject stale responses, show pending/empty/error/retry; preserve outcome-unknown and issue idempotency. Remove kg fallback and preserve null/unavailable in weekly read-only summary, without changing stock commands. Repeat focused checks.

### Task6 — Coordinated preparation scope and durable-outcome clarity (UX14)

**Files:** `MrxMultiCustomerPreparationWorkbench.tsx`, `branches/{MrxPrepHeaderBranch,MrxPrepAllocationsBranch}.tsx`. **Depends on:** Task5 state/quantity rules.
**Interfaces:** retain `issueCoordinated` request/command identity, exact batch versions and atomic inventory owner. Capture `{serviceDate, selectedBatchIds}` for request/result; the visible selector is disabled while pending/unknown, not merely the submit button.

- [ ] Extend existing preparation DOM/network case with deferred POST: attempt date/selection change while pending; scope stays captured, exactly one request. Unknown outcome blocks another issue until readback, normal400 preserves editable selected scope, selected export scope remains unchanged.
- [ ] Run FE(Warehouse.test.tsx), verify pre-fix scope failure, then key selection/result/error by date and clear old-date UI only after safe scope transition. Show concise included-batch/quantity summary before confirmation, no client-side partial acceptance.
- [ ] Repeat focused case and existing BE(ReconciliationPreparationTests) if command mapping changed. Exit: a success banner never describes another date and cannot imply all customers succeeded when the transaction failed.

### Task7 — Chef correct meal grain, explicit export scope and truthful errors (UX09–10)

**Files:** Chef group above. **Depends on:** Task1 and Task5 catalog-state pattern.
**Interfaces:** existing cooking rows already carry batch-scoped serviceDate/shiftName/menuVariant/servings; count each meal grain once only when repeated dish rows agree. Remove misleading total/show unavailable on contradictory facts rather than choosing max/first. Keep export endpoint full-batch in this scope and label buttons explicitly “Tải Excel cả lô” / “Tải CSV cả lô”; view filters do not silently alter export contract. No new export-filter endpoint.

- [ ] Extend Chef DOM owner case: two distinct dishes in same date/ca/variant, both100servings, display total100 not200; another date or variant is a separate grain. Contradictory same-grain serving facts must not produce a plausible invented total.
- [ ] Extend error row: generic409 is conflict with retry, only explicit legacy codes yield unavailable; batch-list failure is visible/retryable. Preserve authenticated download/error contract and read-only Chef behavior.
- [ ] Run FE(Chef.test.tsx), establish failures, then repair aggregation/filter context and explicit full-batch export labels. Use canonical shift identity or existing DTO labels deliberately; do not classify arbitrary409 as missing lineage.
- [ ] Keep code/UUID/version secondary and date/ca selection unambiguous. Repeat FE owner checks; BE(ReconciliationKitchenExportTests) only if producer/DTO changes are actually necessary. Do not add new acknowledgement or stock visibility.

### Task8 — Scope-bound reports, paging and refresh (UX11)

**Files:** `useReconciliationReports.ts`, report table/branches and consuming `ReconciliationPage.tsx`. **Depends on:** Task2 key/filter contract, otherwise independent of presentation tasks.
**Interfaces:** preserve `useReconciliationReports(options)` return shape and actual HTTP report/page/export contracts. Associate data/error/loading with `{reportKind,batchId,weekStartDate,page}`; same-key refreshing may retain rows, different-key navigation cannot.

- [ ] Extend Reconciliation page report case with distinct row identities for A/page1,B/page1,B/page2; preload B cache, switch A→B and verify no A rows. Then delay B response and switch back; delayed response cannot overwrite current scope. Error for B must not expose A rows below B header.
- [ ] Run FE(Reconciliation.test.tsx), verify intended cross-key failure, repair key-owned state/cache hydration and initial loading/error reset. No business-hook mock; the actual page/hook runs against network-shaped fixtures.
- [ ] Repeat focused case. Keep server page total versus current-page row count distinct; mixed-unit/null rows render honestly; authenticated export scope remains exact and full where contracted, not just visible page. No source-level cache-string test.

### Task9 — Manager decisions, blockers and short completion (UX08)

**Files:** `ReconciliationDispositionModal.tsx`, `ReconciliationCompletionModal.tsx`, `ReconciliationBlockerStrip.tsx`, `branches/ReconciliationLinesBranch.tsx`, `reconciliationColumns.tsx`. **Depends on:** Tasks1,3,8.
**Interfaces:** keep real category endpoint and daily-disposition payload `{category,reason,expectedVersion}`, daily lineage and append-only correction owner. Preserve all-date `WEEK_COMPLETE` readiness; selected-date counts never establish whole-week completeness.

- [ ] Extend existing disposition case: category fetch500 shows error+retry, save cannot send a fallback category, typed reason survives retry. Bulk partial success retains successful line identities and displays remaining work without replaying committed corrections.
- [ ] Extend existing completion case only for distinct risk not already owned: selected day matched but another day under-issued cannot be waived/chosen as completion; Manager sees actual blocker and own permitted recovery, no Warehouse navigation.
- [ ] Run FE(Reconciliation.test.tsx) and existing BE(ReconciliationDailyLineagePolicyTests) when completion rules are touched, establish intended failure, remove fabricated category fallback and repair dialog state/close guards.
- [ ] Keep review detail in page work area, confirmation only customer/week/consequence. Use Num/date/identity primitives, required overage reasons and actual source/issue notes. Repeat focused checks; do not invent a shortage disposition path or weaken BE completion.

### Task10 — Historical source-delta visibility without obsolete return workflow (UX13)

**Files:** `MrxSourceDeltaWorkbench.tsx`, its branches, MRX leaf label in `routeRegistry.ts`; BE read `ReconciliationSourceRevisionService.cs`; inspect existing `InventoryReturnService.cs`, `InventoryReturnSourceDeltaHandler.cs` and `ReconciliationInventoryIssueCreator.cs` without blanket removal. **Depends on:** Tasks1,5,8.
**Interfaces:** retain paged `getSourceDeltas(query)` and historical records/typed lineage. `WorkKind` read contract is `SUPPLEMENTAL_ISSUE|RETURN_REQUIRED`, not UI's current RETURN assumption. Treat existing MRX delta surface as historical/compatibility read; no create/confirm-return button, no new source-change-driven issue action. Preserve DEFAULT return contracts and existing historical API compatibility unless an actual policy defect is separately approved.

- [ ] Audit complete existing Warehouse source-delta tests before edits: classify retained read/identity contracts R, obsolete new-workflow command expectations F/C; no delete-to-green. Extend one real page case that displays both persisted work kinds correctly but cannot send new return/issue commands from this historical surface.
- [ ] Preserve the existing BE source-change regression that applying an unlocked change creates no physical return work. If owner investigation finds a live mutation bypass against the approved issued-day lock, isolate it and obtain the specific BE repair ruling; do not silently broaden/remodel compatibility.
- [ ] Run focused FE(Warehouse.test.tsx) and BE(ReconciliationSourceDeltaProjectorTests) for changed read semantics after authorization; establish intended UI-command-contract failure. Implement read-only history/status/pagination and correct label, preserving every stored record.
- [ ] Repeat focused checks. Existing API compatibility is not a requirement to keep inviting ordinary users to the deprecated workflow; no row deletion or unapproved schema migration.

### Task11 — Generated parity, whole-mode consistency and bounded actual-role evidence

**Files:** generated OpenAPI/schema; all changed consumers; `docs/domain/material-reconciliation.md`, `docs/FLOWS.md`, `docs/DESIGN.md` where actual requirements change; existing `frontend/tests/e2e-mrx/specs/g1…g6` and `fixtures/mrxWorkflow.ts` only for evidence gaps. **Depends on:** Tasks1–10.
**Interfaces:** API DTOs from Tasks2–3 precede FE integration/type acceptance. No hand-edited generated contracts. Existing same-candidate artifact ownership/protection protocol remains binding.

- [ ] Regenerate contracts after each BE DTO batch, not only after all FE work. Root `gen:api` can restore/download tools; under no-install rule use only verified installed Swagger/cached openapi-typescript from ENGINEERING/prior retained setup, with no `npx --yes` fallback. If unavailable, stop and request authorization. Compare generated shape, remove the unused summary call and migrate actual live consumers/API types; no new dependency/config workaround.
- [ ] Review changed surfaces together for hierarchy, Vietnamese copy, primary action, long data, pending-close/focus and shared prerequisite guards. Fix at existing shared primitive only if the defect is truly shared; no redesign token adoption.
- [ ] When local verification is explicitly resumed, run task-focused regressions first, then one `npm run verify`, generated parity and `git diff --check`. Named operationalPageContracts/`*.contract.test.tsx` files were not found at intake: locate again, run any real applicable suites; if still absent record that fact and use existing semantic/guard suites, never create padding tests or claim the absent command passed.
- [ ] Separately obtain bounded browser/runtime admission: confirmed actors/credentials/build/mode/resource retention on retained campaign, no automatic Start/Run or DB fixtures. First review retained evidence to minimize new work; do not rerun historical15-case qualification by default.
- [ ] Capture per-role before/after scenes for dashboard, long source review, missing prerequisite, Warehouse issue/supplemental/coordinated pending/error, Chef multi-dish scope/export, Manager blockers/decision/completion and history scope-switch. Batch supported desktop/tablet views; ordinary keyboard/Escape/focus/overflow still required, native200% remains waived. No independent review claimed.
- [ ] Durable business checks require real UI→request→persisted outcome→reload at scoped owners; screenshots alone are not acceptance. If authority is not supplied, finish with NEEDS_EVIDENCE/BLOCKED, not a fake PASS or another implicit execution loop.
- [ ] Report criterion-level PASS/FAIL/NEEDS_EVIDENCE/BLOCKED plus mandatory skill table; update WORK to IDLE only after implementation handback or explicitly paused gate. No release certification implied.

## Coverage and self-review

- Findings: UX01–02→Task2; UX03→Task1; UX04–05→Task3; UX06/07/12→Task5; UX08→Task9; UX09–10→Task7; UX11→Task8; UX13→Task10; UX14→Task6. Import/BOM/shared prerequisites are explicit Task4; whole-mode state/a11y/consistency/evidence and contract parity Task11.
- All five Review Focus classes have a named owning regression. Existing source identity, stock/lot/movement/replay, Chef export and daily completion contracts are retained, not duplicated at every wrapper.
- Interface changes are confined to actual dashboard/source read callers; write semantics remain at current authorities. New public reads have explicit trusted-actor/mode/data scope, no unrestricted generic inbox.
- Plan does not claim every source finding is runtime-reproduced. Decimal midpoint parity, catalog error/type behavior and legacy live-command reachability are required owner checks before their exact repair; no speculative policy or DB mutation is preapproved.
- This plan is one cross-role redesign with dependent owner tasks, not11 independent product projects. No competing task ledger, separate orchestration framework or per-task commit recipe.

## Handoff / admission

Owner has approved the design; review this plan before implementation using the preserved native method. The earlier stop on tests/build/browser/campaign/DB remains in force. Implementation must not proceed into a required verification command until the Owner explicitly resumes the relevant local checks; campaign/browser admission is a separate bounded decision. Do not interpret “approve plan” as unlimited rerun/retention/deploy authority.
