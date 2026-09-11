---
phase: 17-frontend-ownership
plan: "02"
subsystem: frontend-architecture
tags: [react, redux-toolkit, auth, layout, dependency-ownership]
requires:
  - phase: 17-frontend-ownership
    provides: workflow API, cache, layout and coordination characterization contracts
provides:
  - Transport-neutral auth state, storage, role and session primitives under lib/auth
  - App-owned logout orchestration under app/session
  - App-owned MainLayout with unchanged navigation, permission, preload and DOM behavior
  - Dependency baseline reduction from 54 to 44
affects: [17-03, 17-04, 17-05, 17-08]
tech-stack:
  added: []
  patterns: [compatibility re-export, lower-layer auth primitive, app composition owner]
key-files:
  created:
    - frontend/src/lib/auth/authSlice.ts
    - frontend/src/lib/auth/authStorage.ts
    - frontend/src/lib/auth/authTypes.ts
    - frontend/src/lib/auth/roleUtils.ts
    - frontend/src/lib/auth/sessionEvents.ts
    - frontend/src/app/session/logoutSession.ts
  modified:
    - frontend/src/api/apiSlice.ts
    - frontend/src/app/store.ts
    - frontend/src/app/layout/MainLayout.tsx
    - frontend/src/routes/AppRouter.tsx
key-decisions:
  - "Keep feature/auth compatibility re-exports while transport and store depend on lib/auth directly."
  - "Commit auth and MainLayout ownership as one coherent slice because either half alone creates an invalid intermediate dependency graph."
patterns-established:
  - "Compatibility boundary: existing public auth import paths re-export the dependency-safe implementation owner."
  - "Composition boundary: app-owned layout may coordinate app state, routes and feature presentation without shared-to-app reversal."
requirements-completed: [ARCH-17]
duration: 30min
completed: 2026-07-29
---

# Phase 17 Plan 02: App, auth, store and layout ownership summary

**Auth/session primitives now flow downward and MainLayout is app-owned without public API, route, cache, permission, preload or DOM drift**

## Performance

- **Duration:** 30 min
- **Started:** 2026-07-29T03:55:00Z
- **Completed:** 2026-07-29T04:25:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Moved auth reducer/actions/selectors, storage, role and session-event primitives to `src/lib/auth` while preserving all feature-level import compatibility.
- Moved logout orchestration to `src/app/session` and kept best-effort revoke followed by local cleanup unchanged.
- Moved `MainLayout` to `src/app/layout` with only import-path changes; AppRouter route tree and layout DOM/body remain unchanged.
- Removed ten dependency violations: four `apiSlice` auth edges, one auth-to-app reverse edge and five shared-layout reverse edges.
- Verified all HIGH/CRITICAL call chains, PDG dependencies and taint surfaces; node-level evidence is in `17-GITNEXUS-CALLSITES.md`.

## Task Commit

1. **Tasks 1–2: Lower auth/session ownership and move MainLayout** — `ed8c3d0`

The two tasks share one atomic commit because committing either task alone leaves a new dependency violation or a deleted import target.

## Files Created/Modified

- `frontend/src/lib/auth/*` — dependency-safe implementations with the same state shape, action types, selectors, keys and cleanup behavior.
- `frontend/src/features/auth/{authSlice,authStorage,authTypes,roleUtils,sessionEvents}.ts` — compatibility re-exports.
- `frontend/src/app/session/logoutSession.ts` — app-level logout orchestration.
- `frontend/src/app/layout/MainLayout.tsx` — path-only layout owner move.
- `frontend/src/api/apiSlice.ts`, `frontend/src/app/store.ts`, `frontend/src/routes/AppRouter.tsx` — dependency-safe import targets.

## Verification

- Focused auth/API/layout/performance tests: **8 files, 29/29 tests passed**.
- Frontend lint: passed.
- Production build: passed.
- Dependency-cruiser: no new violations; ignored known baseline reduced **54 → 44**.
- GitNexus staged audit: **56 changed symbols, 16 files, 0 affected processes, LOW**.
- GitNexus PDG/taint: 0 taint findings; auth/logout/MainLayout control and data dependencies verified.
- Cypher: 0 old-owner files/imports for the moved logout and MainLayout paths.

## Deviations from Plan

- Tasks 1 and 2 were committed together rather than separately. The intermediate Task 1 tree introduced `components/layout → app/session`, so a separate green commit was impossible without adding a temporary compatibility reversal.

## Issues Encountered

- GitNexus connected the frontend `User` interface to backend entity accesses by shared name. Exact `context` showed four real frontend imports and six unrelated backend `ACCESSES` roots; all 137 reported nodes were classified in the callsite checklist rather than silently discarded.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 17-03 coordination type/API boundary extraction.
- Remaining dependency baseline is 44; no database, seed, reset or import operation occurred.

## Self-Check: PASSED

---
*Phase: 17-frontend-ownership*
*Completed: 2026-07-29*
