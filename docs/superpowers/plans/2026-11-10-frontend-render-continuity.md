# Frontend Render Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Native parent implements task-by-task in this Pi session; no subagent launch or external agent CLI is authorized. Steps use checkboxes; execution status/evidence belongs only in .planning/WORK.md.

**Goal:** Repair shared render-remount and MRX toolbar continuity defects, preserve canonical pending behavior, and verify interaction/route flash with temporal browser evidence.
**Architecture:** Stabilize existing StateBoundary content ownership, then keep the existing MRX line workspace mounted with its toolbar above only the replaceable data body. Reuse current query/route/guard primitives; repair additional route owners only after a reproduced trace. Unit identity/state tests own behavior; installed Playwright owns actual frame/geometry evidence.
**Tech Stack:** Existing React19/TypeScript/Vite8, React Router7, Vitest/Testing Library, Playwright/Chrome, canonical CSS.
**Spec:** `docs/superpowers/specs/2026-11-10-frontend-render-continuity-design.md` (read fully before execution).
**Status:** Proposed; no implementation has started. User selected Native; request review of spec/plan before starting.

## Global Constraints

- Native Pi parent execution via executing-plans; no automatic subagents, external agent CLI, independent reviewer launch, commit or deployment.
- Styles remain solely in frontend/src/styles/index.css; preserve incumbent Quiet Operational design, D6>=12px/D7/T7/T8/M1.2/N6.
- No dependencies, blanket route rewrite, RTK/query migration, permanent diagnostic service, production data fixtures, backend/schema changes, deployments, force Git or automatic commits are in scope.
- Cold first load/no usable data: immediate WorkbenchSkeleton with resolved toolbar/table/split geometry; no blank intermediate canvas. Canonical cold-load CLS <=0.05.
- General CLS <=0.1; cold work-object CLS <=0.05; stable same-workspace control anchors differ <=1CSS px at fixed viewport except intentional state/viewport changes.
- No arbitrary minimum skeleton duration, delayed data commits, global fade, blanket opacity, extra per-route timers or new cache/query framework.
- Preserve DOM-MODE-1, route/action RBAC, stale-write guards, authoritative empty/error distinctions and action-level409 drafts.
- No mocked subject, test-only export, skip/allowlist, fabricated success, or weakened permission/error assertion.
- Existing authorized read-only data only; missing credentials/data/mode/preview/browser evidence is BLOCKED/NEEDS_EVIDENCE, not synthetic PASS.

## Review Focus

1. Refresh500→retry changes a React parent and loses an edited input/focus: T1 owns DOM identity/edit/focus regression.
2. Day A→empty B→A unmounts controls or mixes previous-day counts/actions: T2 owns delayed HTTP/empty-day regression.
3. Rapid date A→B→C resolves B last and wrong data briefly wins: T3 extends existing deferred-response scope owner.
4. Fast warm data and slow cold data choose different canvas/geometry: T3 owns temporal loading test; T4 owns frame measurements.
5. Keyboard/back-forward/denial changes mount behavior or is hidden by reduced-motion-only tests: T4 owns dedicated motion profiles and guarded route coverage; T5 reviews explicit gaps.

---

## Task 0 — Reconfirm source and execution safety

**Files:** Read `.planning/WORK.md`, `AGENTS.md`, `docs/DESIGN.md` §§7–8, `docs/ENGINEERING.md`, spec; inspect current `frontend/src/main.tsx`, `App.tsx`, `routes/routeRegistry.ts`, `components/workbench/{AppShell,StateBoundary,DirtyNavigation}.tsx`, production query owners. No production change.
**Interfaces:** Consumes current working-tree source/runtime, not documentation's possibly divergent architecture; produces verified affected-owner/caller inventory and baseline in WORK.

- [ ] Run `git status --short --branch`, `git rev-parse HEAD`, `git diff --cached --name-only`; preserve all inherited diffs/untracked files. Reconfirm listeners/served source without stopping anything.
- [ ] Load executing-plans, ipc-debugging, ipc-codebase-design, test-audit/ipc-test-audit; load ipc-ui-review/ipc-code-review before their gates. Announce Scoped Pre-Code UI Gate Block for shared consumers and /reconciliation before any TSX/CSS edit.
- [ ] Map all current StateBoundary callers and direct/indirect LinesBranch/toolbar callers using `rg`; confirm spec's current entry vs ARCHITECTURE divergence. If ownership has changed, update this plan before editing; do not force old paths onto new architecture.
- [ ] Run `npm run test:unit -w frontend` for fresh baseline; capture inherited failures separately. Known79/79 audit baseline and previous593/593 are historical, not this task's verification.

## Task 1 — Preserve shared content through recoverable errors

**Files:** Modify `frontend/src/components/workbench/StateBoundary.tsx`; extend `frontend/src/__tests__/Primitives.test.tsx`. CSS only if required in `frontend/src/styles/index.css`.
**Interfaces:** Keep `StateBoundary(props: StateBoundaryProps)` public API. It consumes existing hasExistingData/error/isPreviousData/children and produces one stable allowed-content parent; no new export or option.

- [ ] Extend the existing recoverable-error case: render an existing stateful input child with unchanged prop identity, edit it, focus it and record its DOM reference/scroll container position. Rerender normal→hasExistingData+error500→normal; assert the same connected input node, retained edit/focus/scroll, visible retry on error and error cleared on success. Use local test composition, never a production test seam.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx`; observe intended RED on identity/state, not missing fixture/permission. Record actual result before implementation.
- [ ] Replace success/background-error alternate child parents with one stable content region; add/remove inline explanation without moving that region. Preserve partial/previous-data semantics and genuine permission/mode/lineage/conflict boundaries. Do not make blocked content interactive for DOM-identity convenience.
- [ ] Rerun that command GREEN and existing403/409/partial/empty cases; inspect actual child references, not only text presence. Re-run shared consumer tests if markup affects them; no snapshot/class allowlist padding.

## Task 2 — Make MRX controls independent of the data body

**Files:** Modify `frontend/src/features/reconciliation/ReconciliationPage.tsx`, `branches/ReconciliationLinesBranch.tsx`, `ReconciliationLinesFilterToolbar.tsx`; extend existing cases in `frontend/src/__tests__/Reconciliation.test.tsx` and `ReconciliationMonthScope.test.tsx`. Only if necessary adjust `frontend/src/styles/index.css`; query hook changes require a separately reproduced scope defect.
**Interfaces:** Keep search/filter derivation/counts/disposition state together in existing ReconciliationLinesBranch, which becomes the stable line-workspace owner. Add `bodyState: Omit<StateBoundaryProps, 'children'>` to its real production props; it renders existing StateBoundary around DataGrid only, with toolbar outside. Page renders one LinesBranch for active lines scope keyed by actual batchId, passing current `lines={data?.lines ?? []}`, bodyState and existing dayNavigation/status callbacks even when data is absent/empty. Keyed batch change intentionally resets batch-local search/open/modal state; day change does not. Toolbar keeps its existing local open state/search callbacks; no new controller, duplicate classifier, render-prop or test seam.

- [ ] Extend the existing HTTP-backed search/month owner with real DTOs: same-batch A has lines, B is empty, return A; retain the same search trigger/status control nodes and open query, preserve selected status, render one weekday group when search closed, show zero resolved-day counts on B. Add pending assertions before releasing response, then assert final truth. Check closed-query Đang lọc, Escape/focus return and clearing without extra HTTP reads using existing search case.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx src/__tests__/ReconciliationMonthScope.test.tsx`; observe RED from unmount/state loss before changing owners.
- [ ] In Page factor the existing lines StateBoundary props into a plain typed bodyState object and pass to the always-mounted LinesBranch for that active batch. In Branch place the single toolbar before StateBoundary wrapping the data body. Keep report-tab boundaries as they are. Remove Page's standalone-day fallback; readiness remains separate. Existing branch search/count/filter/disposition logic stays together; do not duplicate it in Page. For no active batch or forbidden/mode/conflict state hide/disable sensitive controls per existing guard while retaining truthful boundary explanation; no fake empty-data success.
- [ ] Preserve batch-scoped resets, pending previous-scope guard, empty-day control access, raw-empty versus filter-empty, RBAC and bulk operations over all eligible current-day lines. If selecting a new day changes results, retain controls but never assert old-day counts are new-day counts. Mutation safety takes precedence over keeping buttons mounted.
- [ ] Rerun both files GREEN and existing bulk-disposition/readonly/error/catalogue-denial cases; record exact counts. Confirm no focus/query loss on empty→return and no duplicate date groups.

## Task 3 — Align pending presentation with canonical policy

**Files:** Review/modify only demonstrated defects in `frontend/src/components/workbench/StateBoundary.tsx`, `WorkbenchSkeleton.tsx`, `frontend/src/hooks/useDeferredSkeleton.ts`, `frontend/src/styles/index.css`. Extend `Primitives.test.tsx`, `useWorkbenchQuery.test.ts` and existing stale-date owner in `ReconciliationMonthScope.test.tsx` only for distinct contracts. Read-only sweep other current callers including WeeklyMenu/Chef/Warehouse/Reports.
**Interfaces:** Keep `useDeferredSkeleton(isLoading:boolean, delayMs?:number, minDurationMs?:number):boolean` and StateBoundary API unless current caller evidence proves an interface change needed. Initial immediate skeleton remains; no default150ms blank window and no250ms forced result delay.

- [ ] Keep Primitives G2 Frame0 skeleton assertion. Extend an existing transition case: warm pending retains the same table/input, no WorkbenchSkeleton; settled empty only after authoritative response; cold pending retains resolved work-object geometry. Use fake timers only if testing an existing timer contract, not to manufacture geometry proof.
- [ ] Extend the existing deferred-scope owner for rapid B→C and late B success/error/finally; assert only C commits, previous-data actions disabled, no transient empty between requested/resolved. If already fully covered, retain the existing test and cite it instead of duplicating.
- [ ] Run the smallest affected files and record RED for each new repair. A proposed timer/animation change without a reproduced violation is not authorized: correct misleading comments only and defer geometry diagnosis to T4.
- [ ] Apply the smallest shared-owner pending fix warranted by evidence, preserve immediate cold skeleton and canonical pagination/microfeedback. For each audited caller using destructive setData(null), distinguish true scope removal/authoritative error from refresh/filter clearing; fix only the violating path and extend that caller's existing test.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/Primitives.test.tsx src/__tests__/useWorkbenchQuery.test.ts src/__tests__/ReconciliationMonthScope.test.tsx src/__tests__/NetworkStabilityAndIdlePurity.test.tsx src/__tests__/ZeroJitterHeaderGeometry.test.tsx`. Review/remove only redundant class-only anti-flash assertions now owned by behavior tests; keep separate formatting/a11y/Frame0 contracts. No new route delay flags.

## Task 4 — Temporal browser evidence and reproduced route repairs

**Files:** Extend existing `frontend/tests/browser/loading-ux-async-consistency.spec.ts` as primary loading/continuity evidence owner; create `frontend/playwright.flash.config.ts` (dedicated attach-only config). Modify `App.tsx`, AppShell or actual affected feature owners only after a failing trace proves their defect. No blanket route/query replacement. Artifacts under a unique ignored `.artifacts/flash-continuity-<run>/` directory; never raw credentials/storageState.
**Interfaces:** Config consumes `FLASH_BASE_URL` and actual installed Chrome, has no webServer/mock-login bypass, one worker and projects `chromium-motion`/`chromium-reduced`. Suite consumes operator-confirmed `E2E_ADMIN_USERNAME`/`E2E_ADMIN_PASSWORD` from environment using actual returned user/mode; fail closed when missing. Additional actor sessions/environments needed for DEFAULT/MRX are confirmed explicitly, never generated or globally switched by the suite. No new production hooks/selectors solely for tests.

- [ ] Read the whole existing browser suite/setup before changing tests. Replace credential default, mock-token/user fallback and swallowed setup errors without printing their values; derive user/role from authenticated response. Replace fixed25-row/31-page assertions only with equivalent independent behavior using current authorized data and real page metadata. Retain/migrate other meaningful cases, do not silently delete them. Do not run current unsafe fallback setup as evidence.
- [ ] Create dedicated config with fresh isolated browser contexts, both motion profiles, confirmed URL, trace/video, no auto server start/install/mode switch. Preflight installed browser and both target builds. If unavailable, record BLOCKED and request owner action; never auto-install or restart.
- [ ] Implement one bounded in-page frame observer inside the existing suite: install before interaction, collect requestAnimationFrame box/control-connectivity/blank-state samples until authoritative UI settlement, and PerformanceObserver layout-shift entries including hadRecentInput diagnostics. Clean up at test end. Assert identity only within a stable workspace; intentional route bodies may differ.
- [ ] Exercise primary spec journeys at1440×900 and390×844 using existing authorized read-only records/known empty day; gate absence as explicit prerequisite failure, not test.skip or seed. Network500/slow/late response interception is controlled test evidence, separately labeled from unmodified live GET evidence. No POST/PUT/PATCH/DELETE business action.
- [ ] Preflight discovery: `FLASH_BASE_URL=http://127.0.0.1:5173 npm exec -w frontend -- playwright test --config=playwright.flash.config.ts --list` (Git Bash env syntax; use environment-equivalent on PowerShell). Then run same command without `--list`, with `--output=../.artifacts/flash-continuity-dev-<run>`; inspect summary and attached frame evidence, not just exit code.
- [ ] Repeat with `FLASH_BASE_URL=http://127.0.0.1:4173` and a distinct output path ONLY after operator confirms running production-preview URL/build. Otherwise production evidence is BLOCKED; do not start/reuse an unknown process. Each command must actually run discovered cases or fail, never green with zero tests.
- [ ] Fill route/view coverage rows from current routeRegistry: home, weekly-menu, meal-orders, approvals, purchasing, warehouse, chef, reconciliation, reports, admin-data, approval-rules, advanced settings, login, forbidden, plus eligible view families. Record mode/role/build/viewport/cold-warm/action/network/results; denied routes prove denial only, not their success UX. Missing eligible sessions prevent whole-route acceptance.
- [ ] For each observed route/interaction defect: capture failing frame trace → identify current owner → add smallest owner regression → patch only that owner → rerun original trace. Explicitly ruled-out hypotheses stay unchanged (StrictMode/auth ready gate/Suspense must not be removed speculatively).

## Task 5 — Native review, verification and truthful closure

**Files:** Relevant existing contract tests and `.planning/WORK.md`; documentation if a tested contract changes. No new state ledger/report outside WORK; measurement files are evidence only.
**Interfaces:** Consumes T1–T4 test/evidence results; produces per-AC PASS/FAIL/BLOCKED/NEEDS_EVIDENCE and reviewed residual risks.

- [ ] Parent reviews changed source/callers/test boundary with ipc-code-review, ipc-ui-review and test-audit; distinguish inherited changes. No automatic independent reviewer/subagent. Review six states, keyboard focus, small-screen overflow, previous-data writes, draft reconciliation and mode isolation. Emit `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact` in WORK.
- [ ] Run fresh `npm run test:unit -w frontend` (includes operationalPageContracts and *.contract cases), `npm run lint -w frontend`, `npm run build -w frontend`, `git diff --check`. Record exact tests/failures/output, not historical593/593. Backend not changed; do not rerun mutation-capable integration suites.
- [ ] Recheck Vite-served changed module URLs for expected exports and source consistency if using dev. No cache-wipe workaround or reload claim substitutes for production/browser frame proof.
- [ ] Match every AC1–AC6 to actual evidence. No PASS on browser route coverage/CLS from DOM classes, screenshots alone, skipped cases or missing preview. Classify SCOPED_CODE_VERIFIED separately from LIVE_ACCEPTANCE_VERIFIED; unresolved routes remain NEEDS_EVIDENCE/BLOCKED with exact next prerequisite.
- [ ] Update WORK with real lifecycle→IDLE, remaining evidence and no commit/push/data/process-change statement; report concise result. Stop rather than claiming triệt để if T4 is blocked. No automatic git add/commit.

## Self-review and handoff

R1→T1; R2→T2; R3→T3/T4; R4→T1–T4; R5→T4/T5; all six ACs mapped. Native method preserved; no agent workflow/reviewer assumed. Current UI and test paths inspected; optional config is explicitly new. Existing DESIGN immediate-cold requirement overrides earlier audit's tentative150ms suggestion. Browser permission/credentials/data/production-preview prerequisites remain unfulfilled at planning time. Review spec and plan before authorizing execution.
