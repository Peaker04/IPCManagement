# MRX Excel and Station UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native sequential execution only; no subagents. Steps use checkbox syntax. WORK is the sole progress owner; this document defines the plan, not a second status ledger.

**Goal:** Deliver Vietnamese, safe, actual XLSX business files and usable existing MRX workstations, with owner regressions and candidate-attributed operation evidence.

**Architecture:** Repair the two confirmed review defects first, then implement vertical stations at existing parser/exporter/service/component owners. Retain compatible CSV endpoints and protect their text cells. Reuse existing workbook builders, UI primitives, campaign guards and evidence routing; no Excel framework, parallel route/workflow or new database.

**Tech Stack:** Existing ASP.NET Core/C#, current workbook/OOXML implementations and installed spreadsheet dependencies; React/TypeScript, Vitest, Playwright, Windows Chrome and PowerShell campaign controller.

**Spec:** [2026-11-03-mrx-excel-and-station-ui-ux-design.md](../specs/2026-11-03-mrx-excel-and-station-ui-ux-design.md), approved by Owner after document delivery.

## Global Constraints

- Hierarchy: original five-user qualification → lifecycle scope lock → single-clone repair → this package. Parent qualification remains incomplete.
- Native sequential, one writer; preserve inherited dirty tree. No install, delegation, worktree, stage, commit, push or deploy. Task checkpoints replace the skill's generic commit steps.
- Campaign `20261103t101725z_407a6d`, clone `ipc_mrx_evidence_20261103t101725z_407a6d`; main `ipcmanagement` read-only. No Start/re-dump/recreate/bootstrap/integration DB/schema mutation/Finish/Abort.
- DEFAULT != MATERIAL_RECONCILIATION. Preserve six-decimal quantities, distinct-ID BOM-once calculation, stock lineage and append-only history; Chef read/export only, Manager != Admin.
- Login queue13s/server5/min/IP unchanged; response timeout15000ms unchanged. No aggregate retry or budget increase.
- Evidence soft2GiB/hard4GiB/reserve256MiB; scanner10000files/3000ms; unknown usage blocks. Keep old acceptance packet/manifests immutable.
- No synthetic stock/master/supplier or new prerequisite without explicit scope approval; no mocked business success, weakened assertions or test-only production seams.
- Production styling authority is `frontend/src/styles/index.css`; existing primitives/composites only. D6>=12px, D7 one primary, T7 frozen header/identifier column, T8 compact36–40px where content permits, M1.2 one blocking modal, N6 existing nested sidebar.
- Runtime requires a separate admitted selection/budget/resource check. This plan is not permission for another15-case run, quantitative/endurance/k6, off-host proof or release.

## Review Focus

1. Formula-like customer/material text, leading whitespace/control characters and embedded CSV delimiters must remain text, while numeric negatives retain numeric meaning — Task1 export regression.
2. Five concurrently reauthenticating actors must wait their login slots without response-timer expiry or lost click response — Task2 fake-clock regression.
3. Vietnamese XLSX headers, legacy aliases, leading-zero codes and numeric six-decimal values must round-trip without changing BOM/unit semantics — Task3 real template/parser case.
4. Same-name different-ID dishes, two customer scopes and unknown supplier must remain distinct; no invented NCC or mixed-unit total — Tasks4–6 owner cases and real outputs.
5. Report exports spanning more than one UI page must retain requested scope, cancellation/resource bounds and immutable historical values — Task7 export boundary case and Task8 runtime readback.

---

## File map and boundaries

Paths below are existing unless labeled Create. Modify only if inspection/reproduction requires it; a file's presence is not an instruction to refactor it.

- **CSV security:** `backend/src/IPCManagement.Api/Features/Reconciliation/Services/ReconciliationKitchenExportService.cs`; `backend/tests/IPCManagement.Api.Tests/ReconciliationKitchenExportTests.cs`. Existing signatures: `BuildCsv(IReadOnlyList<ReconciliationKitchenCookingRowDto>, string customerLabel, DateOnly weekStart) -> byte[]`, `BuildXlsx(...) -> byte[]`.
- **Auth queue:** `frontend/tests/e2e-mrx/fixtures/authHelpers.ts`; extend `fixtures/__tests__/qualificationCredentials.test.ts` if its setup can own login behavior without duplication, otherwise Create `fixtures/__tests__/authHelpers.test.ts`. Public boundary stays `loginRole(page: Page, role: MrxRole, baseURL?: string): Promise<void>`.
- **Template/BOM:** `backend/src/IPCManagement.Api/Features/Catalog/Services/DishBomImportParser.cs`, `DishBomImportService.cs`, `Controllers/DishBomImportsController.cs`, existing `BomTemplateWorkbookBuilder` (resolve exact path before editing); `frontend/src/api/bomApi.ts`, `frontend/src/components/workbench/DishBomBatchImportModal.tsx`; tests `DishBomImportServiceTests.cs`, `DishBomImportsControllerTests.cs`, `frontend/src/__tests__/DishBomBatchImportModal.test.tsx`.
- **Weekly source:** `frontend/src/features/weekly-menu/{WeeklyMenuImportModal,MrxBatchWorkbench,MrxSourceChangePanel,MrxSourceEditGrid}.tsx`, `hooks/{useMrxBatchWorkspace,useMrxSourceEdit}.ts`, weeklyMenuApi; backend SampleData weekly workbook parser/template owners. Tests `WeeklyMenu.test.tsx`, `MrxSourceEdit.test.tsx`, existing weekly import tests and `frontend/tests/e2e-mrx/fixtures/mrxWorkflow.ts`.
- **Preparation:** `frontend/src/features/warehouse/MrxMultiCustomerPreparationWorkbench.tsx`; backend `Features/Reconciliation/Services/{ReconciliationPreparationWorkbookExporter,PreparationWorkbookBuilder}.cs`, `Contracts/ReconciliationPreparationDto.cs`; `ReconciliationPreparationWorkbookTests.cs`, `Warehouse.test.tsx`.
- **Daily warehouse:** `frontend/src/features/warehouse/{MrxDailyIssueWorkbench,MrxSupplementalIssueModal,MrxSourceDeltaWorkbench}.tsx`, `hooks/useMrxDailyWorkspace.ts`, `branches/{MrxDailyHeaderBranch,MrxDailyLinesBranch}.tsx`; `Warehouse.test.tsx`, existing G1/G4/G5/G6 lifecycle specs only when affected.
- **Chef:** `frontend/src/features/chef/MrxCookingWorkbench.tsx`, `branches/MrxCookingHeaderBranch.tsx`, `frontend/src/api/mrxApi.ts`; cooking controller/service; `Chef.test.tsx`, kitchen export owner tests.
- **Reports/completion:** `frontend/src/features/reconciliation/{ReconciliationPage,ReconciliationCompletionModal,ReconciliationDispositionModal,ReconciliationReportTables}.tsx`, `branches/{ReconciliationTransactionsBranch,ReconciliationCompletedBranch}.tsx`; `frontend/src/api/mrxApi.ts`, `utils/fileDownload.ts`; backend `ReconciliationReportsController.cs`, `ReconciliationReportsService.cs`, `MrxReportExportContext.cs`, `MrxReportCsvStreamWriter.cs`, existing report query owners; tests `ReconciliationDashboardAndReportsTests.cs`, `Reconciliation.test.tsx`.
- **Cross-cutting:** change modal/button/grid/download only for reproduced shared-owner defect, review every caller first. No blanket primitive rewrite.

## Verification commands used by the tasks

From repo root, use installed tools; commands do not imply expected results have already been observed:

```sh
# B(owner): substitute the test class named by that task
 dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --no-restore --filter 'FullyQualifiedName~OWNER'
# F(owner): substitute paths relative to frontend
 npm run test:unit -w frontend -- src/__tests__/OWNER.test.tsx --maxWorkers=1
# H: harness-only unit boundary, no API/DB/browser startup
 node node_modules/vitest/vitest.mjs run frontend/tests/e2e-mrx/fixtures/__tests__ --environment node --maxWorkers=1
# Changed production boundary
 npm run lint:fe
 npm run build:fe
 npm run build:be
 npm run depcruise:fe
 git diff --check
```

Before test changes load test-audit/ipc-test-audit and inspect DTO/fixtures; before bug repairs load debugging; before TSX/CSS publish scoped UI gate and load UI review/Impeccable; before code completion load code review/verification. Do not run an unknown broad test command that may connect to main or create a DB. Full `npm run verify` is a final controlled non-campaign gate, not a per-finding loop.

### Task 1: Neutralize formula-leading Chef CSV text

**Files:** CSV security owner/tests above; inspect callers of `BuildCsv`, `BuildXlsx`, `Csv` and retained report CSV implementations.
**Interfaces:** no public signature change. Produces CSV safe text and unchanged data columns/precision for downstream Chef and report compatibility review.

- [ ] Read existing escaping tests and enumerate text vs numeric fields; identify existing safe serializer before adding any helper.
- [ ] Extend the owner export case/table with saved customer label `=1+1 - 1`, plus distinct dangerous-prefix/whitespace cases and ordinary quote/comma/newline text. Parse cells independently; assert text does not begin with executable formula prefix after spreadsheet-relevant leading whitespace, original readable content is preserved under the chosen text escaping, headers/order/numeric six-decimal fields remain valid. Include a valid negative numeric value only in a column whose DTO/business contract supports it, not fabricated invalid Chef quantity.
- [ ] Run B(`ReconciliationKitchenExportTests`); retain intended RED showing unsafe text, not setup failure.
- [ ] Repair private text serialization once, reusing an existing compatible owner if present. Never rely on quoting alone or globally prefix numeric output.
- [ ] Run the same owner test to GREEN; verify XLSX inline/shared text has no formula nodes for the same text using the existing workbook case, not a duplicate business test.
- [ ] Code-review callers and record RED/GREEN/remaining reachable CSV owners in WORK. Do not claim whole-application CSV safety from this one fix.

### Task 2: Start login response timeout after the shared queue

**Files:** auth queue owners above; read `g8-five-user-endurance.spec.ts` callers, but do not run G8.
**Interfaces:** preserve `respectLoginBudget(): Promise<void>` and `loginRole(...)`; no exported testing seam.

- [ ] Add one fake-clock owner case `five_queued_role_logins_capture_their_own_submit_response` around actual imported `loginRole`, using private fake fs/credentials/page transport only. Fake response timer must expire independently if registered during queue wait; submit emits the response immediately so registering after click fails too. Use a clean module per test and restore env/timers/fs mocks.
- [ ] Start five roles concurrently, advance fake time through the real13s ledger slots; assert all fulfill, five distinct actor submissions, adjacent login instants>=13000ms and no response lost. Assert the pre-fix failure is timer expiry before queued click, not a mock exception or credential error.
- [ ] Run H and capture intended RED.
- [ ] Move `await respectLoginBudget()` before creating `responsePromise`, retaining listener-before-click,15000ms response timeout,429 fail-fast and current retry policy.
- [ ] Run H to GREEN; strict typecheck affected harness with existing project command/config. No sleep-based real-time five-user test, rate-limit change or endurance admission.

### Task 3: Round-trip Vietnamese business templates and XLSX test input

**Files:** BOM/template owners, relevant weekly source workbook owners; `frontend/tests/e2e-mrx/specs/g6-merged-customer.spec.ts`, `fixtures/mrxWorkflow.ts`, `fixtures/__tests__/mrxWorkflow.test.ts` only where they construct/parse business files.
**Interfaces:** retain import DTOs and preview→commit semantics. `mrxWorkflow` keeps existing `parseCookingFile(file, format: 'csv' | 'xlsx')` compatibility; prefer XLSX for new business evidence.

- [ ] Inventory every MRX template/import/download control by actual FE caller→endpoint→parser/exporter. Record in WORK: business purpose, format/MIME, required columns, actor/scope, test owner and action needed. Resolve unit-conversion source instead of assuming a separate conversion importer exists.
- [ ] Extend actual template/parser owner case: generate/download existing workbook bytes, fill one smallest valid row with Vietnamese headers, leading-zero code and exact decimal, parse/preview; compare to DTO and independent expected quantity. Existing aliases must still work; ambiguous duplicate canonical headers must reject clearly, not silently overwrite.
- [ ] Run owner tests B(`DishBomImportServiceTests`) and template/controller owner; missing behavior RED first. Do not manufacture RED by changing a copy-only expectation.
- [ ] Reuse existing `BomTemplateWorkbookBuilder` and `HeaderAliases`; translate leaked technical validation copy at existing parser owner. Keep required dates/unit/customer/BOM fields; preserve old technical aliases where consumed.
- [ ] Replace G6 BOM/conversion CSV fixture generation with real XLSX via installed builder/library only, through actual import UI. Unit fixture test independently parses written XLSX cell types/values; no hand-authored expected receipt.
- [ ] Run owner tests and H/F(`DishBomBatchImportModal`) to GREEN, build relevant boundaries. Record inventory completeness; any newly discovered independent file path gets a named owner/check before moving on, not a silent omission.

### Task 4: Weekly source and approval UX on existing pages

**Files:** weekly source map; tests `WeeklyMenu.test.tsx`, `MrxSourceEdit.test.tsx`, `mrxWorkflow` and existing source-decision/G6 cases.
**Interfaces:** same URL customer/batch/week scope, source revision/approval contracts and group/individual dish identities. No new route or source state model.

- [ ] Publish scoped UI gate for `/weekly-menu` in MRX; check loading/empty/error/permission/partial/reconciliation risks against actual owners and C# DTOs.
- [ ] Extend strongest existing case for explicitly selected customer overriding remembered context, retained draft after failure, and same-name different-ID choices only if uncovered. Keep existing regressions rather than duplicating them. Treat pure Vietnamese label changes as review, not a new test suite.
- [ ] Reproduce and fix bounded findings at source/import/review owners: clear context, Vietnamese errors, accessible selectors, grid scroll/frozen identity, no fixture values, no obscured submit/reject buttons; keep immutable issued-date restrictions.
- [ ] Run F(`WeeklyMenu`), F(`MrxSourceEdit`), owner import tests and UI contracts; build/lint affected FE/BE. Mark station runtime evidence pending Task8, not PASS because component tests passed.

### Task 5: Preparation workbook and workbench agree across customers

**Files:** preparation owners/tests above; `mrxApi.getPreparationWorkbookUrl` caller boundary remains authoritative (inspect actual method name before editing).
**Interfaces:** `ReconciliationPreparationWorkbookDto` existing C# DTO in its actual contracts owner; maintain filter/date/customer/supplier inputs and per-customer allocations.

- [ ] Read both exporter and existing `PreparationWorkbookBuilder`; determine already satisfied requirements. Do not replace XLSX that already works or add parallel exporter.
- [ ] Extend existing workbook case with two customer allocations, an unknown supplier and different units. Assert day→supplier grouping uses source supplier only, allocation totals equal independent expected same-unit values, unknown remains explicit, and six-decimal numeric cells survive. Preserve same-name distinct-ID lines where contract distinguishes them.
- [ ] If new sheet/header behavior is needed, capture failing workbook case then adapt existing builder, adding Vietnamese guide/summary/allocation detail only where absent; freeze/filter/print settings must not change data.
- [ ] Publish warehouse preparation UI gate; repair scope/filter/download feedback and overflow only at workbench owners. Do not add supplier grouping to daily issue.
- [ ] Run B(`ReconciliationPreparationWorkbookTests`), F(`Warehouse`), build/lint and UI contracts. Keep supplier truth and no mixed-unit total as explicit review acceptance items.

### Task 6: Daily issue, supplemental dialog and Chef operation

**Files:** daily warehouse/Chef owners and tests above; retain current backend issue/disposition command contracts.
**Interfaces:** same `useMrxDailyWorkspace` commands/durable receipts; Chef download uses authenticated `downloadKitchenCookingBlob(batchId, format)` and server-resolved scope, with XLSX default/prominent.

- [ ] Publish scoped gates for `/warehouse` daily MRX and `/chef`. Inspect actual product state before transferring any mockup layout; no dummy data or synthetic status.
- [ ] Extend `Warehouse.test.tsx` at real command boundary only for uncovered behavior: validation focus, retained values on conflict/unknown outcome, one confirmation request. Extend `Chef.test.tsx` for selected batch/customer XLSX request and permission-safe no-write behavior only if current coverage lacks it.
- [ ] Repair context/fields/short confirmation/body scroll/footer visibility/keyboard return and Vietnamese recovery text through existing modal/form/grid owners. Preserve supplemental vs overage/shortage semantics and explicit reconciliation of uncertain write results.
- [ ] Keep Chef read-only; use XLSX and parse numeric/text cell types. Fix shared file download only if reproduced; verify every caller and auth/error handling before touching `fileDownload.ts`. Do not retain a test-only success branch as product behavior.
- [ ] Run F(`Warehouse`), F(`Chef`), B(`ReconciliationKitchenExportTests`) and relevant warehouse owner regressions; lint/build/UI contracts. Task8 supplies real persisted operation/export evidence.

### Task 7: XLSX history/report exports and completion UX

**Files:** report/completion map. Create only if separation is needed: `backend/src/IPCManagement.Api/Features/Reconciliation/Services/MrxReportWorkbookExporter.cs` as a feature-specific workbook writer consuming existing query rows, not a generic framework; owner tests remain `ReconciliationDashboardAndReportsTests.cs` unless the existing class has a different stronger boundary.
**Interfaces:** retain CSV URLs. Add sibling XLSX GETs to the existing controller: `transactions-history/xlsx`, `variance-register/xlsx`, `completed-register/xlsx`, `audit-trail/xlsx`, `{id}/export/xlsx`, same authorization and relevant scope filters as CSV. FE uses authenticated Blob download, not unauthenticated window.open. No new report DTO/business query meaning.

- [ ] Enumerate CSV caller scope before implementation, including current page-only completed-register behavior. New user action says whether it exports selected scope or current page; default business export is whole requested filtered scope. Never silently call current-page data “all”. Preserve old CSV semantics for compatibility.
- [ ] Extend strongest report/controller case: at least one row beyond UI page boundary, out-of-scope row excluded, historical values unchanged after current master/source changes, Vietnamese workbook headers, quantities numeric and formula-like user text literal. Assert authorization at existing controller integration boundary; no new database fixture setup.
- [ ] Run B(`ReconciliationDashboardAndReportsTests`) and existing controller owner tests; capture intended RED for missing XLSX boundary/output, not arbitrary method naming.
- [ ] Implement sibling endpoints at existing report controller; consume `StreamTransactionsHistoryExportAsync`/`StreamAuditTrailExportAsync` and existing filtered report queries. Use installed workbook writer with bounded row consumption/temp storage and cancellation, keep XLSX sheet row limit enforced with clear Vietnamese error or bounded additional sheets; never load unbounded history into browser or discard resource bounds. If installed writer cannot meet bounds, stop for design ruling rather than add dependency or silently buffer all data.
- [ ] Keep streaming CSV endpoints intact and audit their text escaping; numeric formatting separate. Extend regression only for a distinct uncovered serializer contract, not every controller copy.
- [ ] Wire report controls through existing `mrxApi`/download owners; update generated API contract through installed tooling without tool restore/install. If generation requires missing tools, BLOCKED rather than hand-fabricate parity output.
- [ ] Publish reconciliation UI gate; repair filter/context, detail/disposition/completion dialogs and export feedback. Tests F(`Reconciliation`), report owner tests, lint/build/contract parity/UI contracts GREEN. Do not change Manager permission or append-only rules to make UI simpler.

### Task 8: Candidate freeze, admitted station evidence and final affected gates

**Owner scope amendment (supersedes native-zoom bullets below):** Owner explicitly requests “bỏ qua kiểm tra zoom thật 200% bằng phím Windows”. Native200% is `WAIVED_BY_OWNER`, NOT PASS or emulated evidence; it is no longer a Task8 runtime-admission prerequisite. Remove Task8-only native helper/calls, retain normal responsive, keyboard/focus/Escape/overflow and all business/XLSX assertions. No test.skip/todo/exemptions, guard weakening or parent G7/performance certification. Existing single confirmation approval, same clone/selection/budgets and immutable R6 constraints remain unchanged.

**Files:** existing lifecycle specs/fixtures only when needed, `.planning/WORK.md`, current campaign artifact routes. No change to old `acceptance/lifecycle.json`.
**Interfaces:** exact campaign/build/attempt identity from current controller; no fresh clone and no unapproved aggregate selection.

- [ ] Before runtime, publish in WORK an admission table with exact test names/CLI selection, role, read/write scope, prerequisite authority, per-case and phase budgets, output paths and resource headroom. Ask Owner to approve runtime mutation/selection where not already explicit. Existing functional caps: ordinary900000ms; LifecycleAcceptance1200000ms; Golden180000ms/coordinated420000ms registered before fixture setup. These are ceilings, not authority to consume all groups or repeat them.
- [ ] Run required cheap prefreeze gates: `npm run verify`, existing recovery/evidence safety tests, H, relevant strict harness typecheck and UI operational/contract tests. Inspect test command routing first; do not start integration DBs. Capture actual command/status/count, not expected counts from old R6.
- [ ] Freeze new source/build candidate with existing manifests and safe source/main/resource readback. Stop on mismatch, unknown storage, missing credentials or unapproved prerequisites; no fallback runner/database.
- [ ] Under admitted selection, operate sequentially: XLSX import/preview/commit and source review → preparation workbook/allocation → daily/supplemental issue/recovery → Chef selected-scope XLSX → disposition/completion/history/report. Use original role responsibilities and real objects. If case budget or fixture authority is insufficient, checkpoint and ask; do not silently extend phase or synthesize data.
- [ ] Collect supported UI checkpoints: source editor/import/review at1366×768, preparation/day-issue and supplemental modal at1280×720, Chef/reconciliation/report at1920×1080;960×720 for daily and key dialog overflow. Native Chrome200% on source editor, issue dialog and completion controls. Test keyboard Tab/Shift+Tab/Enter/Escape and focus return at real risky controls, not every role×viewport combination. These are bounded usability observations, not memory/performance certification.
- [ ] Parse actual downloaded/imported XLSX bytes independently. Corroborate FE durable writes/reload with allowed HTTP/SQL readback, preserve IDs/versions/quantity/customer/date/ca/NCC lineage. Unknown outcomes and failures remain evidence, never relabeled success.
- [ ] Reconcile each inventory row and station criterion to PASS/FAIL/NEEDS_EVIDENCE/BLOCKED. Verify referenced files/hashes, storage and owned process cleanup; retain DB/principal/DPAPI. Preserve old candidate acceptance untouched; no new final-package/release claim.
- [ ] Update WORK to IDLE with exact scoped outcome and parent gaps. Skill report format: `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact`.

## Self-review and execution handoff

Coverage: spec§1–3→global constraints/file map; §4→Tasks1/3/5/6/7; §5→Tasks1–2; §6→Tasks4–7; §7→ordered tasks; §8–10→Task8. Review-focus rows have owner checks, not duplicate matrices. Existing API signatures retained except explicit sibling XLSX routes; exact inventory and newly discovered caller ownership are verified before each patch, not invented from the preview. No task grants live admission, prerequisites, cleanup or quantitative authority.

Residual planning limits: workbook/parser implementations need complete execution-time reads before choosing a concrete writer change; report stream bounds may require a ruling if current tooling cannot satisfy them. UI findings must be reproduced before adding speculative tests. This plan has been parent self-reviewed, not independently delegated. No code/tests/runtime have been executed to implement it.

**Handoff:** Owner reviews this plan, confirms native execution, then `executing-plans`. No commit/stage step, no subagent and no automatic live run.
