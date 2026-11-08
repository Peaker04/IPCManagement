# MRX post-review follow-through Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` to implement this plan task-by-task inline, only after explicit implementation approval. Owner approved the documentation commit and handoff, not execution in this turn. No delegation, worktree, product-code commit or runtime changes are authorized. Checkboxes describe future actions; `.planning/WORK.md` alone tracks actual task state.

**Goal:** close all five post-P1–P5 review findings without losing frozen evidence, exact command scope or unknown-write safety.

**Architecture:** repair existing workspace/navigation, workbook exporter, number formatter and test setup owners. Keep endpoints/persistence unchanged; use existing UI primitives and network-boundary fixtures. Implement sequentially in this inherited dirty checkout, one writer.

**Tech Stack:** React/TypeScript/React Router/Vitest/Testing Library, ASP.NET Core/EF Core, existing OpenXML/workbook test tooling; no new dependencies.

**Spec:** [2026-11-08-mrx-review-followthrough-design.md](../specs/2026-11-08-mrx-review-followthrough-design.md).

## Global Constraints

- Documentation approved for commit/handoff: no source/test execution authorized by this turn. Implementation approval must explicitly include isolated regression fixtures and their test runs; no live data fixture creation.
- Preserve inherited tree, HEAD/index, `DEFAULT != MATERIAL_RECONCILIATION`, exact frozen lineage, final quantity precision six decimals, actor/version/reason/RBAC/day locks and idempotency.
- No migration/backfill/deploy/restart/install/commit, real business write, guessed historical conversion, price scaling or new framework. Existing rollout/UAT obligations stay open.
- No mocked owner hook/component, copied implementation as expected result, source-regex substitute for runtime behavior, test skip/exemption padding, timeout/heap inflation or permissive response fallback.
- Keep current external interfaces unless a necessary change is explicitly listed below. Stop for additional approval on schema/wire/dependency/unrelated behavior changes.
- Use fresh rebuilt backend test artifacts; historical successful suites and the review's existing-DLL run do not prove these changes.

## Review Focus

1. Query changes arrive before an effect commits: no wrong-batch write is possible during this render gap. Own in T1, actual POST/no-POST assertions.
2. Back/Forward occurs during pending/unknown write: preserve attempted scope/draft/ID and block discard. Own in T1, extended existing unknown tests.
3. Supplier has no matching materials but menus exist: valid menu-only workbook, not an identity exception or fabricated materials. Own in T2, real XLSX case.
4. Positive rate below a fixed 20-decimal cap: rate still nonzero while totals use six decimals. Own in T3, significant-digit UI case + unchanged total assertions.
5. Fetch rejection is caught or mocks are restored: runner still fails for unhandled request and never reaches native network. Own in T5, isolated-run negative control and lifecycle case.

## File map and interfaces

Backend Services below means `backend/src/IPCManagement.Api/Features/Reconciliation/Services/`; backend tests means `backend/tests/IPCManagement.Api.Tests/`. Frontend paths below are full repository-relative paths.

| Task | Modify at existing owner | Extend existing test owner |
|---|---|---|
| T1 | `frontend/src/features/warehouse/hooks/useMrxDailyWorkspace.ts`, `frontend/src/features/warehouse/MrxDailyIssueWorkbench.tsx`; `frontend/src/components/workbench/DirtyNavigation.tsx` / context only if required by real guarded navigation | `frontend/src/__tests__/Warehouse.test.tsx`; `frontend/src/__tests__/RouteNavigationIntegrity.test.tsx` only for distinct shared-provider behavior |
| T2 | Services `ReconciliationPreparationWorkbookExporter.cs`; keep `PreparationWorkbookBuilder.cs` validation, change only if valid zero-material output needs a surgical fix | Backend `ReconciliationPreparationWorkbookTests.cs` |
| T3 | Services `ReconciliationKitchenExportService.cs`; `frontend/src/utils/formatters.ts`, `frontend/src/components/ui/num.tsx`, `frontend/src/features/chef/branches/MrxCookingDishListBranch.tsx`, `frontend/src/components/workbench/MrxBatchDishesModal.tsx` | Backend `ReconciliationKitchenExportTests.cs`; `frontend/src/__tests__/{Chef,Reconciliation,Primitives}.test.tsx` for distinct UI/primitive contracts |
| T4 | `frontend/src/features/warehouse/MrxSupplementalIssueModal.tsx`; workspace hook only if a real mutation bypass is reproduced | `frontend/src/__tests__/Warehouse.test.tsx` existing pending/unknown cases |
| T5 | `frontend/src/test/setup.ts`, `frontend/src/test/fixtures.ts` only for genuinely shared explicit DTOs; affected unit tests based on actual failures | `frontend/src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts` plus explicit HTTP handlers at affected existing tests |

T1 retains the hook's exported `useMrxDailyWorkspace(props)` owner and real mrxApi transport. A local returned `requestScopeChange(nextBatchId: string, nextDate: string): void` may replace the header's scattered updates; it is used by the actual workbench, never exported only for tests. Read all existing setters/callers before changing the returned interface.

T2 retains `GetWorkbookAsync(query, token)` and `ExportWorkbookXlsxAsync(query, token)`, the current DTO and CustomerId dictionary semantics. T3 adds `rate` to existing `formatNumber`/`NumProps.format` unions, with two production callers; no separate rate component. T4 retains current controlled props and command owner. T5 changes test infrastructure only, not production API behavior.

## Gate 0 — permission, baseline and UI prerequisites

- [ ] Obtain explicit implementation approval for this spec/plan and isolated HTTP/DB/subprocess test fixtures; note exclusions. Documentation commit/handoff approval and existing original P1–P5 approval do not authorize these new repairs.
- [ ] Read AGENTS/WORK and applicable executing-plans, debugging, TDD, test-audit, UI/code-review and verification skills; refresh canonical domain owners referenced in the spec.
- [ ] Record `git status --short --branch`, `git rev-parse HEAD`, `git diff --cached --name-only`; capture hashes/path inventory to distinguish task changes from inherited changes. Do not stage anything.
- [ ] Read each full owner/caller/test before its task. Inventory useMrxDailyWorkspace setters, rate consumers, menu/material customer identities and all global fetch restore/stub patterns. Stop on concurrent edits to the same owner.
- [ ] Run focused baseline FE/BE commands below and capture real exit/summary. Ensure isolated provider/file fixtures cannot reach production DB or live backend. No edit while a relevant test run is active.
- [ ] Emit **Scoped Pre-Code UI Gate Block** before any TSX edit: `/warehouse?view=mrx-daily`, `/chef`, existing MRX dish-inspection host routes; existing WorkspaceFrame/table work object, MATERIAL_RECONCILIATION, actual current route/action RBAC tokens, six states loading/empty/error/permission-denied/partial/write-reconciliation, Modal/Select/Input/Button/Num/StateBoundary; D6≥12px, D7 one primary, T7 frozen header/column, T8 36–40px density, M1.2 one blocking modal, N6 nested sidebar v2. Read current guards; do not invent permissions. No CSS/redesign needed.

## T1 — synchronize route scope safely (AC1–AC2)

- [ ] In `Warehouse.test.tsx`, extend the real router/workspace harness (not hook mocks) with `same_mounted_history_targets_the_visible_batch`: use distinct A/B dates and daily-line IDs, navigate A→B→Back→A→Forward→B without remount. Submit fresh valid data after navigation; inspect real apiClient POST JSON through mrxApi. Assert batch/date/line IDs match visible scope and no POST while a destination read is deferred.
- [ ] Add assertions to the same test for a delayed old-scope response and an explicit URL target missing from the catalog page. Expect no fallback command against first catalog batch; show real missing/denied target state. Preserve the existing F5 reload test.
- [ ] Run focused Warehouse suite on pre-fix source. Expected RED: stale active batch/outgoing wrong batch after same-mounted query change. A compile/permission/mock failure is not the intended regression.
- [ ] Implement the scope authority/transition in the existing hook and workbench. Make explicit prop/URL batch/date current authorities, snapshot/session/catalog fallback only. Gate submit synchronously on route/active/payload agreement before any effect can clear state; reset clean old-scope transients together and reuse late-read generation fencing.
- [ ] Route header selection through the same transition; retain unrelated query parameters and history semantics. Remove duplicated workbench session/cache updates only once their responsibility is covered by the actual transition owner; no remount, new state store or URL update loop.
- [ ] Extend existing dirty/pending/unknown cases: dirty cancel keeps draft and batch, confirmed discard follows destination; pending/unknown Back and programmatic navigation do not erase attempted batch/date/values/ID or issue another POST. Connect existing DirtyNavigation provider as needed. Defensively fence mismatched route if a navigation bypasses the guard, restore guarded location without losing the fence.
- [ ] Run Warehouse and, only if shared provider changes, RouteNavigationIntegrity suites. Expected GREEN includes both initial and supplemental command owners, existing 400/409 correction, initial saved-draft recovery, unknown sticky recovery and no stale cross-scope fields.
- [ ] Self-review all setters, route entry/Back/Forward, error/permission targets and new command admission conditions; no business endpoint/source lock changes. Record task diff and proof in WORK.

## T2 — union customer identities before workbook rendering (AC3)

- [ ] Extend `GetWorkbookAsync_Filters_By_Supplier_Name_Maintaining_Parity` or adjacent actual-export owner case: A and B selected, A allocation2.5 for supplier X, B allocation3 for supplier Y, `SupplierName=X`, `IncludeMenus=true`, frozen menus for both. Load actual generated XLSX. Assert A/B definitions, both menus, A2.5/B0 material allocation and grand total2.5; no excluded-supplier materials. Use independently written expected numbers.
- [ ] Add only distinct rows: unmatched supplier gives menus without material rows and total0; `IncludeMenus=false` preserves material-only definitions/layout. Retain existing same-name/repeated-customer-batch case (2.5/3,total5.5) and missing/duplicate identity rejection.
- [ ] Run backend preparation tests pre-fix. Expected RED: valid combined filter throws builder identity exception; not missing frozen fixture metadata.
- [ ] Reorder exporter projection so material detail and included menu rows exist before definitions/summary dictionaries. Form referenced-customer union using selected version/customer identity, not menu-name matching. Deduplicate by ID, deterministic code/ID order; reject contradictory metadata and populate every summary dictionary with zero for missing allocations.
- [ ] Keep menu scope independent of supplier filter, material scope filtered, total parity and builder strict validation. Check valid menu-only rendering; do not delete validation to pass. Keep DTO/schema unchanged.
- [ ] Rebuild/run preparation workbook + preparation suites. Expected GREEN actual byte-level layouts, selected scope, supplier ambiguity handling, text/formula escaping and no service writes. Record proof and review exporter→builder together.

## T3 — separate rate precision from quantity precision (AC4)

- [ ] Extend existing kitchen CSV/XLSX owner test with canonical rate0.0000004, servings1000, frozen total0.0004. Assert parsed CSV rate and XLSX numeric `<v>` are exactly0.0000004, not0; numeric total remains0.0004. Reuse existing null/unavailable coverage and formula-label tests.
- [ ] Extend actual Chef and dish-inspector DOM cases with rate0.0000004 and total0.0004; expect visible `0,0000004` and `0,0004`. These are distinct callers/DTOs, not duplicate writer tests. One existing Num/Primitives table row covers rate1e-24, ordinary0.1 and null without a combinatorial matrix.
- [ ] Run relevant BE/FE tests pre-fix. Expected RED is numeric serialized/displayed zero; JSON-only precision, missing new `rate` format compilation or a snapshot does not suffice.
- [ ] In kitchen exporter add one file-local rate serializer `Rate(decimal? value): string` using invariant `0.############################` and blank for null. Use only for the per-serving CSV/XLSX fields; leave current final-total/waste `Number` formatting unchanged. Keep XLSX numeric cell and escaping behavior.
- [ ] Extend `formatNumber(value, format, decimals?)` and `NumProps.format` with `rate`: Vietnamese locale and maximumSignificantDigits15, no fixed fraction cap. Reuse Num in both consumers as `format="rate"` without `decimals={6}`. No new helper/component or decimal library.
- [ ] Run kitchen, Chef, Reconciliation and Primitives suites, then build/typecheck. Expected GREEN: small positive not0, null is unavailable, currency/quantity/plain callers unchanged, final quantity normalization6 unchanged. Document JS/Excel15-significant-digit boundary; no promise of exact28-digit arithmetic.
- [ ] Search all canonical/bom per-serving consumers before exit; fix only matching rate-presentation callers, not raw BOM editor/currency or final quantity fields. Record any newly discovered caller and test ownership in WORK.

## T4 — lock direct supplemental fields (AC5)

- [ ] Extend the existing Warehouse initial/supplemental failure table near the 502/503/missing-receipt cases. Defer POST to observe pending; attempt material selection, quantity/reason edit and every preset button. Assert disabled semantics and unchanged visible material/quantity/reason/request JSON, not only disabled submit.
- [ ] Reject deferred request with existing unknown outcome, trigger existing background/version refresh, then retry interactions. Assert all direct controls remain disabled, original values/command identity retained and POST count stays1. Extend the existing definite400/409 case to assert fields become editable after pending ends.
- [ ] Run Warehouse pre-fix. Expected RED: direct controls enabled/editable during pending/unknown despite guarded submit.
- [ ] Apply `disabled={isSubmittingSupp || isOutcomeUnknown}` to Select, both Input controls and every preset button at the existing modal owner. Preserve existing mode/by-dish/submit/close/scope/recovery controls; no payload store if controlled values stay stable. Verify the custom primitives really honor disabled for keyboard and mouse.
- [ ] Run full Warehouse suite. Expected GREEN across deferred/unknown/definite rejection; no new submit, lost reason, modified attempted quantity or newly disabled safe recovery.

## T5 — strict unit-test network boundary and explicit fixtures (AC6)

- [ ] Inventory setup ordering and current `restoreAllMocks`/`unstubAllGlobals`/fetch spies before implementation. Identify every background request that currently relies on setup's catch-all; classify required explicit handler vs real product/test defect. Do not produce a blanket allowed endpoint list.
- [ ] Extend existing `ZeroFakeApiAndTestAuditGuard.test.ts` with an isolated Vitest invocation using installed tooling, bounded temporary fixture/config and real `src/test/setup.ts`. Temporary fixture calls fetch on an unmistakably invalid test URL and catches rejection. Expected parent assertions: subprocess nonzero exit with unexpected method+URL diagnostic. Add explicit-handler success/error and restore/stub lifecycle cases within this one support contract; assert no native network. Child config includes only temporary fixtures, never parent test, so no recursion. Delete owned temp files in finally, no persistent state ledger.
- [ ] Run support regression pre-fix. Expected RED: caught unexpected request currently returns successful empty response and child exits0. Distinguish this from child launch/config/dependency failure.
- [ ] Replace permissive setup with fail-closed default fetch installed at the test environment boundary. Record unhandled method/URL, reject immediately and assert no recorded unexpected traffic after React cleanup; preserve diagnostics even if caller catches rejection. Use installed Vitest lifecycle primitives so restore/stub cleanup cannot uncover native fetch. No new exported production seam or network access.
- [ ] Patch affected tests in coherent owner batches: explicitly match expected method/endpoint at fetch/apiClient boundary and return actual backend-shaped envelopes/pages/DTOs. Keep catch-all branches rejecting, rather than restoring `{success:true,data:[]}` in each file. Share fixture data only when repeated; empty, denied, partial and error cases must remain independently observable.
- [ ] Run support regression plus affected suites after each batch. Explicitly handled HTTP failures pass when expected; unexpected traffic fails even if caught. Preserve full assertions/RBAC and test count provenance; report any newly exposed unrelated production bug and stop for approval instead of weakening tests.
- [ ] Run canonical unfiltered full FE suite to completion after all fixtures are corrected. Expected0fail/0skip added, no unexpected network and terminal summary. Timeouts are NEEDS_EVIDENCE, not PASS; do not inflate limits or drop files. Re-run focused T1/T3/T4 owners under strict setup to detect their missing reads.

## Verification commands (repository root)

Use installed tooling only; `--no-restore` for .NET. These are future commands, not already obtained results. Capture stdout/stderr/exit/summary and exact artifact identity. Keep a bounded runner; stop only exact owned test parent tree on timeout, never app/runtime processes.

```sh
# Focused frontend; narrow file list per task, then all affected owners together.
npm run test:fe:unit -- src/__tests__/Warehouse.test.tsx src/__tests__/RouteNavigationIntegrity.test.tsx src/__tests__/Chef.test.tsx src/__tests__/Reconciliation.test.tsx src/__tests__/Primitives.test.tsx src/__tests__/ZeroFakeApiAndTestAuditGuard.test.ts --reporter=verbose

# Fresh backend build + focused tests, isolated artifact directory name.
dotnet test backend/IPCManagement.slnx -c Release --no-restore -m:1 -p:UseSharedCompilation=false -p:UseAppHost=false -p:ArtifactsBinOutputName=bin-mrx-review-followthrough --filter 'FullyQualifiedName~ReconciliationPreparationWorkbookTests|FullyQualifiedName~ReconciliationPreparationTests|FullyQualifiedName~ReconciliationKitchenExportTests'

# Full FE and approved backend coverage; excluded suites are NOT accepted by this run.
npm run test:fe:unit -- --reporter=verbose
dotnet test backend/IPCManagement.slnx -c Release --no-restore -m:1 -p:UseSharedCompilation=false -p:UseAppHost=false -p:ArtifactsBinOutputName=bin-mrx-review-followthrough --filter 'FullyQualifiedName!~IPCManagement.Api.Tests.Integration&Category!=EvidenceOwned&FullyQualifiedName!~RecoveryScriptContractTests'

npm run build:fe
npm run lint:fe
npm run depcruise:fe
npm run check:conformance-contracts
npm run test:conformance-contracts
git diff --check
git rev-parse HEAD
git diff --cached --name-only
```

## Integrated exit / owner handoff (AC7)

- [ ] Read actual final diff plus connected route→command, filtered scope→XLSX and DTO→rate display paths, not just passing tests. Verify original P1–P5 owners and protections remain intact.
- [ ] If existing dedicated browser harness can run without install/restart/live writes, extend its mocked scenario for same-mounted A/B Back/Forward and nonzero tiny-rate display at1440/1024 with keyboard interaction. Label fixture evidence; no owner browser/profile or real issue submission. If harness cannot run safely, mark NEEDS_EVIDENCE and ask, not reuse old screenshots.
- [ ] Load ipc-ui-review/code-review and test-audit gates; run actual existing contract owners where present. `operationalPageContracts.test.ts`/`*.contract.test.tsx` previously NOT_PRESENT: recheck and report honestly, no invented replacement/exemption. Native200%/print and authenticated persisted-write acceptance remain separate.
- [ ] After final repairs, rerun affected checks/full suite as needed; report exact failures, warnings and excluded suites. Do not describe no-rebuild DLL checks as source verification.
- [ ] Update WORK with task-only changes, RED→GREEN receipts, F1–F5 PASS/FAIL/NEEDS_EVIDENCE/BLOCKED, skill report `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact`; close IDLE while preserving release blockers.
- [ ] Return to owner with fresh evidence and remaining exact-target migration/backend/client rollout, real accepted-write loss/reload UAT, MySQL/load/SLA, native200%/print/U12 and external-consumer gates. No deploy/commit follows automatically.

## Plan self-review

Coverage: AC1–2→T1, AC3→T2, AC4→T3, AC5→T4, AC6→T5, AC7→integrated exit. All five Review Focus risks have named tests in their owner tasks. T1/T4 share Warehouse and execute sequentially; T5 must revalidate them under strict setup. T2 definitions and numeric dictionaries finalize from one union, without a DTO change; T3 changes rate formatting only, not calculation/quantity policy. No automatic stage/commit or independent review is inferred from generic skill recipes. This is parent-context document review, not independent code certification.
