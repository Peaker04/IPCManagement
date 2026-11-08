# MRX Production Vertical Slice Design

**Status:** Owner-approved design

**Canonical business contract:** `docs/domain/material-reconciliation.md`

## Goal

Make `MATERIAL_RECONCILIATION` operable in production through public UI/API from source preparation to a completed reconciliation batch, with actor separation, durable warehouse evidence, optimistic concurrency, reload continuity, and strict `DEFAULT != MATERIAL_RECONCILIATION` isolation.

## Decision

Implement the smallest complete production vertical slice rather than exposing only the existing reconciliation page or attempting every report/dashboard enhancement at once.

The required lifecycle is:

`source → quantity preview/commit → DRAFT → READY → TRANSFERRED → initial issue → optional supplemental issue → daily disposition → COMPLETED`

Kitchen cooking read/export is included because it is a required MRX actor surface. MRX dashboards, new analytics, duplicate report workbenches, and non-critical visual redesign are deferred.

## Current-state finding

Backend owns substantial MRX lifecycle capability, but Frontend exposes only batch listing/client-side selection and completion. The canonical route registry currently keeps Weekly Menu, Warehouse, and Chef in `DEFAULT`, leaving the MRX lifecycle unreachable through the product.

The current Frontend batch lookup loads all batches and selects the first customer/date match. Production navigation instead uses `batchId` as the stable work-object identity, with `date` as daily scope.

## Surface architecture

Existing top-level routes are retained; mode-specific leaves and API owners remain distinct:

- `/weekly-menu?view=mrx-batch`: coordinator source, preview, commit, create, READY, transfer.
- `/warehouse?view=mrx-daily&batchId=...&date=...`: warehouse daily projection and initial issue.
- `/warehouse?view=mrx-issues&batchId=...`: supplemental issue and append-only issue history.
- `/chef?view=mrx-cooking&batchId=...`: kitchen cooking read/export.
- `/reconciliation?batchId=...&date=...`: manager review, daily disposition, completion.

No MRX surface imports or invokes DEFAULT Purchasing, material-demand, production-plan, or approved-material-request workflow owners. Shared master data and physical stock remain shared only through their canonical Backend owners.

## Actor boundaries

- **Coordinator:** source, quantity preview/commit, batch creation, READY, transfer.
- **Warehouse:** daily frozen requirements, initial issue, supplemental issue, issue history.
- **Manager:** daily decision detail, disposition, completion.
- **Chef:** cooking projection and export only.
- **Purchasing:** no MRX navigation or action.
- **Admin:** authorized supervision/emergency access while audit retains the real actor.

Buttons outside an actor's authority are absent. Route and API boundaries still return `403`; hidden navigation is not treated as security.

## Data and concurrency boundaries

- `batchId` is the Frontend work-object identity and URL state owner.
- Daily mutations use authoritative `dailyLineId`; display index, ingredient group, and weekly line ID are not mutation identities.
- Every write carries Backend-required command identity and `expectedVersion` and handles `409` without discarding known data.
- Initial issue includes each positive frozen daily line for the target date exactly once; requested quantity is immutable.
- Supplemental issue can reference only frozen ingredients/lines from that batch and creates a new append-only transaction.
- Issued quantity is ledger-derived; legacy purchased/issued actual mutations remain unavailable.
- Completion readiness comes from the Backend all-date projection, never a selected date or client calculation.

## Production readiness gate

Before exposing writes, verify in source and focused tests:

1. MRX reads/writes enforce operation mode before repository access.
2. Shared issue reads cannot select the opposite workflow family.
3. Mode/version and aggregate version are rechecked within protected writes.
4. Stock provisioning, if required by the MRX invariant, uses canonical ledger `ADJUSTMENT` with MRX batch lineage and shares the issue transaction; no direct stock write or new movement enum.
5. Legacy batches remain readable and fail closed for unsupported daily writes.
6. Retry/double-submit behavior cannot duplicate batch, issue, movement, or audit records.

A gate failure blocks the corresponding UI action; it is not worked around in Frontend.

## UI behavior

All pages reuse current UI/workbench primitives and semantic tokens. No duplicate primitive or styling authority is introduced.

- Cold loading uses the route surface geometry.
- Refresh/filter/date transitions retain known data with truthful updating state.
- Permission denial, mode conflict, stale-write conflict, empty, partial/legacy, and loading states are distinct.
- A single primary action is shown for the current lifecycle step.
- Blocking confirmation uses one modal with focus trap, background lock, and focus return.
- Technical IDs and lineage are secondary disclosure, not primary operational copy.

## Acceptance boundary

Production readiness requires one newly created batch to pass through the entire lifecycle using public UI/API with the proper actors and MRX mode. Evidence must cover DOM state, HTTP requests/responses, Backend aggregate state, persistence transitions, daily lineage, stock movements, audit actor, and state after reload.

Negative acceptance includes wrong mode, wrong actor, stale version, duplicate submission, legacy missing lineage, missing BOM, initial issue omission/duplication, over-issue without reason, and attempt to use an ingredient outside the frozen batch.

No production readiness claim may rely only on mocked component tests, screenshots, direct database writes, sample-data reset, fabricated stock, or manually manufactured batch state.

## Approved operational amendments

### Chef boundary

Chef is outside the primary MRX lifecycle. Chef may read and export only the sanitized frozen cooking projection. Chef cannot read issue quantities, confirm MRX receipt, enter actual issue quantities, create supplemental issues, set dispositions, or complete batches.

### Source changes after batch creation

Menu and serving changes never rewrite a frozen requirement, historical issue, stock movement, disposition history, or audit record.

- Before the first issue, an approved source change creates a new source revision and replacement batch revision before Warehouse confirmation.
- After the first issue, an approved change computes a date/shift/ingredient delta against frozen facts and automatically creates a pending supplemental-work item.
- A positive delta requires Warehouse confirmation before a new append-only supplemental `InventoryIssue` is created.
- A negative delta never creates a negative issue or silently increases stock. It enters the canonical return/reconciliation path and requires a physical return transaction before stock changes.
- A source revision invalidates only affected daily dispositions and blocks completion until its delta is resolved.
- The Backend automatically enqueues the delta when the change becomes effective; Admin does not perform a separate “send to Warehouse” step.

### Change approval by actor

- Admin edits require an impact preview and explicit confirmation, then apply immediately with the real Admin actor recorded.
- A Coordinator or other specialist submits a pending change request. The current source remains unchanged until Admin approval.
- Admin approval applies the revision and automatically enqueues its Warehouse delta.
- Rejection leaves source, batch, Warehouse queue, and stock unchanged.
- The same approval rule covers dish replacement and serving-count changes; no role-specific shortcut may bypass audit, version, or mode checks.

### Multi-customer preparation and issue isolation

A Warehouse actor may select multiple eligible customer batches for the same service date and operational warehouse. The system may aggregate equal `ingredient × canonical unit` quantities for preparation and export, but durable transactions remain isolated:

- one reconciliation batch per customer/week;
- one initial or supplemental inventory issue per customer/batch/date;
- independent batch versions, issue IDs, lineages, audit entries, dispositions, and completion states;
- an optional `preparationGroupId` links separately persisted issues created from one coordinated action.

Every selected batch must already be eligible to issue. If validation or concurrency fails for any selected batch, the coordinated command performs no durable writes. The user reloads and removes the invalid batch or retries the entire group.

### Supplier-classified Excel export

The Warehouse preparation export supports one or more customers, selected service dates within the week, eligible batches, supplier filtering, and initial/supplemental status. It is a read projection, not a stock mutation.

The workbook contains:

1. **Preparation summary:** supplier → ingredient → canonical unit with per-customer quantities and total preparation quantity.
2. **Allocation detail:** customer, batch, service date, shift, ingredient, quantity, initial/supplemental classification, and issue readiness/status.

Supplier classification must come from canonical supplier/ingredient authority. Missing or ambiguous assignment is rendered as `Chưa xác định nhà cung cấp`; the Backend must not choose the first supplier or invent an assignment.

## Backend alignment required before Warehouse UI

The production slice depends on these repairs:

1. Add emitted permission tokens: `reconciliation.read`, `reconciliation.source.read`, `reconciliation.warehouse.read`, `reconciliation.kitchen.read`, `reconciliation.disposition`, and `reconciliation.complete`; map them to the approved actors and use the same tokens in Frontend guards.
2. Make disposition-category reads MRX-only and decision-role protected.
3. Restrict full reconciliation report/detail export to decision actors; Chef uses only the sanitized cooking endpoint.
4. Preserve source family in issue `Location` responses and reject unknown/wrong family before repository access.
5. Enforce the approved Chef boundary on MRX issue receipt confirmation; DEFAULT confirmation remains unchanged.
6. Add paged/filterable batch summaries before production-volume acceptance; batch detail, Warehouse daily projection, and cooking projection remain separate owners.
## Complete production program scope

The Owner requires the complete connected MRX product, not only the minimum lifecycle. Delivery therefore includes all of the following, with no disconnected local-only state:

1. **Source authority:** customer, weekly menu, dish, BOM, supplier classification, and servings by service date/shift.
2. **Change governance:** impact preview, Admin direct confirmation, specialist request/Admin approval, rejection, immutable source revision, and affected-work notification.
3. **Batch lifecycle:** canonical import, DRAFT, READY, TRANSFERRED, IN_PROGRESS, COMPLETED, replacement revision before first issue, and completion blockers after issue.
4. **Warehouse execution:** daily initial issue, supplemental delta issue, physical return for negative delta, multi-customer preparation, separate durable issues, issue detail/history, and stock ledger correlation.
5. **Manager decisions:** exact daily-line review, disposition categories, source/issue notes, stale-write recovery, all-date readiness, completion, and read-only completed history.
6. **Chef output:** sanitized cooking preview plus CSV/XLSX only; no issue, stock, variance, disposition, or lifecycle mutation.
7. **Supplier preparation:** customer/date/week/batch/supplier filters, multi-customer aggregation, unresolved supplier classification, preparation summary and allocation detail workbook.
8. **Operational visibility:** actor-owned queues and Dashboard summaries for source changes awaiting approval, batches awaiting Warehouse, pending deltas, unresolved variances, and completion-ready batches. Dashboard facts are Backend projections and link to exact work objects.
9. **Reports:** batch reconciliation statement, issue/supplemental/return history, supplier preparation workbook, completion history, and audit trail. Reports reuse the same projections as operational screens and never create a second calculation authority.
10. **Audit and notification:** actor, approver, source revision, batch/daily-line identity, command/correlation identity, issue/return/movement linkage, disposition invalidation, timestamps, and notification acknowledgement where applicable.
11. **Compatibility:** retained legacy batches remain readable, daily mutations fail closed without lineage, and migration/backfill is never implicit.
12. **Production evidence:** actor×mode, browser, API, persistence, concurrency, idempotency, reload, export content, responsive/accessibility, and operational rollback/runbook validation.

## End-to-end lineage contract

Every operational row must be traceable through persisted identities:

`customer → menuVersion → menuSchedule/serviceDate/shift → mealQuantityPlanLine → dish/BOM → quantityImportBatch → reconciliationBatch → weeklyLine → dailyLine → sourceRevision/delta → inventoryIssue/return line → stockMovement → dailyDisposition → completion/audit`.

A consumer may display a summarized projection, but no command may mutate by customer name, ingredient grouping, display index, or Excel row. Commands use canonical IDs and expected versions.

## Reporting and dashboard defaults

Until a later Owner decision adds financial settlement, the complete MRX report set is operational rather than accounting-valued:

- reconciliation batch statement by customer/week/date;
- initial, supplemental, and return transaction history;
- supplier-classified preparation workbook;
- unresolved/resolved variance report;
- completed-batch register;
- actor and source-change audit trail.

No dish-cost, supplier payable, or accounting journal is inferred from reference prices or issue quantities.

## Remaining exclusions and authorization boundaries

- DEFAULT workflow redesign unrelated to strict mode isolation.
- Accounting settlement, supplier payable, and generalized BI/report-builder functionality.
- Migration apply, seed/import, deployment, production mode switching, production credentials, or destructive data operation without separate authorization.
