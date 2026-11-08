---
phase: 17-frontend-ownership
plan: "04"
subsystem: frontend-architecture
tags: [react, redux-toolkit, rtk-query, api-ownership, compatibility-barrel]
requires:
  - phase: 17-frontend-ownership
    provides: characterized workflow API/cache contracts and lower coordination ownership
provides:
  - Seven owner-scoped workflow endpoint injectors sharing one apiSlice
  - Neutral workflow-document API and shared workflow type owner
  - Compatibility-only workflowApi barrel preserving 75 endpoint keys and hooks
  - Strict dependency rule limiting the compatibility barrel to enumerated API owners
affects: [17-05, 17-06, 17-07, 17-08]
tech-stack:
  added: []
  patterns: [single RTK Query slice, owner-scoped injectors, compatibility barrel, exact endpoint registration]
key-files:
  created:
    - frontend/src/api/workflowApiTypes.ts
    - frontend/src/api/workflowDocumentsApi.ts
    - frontend/src/features/dashboard/dashboardApi.ts
    - frontend/src/features/reports/reportsApi.ts
    - frontend/src/features/purchasing/purchasingApi.ts
    - frontend/src/features/warehouse/warehouseApi.ts
    - frontend/src/features/chef/chefApi.ts
    - frontend/src/features/approvals/approvalsApi.ts
    - frontend/src/features/admin/adminWorkflowApi.ts
  modified:
    - frontend/src/api/workflowApi.ts
    - frontend/src/features/admin/adminApi.ts
    - frontend/.dependency-cruiser.cjs
    - frontend/src/shared/api/contracts/openapi.json
    - frontend/src/shared/api/contracts/schema.ts
key-decisions:
  - "Keep workflowApi as a deterministic compatibility barrel over one apiSlice and seven enumerated owner injectors."
  - "Keep employee administration endpoints outside workflow registration; expose approval-rule workflow endpoints through adminWorkflowApi and adminApi re-exports."
  - "Permit only the exact compatibility-barrel-to-owner imports through a milestone-v1.3 dependency rule instead of expanding the known violation baseline."
patterns-established:
  - "Endpoint implementations live with feature owners while legacy consumers use a stable compatibility barrel."
  - "All injectors extend src/api/apiSlice; no feature creates or overrides an RTK Query API slice."
requirements-completed: [ARCH-17]
duration: 39min
completed: 2026-07-29
---

# Phase 17 Plan 04: Split workflow endpoints by owner summary

**Seventy-five workflow endpoints and hooks now resolve through owner-scoped injectors on one RTK Query slice, with the legacy workflowApi reduced to a deterministic compatibility barrel**

## Performance

- **Duration:** 39 min
- **Started:** approximately 2026-07-29T04:37:00Z
- **Completed:** 2026-07-29T05:16:12Z
- **Tasks:** 4
- **Files modified:** 14

## Accomplishments

- Extracted reports, dashboard, documents, purchasing, warehouse, chef, approvals and admin workflow endpoint implementations into explicit owners.
- Preserved exactly 75 endpoint keys, 75 generated hooks, all request arguments, response transforms, cache tags, invalidation behavior and compatibility imports.
- Kept exactly one production `createApi(` call, one `reducerPath: 'api'`, and identity equality between `workflowApi` and `apiSlice`.
- Replaced the broad compatibility-barrel dependency exception with an exact seven-file allowlist without increasing the 16-item known dependency baseline.
- Synchronized generated OpenAPI/TypeScript artifacts with the existing backend `SearchKeyword` query property and proved generation idempotent by SHA-256.

## Task Commits

1. **Task 1: Extract read/report/dashboard and neutral document endpoints** — `7700140`
2. **Task 2: Extract purchasing and warehouse endpoints** — `6e35d5f`
3. **Task 3: Extract chef, approvals and admin endpoints** — `57b89dc`
4. **Task 4: Collapse workflowApi.ts to the deterministic compatibility barrel** — `b2adb6f`

## Verification

- Full frontend unit suite: **79 files, 428/428 tests passed**.
- Frontend ESLint: passed.
- Dependency-cruiser: no new violations; existing baseline remains **16 ignored**.
- Frontend production build: passed.
- API contract check and two-run SHA-256 determinism check: passed.
- Structural contract: one production `createApi(`, one API reducer path, no endpoint builders or `injectEndpoints` in `workflowApi.ts`, and no `overrideExisting: true`.
- Public surface: exactly **75 workflow endpoint keys and 75 generated hooks**; `workflowApi === apiSlice`.
- GitNexus final staged audit: **HIGH**, 8 changed symbols and 8 expected Dashboard/Warehouse overview processes; all are handled by the full frontend suite and build.
- GitNexus Cypher found 38 exact compatibility-barrel importers at confidence 1.0; rename dry-run found 44 files/103 references and applied no edits.
- Complete bidirectional impact, 134-node disposition and process evidence is recorded in `17-GITNEXUS-CALLSITES.md`; Deferred is empty.

## Files Created/Modified

- `frontend/src/api/workflowApiTypes.ts` — shared workflow query/result contracts formerly owned by the monolith.
- `frontend/src/api/workflowDocumentsApi.ts` — neutral document endpoint injector consumed across features.
- `frontend/src/features/dashboard/dashboardApi.ts` — dashboard-owned workflow endpoints.
- `frontend/src/features/reports/reportsApi.ts` — reports endpoints and overview transforms.
- `frontend/src/features/purchasing/purchasingApi.ts` — purchasing endpoint owner.
- `frontend/src/features/warehouse/warehouseApi.ts` — warehouse endpoint owner.
- `frontend/src/features/chef/chefApi.ts` — chef endpoint owner.
- `frontend/src/features/approvals/approvalsApi.ts` — approval endpoint owner.
- `frontend/src/features/admin/adminWorkflowApi.ts` — workflow-only admin approval-rule endpoints.
- `frontend/src/features/admin/adminApi.ts` — retains employee endpoints and re-exports approval-rule hooks.
- `frontend/src/api/workflowApi.ts` — deterministic compatibility barrel only.
- `frontend/.dependency-cruiser.cjs` — exact owner-import policy for the compatibility barrel.
- `frontend/src/shared/api/contracts/openapi.json` and `schema.ts` — synchronized generated `SearchKeyword` contract.

## Decisions Made

- Kept the compatibility barrel as the sole legacy public entry point while importing each owner injector exactly once, preserving consumer imports and registration order.
- Split admin workflow endpoints from the existing employee `adminApi`; importing the employee injector into the barrel would register five unrelated endpoints and violate the exact 75-key contract.
- Added a narrow dependency-cruiser rule that enumerates the seven permitted owner modules and expires for review at milestone v1.3; the known baseline was not expanded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored workflow-document default limit**
- **Found during:** Task 1
- **Issue:** Extraction temporarily changed the existing default limit from `100` to `500`.
- **Fix:** Restored the original `100` default so request behavior remains unchanged.
- **Files modified:** `frontend/src/api/workflowDocumentsApi.ts`
- **Verification:** Cache/public-surface tests and the full frontend suite passed.
- **Committed in:** `7700140`

**2. [Rule 1/2 - Correctness] Isolated admin workflow registration**
- **Found during:** Task 3
- **Issue:** Reusing the employee `adminApi` injector in the compatibility barrel registered five unrelated endpoints, producing 80 keys instead of the required 75.
- **Fix:** Added `adminWorkflowApi.ts` for approval-rule workflow endpoints and kept `adminApi.ts` as the employee owner plus hook re-export surface.
- **Files modified:** `frontend/src/features/admin/adminApi.ts`, `frontend/src/features/admin/adminWorkflowApi.ts`, `frontend/src/api/workflowApi.ts`
- **Verification:** Exact 75-key/75-hook contract and full frontend suite passed.
- **Committed in:** `57b89dc`

**3. [Rule 3 - Blocking] Added a strict compatibility-barrel dependency exception**
- **Found during:** Task 4
- **Issue:** The required shared compatibility barrel must import feature owner injectors, conflicting with the general shared-to-feature dependency rule.
- **Fix:** Added a narrow rule allowing only seven enumerated owner API files, with Frontend Architecture ownership and milestone-v1.3 review; any other feature import still fails.
- **Files modified:** `frontend/.dependency-cruiser.cjs`
- **Verification:** Dependency-cruiser passed with no new violation and the baseline remained 16.
- **Committed in:** `b2adb6f`

**4. [Rule 3 - Blocking] Synchronized stale generated API artifacts**
- **Found during:** Task 4
- **Issue:** `check:api-contract` detected generated artifacts missing the backend's existing `SearchKeyword` query property.
- **Fix:** Regenerated the committed OpenAPI and TypeScript contract artifacts without changing runtime endpoint behavior.
- **Files modified:** `frontend/src/shared/api/contracts/openapi.json`, `frontend/src/shared/api/contracts/schema.ts`
- **Verification:** Contract check passed and consecutive generation hashes were identical.
- **Committed in:** `b2adb6f`

---

**Total deviations:** 4 auto-fixed (2 correctness, 2 blocking)
**Impact on plan:** All fixes were required to preserve the characterized API surface or complete mandatory gates; no feature scope was added.

## Issues Encountered

- GitNexus reports the final staged diff as HIGH because overview helpers participate in Dashboard and Warehouse chains. All eight reported processes were enumerated and covered by the full frontend tests/build; no affected process remains unhandled.

## Known Stubs

None. The scan found only the intentional empty default options object in `useWorkflowOverview`; existing empty-array fallbacks remain wired defensive behavior, not UI placeholders.

## User Setup Required

None.

## Next Phase Readiness

- Owner-scoped workflow transport is ready for Plan 17-05 page-model and remaining dependency ownership work.
- No endpoint implementation remains in the compatibility barrel and no callsite uses a removed API.
- No database access, reset, seed, import or mutation occurred during this plan.

## Self-Check: PASSED

- All nine created owner/type modules exist.
- All four task commit hashes resolve in repository history.

---
*Phase: 17-frontend-ownership*
*Completed: 2026-07-29*
