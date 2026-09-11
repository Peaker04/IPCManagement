---
phase: 30-closed-loop-menu-issue-reconciliation
plan: 02
subsystem: frontend-ui
status: complete
tags: [react, rtk-query, routing, operation-mode, reconciliation, accessibility]
requires:
  - phase: 30-closed-loop-menu-issue-reconciliation
    plan: 01
    provides: exact reconciliation batch/issue lineage, five-route capability and generated API contracts
provides:
  - exact five-route MATERIAL_RECONCILIATION shell with blocked Purchasing and Reports ownership
  - source-linked Weekly Menu transfer, Warehouse issue and Reconciliation readback workflow
  - compact required-versus-issued reconciliation route with human-readable fields
  - mode-specific retained Admin Data and navigation preference recovery behavior
affects: [30-03-edge-expansion-protected-evidence-closeout]
actuals:
  tokens: 64641
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - backend capability intersection governs navigation, direct routes, preloads and retained tabs
    - customer/week/batch scope is carried through route query state rather than a second persistence owner
    - hidden mode surfaces are unmounted and excluded from request/preload ownership
key-files:
  created:
    - frontend/src/features/reconciliation/ClosedLoopTransferPanel.tsx
    - frontend/src/features/reconciliation/pages/ReconciliationPage.tsx
    - frontend/src/features/reconciliation/closedLoopWorkflow.test.tsx
    - frontend/src/features/warehouse/pages/ReconciliationWarehousePage.tsx
  modified:
    - frontend/src/app/layout/MainLayout.tsx
    - frontend/src/features/projects/pages/WeeklyMenuPage.tsx
    - frontend/src/features/warehouse/pages/WarehousePage.tsx
    - frontend/src/features/system-operation/systemOperationEligibility.ts
    - frontend/src/routes/routeDataPreloaders.ts
key-decisions:
  - "MATERIAL_RECONCILIATION route, tab and preload ownership is resolved from backend capability at shared seams; DEFAULT behavior remains intact."
  - "Reconciliation is a route-owned no-tab page; Weekly Menu and Warehouse no longer embed or mutate reconciliation actuals."
  - "The known-hanging broad frontend aggregate was not rerun during recovery; bounded focused suites, lint, production build, checklist and API parity provide Wave 2 closeout evidence, with full aggregate retained for Wave 3."
patterns-established:
  - "Closed-loop URL handoff: Weekly Menu source identity -> Warehouse batch query -> Reconciliation batch query."
  - "Mode trimming unmounts excluded owners instead of hiding them with CSS."
requirements-completed: [MRX-01, MRX-02, MRX-03, MRX-04, MRX-05]
coverage:
  - id: D1
    description: Reconciliation mode exposes exactly Dashboard, Weekly Menu, Warehouse, Reconciliation and Admin Data while blocking excluded routes and preloads.
    requirement: MRX-04
    verification:
      - kind: unit
        ref: frontend/src/features/system-operation/systemOperationEligibility.test.ts
        status: pass
      - kind: unit
        ref: frontend/src/routes/protectedOperationalFamilyRegistry.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Weekly Menu transfers exact source scope to Warehouse and Warehouse issue readback opens the route-owned reconciliation projection.
    requirement: MRX-01
    verification:
      - kind: integration
        ref: frontend/src/features/reconciliation/closedLoopWorkflow.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: Reconciliation presents one compact required-versus-issued table without purchased or UUID fields.
    requirement: MRX-03
    verification:
      - kind: unit
        ref: frontend/src/features/reconciliation/closedLoopWorkflow.test.tsx
        status: pass
      - kind: unit
        ref: frontend/src/features/reconciliation/ReconciliationWorkspace.test.tsx
        status: pass
    human_judgment: false
  - id: D4
    description: Retained Weekly Menu, Warehouse and Admin Data surfaces intersect local preferences with backend authority and leave excluded owners inactive.
    requirement: MRX-05
    verification:
      - kind: integration
        ref: bounded frontend feature suites (72 files / 336 tests)
        status: pass
      - kind: other
        ref: npm run check:frontend-checklist
        status: pass
    human_judgment: false
duration: 27 min
completed: 2026-08-28
---

# Phase 30 Plan 02: Focused Closed-Loop Frontend Surfaces Summary

**A capability-governed five-route shell now carries one menu source through Warehouse issue to a compact, read-only required-versus-issued reconciliation page while excluded owners remain unmounted.**

## Performance

- **Duration:** 27 min across the original executor and bounded recovery closeout
- **Started:** 2026-08-28T16:33:08+07:00
- **Completed:** 2026-08-28T17:00:00+07:00
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments

- Added `ROUTES.RECONCILIATION`, lazy route ownership and mode-aware direct-route/preload guards so Purchasing and Reports remain absent in closed-loop mode.
- Connected Weekly Menu transfer, source-scoped Warehouse issue and reconciliation readback using stable batch query state and Wave 1 endpoints.
- Replaced embedded page-bottom reconciliation integrations with one no-tab route and a compact human-readable required/issued/difference/verdict table.
- Trimmed Admin Data and Advanced Settings through backend eligibility intersection, including a recovery state when local preferences hide every eligible tab.
- Registered the new route/query owners in source-ownership and protected-family checks.

## Task Commits

1. **Task 1 RED:** `ec85b6ed` — add failing closed-loop frontend tracer.
2. **Task 1 GREEN:** `00721348` — connect route, source handoff, Warehouse issue and reconciliation readback.
3. **Task 2 GREEN:** `30d214a6` — trim retained mode surfaces and lock query ownership.

## Files Created/Modified

- `frontend/src/features/reconciliation/pages/ReconciliationPage.tsx` — route-owned batch selector and compact projection.
- `frontend/src/features/reconciliation/ClosedLoopTransferPanel.tsx` — explicit transfer-to-Warehouse action.
- `frontend/src/features/warehouse/pages/ReconciliationWarehousePage.tsx` — selected-source demand, issue and linked history owner.
- `frontend/src/features/system-operation/systemOperationEligibility.ts` — shared route/tab capability intersection.
- `frontend/src/routes/routeDataPreloaders.ts` — mode-aware preload exclusion.
- `frontend/src/app/pages/admin-data/useAdminDataPageModel.ts` — retained Admin Data eligibility and recovery state.

## Decisions Made

- Backend capability remains the authority for mode availability; local navigation/tab preferences can narrow but never re-enable excluded identities.
- Batch/customer/week identity is passed through URL query state, avoiding duplicate storage authority.
- DEFAULT page composition remains unchanged; mode-specific branches unmount excluded owners rather than cosmetically hiding them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Recovered verification after a previous broad command timeout**
- **Found during:** Wave 2 closeout recovery
- **Issue:** The prior executor timed out during a broad Bash-driven aggregate command, leaving documentation/state incomplete.
- **Fix:** Preserved existing commits and unrelated `nul`, inspected status/diffs first, then ran bounded focused suites and independent lint/build/contract/checklist gates.
- **Files modified:** closeout documentation only
- **Verification:** 72 focused test files / 336 tests passed; lint, production build, API parity, checklist and diff hygiene passed.
- **Committed in:** final Wave 2 closeout commit

**Total deviations:** 1 blocking recovery deviation. **Impact:** no production behavior was changed during recovery and no database command was run.

## Issues Encountered

- The known-hanging broad frontend aggregate was deliberately not rerun. Recovery instead ran two bounded feature groups plus a focused tracer group. Those runs total 72 passing files and 336 passing tests, but they are not a substitute claim for the repository-wide frontend aggregate.
- API contract generation completed with 0 errors and 26 pre-existing nullable-reference warnings in backend source outside this plan.

## Known Stubs

None. Empty-array defaults in RTK Query hooks and test fixture reset values are intentional loading/test behavior, not shipped placeholders.

## Front-End Checklist Disposition

- **Lane:** Graph-free for recovery closeout documentation; implementation commits were already complete.
- **Critical/high findings:** none evidenced in touched surfaces after semantic tests, ESLint, TypeScript/Vite production build and the canonical checklist integration gate.
- Browser/visual judgment remains reserved for Plan 30-03 as required by the phase context.

## Verification

- Focused closed-loop feature suite: 40 files / 175 tests PASS.
- Admin/projects/route ownership suite: 32 files / 161 tests PASS.
- Focused tracer and eligibility subset: 4 files / 14 tests PASS (overlaps the two groups above; not added to the unique total).
- Unique bounded recovery total: 72 files / 336 tests PASS.
- `npm run lint -w frontend`: PASS.
- `npm run build -w frontend`: PASS.
- `npm run check:api-contract`: PASS; generated contract diff remained clean.
- `npm run check:frontend-checklist`: PASS.
- `git diff --check`: PASS.
- Full broad frontend aggregate: NOT RERUN because the prior command is known to hang; Wave 3 retains the repository-wide regression obligation.
- Protected/operational database commands: NOT RUN.

## User Setup Required

None.

## Next Phase Readiness

- Ready for `30-03-PLAN.md` edge expansion, repository-wide regression, protected preflight/checkpoint and headed-browser evidence.
- Residual risk is limited to the unrerun broad frontend aggregate; all Wave 2 touched seams passed bounded validation.

## Self-Check: PASSED

- Summary exists on disk.
- All three Wave 2 commits exist.
- All 27 implementation paths are committed.
- No staged files remain; pre-existing untracked `nul` remains untouched.

---
*Phase: 30-closed-loop-menu-issue-reconciliation*
*Completed: 2026-08-28*
