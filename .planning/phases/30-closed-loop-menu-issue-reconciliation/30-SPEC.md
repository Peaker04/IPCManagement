# Phase 30: Closed-loop menu issue reconciliation — Specification

**Created:** 2026-08-29
**Ambiguity score:** 0.105 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

Separate `DEFAULT` and `MATERIAL_RECONCILIATION` workflow ownership so records, commands, caches and aggregates cannot cross-contaminate, while preserving one shared master-data authority and one Warehouse-authoritative physical inventory ledger.

## Background

The application already has one server-authoritative operation mode, mode-specific navigation/capabilities, `MaterialRequest` lineage for the default issue workflow, `ReconciliationBatch` and exact batch-line lineage for the reconciliation workflow, and database constraints that distinguish the two inventory-issue source families. Warehouse is already the sole stock-mutation authority.

The remaining integrity gap is end-to-end isolation rather than route visibility alone. It is not yet proven that every list, detail, aggregate, export, approval, cleanup, preload, background owner, stale client and concurrent command consistently respects source-family ownership. A mode switch must not convert, delete, complete, expose or mutate records owned by the inactive workflow, and later shared-master edits must not rewrite frozen reconciliation facts.

The selected model is **shared master data plus isolated workflow lineage**. Material, unit, dish, BOM, customer and physical stock authorities remain shared. Transactional workflow records remain permanently owned by exactly one source family. Switching mode changes active operating authority only; it does not move data between families.

## Requirements

1. **Exact-one workflow source family**: Every transactional inventory-issue record in the closed-loop scope belongs to exactly one workflow family: `DEFAULT` through `MaterialRequest` lineage or `MATERIAL_RECONCILIATION` through `ReconciliationBatch` lineage.
   - Current: New reconciliation issues have exact batch and batch-line lineage, and source-family constraints exist, but full read/write closure and legacy behavior are not yet proven across all consumers.
   - Target: New headers and lines with both source families or neither source family are rejected. Header and line lineage must agree. No production path may infer family from ingredient name, display code, week label, date proximity or another approximate attribute.
   - Acceptance: Database constraints plus service/controller tests reject both-family, no-family and header/line mismatch fixtures before any issue, issue line or stock movement is committed.

2. **Mode-scoped reads and processing**: Every mode-sensitive list, detail, aggregate, export, approval, cleanup, preload and background operation processes only the source family authorized for its operation mode.
   - Current: Primary reconciliation pages and hidden query owners are separated, but reporting, approval, cleanup, export and background closure are not fully evidenced.
   - Target: `DEFAULT` business views process only MaterialRequest-origin records; reconciliation business views process only ReconciliationBatch-origin records. Audit may read both families only when each row, filter and export exposes `sourceFamily` and exact source identity. Business aggregates never add quantities across families.
   - Acceptance: Paired-identity fixtures with the same ingredient, customer and week return isolated counts/quantities per mode; audit returns both with explicit family labels; prohibited cross-family aggregate tests fail first and then pass after enforcement.

3. **Transactional mode/version precondition**: Every mode-sensitive mutation validates the active server mode and expected mode version inside the same transaction immediately before its first durable write.
   - Current: The operation mode has optimistic versioning and request eligibility, but a stale command racing a mode change is not yet proven to roll back every downstream write.
   - Target: A command created under an old mode/version fails closed when the authority changes. Validation covers workflow state, issue document, issue lines, stock movement, audit/lifecycle records and idempotency response as one atomic outcome.
   - Acceptance: A deterministic concurrency test pauses a mutation before write, changes mode/version, resumes the mutation and proves zero partial rows, zero stock delta and a clear version/configuration conflict response.

4. **Frozen inactive workflows**: Changing mode preserves unfinished records of the inactive family without allowing them to mutate until their owning mode becomes active again.
   - Current: Mode changes do not intentionally delete workflow data, but resume identity/version and all inactive-mode write fences are not yet proven.
   - Target: Switching mode never deletes, converts, copies, implicitly completes or re-parents a workflow record. Switching back exposes the same record identity, source lineage, state and concurrency version that existed before deactivation, except for explicit shared audit metadata.
   - Acceptance: Create an unfinished record in each family, switch away and prove every owning mutation fails; switch back and prove the same IDs, versions, quantities and statuses resume without duplicate or converted records.

5. **Mode-partitioned frontend state**: Query caches, preloads, URL scope and persisted selections are partitioned by mode or invalidated on every mode-version change.
   - Current: Capability changes invalidate operation-mode state and relocate unavailable routes, but stale multi-tab selections and pending mutations have not been fully tested.
   - Target: A browser session cannot render or submit a record selected under the previous mode. A second tab changing mode invalidates/relocates the first tab; backend preconditions remain authoritative if frontend invalidation is delayed.
   - Acceptance: Two headed browser contexts hold different mode versions; after one changes mode, the other loses stale data/selection, is relocated to an eligible route and receives a fail-closed response if a captured stale request is replayed.

6. **Shared authorities with restricted mutation**: Material, canonical unit, dish, BOM and customer data are shared and mutable only through retained Admin Data authority; physical inventory is shared and mutable only through canonical Warehouse transactions.
   - Current: Reconciliation retains BOM/audit Admin Data surfaces and Warehouse owns issue stock mutations, but the ownership rule is not yet asserted across all commands.
   - Target: Neither operation mode creates a second inventory balance, parallel stock ledger or mode-local master copy. Mode never grants permission. Reconciliation transfer and comparison create no stock movement, and non-Warehouse commands cannot alter stock.
   - Acceptance: Authority tests enumerate all retained mutation endpoints and prove master writes require existing Admin permission, inventory writes require canonical Warehouse authority, transfer/comparison stock delta is zero and switching mode grants no new permission.

7. **Immutable reconciliation snapshot**: A materialized/ready reconciliation batch freezes its source menu/version, servings, BOM resolution, ingredient identity, canonical unit and required quantity.
   - Current: Required quantities and source lineage are materialized, but the effect of later shared-master edits on every in-progress and historical batch state is not fully evidenced.
   - Target: Later BOM, dish, unit or customer edits affect only newly materialized batches. Existing frozen batches do not refresh or recalculate. A changed source requires a new batch/version rather than rewriting the prior batch.
   - Acceptance: Freeze a batch, mutate shared BOM/master data through authorized Admin Data, reload the batch and prove byte-equivalent frozen fields and quantities; create a new batch and prove it alone reflects the new authority.

8. **Exactly-once stock projection**: Stock movements retain exact issue and issue-line lineage and each issue command is idempotent across retries, concurrency and mode switching.
   - Current: Reconciliation issue creation uses canonical stock validation, command replay and exact batch-line links; complete duplicate and cross-family projection protection still requires paired runtime evidence.
   - Target: One issue line contributes to one source family and one stock movement chain. Replays return the original command result; concurrent duplicates produce no second issue, movement or issued-quantity contribution. Returns/corrections remain linked to the original line and contribute through canonical net issue semantics.
   - Acceptance: Retry and parallel-submit tests prove one issue document, one lineage-consistent set of lines, one movement chain and one net issued projection; the same movement is absent from the other family aggregate.

9. **Cross-mode verification and protected restoration**: Verification exercises paired identities, inactive workflows, stale clients, mode-switch races, retries and reloads without mutating protected data before explicit authorization.
   - Current: Local migration, focused tests and read-only five-viewport UI evidence exist; protected Phase 30 mutation evidence remains authorization-blocked.
   - Target: Local deterministic tests prove the isolation contract. After a separate explicit operator authorization, protected MySQL/API/headed-browser evidence proves the complete workflow and restores the final operation mode to `DEFAULT` without cleanup/reset/seed rescue.
   - Acceptance: The evidence manifest captures exact branch/SHA, frontend/backend identity, database target, migration state, starting/ending mode, paired source-family DB assertions, API requests, five required viewports and zero undispositioned cross-mode reads/writes; final protected mode is `DEFAULT`.

## Boundaries

**In scope:**
- Source-family classification and exact header/line lineage consistency for inventory issues.
- Mode-scoped query, aggregate, export, approval, cleanup, preload and background-processing closure.
- Transactional active-mode and expected-mode-version preconditions for mode-sensitive mutations.
- Frozen/resumable inactive workflow records across operation-mode changes.
- Mode-aware frontend cache, URL, preload, selection and stale-request behavior.
- Shared master-data authority through Admin Data and shared physical stock authority through Warehouse.
- Immutable reconciliation snapshots after materialization/ready authority.
- Idempotent stock movement and issued-quantity projection with exact source lineage.
- Local deterministic regression plus separately authorized protected MySQL/API/headed-browser evidence.
- Explicit legacy handling as `LEGACY_UNCLASSIFIED`: readable through audit/detail only, immutable and excluded from both business aggregates until exact lineage is proven.

**Out of scope:**
- Separate databases, schemas, inventory balances or master catalogs per mode — these would create competing physical truths.
- Automatic lineage inference or bulk backfill from names, display codes, dates, weeks or approximate matching — exact evidence is required.
- Conversion, copying or migration of active workflow records from one source family to the other — switching mode changes authority, not ownership.
- Deleting drafts/history during mode changes — preservation is required.
- Recalculating frozen batches after master-data changes — new authority requires a new batch/version.
- Restoring Purchasing or Reports to reconciliation primary workflow — Phase 30 closed-loop scope excludes them.
- Redesigning the complete `DEFAULT` workflow — compatibility must be preserved.
- Protected `ipc_lane7` mutation before a new explicit authorization checkpoint — planning and local tests do not authorize protected writes.

## Constraints

- `DEFAULT` retains its existing navigation, tabs, MaterialRequest issue path and business behavior.
- `MATERIAL_RECONCILIATION` retains exactly Dashboard, Weekly Menu, Warehouse, Reconciliation and Admin Data, with current backend-authoritative tabs.
- Warehouse remains the sole stock-mutation authority; transfer and reconciliation comparison have zero stock effect.
- Physical inventory and stock movement are shared system facts; workflow ownership is isolated by exact lineage.
- Mode checks supplement permission checks and must never grant permissions.
- Mode/version validation must be performed server-side inside the write transaction; frontend guards are supplementary only.
- Historical completed Phase 29 batches remain immutable/readable.
- Legacy records without exact source evidence remain `LEGACY_UNCLASSIFIED`, read-only and excluded from business aggregates.
- All database identity assertions use raw .NET GUID storage conventions.
- No reset, cleanup, seed or guessed repair may be used to make protected evidence pass.
- Protected execution remains backup-first, fail-closed and separately authorization-gated; final protected mode must be `DEFAULT`.

## Acceptance Criteria

- [ ] New issue headers and lines with both source families, neither source family or mismatched families are rejected atomically.
- [ ] No production code classifies source family using ingredient name, display code, week text, approximate date or another inferred match.
- [ ] `DEFAULT` list/detail/aggregate/export/approval/cleanup/background paths exclude reconciliation-origin records.
- [ ] Reconciliation list/detail/aggregate/export/approval/cleanup/background paths exclude MaterialRequest-origin records.
- [ ] Shared audit rows and exports expose `sourceFamily` plus exact source identity.
- [ ] Same-ingredient/same-week paired fixtures produce independent business totals with no cross-family sum.
- [ ] A mutation racing a mode/version change rolls back workflow, issue, line, movement, lifecycle and audit writes together.
- [ ] Inactive workflow records are readable only through authorized historical/detail surfaces and cannot be mutated.
- [ ] Switching back resumes the same unfinished record IDs, versions, states and quantities without conversion or duplication.
- [ ] A second browser tab changing mode invalidates/relocates the stale tab and backend replay of its captured mutation fails closed.
- [ ] Admin Data remains the only retained shared-master mutation authority and mode changes grant no additional permission.
- [ ] Reconciliation transfer/comparison and all non-Warehouse commands produce zero stock movement.
- [ ] Frozen reconciliation fields and quantities remain unchanged after authorized shared-master edits; only a new batch reflects new master authority.
- [ ] Retry and concurrent issue submission produce exactly one issue, one movement chain and one net issued projection.
- [ ] A movement/issue line is counted in exactly one workflow-family aggregate.
- [ ] `LEGACY_UNCLASSIFIED` records remain readable, immutable and excluded from both business aggregates until exact lineage is explicitly established.
- [ ] Local backend/frontend tests and source-aware closure checks pass without protected mutation.
- [ ] After separate authorization, protected evidence covers complete workflow, DB transitions, API/runtime errors and all five desktop viewports, then restores mode to `DEFAULT`.

## Edge Coverage

**Coverage:** 12/12 applicable edge groups resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|----------|-------------|--------|---------------------|
| empty/source classification | R1 | ✅ covered | Both-family, no-family and header/line mismatch fixtures are rejected atomically. |
| legacy/unclassified | R1, R2 | ✅ covered | Exact lineage absent → `LEGACY_UNCLASSIFIED`, audit/detail read-only, excluded from both business aggregates. |
| equal business keys | R2 | ✅ covered | Same ingredient/customer/week does not merge records across source families; exact lineage controls membership. |
| empty result sets | R2 | ✅ covered | A mode with no owned rows returns a valid empty result, never rows from the other family. |
| mode-switch concurrency | R3 | ✅ covered | Mode/version rechecked inside the write transaction; stale mutation rolls back every durable side effect. |
| interruption/partial write | R3 | ✅ covered | Transactional acceptance includes issue, lines, stock, lifecycle, audit and idempotency response. |
| switch away/switch back | R4 | ✅ covered | Record identity/version/state is frozen and resumes without conversion, deletion or completion. |
| repeated invalidation | R5 | ✅ covered | Repeated mode-version notifications are idempotent; stale cache and selection cannot reappear. |
| multi-tab race | R5 | ✅ covered | Backend remains authoritative when browser invalidation is delayed or interrupted. |
| master edit boundary | R7 | ✅ covered | Freeze point separates immutable existing batches from newly materialized batches using changed authority. |
| duplicate/retry/concurrency | R8 | ✅ covered | One command result, issue, movement chain and net projection survive replay and parallel submission. |
| quantity precision | R7, R8 | ✅ covered | Existing canonical-unit decimal semantics are preserved in frozen required and net issued projections; no cross-family rounding or recomputation is introduced. |

Engine suggestions about display ordering and interval adjacency were dismissed as non-applicable because source-family membership is identity-based, not an ordered merge/range operation. The relevant equal-key collision case is explicitly covered by paired exact-lineage fixtures.

## Prohibitions (must-NOT)

**Coverage:** 9/9 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|----------------------------------|-------------|--------|------------------------|
| MUST NOT infer lineage from ingredient name, display code, week text, approximate date or similar business attributes. | R1 | resolved | verification: test — paired ambiguous fixtures remain unclassified/rejected. |
| MUST NOT convert, copy, re-parent or implicitly complete workflow records when mode changes. | R4 | resolved | verification: test — pre/post identity and state comparison. |
| MUST NOT create mode-specific inventory balances, stock ledgers or duplicated master catalogs. | R6 | resolved | verification: judgment plus schema/source review. |
| MUST NOT let browser preference, URL, local storage or query cache determine source-family authority. | R3, R5 | resolved | verification: test — stale browser state loses against backend mode/version. |
| MUST NOT rewrite a frozen reconciliation snapshot from current master data. | R7 | resolved | verification: test — before/after frozen snapshot equivalence. |
| MUST NOT count one issue, issue line or movement in both workflow-family aggregates. | R2, R8 | resolved | verification: test — paired aggregate and exact-lineage assertions. |
| MUST NOT delete drafts or historical records merely because the active mode changes. | R4 | resolved | verification: test — switch-away/switch-back preservation. |
| MUST NOT use operation mode to bypass role/permission checks. | R6 | resolved | verification: test — permission matrix remains restrictive in both modes. |
| MUST NOT mutate protected `ipc_lane7` without a new explicit authorization checkpoint. | R9 | resolved | verification: judgment — execution gate and immutable evidence manifest. |

Generic injection, credential handling and transport-security concerns remain owned by the project security process and are not duplicated as phase-specific prohibitions.

## Ambiguity Report

| Dimension           | Score | Min   | Status | Notes |
|---------------------|-------|-------|--------|-------|
| Goal Clarity        | 0.95  | 0.75  | ✓ | One shared physical truth with isolated transactional workflow ownership. |
| Boundary Clarity    | 0.90  | 0.70  | ✓ | Shared authorities, isolated records, legacy policy and protected-data boundary are explicit. |
| Constraint Clarity  | 0.90  | 0.65  | ✓ | Warehouse authority, server transaction check, DEFAULT compatibility and no inferred lineage are locked. |
| Acceptance Criteria | 0.85  | 0.70  | ✓ | Cross-mode reads, writes, races, retries, frozen data and protected restoration have pass/fail checks. |
| **Ambiguity**       | **0.105** | **≤0.20** | **✓** | Weighted gate passed. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1 | Researcher | What does “separate the two modes” mean for existing architecture? | Keep one server mode authority, shared master/stock truth and permanently isolated transactional lineage. |
| 2 | Simplifier | What is the minimum safe isolation model? | Shared master data plus isolated workflow records; do not create separate databases or inventories. |
| 3 | Boundary Keeper | What happens to unfinished records and who mutates shared data? | Inactive records freeze and resume unchanged; Admin Data owns shared master mutation; Warehouse owns stock mutation. |
| 4 | Failure Analyst | How are legacy records, mode-switch races, stale tabs, master edits and shared audit handled? | E1-1 through E5-1 accepted: legacy read-only/unclassified, transactional mode/version checks, stale-client invalidation plus backend rejection, immutable snapshots and family-labelled audit with no cross-family business aggregate. |
| 5 | Seed Closer | Which harmful behaviors are explicitly forbidden? | All nine proposed prohibitions accepted, including no inferred lineage, no record conversion, no dual inventory and no unauthorized protected mutation. |

---

*Phase: 30-closed-loop-menu-issue-reconciliation*
*Spec created: 2026-08-29*
*Next step: update Phase 30 discussion/plan against this locked data-isolation contract before production edits.*
