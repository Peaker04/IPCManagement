# Lifecycle contract — cung cấp suất ăn

Source/models/services and behavioral tests own implemented transitions. This document owns lifecycle vocabulary and safety invariants, not execution history or task status. Mode-specific MRX rules belong to [material-reconciliation.md](domain/material-reconciliation.md).

## Work objects and identity

Menu scope is customer/week/tier/effective range. Demand retains service date, shift, customer, ingredient, unit and source-line identity. Purchase/receipt/issue/return commands address actual document lines, never ingredient names or UI aggregate rows. ServiceRun identity follows its production plan/customer/date/shift model, not a display label. [DATA-GRAIN-MATRIX.md](DATA-GRAIN-MATRIX.md) owns detailed read/projection grains.

## Transition vocabulary

- `MUTABLE`: editable draft inside allowed cutoff.
- `AWAITING_APPROVAL`: required actor decision; creator cannot self-decide where separation of duties applies.
- `POSTABLE`: prerequisites complete; posting remains an explicit command.
- `POSTED`: physical/financial effect committed exactly once.
- `RECONCILIATION_REQUIRED`: physical evidence differs; no silent regeneration.
- `TERMINAL`: no in-place rewrite; corrections use compensating documents/events.

Actual feature enums remain intact. A shared projection must not replace their owners.

## DEFAULT lifecycle owners

- Weekly menu import preview distinguishes unmatched valid dishes from malformed/ambiguous names; commit is transactional and retains provenance. Missing BOM permits source draft authoring but is not a complete material plan. Demand generation fails closed before persistence when any target source lacks effective published BOM.
- Coordination owns send-to-kitchen for the selected date/shift. Chef reads handoff, not a fabricated send/receive action. Locked baseline, adjusted servings and signed variance remain distinct; changed servings require demand-readiness review.
- Purchasing groups week/date/stage for reading, but decisions and receipts retain exact source-line IDs. No silent repricing or inferred procurement entitlement from projected allocation.
- Receipt path: Coordinator draft → Warehouse quality acceptance/rejection → Manager approval → Admin posting. Only posting creates physical stock effect. Rework/void are pre-post; posted receipt and ledger are immutable. Partial quality acceptance and compensating corrections retain provenance.
- Chef ingredient counting is local progress; persisted acknowledgement is atomic at whole-issue grain, requires every line checked and is not ServiceRun completion.
- Normal menu amendment: Coordinator creates → different Manager reviews → different Admin executes. Physical-document cases need append-only reconciliation. Break-glass is an audited, reasoned exception, not routine approval.
- Return/supplemental/disposition retain origin issue and unit. Cross-customer return disposition is Admin-only. Confirmed return affects physical stock through its canonical owner, not a rewritten issue.

## ServiceRun and close

Planning, material, service and reconciliation readiness tracks are distinct. Source must be handed to kitchen before opening a run. Open/retry is idempotent. Actual-serving variance requires the authorized decision; CONFIRMED and WAIVED are exclusive. Re-recording actual servings invalidates prior confirmation. Close requires all owned blockers resolved, has terminal `ClosedAt` truth and freezes cost/serving facts. Post-close corrections are append-only deltas, not mutation of the close snapshot. `ServiceRunLifecycleTests` is the behavioral owner.

## Commands, persistence and recovery

Use the feature's command ID, expected aggregate version, actor/permission, source IDs and exception reason. Authorize → load/version check → domain preconditions → atomic state/audit/outbox/idempotency → projection. Transaction/retry belongs to `IEfTransactionRunner`; retries must not duplicate physical effects. Outbox delivery is separate from its transactional creation.

Legacy nullable provenance may only be mapped through reviewed proposal → different-actor approval → approved apply, checking exact source/unit compatibility at create and apply. No name/header/first-candidate mapping, quantity rewrite or destructive backfill. [Database recovery](operations/database-recovery.md) owns operational migration/restore safeguards.
