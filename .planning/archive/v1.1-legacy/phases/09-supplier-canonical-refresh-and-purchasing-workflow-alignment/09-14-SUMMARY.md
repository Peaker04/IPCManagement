---
phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
plan: 14
status: completed
subsystem: e2e-evidence
tags: [shipyard, playwright, purchasing, warehouse, reconciliation, operator-checkpoint]

requires:
  - phase: 09-13
    provides: Six-stage Purchasing workbench and Warehouse receipt interaction
  - phase: 09-05
    provides: Guarded reconciliation apply with unresolved data kept as zero-write blockers
provides:
  - Two restored real-stack workflow rounds on the exact implementation commit
  - Stable zero-write evidence for every deferred purchase-history blocker
  - Operator-accepted disposable UAT evidence with no real/shared apply authority
affects: [phase-09-verification, PUI-01, SUP-04]

key-files:
  created:
    - frontend/tests/phase9-test-fixture.ts
    - frontend/tests/phase9-purchasing-workflow.spec.ts
    - .planning/phases/09-supplier-canonical-refresh-and-purchasing-workflow-alignment/09-UAT-EVIDENCE.md
  modified:
    - frontend/tests/route-smoke.spec.ts
    - frontend/tests/ui-audit.spec.ts
    - frontend/tests/visual-routes.spec.ts
    - shipyard/profiles/IPCManagement/hooks/boot.sh
    - shipyard/profiles/IPCManagement/hooks/e2e.sh

key-decisions:
  - "Operator acceptance closes only the disposable evidence checkpoint and never authorizes real/shared apply."
  - "Unresolved historical rows remain stable blockers; Plan 09-14 proves zero writes instead of claiming SUP-04 completion."
  - "Visual compensation is limited to deterministic test fixtures and baselines after the current UI assertions pass."

requirements-completed: [PUI-01]
requirements-deferred: [SUP-04]

duration: resumed
completed: 2026-07-23
---

# Phase 09 Plan 14: Restored Workflow and Operator Evidence Summary

**Two independently restored Shipyard rounds prove the Manager→Purchasing→Manager→Warehouse flow and stable deferred blockers; the operator accepted the disposable evidence without authorizing real apply.**

## Accomplishments

- Ran the exact implementation commit `630670b8513a4e0d12a45f401a816b985b18bd38` twice on disposable `ipc_lane1`, restoring from `ipc_e2e_template` before each round with `TABLES=56` and `VERIFY=PASS`.
- Proved identical material request, purchase request, purchase order, inventory issue, kitchen receipt, and report counts across both rounds, including retry no-op behavior.
- Proved both read-only reconciliation previews have the same manifest, database fingerprint, 9,441 actions, and ordered identity of all 408 deferred blockers.
- Completed the browser regression contract: smoke 17/17, UI audit 8/8, visual 28/28, and eight exact Phase 09 snapshots across four required viewports.
- Recorded the operator's explicit acceptance on 2026-07-23 while retaining `REAL_APPLY_NOT_EXECUTED`, `ApplyCalled=false`, and `ReconciliationWrites=0`.

## Task Commits

1. `cfa707c` — add purchasing workflow browser evidence and deterministic snapshots.
2. `cdb0a9f` — route the Shipyard frontend through the lane API proxy.
3. `9ac3899` — reuse one authenticated real-stack browser session.
4. `c927750` — make completed happy-path retries idempotent.
5. `630670b` — align browser fixtures and approved test-only visual baselines.
6. `153dc62` — record the two-round disposable UAT evidence.

## Verification

- Phase 09 backend filter: 191 passed.
- Full backend Release: 499 passed.
- Frontend unit: 166 passed.
- Route smoke: 17 passed.
- UI audit: 8 passed.
- Visual regression: 28 passed.
- Frontend lint and production build: PASS.
- Both scoped real-stack Playwright rounds: PASS.
- Both clone logs: `CLONE=ipc_e2e_template->ipc_lane1`, `TABLES=56`, `VERIFY=PASS`.
- Protected SQL SHA-256 remains `B9645F115F1308949DAD8265DF169845907309EEA9D7268ADEB61A810950AA53` and the file remains untracked.
- GitNexus test commit scope: LOW, seven test symbols, zero affected flows. Full Phase 09 compare to `main` remains CRITICAL because it contains 151 files and 48 cumulative flows requiring phase-level review.

## Deferred Data Boundary

The operator chose to keep the 408 unresolved date, ingredient, supplier, and unit cases blocked for later handling. Therefore:

- Plan 09-14 and `PUI-01` are complete.
- Plan 09-05's accepted-apply/replay proof and `SUP-04` remain deferred.
- No real/shared database mutation occurred.
- Any future apply requires a new exact target request, a fresh zero-blocker preview, and target-specific backup/restore proof.

## Operator Checkpoint

**Accepted:** 2026-07-23, through the plan's `đồng ý` resume signal.

Acceptance covers only [09-UAT-EVIDENCE.md](./09-UAT-EVIDENCE.md) and does not expand mutation authority.

## Self-Check: PASSED WITH DEFERRED DATA SCOPE

- `09-UAT-EVIDENCE.md` contains `ROUND_1=PASS`, `ROUND_2=PASS`, and `REAL_APPLY_NOT_EXECUTED`.
- Source and lane implementation commits match for both rounds.
- Shipyard lane 1 was shut down after verification; dashboard remained available on port 8090.
- Only user-owned README changes and the protected untracked SQL remain in the source worktree.

---
*Phase: 09-supplier-canonical-refresh-and-purchasing-workflow-alignment*
*Completed: 2026-07-23*
