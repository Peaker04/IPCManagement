# Phase 5: Customer-Week Tier Integrity — Context

**Gathered:** 2026-08-03
**Status:** Ready for execution
**Mode:** Autonomous from accepted standardization contract

## Phase boundary

Materialize one canonical price-tier assignment for each customer/week and make every menu schedule reference that scope. Import, schedule-rule and customer-contract writes must reject a different tier with domain guidance before the database constraint/trigger does.

## Locked decisions

- Add `customerweekmenutiers` with a unique `(customerId, weekStartDate)` grain and one `priceTierAmount`.
- Add a composite FK from `menuschedules(customerId, weekStartDate)` to the canonical tier scope.
- MySQL insert/update triggers require schedule `menuPrice` to equal the canonical amount; a tier-update trigger rejects changing a populated week.
- Existing schedules are backfilled by distinct customer/week/price. Conflicting historical prices collide on the unique key and fail the forward migration rather than silently choosing one.
- Tier is immutable while schedules exist. Conflict guidance tells operators to keep the canonical tier or rollback/remove the whole week's draft import before recreating it.
- Service guard is shared by weekly import, schedule rules and customer-contract schedule propagation.
- Migration is generated/validated only; never applied to `ipc_lane1`. GitNexus is not active.

## Verification contract

- Service regression rejects a different tier and preserves the canonical assignment.
- Relational uniqueness test rejects a second customer/week tier row directly at the database layer.
- Migration-operation test locks fail-fast distinct backfill, FK and three trigger protections; generated SQL is reviewed for destructive statements.

## Deferred

An explicit “replace tier for empty week” command is unnecessary; an empty scope can be deleted/recreated through administrative recovery outside this phase.
