---
phase: 05-customer-week-tier-integrity
plan: 01
status: complete
completed: 2026-08-03
commit: 688c478
requirements: [TIER-01, TIER-02, TIER-03, TIER-04]
---

# Phase 5 Plan 01 Summary

Added the canonical `customerweekmenutiers` grain with one unique `(customerId, weekStartDate)` assignment. Menu schedules reference that scope through a composite foreign key, while MySQL insert/update triggers require `menuPrice` to match the canonical amount and a tier-update trigger prevents changing a populated week.

Weekly-menu import, schedule-rule updates and customer-contract propagation all call the same domain invariant before mutating schedules. Conflicts return actionable guidance to keep the current tier or rollback/remove the whole draft week before recreating it.

The migration backfills distinct customer/week/price rows before adding the foreign key. Historical scopes with multiple prices collide on the unique key and fail fast instead of silently selecting or normalizing a tier.

## Verification

- Focused invariant/API/migration tests: 4/4 pass; related contract/menu/import tests: 48/48 pass; PA2 source/invariant checks: 6/6 pass.
- Root gate: Application 49/49; API 719 pass + 1 intentional skip; UI completeness 87/87; frontend 129 files / 748 tests.
- Strict architecture baseline, ESLint, dependency-cruiser (0 violations / 377 modules / 1,355 dependencies), backend build and frontend production build pass.
- EF reports no pending model change. Forward SQL creates the canonical table/index, performs distinct backfill, then adds the FK and three triggers; it contains no destructive forward operation.
- Staged secret scan and `git diff --cached --check` pass. Migration was generated and reviewed only; `ipc_lane1` was not mutated and GitNexus was not used.
