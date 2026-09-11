---
phase: 05-service-run-integration
plan: 04
subsystem: multi-customer-lifecycle-e2e
tags: [service-run, golden-path, exceptions, headed-browser, lane-fence]
requires: [service-run-kernel, purchasing-lifecycle, menu-amendment-reconciliation]
provides: [physical-golden-proof, scoped-exception-matrix, retry-durability, phase-closeout]
affects: [weekly-menu, purchasing, warehouse, kitchen, reports]
status: complete
completed: 2026-08-14
---

# Phase 05 Plan 04: Multi-customer lifecycle closeout

Phase 5 now has one ordered, physically headed proof from contract/migration preflight through independent
ANV/DAV Golden operation, scoped exception handling, durable retries and run-owned teardown on exact
`ipc_lane7`.

## Accomplishments

- Proved trusted pointer and keyboard dispatch in the real headed application before any Golden mutation.
- Completed independent ANV/DAV demand → purchasing → receipt → issue → kitchen receipt → ServiceRun closure,
  preserving source-line/customer/date/shift/tier lineage and append-only lifecycle facts.
- Completed the ordered exception matrix: returns, waste, excess, supplemental and quality isolation,
  append-only amendment correction, kitchen discrepancy, ambiguous lineage, explicit shared-shortage decision,
  blocked allocation and replay/stale/concurrent retry durability.
- Kept all protected-lane connection attempts at zero; no Task 0 reset, seed, cleanup or menu re-import was replayed.
- Reconciled current-source regression contracts without rewriting Phase 4.2 historical archives and restored
  the intentional Admin-only weekly-menu publish control.

## Commits

1. `0cc7fbf6` — `test(phase05): prove retry matrix durability`
2. `7ef4040c` — `docs(phase05): checkpoint closeout and refresh rules`
3. `c3cdaa79` — `fix(phase05): reconcile closeout regression contracts`

## Verification

- Backend tests: `944 passed`, `1 intentional skip`.
- Frontend: `152 files / 853 tests`; ESLint and production build PASS.
- Backend solution isolated build: `0 warning / 0 error`.
- EF: no pending model changes. OpenAPI/schema regeneration: deterministic, zero tracked diff.
- Source ownership `17/17`, PC disposition `6/6`, operational registry `28/28` PASS.
- Exception aggregate `-ValidateOnly` PASS with no runtime/browser/database action.
- Secret scan, production-stub disposition and `git diff --check` PASS.
- Teardown stopped only PID 32448/32588; ports 8036/3036 closed; external PID 3580 remained running.

## Evidence

The authoritative top-level manifest and its SHA-256 are indexed only in `docs/EVIDENCE-INDEX.md`.

## Deviations

- The canonical Release output was locked by external PID 3580. The solution was built into an isolated output
  directory; the external process was not terminated.
- The first isolated build attempt also moved `obj` and therefore lacked NuGet assets. The final passing build
  kept existing intermediate assets and isolated only output; no database action occurred.

## Self-check

PASS — ordered manifests, zero protected-lane attempts, full closeout gates and run-owned teardown are present.
