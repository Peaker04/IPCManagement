# MRX New-Menu Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Direct parent execution; delegation is not authorized.

**Goal:** Make new-menu import reachable from Dashboard and an existing MRX batch, then show the successfully imported customer/week without weakening old-batch locks.

**Architecture:** Reuse WeeklyMenuImportModal, MrxBatchWorkbench, MrxBatchHeaderBranch and useMrxBatchWorkspace. Dashboard carries URL intent; the workbench owns one dialog lifecycle; the existing hook owns selected scope, queries and preview invalidation. No parallel wizard/store/API or shared-query rewrite.

**Tech Stack:** Existing React, TypeScript, React Router, Vitest/Testing Library, Vite.

**Spec:** docs/superpowers/specs/2026-11-06-mrx-new-menu-entry-design.md

## Global Constraints
- DEFAULT != MATERIAL_RECONCILIATION; preserve customer × week source grain and existing permissions/approval/locked-date/completed guards.
- Existing preview/commit is the only import write boundary; importing does not automatically create a reconciliation batch.
- Use existing styling tokens/primitives, one primary action and one blocking modal; preserve dirty input and truthful loading/error/permission/partial/write-reconciliation states.
- No install, BE/schema/data mutation, browser credential use, delegation or commit. Preserve inherited tree.
- WORK is the only live task checklist; do not use this static plan as another status owner.

## Review Focus
1. Completed old scope must not hide new-menu entry or become the default destructive target; Task 1/2 test old COMPLETED state and explicit target week.
2. URL intent/reload/denied actor must not bypass guards, reopen after cancel, or issue a write; Task 2 tests real router and network boundaries.
3. New scope with old cached/delayed data must not show actionable old lines or restore old session scope; Task 1 tests delayed old response and query navigation.
4. Selected file/preview must survive a cancelled discard, disappear after confirmed close, and block close while pending; Task 1 extends actual modal behavior tests.
5. Failed/locked import, DEFAULT import and history rollback must retain distinct semantics; Task 1/2 extend retained error/lock/history cases, not duplicate a state matrix.

---

### Task 1: Correct the existing import lifecycle and scope handoff

**Files:**
- Modify: frontend/src/features/weekly-menu/WeeklyMenuImportModal.tsx
- Modify: frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx
- Modify: frontend/src/features/weekly-menu/hooks/useMrxBatchWorkspace.ts
- Modify only if required for callback compatibility: frontend/src/features/weekly-menu/WeeklyMenuPage.tsx
- Tests: frontend/src/__tests__/WeeklyMenu.test.tsx, frontend/src/__tests__/MrxSourceEdit.test.tsx

**Interfaces:**
- `onImportSuccess` becomes `(scope?: { customerId: string; weekStartDate: string }) => void`: successful commit supplies the exact customer/ISO week submitted; rollback calls without scope. Existing refresh-only callers may ignore the optional argument.
- Existing hook consumes explicit URL customerId/weekStartDate before fallback state; existing returned setters stay compatible with the workbench. It exposes a single real-caller success handler if coordination cannot stay within current callbacks, not a new manager/abstraction.
- Workbench conditionally mounts the existing modal; new import starts with an explicitly unset target week, while reimport uses current source scope. Do not reset user inputs on ordinary parent rerenders.

- [ ] Extend existing owner tests: open import, select a different customer/week, upload/preview/commit through real UI and mocked HTTP/API boundary; assert submitted scope and subsequent source read/visible selector scope. Assert failed commit preserves the old selection and preview, with no batch-create call.
- [ ] Extend actual modal close/reopen coverage for file dirtiness, safe footer/Escape close and pending guard; reuse shared Modal safe-close and dirty registry. Keep existing locked-day/approval/history cases.
- [ ] Add/extend one MRX same-route scope regression with a delayed prior-scope response; after new selection assert the old batch is not actionable and cannot overwrite current session scope. Fixtures must follow real C# DTOs; no component/hook mocks or production test seams.
- [ ] Run `npm run test:unit -w frontend -- src/__tests__/WeeklyMenu.test.tsx src/__tests__/MrxSourceEdit.test.tsx --maxWorkers=1`; confirm intended pre-fix assertions fail, not syntax/setup errors.
- [ ] Implement optional import-result scope notification, owner-local URL/scope handoff and preview invalidation. Guard old hydration and side effects at the MRX owner; preserve generic useWorkbenchQuery semantics. Session updates occur only for current scope, not stale query completion.
- [ ] Implement on-demand dialog lifecycle and dirty safe close using current Modal footer function API. Do not swallow successful-commit identity in a generic refresh or navigate on rollback/failure.
- [ ] Rerun focused tests; all new regressions and existing import/reimport/history/lock cases PASS. No stage/commit.

### Task 2: Connect the two authorized entry points

**Files:**
- Modify: frontend/src/features/dashboard/ReconciliationDashboardPage.tsx
- Modify: frontend/src/features/weekly-menu/MrxBatchWorkbench.tsx
- Modify: frontend/src/features/weekly-menu/branches/MrxBatchHeaderBranch.tsx
- Tests: frontend/src/__tests__/MrxDashboard.test.tsx, frontend/src/__tests__/WeeklyMenu.test.tsx

**Interfaces:**
- Dashboard destination: `/weekly-menu?view=mrx-batch&action=import`.
- Existing optional header `onOpenImport?: () => void` renders `Nhập thực đơn mới` only when the workbench supplies an authorized callback. Preserve current primaryAction hierarchy and responsive action grouping; no blank reserved slot.
- Workbench consumes `action=import`, shares the same guarded open handler with header, and removes only the intent parameter on close/success. Invalid/denied intent must not render a modal or cause preview/commit.

- [ ] Extend existing Dashboard navigation regression to the real WeeklyMenuPage route, with an old COMPLETED scope; assert click opens actual importer and does not merely land on old content. Ordinary pipeline navigation still inspects scope without auto-opening.
- [ ] Extend existing completed-batch test: new-menu entry exists for source-authoring actor, existing old-source editing/reimport stays absent; importer requires explicit target week. Extend one denied-actor case and existing locked-conflict case rather than a permissions matrix.
- [ ] Run the three focused suites and record intended RED before changing entry points.
- [ ] Wire Dashboard intent and existing header callback, keeping role/permission/mode enforcement independent from `canEditSource` for the current completed batch. URL and header must share the same admission policy.
- [ ] On cancellation keep prior customer/week/batch; strip only `action`, preventing reopening on refresh. No duplicated dialog or backend mutation on navigation.
- [ ] Rerun focused suites; PASS without weakening expectations, guards or fixtures. Review all real callers and remove only superseded unused props introduced by this flow if no live caller remains. No unrelated cleanup/commit.

### Task 3: Verification and owner handoff

- [ ] Announce and record scoped pre-code UI gate before TSX edits: / and /weekly-menu?view=mrx-batch; existing OperationalFrame; MRX; actual route/action guards; six states; existing Button/WorkspaceHeader/Modal; D6/D7/T7/T8/M1.2/N6 unchanged.
- [ ] Run scoped ESLint, `npm run build -w frontend`, `npm run depcruise -w frontend`, and full FE unit suite `npm run test:fe:unit`. If exact operationalPageContracts/*.contract.test.tsx are still absent, report that and run actual existing conformance/state owners; do not create fake replacement suites.
- [ ] Run `node scripts/check-conformance-contracts.mjs`, scoped Impeccable detector and `git diff --check`. Review any unchanged bundle warnings/inherited failures separately.
- [ ] Source/code/UI review of final delta: no DEFAULT regression, permission weakening, old-batch write, stale scope, duplicate request or dirty-close bypass. Compare own edits separately from inherited diff.
- [ ] Confirm dev server serves current changed modules without logging in or writing business data. Owner manually verifies create-from-Dashboard, create-from-completed, new-week scope, cancellation and locked-target feedback.
- [ ] Update WORK with exact results, skill report and IDLE; distinguish local PASS from live UAT NEEDS_EVIDENCE. Leave requested FE/BE running.

## Plan self-review
All five acceptance criteria map to Task 1 or 2; Task 3 provides bounded verification and live-evidence limits. No new API/config/generated contract or generic query mechanism. Shared modal behavior is reused, not reimplemented. Import success and history rollback are intentionally separate event meanings. This is the approved flow's implementation plan; product code is not changed until owner reviews this plan.
