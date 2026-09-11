---
phase: 17-frontend-ownership
plan: "01"
subsystem: testing
tags: [react, rtk-query, vitest, dependency-ownership]
requires:
  - phase: 13-state-boundary-rollout
    provides: QueryView and operational page behavior contracts
provides:
  - Exact 75-hook and 75-endpoint workflow API public-surface characterization
  - Canonical workflow cache-tag and invalidation fan-out contract
  - MainLayout navigation/preload/DOM behavior contract
  - Projects-to-coordination legacy import inventory
affects: [17-02, 17-03, 17-04, 17-05]
tech-stack:
  added: []
  patterns: [raw-source ownership contract, RTK Query public-surface characterization]
key-files:
  created:
    - frontend/src/api/workflowApi.publicSurface.test.ts
    - frontend/src/api/workflowApi.cacheContract.test.ts
    - frontend/src/app/layout/MainLayout.ownership.test.tsx
    - frontend/src/features/projects/weekly-menu/coordinationBoundary.test.ts
  modified: []
key-decisions:
  - "Characterize module exports and API identity independently from endpoint implementation file placement."
  - "Keep cache-tag arrays explicit so owner moves cannot silently narrow invalidation fan-out."
patterns-established:
  - "Public surface contract: assert exact endpoint keys, hooks, apiSlice identity and reducerPath."
  - "Ownership contract: use raw source only for dependency direction/DOM tokens and retain behavioral tests for runtime semantics."
requirements-completed: [ARCH-17]
duration: 8min
completed: 2026-07-29
---

# Phase 17 Plan 01: Characterization Safety Net Summary

**Exact RTK Query public/cache surface plus layout and cross-feature ownership contracts established before production moves**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-29T03:44:00Z
- **Completed:** 2026-07-29T03:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Locked 75 endpoint keys, 75 generated hook exports, `workflowApi === apiSlice`, and reducer path `api`.
- Locked all 22 canonical workflow tags and the overview/KPI/audit fan-out arrays.
- Locked MainLayout permission, preload, Data Saver/2G, navigation event and main-content DOM tokens.
- Captured the exact legacy projects→coordination import specifiers for later zero-boundary verification.

## Task Commits

1. **Task 1: Lock workflow API public contract** - `2a0f00d`
2. **Task 2: Lock layout and coordination boundaries** - `e00d840`

## Files Created/Modified

- `frontend/src/api/workflowApi.publicSurface.test.ts` — exact API identity, endpoint and hook surface.
- `frontend/src/api/workflowApi.cacheContract.test.ts` — canonical tag registry and invalidation fan-out.
- `frontend/src/app/layout/MainLayout.ownership.test.tsx` — path-neutral behavior tokens before the move.
- `frontend/src/features/projects/weekly-menu/coordinationBoundary.test.ts` — legacy boundary inventory.

## Decisions Made

- Public endpoint/hook registration is verified dynamically through the imported module; types remain compiler-verified.
- Cache tags are checked as semantic objects/arrays rather than a file snapshot.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial assertions used one alphabetical ordering and one equality token that differed from the baseline source; corrected the new tests and reran the full focused set. No production defect was involved.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 1 can move auth/store/layout ownership with immediate public/cache/navigation regression feedback.
- Focused 7-file suite passes 16/16; frontend lint and production build pass.

## Self-Check: PASSED

---
*Phase: 17-frontend-ownership*
*Completed: 2026-07-29*
