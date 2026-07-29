---
phase: 17-frontend-ownership
plan: "03"
subsystem: frontend-architecture
tags: [react, redux-toolkit, rtk-query, coordination, dependency-ownership]
requires:
  - phase: 17-frontend-ownership
    provides: characterized workflow API, cache and coordination contracts
provides:
  - One lower-owned coordination RTK Query injector under src/api
  - Stable cross-consumer coordination types under src/types
  - Lower-owned weekly-menu Redux action contracts under src/lib
  - Zero Projects imports from Coordination feature internals
  - Dependency baseline reduction from 44 to 16
affects: [17-04, 17-05, 17-08]
tech-stack:
  added: []
  patterns: [single RTK Query injector, compatibility re-export, lower action contract]
key-files:
  created:
    - frontend/src/api/coordinationApi.ts
    - frontend/src/types/coordination.ts
    - frontend/src/lib/coordinationActions.ts
  modified:
    - frontend/src/features/coordination/coordinationApi.ts
    - frontend/src/features/coordination/types.ts
    - frontend/src/features/coordination/coordinationSlice.ts
    - frontend/src/features/projects/weekly-menu/**
key-decisions:
  - "Keep exactly one coordination injector and make the former feature API/type modules compatibility re-exports."
  - "Move only cross-feature weekly-menu actions to lib; keep coordination presentation state and reducer ownership in the feature."
patterns-established:
  - "Feature consumers import transport from src/api, shared DTOs from src/types and cross-feature Redux actions from src/lib."
requirements-completed: [ARCH-17]
duration: 25min
completed: 2026-07-29
---

# Phase 17 Plan 03: Lower coordination boundary summary

**Projects no longer depends on Coordination feature internals, while the single API slice, all endpoint/hook/cache contracts, Redux action types and weekly-menu behavior remain unchanged**

## Performance

- **Duration:** 25 min
- **Completed:** 2026-07-29T04:34:02Z
- **Tasks:** 2
- **Code commits:** 2

## Accomplishments

- Moved the single coordination endpoint injector to `src/api/coordinationApi.ts` and stable DTO/query contracts to `src/types/coordination.ts`; feature paths remain compatibility re-exports with no duplicate definitions.
- Repointed every Projects production and test import away from `features/coordination` to the lower API/type/action owners.
- Preserved `coordination/setWeeklyMenu` and `coordination/updateWeeklyMenuDish` exactly while keeping reducer logic in Coordination through `extraReducers`.
- Removed all 25 Projects→Coordination violations and reduced the dependency baseline from 44 to 16.
- Preserved all 75 endpoint keys, 75 public hooks, 22 cache tags and the one shared `apiSlice`.

## Task Commits

1. **Task 1: Move coordination transport/type ownership** — `6ce48f9`
2. **Task 2: Repoint Projects and lower cross-feature actions** — `9f90c8f`

## Verification

- Coordination API/public/cache focused suite: **61/61 tests passed**.
- Projects + Coordination focused suite: **133/133 tests passed**.
- Frontend lint: passed.
- Production build: passed.
- Dependency-cruiser: no new violation; known baseline reduced **44 → 16**.
- TypeScript AST body parity: all four CRITICAL functions have identical before/after body hashes after line-ending normalization.
- GitNexus final graph: 0 Projects→Coordination feature import edges, 0 cycles, exactly one `apiSlice`, one definition per lower action.
- GitNexus staged Task 2 audit: **5 changed symbols, 22 files, 0 affected processes, LOW**.
- PDG/taint: 0 taint findings; all control/data edges remained queryable; cross-boundary traces were verified at confidence 0.85.
- Complete node-level dispositions are recorded in `17-GITNEXUS-CALLSITES.md`; Deferred is empty.

## Deviations from Plan

- Added a lower action-contract module because importing Redux actions from `coordinationSlice` would have left two Projects→Coordination feature edges. The action type strings and reducer behavior are explicitly characterized, so this removes ownership debt without behavior drift.

## Issues Encountered

- GitNexus does not connect `createAction` Const imports as symbol CALLS edges. Exact File `IMPORTS` Cypher plus action-type/reducer tests were used to verify the final caller set.
- Trace cannot traverse nested callback closures in `useWeeklyMenuImport`; exact context on `getApiErrorMessage` enumerated and verified those nested callers.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 17-04 workflow API feature endpoint extraction.
- Remaining dependency baseline is 16; no database reset, seed, import or lane mutation occurred.

## Self-Check: PASSED

---
*Phase: 17-frontend-ownership*
*Completed: 2026-07-29*
