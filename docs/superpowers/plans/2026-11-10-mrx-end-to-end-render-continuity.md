# MRX end-to-end render continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Implement natively in the current authorized workspace. No subagent/reviewer launch or automatic commit.

**Goal:** Resolve all seven deep-audit findings and establish truthful per-view MRX acceptance.
**Architecture:** Keep existing data owners; distinguish exact report identity from retained presentation, same-schema scope changes from schema changes, and cold readiness from refresh. Repair existing boundaries and modal frames without adding a generic query layer.
**Tech Stack:** React/TypeScript, existing Vitest/Testing Library and Playwright, index.css.
**Spec:** docs/superpowers/specs/2026-11-10-mrx-end-to-end-render-continuity.md

## Global constraints
- WORK.md sole execution-state ledger; preserve all inherited dirty work and staged index.
- Native parent only. No install/DB mutation/seeding/service restart/mode switch/commit/deploy.
- Keep mode/RBAC/lineage/write guards and dirty navigation; no synthetic live evidence.
- Immediate geometry-matched cold skeleton; no delayed commits/fades/minimum pending durations.
- Styling only index.css; reuse Modal/DataGrid/LocalFindBar/StateBoundary/WorkbenchSkeleton. Scoped UI gate required before TSX/CSS edits.

## Review focus
1. Same-key refresh500 versus foreign-key403: preserve workspace only where safe (T1).
2. Slow source A→B→C/editScope failure: correct readiness, latest response and retry (T2).
3. Wrong-schema prior report and late inspection payload: target columns immediately, no foreign draft (T3).
4. Long dialog metadata, large tables and empty/error transitions: stable bounded frame and one scroll owner (T4/T5).
5. Actor-specific/motion/mobile journeys: no fake green from table-count/class assertions or route discovery (T6/T7).

## T0 Intake, contracts and baseline
**Files:** WORK.md; current spec; docs/DESIGN.md; docs/domain/material-reconciliation.md; existing frontend routeRegistry.ts, package.json and playwright.flash.config.ts.
- [ ] Record fresh status/HEAD/staged names, diff relevant owners against current inherited baseline; do not attribute all dirty changes to this task.
- [ ] Load ipc-debugging, ipc-codebase-design, ipc-test-audit/test-audit, ipc-ui-review/ipc-code-review, executing-plans and verification-before-completion. Read existing callers and complete owner tests before editing.
- [ ] Record actor-permission/state/view matrix for AC8 in WORK, including shared admin leaves and dialogs. Confirm missing browser prerequisites by presence only.
- [ ] Run focused baseline: `npm run test:unit -w frontend -- src/__tests__/Reconciliation.test.tsx src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx src/__tests__/Warehouse.test.tsx src/__tests__/WorkspaceFrame.test.tsx`. Save real output under .artifacts; no PASS from history.

## T1 Report pending and same-scope recovery — AC1/AC2
**Owners:** frontend/src/features/reconciliation/useReconciliationReports.ts; ReconciliationReportTables.tsx; frontend/src/components/workbench/LocalizedBoundary.tsx; tests Reconciliation.test.tsx, WorkspaceFrame.test.tsx.
**Interfaces:** Hook exposes exact-data identity and same-scope recoverable state to its production caller (typed props, not test-only exports). Boundary retains one stable children parent; no broad error bypass.
- [ ] Extend existing HTTP report owner: edit search, capture table/input/focus/scroll; delayed refresh of same key then500 then retry. Assert same nodes/query, explicit error and no dimming. Existing different-batch500/403 test must continue blocking foreign/sensitive rows.
- [ ] Run focused RED; verify failure is intended remount/brightness, not transport setup.
- [ ] Remove whole-report opacity branch. Keep inert/progress. Pass same-key retained-data authority explicitly; boundary shows inline retry only for approved recoverable same-scope reads. Preserve cold skeleton and denial/mode/conflict semantics; enumerate all LocalizedBoundary callers (currently report production owner plus tests).
- [ ] Run GREEN plus Primitives/WorkspaceFrame consumers. Do not make existing report-failure expectations weaker to pass.

## T2 Source matrix readiness — AC3
**Owners:** frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx; hooks/useMrxSourceEdit.ts; existing MrxSourceEdit.test.tsx and WeeklyMenu.test.tsx.
**Interfaces:** Existing editScope/isLoading/isTransitioningScope/error remain authoritative; consume them in body readiness. Avoid changing query ownership if presentation-only repair suffices.
- [ ] Extend real network-boundary source test: resolve weekly source, defer editScope and dish catalog separately, then success/error/retry. Assert matrix-shaped pending surface, no intermediate centered loading message, latest selected source and retained warm draft.
- [ ] Observe RED before repair. Identify whether catalog is needed for current matrix display; keep read-only data available when safe rather than globally delaying it.
- [ ] Keep correct matrix skeleton until required scope ready; failed dependency exposes retry instead of spinner. Do not remount valid warm editor or reset its draft for background reads.
- [ ] GREEN source suites and existing dirty-navigation/locked-day tests.

## T3 Target-schema tabs — AC4
**Owners:** ReconciliationReportTables.tsx; useReconciliationReports.ts; reconciliation/branches/ReconciliationAuditBranch.tsx; weekly-menu/MrxQuantityInspectionPage.tsx; hooks/useMrxQuantityInspection.ts.
**Tests:** Existing Reconciliation.test.tsx cross-tab N2 case, audit cases and WeeklyMenu.test.tsx inspection owner.
**Interfaces:** Retained payload is eligible only if view/subtab schema matches current target; exact scope and current schema are separate facts. Reuse existing unions and loadingGeometry, no universal schema engine.
- [ ] Rewrite N2 to assert target transactions header/columns/surface while response is delayed, not continued variances content. Extend materials→plans and audit warehouse→source cases with distinct DTO fields and reverse/late response.
- [ ] Run RED for target-schema assertions. Retain same-view page/customer latest-response tests as independent contracts.
- [ ] Remove wrong-tab fallback rendering. Match target toolbar/column geometry immediately; use target skeleton on cold schema while same-schema requests retain node/query. Audit pending fallback must not swap labels from previous subtab.
- [ ] Run GREEN Reconciliation/WeeklyMenu and table contracts. Verify export remains disabled until exact current data.

## T4 Issue detail frame — AC5
**Owner:** frontend/src/components/workbench/ReconciliationIssueDetailModal.tsx; existing Warehouse.test.tsx modal identity/request tests; index.css only if required.
**Interfaces:** Same isOpen/issueId/onClose API, existing Modal; follow MrxBatchDishesModal bounded-height/scroll pattern.
- [ ] Extend existing network modal test for delayed read→success→retry/error and changing issueId; assert no stale issue and close/focus behavior. Geometry assertions belong to browser, not utility-class checks.
- [ ] Bound frame to viewport and keep one scroll owner; render loading/error within reserved body. Do not change shared Modal for this one caller.
- [ ] GREEN Warehouse/Primitives; T6 measures actual dialog rectangle for long text and row sets.

## T5 Import history frame — AC6
**Owners:** frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx; existing WeeklyMenu.test.tsx history loading/error/snapshot cases; index.css if needed.
**Interfaces:** Existing historyState customer identity and snapshotRequest generation remain; no mutation/API changes.
- [ ] Extend existing history test: delayed customer A then B, assert unknown count placeholder and persistent history columns, correct empty/error/retry, ignored old snapshot; keep rollback and dirty close regressions.
- [ ] Run RED for persistent header/count semantics.
- [ ] Keep header/body slots during history loading/error/empty; bound scrolling. Use placeholder until count known, no fabricated zero. Preserve upload form/files across tabs and existing permissions.
- [ ] GREEN WeeklyMenu/MrxSourceEdit. Live import/rollback is not authorized; test write transitions only at HTTP boundary.

## T6 Temporal browser coverage — AC7/AC8
**Owners:** frontend/tests/browser/loading-ux-async-consistency.spec.ts; frontend/playwright.flash.config.ts. Extend existing owner, no parallel certification framework.
- [ ] Read actual registry leaves and build an explicit per-view interaction table in WORK. For every eligible leaf record applicable entry/return/back-forward/scope/filter/page/empty/error actions; mark unavailable data/permissions as BLOCKED, never skip/pad exemptions.
- [ ] Extend suite with separate report same-view refresh/error and schema-switch journeys, source two-stage readiness, warehouse search-empty-day, cooking shift/filter, preparation customer selection, history pagination and relevant detail/import-history dialog checks. Shared admin leaves get their existing read/filter journeys. Controlled network tests may prove rendering but are labeled controlled, not live business evidence.
- [ ] Capture header/toolbar/table anchors, dialog bounds, opacity, focus/node/scroll before action through response and two frames; bounded4096 samples. Assert no unexpected blank interval; <=1CSSpx same-workspace movement, CLS thresholds per spec; do not compare unrelated target schemas as equal-height screens.
- [ ] Standalone tsc from root: `./node_modules/.bin/tsc --ignoreConfig --noEmit --target es2022 --module esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --types node --typeRoots frontend/node_modules/@types frontend/tests/browser/loading-ux-async-consistency.spec.ts frontend/playwright.flash.config.ts`.
- [ ] Discover cases using confirmed FLASH_BASE_URL; discovery is not PASS. Execute only after confirmed E2E_ADMIN_USERNAME/PASSWORD, FLASH_API_URL, existing scope/empty-day data, actor/mode and DEV/preview build URLs. Dedicated contexts, no secret-bearing traces. Run both viewport/motion profiles on both builds; attach redacted frame evidence and per-view rulings.
- [ ] If prerequisites absent: record exact missing variables/data and leave AC8 BLOCKED. Do not install/start services or manufacture data to obtain PASS.

## T7 Integration, review and truthful closure
- [ ] `npm run test:unit -w frontend` (includes operational/contract suites); `npm run lint -w frontend`; `npm run build -w frontend`; browser types; `git diff --check`. Save actual output, do not overwrite failing evidence with claimed success.
- [ ] Direct scoped code/UI/test audit: same-key versus foreign-key errors, mode/RBAC, stale generations, write guards, draft/focus cleanup, all changed callers and inherited differences. No automatic independent agent.
- [ ] Map each finding1–7 to owner fix + failing regression + final gate + browser evidence. AC8 matrix must include every listed leaf/dialog or explicit BLOCKED reason.
- [ ] Report `Skill; Task type; Baseline missed; Skill added; Was it correct; Noise; Decision impact` in WORK; return IDLE. Code completion and live acceptance statuses stay separate. No full no-flash or 'triệt để' claim while any acceptance row lacks evidence.

## Coverage self-review
Findings1/2→T1; finding3→T2; finding4→T3; finding5→T4; finding6→T5; finding7→T6/T7. AC8 broader MRX matrix→T0/T6/T7. No unrelated refactor/dependency/BE scope. This plan is proposed; execution begins after operator review using native parent method.
