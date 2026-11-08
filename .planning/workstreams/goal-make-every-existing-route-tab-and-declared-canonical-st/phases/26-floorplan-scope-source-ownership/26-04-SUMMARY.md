---
phase: 26-floorplan-scope-source-ownership
plan: 04
subsystem: ui
tags: [react, opaque-dom-metadata, source-ownership, gitnexus-full-analysis]
requires:
  - phase: 26-02
    provides: [floorplan declarations and capability contracts]
  - phase: 26-03
    provides: [opaque ownership targets and source manifest]
provides:
  - "Opaque owner/floorplan/region tuples on every protected/public route root."
  - "Exact nested-state tuples on every current ViewSwitcher tablist and tab."
  - "Nearest-route ownership inheritance for shared OperationalFrame regions."
affects: [26-05, 27-capture-geometry]
tech-stack:
  added: []
  patterns: ["Test-owned source knowledge joined to opaque production DOM metadata"]
key-files:
  created: [frontend/tests/uiOwnershipInstrumentationContract.test.tsx]
  modified: [frontend/src/app/layout/MainLayout.tsx, frontend/src/components/common/OperationalFrame.tsx, frontend/src/components/common/ViewSwitcher.tsx, frontend/src/features/auth/pages/LoginPage.tsx, frontend/src/features/auth/pages/ForbiddenPage.tsx]
key-decisions:
  - "Route ownership flows through React context without a DOM wrapper; OperationalFrame inherits only the route region unless explicitly overridden."
  - "ViewSwitcher bindings remain a bounded exact ariaLabel plus tab-id lookup containing opaque tokens only."
requirements-completed: [SOURCE-01]
duration: 35 min
completed: 2026-08-02
---

# Phase 26 Plan 04: Opaque Ownership Instrumentation Summary

**Every canonical route and nested view now emits an exact source-blind owner/floorplan/region tuple on existing DOM boundaries**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-02T14:52:00+07:00
- **Completed:** 2026-08-02T15:27:00+07:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Instrumented all protected route roots plus login and forbidden outliers with exact opaque tuples.
- Instrumented all current `ViewSwitcher` nested states and controls without changing roles, keyboard behavior, labels, classes, or navigation.
- Added exact-set route/tab closure, source-blindness, optional-props compatibility, region inheritance, and inert-render regressions.
- Completed Full-analysis and HIGH-rigor review with a final refreshed explicit-branch detect and no Deferred item.

## Task Commits

1. **Task 1: Complete Full analysis and instrument protected/public route roots** - `0c4e306` (feat; cohesive implementation commit)
2. **Task 2: Instrument shared region/tab boundaries and reconcile regressions** - `0c4e306` (feat; cohesive implementation commit)

## Files Created/Modified

- `frontend/src/app/layout/MainLayout.tsx` - Route tuple lookup, inert root attributes, and ownership context provider.
- `frontend/src/components/common/OperationalFrame.tsx` - Typed optional ownership contract and inherited region boundary.
- `frontend/src/components/common/ViewSwitcher.tsx` - Exact current-view bindings and active/per-tab attributes.
- `frontend/src/features/auth/pages/LoginPage.tsx` - Public login tuple on the existing auth shell.
- `frontend/src/features/auth/pages/ForbiddenPage.tsx` - Forbidden tuple on the existing native content node.
- `frontend/tests/uiOwnershipInstrumentationContract.test.tsx` - Exact bidirectional joins, mutants, leakage fences, and render regressions.

## Decisions Made

- Used React context only to carry the already-selected opaque route tuple; it adds no DOM node, effect, subscription, state transition, or visible behavior.
- Preserved exact-line permanent gates by placing bounded metadata declarations after the scanned behavior-bearing regions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prevented mixed route/region tuples**
- **Found during:** HIGH-risk diff review after the first green root gate.
- **Issue:** A universal `uir-i` frame fallback would override non-dashboard route regions and create an invalid component-wise join.
- **Fix:** Passed the selected opaque route tuple through a wrapper-free React context and inherited its region in `OperationalFrame`.
- **Files modified:** `MainLayout.tsx`, `OperationalFrame.tsx`, instrumentation contract test.
- **Verification:** focused 29/29, full frontend 710/710, final explicit-branch detect, lint and build.
- **Committed in:** `0c4e306`.

**2. [Rule 3 - Blocking] Preserved exact-line PF/button baselines**
- **Found during:** root verification.
- **Issue:** New metadata declarations shifted line-number fingerprints in permanent source inventories.
- **Fix:** Moved bounded declarations below scanned regions and compacted pre-button metadata without changing behavior.
- **Files modified:** `MainLayout.tsx`, `ViewSwitcher.tsx`.
- **Verification:** UI-completeness 87/87, button convergence green, root verification green.
- **Committed in:** `0c4e306`.

**Total deviations:** 2 auto-fixed (1 correctness bug, 1 blocking baseline compatibility issue). **Impact:** Both fixes preserve the authorized behavior-neutral instrumentation scope.

## Issues Encountered

- The plan's whole-file secret/stub regex matched three pre-existing LoginPage lines; an added-line-only scan passed and no new secret, placeholder, TODO, or hardcoded credential was introduced.

## GitNexus Full-Analysis Review

- **Repo/branch:** `IPCManagement` / `feature/workflow-b17-b18`
- **Pre-edit:** seven required symbols/contracts analyzed upstream and downstream with `includeTests=true`; all pages complete, confidence at least 0.85, Deferred empty. Raw risk reached CRITICAL for shared graph hubs; effective risk HIGH because the diff is inert metadata with no auth/policy/API/control/data-flow change.
- **Final detect:** 17 changed symbols, 5 indexed production files, 3 affected processes, MEDIUM; no partial/truncated result or low-confidence node.

| Symbol/group | Callers/processes found | Handling | Deferred |
|---|---|---|---|
| MainLayout, routeOwnership, ownershipForRoute | AppRouter plus route composition; no final process | Exact route closure, layout ownership regression, full suite | None |
| OperationalFrame, OperationalFrameProps, UiOwnershipContext, UiOwnershipMarker | 10 direct page callers pre-edit; final ApprovalRulesPage, ReportsPage, AdminDataPage processes | Optional-prop compatibility, nearest-route region test, all callers covered by full suite | None |
| ViewSwitcher, ViewSwitcherProps, ViewTab, viewOwnershipBindings, moveFocus | 10 direct callers pre-edit; no final process | Exact 38-binding closure, click/keyboard/roving-tabindex regressions, full suite | None |
| LoginPage | Auth outlier; no affected final process | Existing feedback/auth regression and root tuple assertion | None |
| ForbiddenPage | Route outlier; no affected final process | Existing native-node tuple and exact route closure | None |

**Review recommendation:** APPROVE. No unhandled caller, process, contract break, or business/rendered behavior change remains.

## Verification

- Focused prerequisite/instrumentation set: 56/56.
- Root verification: Application 49/49; API 705 pass + 1 intentional skip; frontend 122 files / 710 tests.
- UI-completeness 87/87; ESLint, dependency-cruiser (373 modules / 1,346 dependencies), backend build, and frontend production build pass.
- `git diff --check` and added-line secret/stub scan pass.
- No browser/runtime/database operation occurred; `ipc_lane1` was not mutated.

## User Setup Required

None - no external configuration required.

## Next Phase Readiness

Ready for 26-05 to prove canonical rendered DOM and emitted bundle/source-map leakage closure.

## Self-Check: PASSED

All SOURCE-01 criteria, declared paths, Full-analysis evidence, final review, and regression gates pass with Deferred empty.

---
*Phase: 26-floorplan-scope-source-ownership*
*Completed: 2026-08-02*
