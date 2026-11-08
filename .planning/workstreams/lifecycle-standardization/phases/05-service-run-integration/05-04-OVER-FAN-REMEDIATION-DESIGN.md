# Append-only remediation for over-fanned menu-amendment decisions

## Problem

The persisted amendment case is immutable evidence. Its original impact snapshot references 120
decision items because the create path grouped binary customer identifiers by reference and did not
restrict the effective scope to the amended service date and shift. Deleting decisions, rewriting the
snapshot, or resolving the case from one legacy decision would destroy evidence or produce a false
resolution.

## Locked invariants

- Preserve the amendment, reconciliation case, original impact snapshot, 120 decision items, audit,
  and Golden documents exactly as recorded.
- A remediation is a new fact. It never updates or deletes an earlier snapshot or decision item.
- The effective decision set is the latest remediation for the case; without a remediation, the
  original snapshot remains effective.
- Canonical scope is derived from immutable amendment lines plus source-line lineage at
  `customer + service date + shift + price tier`; it is never selected by display name.
- Each correction references one effective decision item. A case is resolved only when every
  effective decision item has one correction.
- Remediation and correction commands are idempotent, version checked, audited, and fenced to the
  exact reconciliation case.

## Persistence contract

Append `MenuAmendmentReconciliationRemediation` with:

- remediation id and reconciliation case id;
- unique command id;
- canonical impact snapshot JSON containing newly appended decision ids and exact source-line ids;
- reason, actor, and timestamp.

Extend correction with an optional decision-item id for backward-compatible history, and enforce one
correction per decision item when present.

## Effective projection

`GetEffectiveImpact(case)` reads the newest remediation by creation order, otherwise the original case
snapshot. Inbox pagination and command lookup use this projection. Legacy over-fanned decisions stay
queryable as database evidence but are not actionable after remediation.

## Command preflight

Before appending remediation:

1. Require an open case, a non-empty reason and unique command id.
2. Derive amendment date/shift scopes and find active material-request source lines for the same
   customer/week and exact amended date/shift.
3. Require at least one source line and exactly one closed ServiceRun containing all source lines for
   each canonical scope.
4. Append canonical decision items and remediation in one transaction with audit and lifecycle receipt.
5. Re-read counts: original decisions unchanged, remediation count +1, canonical decision count equals
   derived scope count, corrections unchanged.

No Golden correction is permitted until migration receipt, lane fence, OpenAPI parity, focused tests,
and this readback all pass on exact `ipc_lane7` with `protectedLaneConnectionAttempts = 0`.
