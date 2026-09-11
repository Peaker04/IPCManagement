---
phase: 30-closed-loop-menu-issue-reconciliation
plan: 12
subsystem: frontend-authority-and-reconciliation-ownership
status: complete
completed: 2026-08-31
requires: [30-11]
provides:
  - monotonic cross-tab server-authority convergence for independent frontend stores, providers, routers, and storage adapters
  - targeted reconciliation RTK query and mutation cleanup before stale owners can reuse state
  - reconciliation URL, view, and persisted-selection cleanup with DEFAULT-safe preload behavior
affects: [system-operation, reconciliation, warehouse, route-preloading, navigation-preferences]
requirements-completed: [MRX-03, MRX-04, MRX-05, MRX-06L]
tech-stack:
  added: []
  patterns:
    - BroadcastChannel-first authority hints with storage-event fallback
    - server-confirmed monotonic authority acceptance
    - endpoint-owned RTK cancellation and residue removal
key-files:
  created:
    - frontend/src/features/system-operation/systemOperationAuthorityChannel.ts
    - frontend/src/features/system-operation/systemOperationAuthorityChannel.test.ts
    - frontend/src/features/system-operation/systemOperationLocation.ts
    - frontend/src/features/system-operation/systemOperationLocation.test.ts
    - frontend/src/features/system-operation/SystemOperationProvider.test.tsx
    - frontend/src/features/reconciliation/reconciliationApi.cleanup.test.ts
  modified:
    - frontend/src/features/system-operation/SystemOperationProvider.tsx
    - frontend/src/features/system-operation/systemOperationApi.ts
    - frontend/src/features/reconciliation/reconciliationApi.ts
    - frontend/src/features/reconciliation/pages/ReconciliationPage.tsx
    - frontend/src/features/warehouse/pages/ReconciliationWarehousePage.tsx
    - frontend/src/routes/routeDataPreloaders.ts
    - frontend/src/lib/navigationPreferences.ts
key-decisions:
  - Browser channel payloads are hints only; the provider waits for a newer server query result before accepting mode or capability.
  - Reconciliation cleanup enumerates owned query and mutation endpoints and does not reset the shared API slice.
  - The pure relocation contract uses systemOperationLocation.test.ts while provider integration remains in SystemOperationProvider.test.tsx; the suspicious duplicate basename was removed.
metrics:
  tasks: 3
  commits: 1
  files: 16
actuals:
  tokens: 35744
  tasks: 3
  commits: 1
---

# Phase 30 Plan 12: Cross-Tab Authority and Inactive-Owner Cleanup Summary

Independent frontend tabs now converge on newer server-confirmed operation authority while reconciliation-owned requests, cache, mutations, URL state, local view, and persisted selection are removed surgically before DEFAULT owners mount.

## Outcome

- Added one production authority transport with BroadcastChannel preference, storage-event fallback, injectable ports, subscription cleanup, and stable `{ mode, version }` messages.
- Successful mode queries and mutations publish hints, but providers never grant capability from browser payloads; each tab refetches and accepts only a strictly newer server snapshot.
- Two-tab integration uses independent Redux stores, RTK caches, routers, providers, and storage adapters and verifies duplicate/older hints plus late server responses cannot regress accepted authority.
- Added targeted reconciliation cleanup for owned list/detail/history/weekly-menu queries and all reconciliation mutations. Running work is aborted and query/mutation residue removed without resetting shared RTK state.
- Authority relocation strips reconciliation-only warehouse and weekly-menu query state or redirects an ineligible reconciliation route before children render.
- Reconciliation batch and warehouse-view selection use a separate storage key, leaving DEFAULT navigation and tab preferences unchanged.
- DEFAULT reconciliation route intent produces zero reconciliation preload requests; reconciliation warehouse intent preloads only the shared warehouse selector.

## Authority Channel Matrix

| Input | Runtime behavior | Authority effect |
|---|---|---|
| Successful server query/mutation | Publish `{mode, version}` | Hint only |
| BroadcastChannel available | Deliver through production channel | Receiver refetches server |
| BroadcastChannel unavailable | Storage-event write/remove fallback | Receiver refetches server |
| Duplicate or older version | Ignore monotonically | No regression/refetch duplication |
| Same mode, higher version | Refetch and accept confirmed snapshot | Capabilities/version advance |
| Late older server response | Reject against accepted version | No regression |
| Malformed browser payload | Ignore | No capability granted |

## Frontend Owner Matrix

| Owner | Authority-loss behavior | DEFAULT preservation |
|---|---|---|
| Reconciliation RTK queries | Abort running and remove owned cache entries | Shared warehouse/master queries remain |
| Reconciliation RTK mutations | Abort running and remove mutation residue | Unrelated mutations remain |
| Deferred responses | Aborted and unable to repopulate removed ownership | Shared fulfilled cache remains |
| `/reconciliation` route | Relocate to dashboard before child mount | DEFAULT eligible routes remain |
| Warehouse URL | Remove `batchId` and reconciliation `view` | Warehouse route remains |
| Weekly-menu URL | Remove reconciliation `view/customerId/weekStartDate` | Weekly-menu route remains |
| Persisted selection | Remove dedicated reconciliation key | Navigation/tab preferences remain |
| Route/intent preloads | Zero reconciliation requests in DEFAULT | Existing DEFAULT preload map remains |

## Surgical Review

- Reviewed the complete staged scope (16 files, 1,215 changed lines before commit).
- Kept the 315-line provider integration test because it is the only production-shaped independent-store/provider/router proof.
- Renamed the distinct 20-line pure relocation test from `SystemOperationProvider.test.ts` to `systemOperationLocation.test.ts`; there is no duplicate provider test left.
- Fixed a recovered implementation bug discovered during review: a newer channel hint changed provider state but production-stable `refetch` identity could prevent the authority effect from rerunning. `hintedAuthority` is now an explicit dependency, and the integration mock uses a stable refetch callback to lock the regression.
- No broad API reset, DEFAULT component redesign, unrelated cache removal, backend mutation, browser run, protected environment, reset, or seed was introduced.

## Verification

- Targeted shard 1: authority channel, relocation, provider integration — passed.
- Targeted shard 2: reconciliation workflow and RTK cleanup — passed.
- Targeted shard 3: route preload and navigation preference ownership — passed.
- Relevant bounded suite: **14 files / 45 tests passed**, `maxWorkers=1`, explicit 240-second shell timeout.
- `npm --prefix frontend run lint` — passed.
- `npm --prefix frontend run build` — passed (`tsc -b`, Vite, 2,315 modules).
- `git diff --cached --check` before commit — passed.
- Targeted secret/stub scan — passed; the existing Select placeholder is functional UI copy, not an implementation stub.

## API Contract Parity

`npm run check:api-contract` generated a diff and exited 1. To diagnose without resetting the branch, exact `HEAD eea626a5` backend sources were exported into `.artifacts/contract-baseline-eea626a5`, built independently, and used to generate OpenAPI/schema output. Both generated files were byte-identical to the current branch generation:

- OpenAPI SHA-256: `c7c5a7f8e148552d6c235b236a3b24183e1a92e3ff9d246313cda8b286d53ade`
- Schema SHA-256: `a77e1013249e4d83e83eaf3b601737649141d5a44d9b3fec4d2e1da3ea1681ff`

Therefore the parity failure is stale generated contract already present at base, not Plan 30-12 drift. The generated files were returned byte-for-byte to their HEAD blobs and excluded from the commit; adopting them would force unrelated contract-consumer changes outside this frontend authority slice.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Made production-stable refetch respond to newer authority hints**
- **Found during:** surgical staged-diff review
- **Issue:** the integration mock recreated `refetch` each render, masking a missing `hintedAuthority` effect dependency that could leave production tabs waiting without issuing server confirmation.
- **Fix:** stabilized the test refetch callback and added the hint state dependency to the provider authority effect.
- **Files modified:** `SystemOperationProvider.tsx`, `SystemOperationProvider.test.tsx`
- **Commit:** `ba7ec4c9`

**2. [Rule 3 - Blocking] Removed suspicious duplicate test basename**
- **Found during:** staged-file inventory
- **Issue:** `SystemOperationProvider.test.ts` and `.test.tsx` were distinct tests but appeared duplicated and obscured ownership.
- **Fix:** retained the integration test and renamed the pure relocation contract to `systemOperationLocation.test.ts`.
- **Commit:** `ba7ec4c9`

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|---|---|---|
| threat_flag: cross-tab-untrusted-hint | frontend/src/features/system-operation/systemOperationAuthorityChannel.ts | Browser messages cross a trust boundary but are parsed, monotonic hints only, and require server confirmation. |
| threat_flag: targeted-cache-removal | frontend/src/features/reconciliation/reconciliationApi.ts | Internal RTK removal actions are limited to an explicit reconciliation endpoint allow-list. |

## Commit

- `ba7ec4c9` — `feat(30-12): enforce monotonic cross-tab authority cleanup`

## Self-Check: PASSED

- All 16 committed files exist.
- Commit `ba7ec4c9` exists at branch HEAD.
- `.planning/ROADMAP.md` and `.planning/STATE.md` remain unstaged and were not committed.

## Final Local Closeout Reconciliation

- **Final verdict:** PASS at verified HEAD `6bfbd9f9`.
- Exact plan commit: `ba7ec4c9`.
- The final 203-file frontend aggregate, eager-route ownership, unchanged route budgets, lint, build, architecture and dependency gates passed after phase-level remediation.
- Cross-tab browser behavior is locally deterministic only; the protected five-viewport run remains MRX-06P work.
