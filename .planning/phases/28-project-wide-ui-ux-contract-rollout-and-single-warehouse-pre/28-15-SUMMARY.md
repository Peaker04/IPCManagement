---
phase: 28-project-wide-ui-ux-contract-rollout-and-single-warehouse-pre
plan: 15
subsystem: phase-closeout
status: blocked
tags: [regression, architecture, build, evidence, operational-checkpoint]
requires: [28-14]
provides: [exact-three regression, operational activation evidence, closeout diagnostics]
affects: []
tech-stack:
  added: []
  patterns: [exact-three cardinality, fail-closed release gate]
key-files:
  created:
    - frontend/src/lib/operationalWarehouseContext.ts
  modified:
    - frontend/src/features/purchasing/purchasingModel.test.ts
    - scripts/architecture-growth-baseline.json
    - MEMORY.md
    - HISTORY.md
    - docs/EVIDENCE-INDEX.md
decisions:
  - Do not manufacture full frontend PASS while historical ignored Phase 28 inputs are absent and older authority locks are stale.
  - Treat focused closeout/static/build gates as green but keep Phase 28 blocked on the requested aggregate frontend regression.
metrics:
  duration: 34m
  completed: 2026-08-24
actuals:
  tokens: 19500
  tasks: 2
  commits: 4
---

# Phase 28 Plan 15: Final Regression and Closeout Summary

All shipped single-warehouse behavior and prescribed focused/static/build gates are green, but the requested aggregate frontend unit suite remains fail-closed on historical ignored evidence and older stale authority locks, so Phase 28 is not declared complete.

## Accomplishments

- Added exactly three named zero/one/multiple state tests; invalid-state mutation spies remain zero.
- Fixed all Phase 28 backend fixture regressions and passed the full backend suite.
- Passed focused frontend owner/cardinality tests, lint, dependency, build, strict architecture, route budgets, generated-contract stability, and EF model checks.
- Applied the authorized local migration/activation checkpoint and recorded rollback/startup evidence without secrets.
- Reduced newly grown services below the 600-line architecture threshold and shrank the WarehousePage baseline from 762 to 741.

## Verification Passed

- Exact cardinality: 3/3, exact output count 3.
- Backend full: 971 passed, 1 intentional integration skip, 0 failed.
- Frontend prescribed closeout: 5 files / 41 tests passed.
- Frontend lint: passed.
- Dependency Cruiser: 438 modules / 1,645 dependencies / 0 violations.
- Production build: 2,294 modules.
- Strict architecture: passed; existing split-plan debt remains MaterialDemandService and PurchaseHistoryReconciliationService.
- Route budgets: all 10 passed; Weekly Menu 274.93/275.00 KiB and Purchasing 254.73/255.00 KiB remain near limits.
- EF pending model: none; idempotent SQL generated with no DROP DATABASE/TABLE.
- Local startup: `/health/ready` HTTP 200 on owned port 8148; owned process/listener teardown passed.

## Blocking Verification

The aggregate frontend unit run completed with 1,156 passed and 24 failed. Remaining failures fall into two groups:

1. Historical ignored Phase 28 baseline inputs are absent by design (`frontend/test-results/ui-audit-phase28-*.json`) and cannot be recreated as the lost historical bytes.
2. Older Phase 27/27.1 attestation, line-location, hidden-state, presentation-count, and source-format locks are stale against the current repository. Broad baseline/attestation rewriting is outside Plans 28-11..15 and is prohibited as a way to manufacture PASS.

The aggregate command and failure output were preserved by the runtime at `D:/Temp/pi-bash-18cfe98210668dde.log`.

## Deviations from Plan

### Auto-fixed Issues

- Mapped warehouse raw SQL shadow columns after the live migrated schema exposed a startup materialization bug (`8f061fac`).
- Updated focused backend factories/SQLite schemas for resolver and shadow-column dependencies.
- Moved canonical scope helpers into existing rule/policy owners to satisfy strict architecture without baseline expansion.
- Introduced shared `lib/operationalWarehouseContext.ts` after dependency-cruiser rejected a feature-to-feature import.

## Known Stubs

None.

## Residual Risks

- KnownProxies warning remains until exact trusted reverse proxy addresses exist.
- Full frontend aggregate regression remains red for the exact historical authority reasons above.
- Weekly Menu and Purchasing route budgets have less than 0.3 KiB headroom.

## Self-Check: PASSED

All listed commits and operational evidence exist; no staged files remain before metadata commit.
