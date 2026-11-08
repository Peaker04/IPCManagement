# Phase 29: System Operation Mode and Material Reconciliation — Specification

**Created:** 2026-08-25  
**Ambiguity score:** 0.14 (gate: ≤ 0.20)  
**Requirements:** 13 locked

## Goal

IPCManagement changes from one implicit full-workflow mode to one audited server-authoritative global mode with a bounded immutable material-reconciliation workflow, while both modes receive evidence-backed clarity corrections that preserve permissions, business meaning and technical lineage.

## Background

IPCManagement currently exposes the complete golden workflow. Route eligibility is expressed through route configuration, navigation and `RoleGuard`, but no global operation-mode authority exists. Deployment configuration is not an Admin-mutated business setting, and browser storage cannot be authoritative.

Existing Weekly Menu, meal-quantity and `MaterialDemandService` flows can calculate demand and retain source identities, but they belong to the mutable full workflow and may create production plans, material requests and stock-reservation context. Purchasing, receipt, inventory issue and stock entities carry stronger lifecycle semantics than the deliberately bounded reconciliation branch. No immutable reconciliation batch currently records frozen required quantity, tolerance, independently entered purchased/issued actuals, revisions and exception dispositions.

Phase 27/28 already established evidence-first UI contracts. Phase 29 reuses that harness and existing owners rather than creating a second audit framework or generic renderer.

## Requirements

1. **One server-authoritative operation mode**: The active mode is exactly one system-wide persisted value, `DEFAULT` or `MATERIAL_RECONCILIATION`; browser and per-user state cannot override it.
   - Current: No persisted mutable operation-mode aggregate exists; application behavior assumes the complete workflow.
   - Target: A durable singleton business authority supplies one validated global mode to backend and frontend consumers.
   - Acceptance: Server readback, two different authenticated users and a fresh browser session report the same value; changing or clearing browser state cannot change it; missing/invalid persisted mode fails closed instead of silently assuming `DEFAULT`.

2. **Admin-only audited mode mutation**: Only Admin may change mode after explicit confirmation; actor/time and reason when work is in progress are persisted, clients invalidate configuration and users on excluded routes relocate safely without data deletion.
   - Current: No operation-mode mutation or audit contract exists.
   - Target: The mode transition is authorized, transactional, audited and propagated to active clients.
   - Acceptance: Admin mutation persists old/new mode, actor and timestamp; non-Admin mutation is denied; work-in-progress requires a non-empty reason; mode switch leaves workflow and batch data unchanged and a fresh/config-invalidated client observes the new mode.

3. **Mode before permission eligibility**: Every protected route, navigation item, preload, action and backend operation evaluates current mode eligibility before applying existing permissions.
   - Current: Navigation, lazy preload, route permission and backend authorization do not consume one shared mode contract.
   - Target: Excluded operations are unavailable at every boundary while retained operations still require their existing permissions.
   - Acceptance: Role × mode × route/action/API tests prove mode never grants permission; excluded direct routes render the mode-unavailable state instead of `/403`; excluded routes issue no intent preload/data request; a mutation racing with a mode change cannot commit under stale mode.

4. **Locked route matrix**: `MATERIAL_RECONCILIATION` retains Dashboard, Weekly Menu, Purchasing, Warehouse, Reports, Admin Data and Admin-only Advanced Settings and excludes Coordination, Approvals, Chef Dashboard and Approval Rules for every role, including Admin.
   - Current: All routes follow only permission eligibility.
   - Target: The locked matrix governs navigation, direct routing and action inventory while `DEFAULT` preserves current route behavior.
   - Acceptance: Automated matrix coverage checks every listed route for Admin and representative non-Admin roles in both modes, including retained-route permission denial and excluded-route mode-unavailable behavior.

5. **Draft batch per committed import**: Each successful committed Weekly Menu import establishes an independently identified draft reconciliation batch linked to that import and its meal-quantity sources.
   - Current: Imports create menu/version history but no reconciliation batch.
   - Target: Imports are never merged into one historical comparison authority; draft batches expose diagnostics until explicitly made ready.
   - Acceptance: Two committed imports create two distinct batch identities; preview/failure creates no authoritative batch; a draft with no valid material line or unresolved ingredient/unit identity cannot become ready.

6. **Immutable ready authority and grain**: Explicit “Sẵn sàng đối chiếu” confirmation creates the immutable comparison authority at grain `batch × ingredient identity × canonical unit` and freezes required quantity, source contributors and applicable tolerance/version.
   - Current: Default-workflow demand can be recalculated or cancelled after source changes.
   - Target: Later menu, BOM, unit or tolerance changes cannot rewrite historical batch lines or verdicts.
   - Acceptance: After ready confirmation, source/config changes leave stored required quantity, canonical unit, tolerance and verdict byte/decimal-equivalent; same-name ingredients remain separate; duplicate source lines with the same ingredient/unit aggregate only at the locked grain and retain drill-down contributors.

7. **Batch-owned purchased actuals**: Purchasing records purchased quantity directly for each ready batch line without creating procurement or inventory lifecycle records.
   - Current: Purchased quantities are represented through the full PR/PO/receipt workflow.
   - Target: The bounded branch owns explicit purchased actual entries with actor/time provenance.
   - Acceptance: Entry and readback preserve batch-line identity, canonical unit, actor and timestamp; DB before/after proves no PR, PO, receipt, stock movement, lot, snapshot or current-stock mutation.

8. **Batch-owned issued actuals**: Warehouse records issued quantity directly for each ready batch line without creating warehouse documents, movements or stock deduction.
   - Current: Issued quantities are represented through inventory issue and stock movement lifecycle.
   - Target: The bounded branch owns explicit issued actual entries with actor/time provenance while continuing to enforce Warehouse permissions.
   - Acceptance: Entry and readback preserve batch-line identity, canonical unit, actor and timestamp; DB before/after proves no inventory issue, stock movement, lot, snapshot or current-stock mutation.

9. **Append-only actual correction**: Before completion, purchased or issued actuals may be corrected only by an append-only revision recording old value, new value, actor, timestamp and non-empty reason; frozen demand/tolerance remain unchanged.
   - Current: No reconciliation actual or revision aggregate exists.
   - Target: Corrections are auditable and stale concurrent writers cannot silently overwrite one another.
   - Acceptance: Each correction adds a revision and changes the current projection; prior values remain queryable; optimistic concurrency rejects stale writes and a concurrency test proves no last-write-wins audit loss.

10. **Exact comparison and tolerance semantics**: Every line exposes required, purchased and issued quantities plus `purchased − required`, `issued − required` and `purchased − issued`; exact differences remain visible and `Cần kiểm tra` applies only when an absolute applicable difference is greater than frozen tolerance.
   - Current: No reconciliation comparison projection exists.
   - Target: Comparison results are deterministic historical data with explicit tolerance-boundary behavior.
   - Acceptance: Positive, negative, zero and exactly-equal-to-tolerance fixtures return exact decimal differences; equality at tolerance is within tolerance; only `>` tolerance is exceptional; default ordering prioritizes exceptions and a secondary control shows all rows.

11. **Meaningful batch completion**: A batch completes only when every existing line has explicit purchased and issued values, including explicit zero, and every `Cần kiểm tra` line has a disposition and non-empty reason.
   - Current: No reconciliation lifecycle or completion gate exists.
   - Target: Completion means quantities and exceptions have been consciously resolved rather than merely viewed.
   - Acceptance: Missing/null actuals, unresolved exception dispositions and empty batches block completion; explicit zero satisfies quantity presence but does not fabricate a line; completed batches reject further actual mutation.

12. **Concise user language with authorized action**: Both modes use concise regions that communicate current condition and at most one authorized next action without duplicated headings, implementation vocabulary or unavailable instructions.
   - Current: Audited routes contain redundant notes, stacked empty-state prose and technical copy.
   - Target: Corrections occur at the lowest demonstrated owner and retain loading, empty, error, permission, stale-data and audit distinctions.
   - Acceptance: Owner inventory and semantic DOM assertions prove each corrected region has one state message and no more than one permitted next action; actors lacking that action do not see its instruction; error/unknown states are not relabeled as empty/success.

13. **Decision-bearing tables and preserved identity**: Tables prioritize decision fields, use type-correct alignment/spacing and may shorten technical identifiers only when full values remain inspectable, copyable and searchable and unchanged in API/export/audit/lineage.
   - Current: Full technical codes consume width and some tables expose low-priority technical columns or repeated unit text.
   - Target: Presentation is concise and collision-safe without erasing technical authority or business meaning.
   - Acceptance: Corrected table contracts verify alignment, overflow, column priority and full-ID inspect/copy/search; colliding short forms expand until distinguishable or show full values; API/export/audit raw IDs remain unchanged; headed DOM/geometry evidence, not screenshots alone, authorizes closure.

## Boundaries

**In scope:**

- Durable global operation-mode read and Admin mutation contracts with audit and safe client propagation.
- Frontend navigation, route, preload and action eligibility plus backend operation enforcement.
- The exact retained/excluded route matrix approved for reconciliation mode.
- Draft reconciliation batch creation from committed Weekly Menu import and meal-quantity sources.
- Ready/freeze lifecycle, immutable required quantity/tolerance/source contributors and canonical-unit grain.
- Batch-owned purchased and issued actual entry, append-only corrections, comparisons, dispositions and completion.
- Reconciliation reporting/table/filter/history/export contracts required to inspect immutable batches.
- Project-wide clarity, table, identifier, empty-state and hierarchy correction across both modes in bounded lowest-owner waves.
- Role/mode/backend/database/browser verification and documentation/state closeout.

**Out of scope:**

- Replacing or deleting the current default golden workflow — `DEFAULT` must preserve it.
- Per-user, per-role or per-browser mode selection — the approved authority is one global server value.
- Deriving new permissions from mode — existing authorization remains independent and mandatory.
- Creating PRs, POs, receipts, inventory issues, stock movements or stock balances from reconciliation actual entry — the first branch is deliberately bounded.
- Automatically normalizing unresolved legacy units, converting `G`, rounding counted units or merging ingredients by name — these require separate source-owner decisions.
- Rewriting historical batches after menu/BOM/unit/tolerance changes — history is immutable.
- A broad brand redesign, component-stack replacement, generic page renderer, UI DSL or second audit framework — clarity corrections reuse current owners and evidence architecture.
- Deleting data when changing mode — mode controls eligibility, not data retention.

## Constraints

- Use one existing RTK Query `apiSlice` architecture and preserve reducer, middleware and cache identity.
- Do not use `localStorage`, session state or deployment `appsettings` as mutable operation-mode authority.
- Preserve current public/API behavior for `DEFAULT` except explicitly specified user-facing clarity corrections and versioned Phase 29 contracts.
- Preserve ingredient, unit, warehouse, source-line, audit, export and database lineage identities.
- Decimal comparison and tolerance use stored canonical-unit values; display rounding cannot decide `Cần kiểm tra`.
- Mode and actual-entry concurrency must fail closed; no silent last-write-wins.
- Browser verification uses the five desktop viewports in `MEMORY.md`, headed Chrome and semantic DOM/API/DB/performance evidence.
- Database mutation requires a disposable approved lane, preconditions, rollback checkpoint, reviewed migration, postflight lineage and evidence indexing before promotion.

## Acceptance Criteria

- [ ] One persisted validated global mode is identical across users/sessions and cannot be overridden by browser state.
- [ ] Missing or invalid mode fails closed and never silently becomes `DEFAULT`.
- [ ] Only Admin changes mode; confirmation and audit actor/time are mandatory, and in-progress work requires reason.
- [ ] A mode transition deletes or rewrites no workflow or reconciliation data.
- [ ] Role × mode × route/action/API matrix proves mode eligibility precedes but never replaces permission checks.
- [ ] Excluded direct routes render “Chức năng này không sử dụng trong chế độ Đối chiếu nguyên liệu.” rather than `/403`.
- [ ] Excluded routes/actions issue no unauthorized preload/query/mutation request.
- [ ] A mutation racing with a mode switch cannot commit when the new mode excludes it.
- [ ] Each committed import creates a distinct draft batch; preview/failure creates no authoritative batch.
- [ ] Empty or unresolved ingredient/unit batches cannot become ready or complete.
- [ ] Ready confirmation freezes batch grain, required quantities, source contributors and tolerance/version.
- [ ] Same-name ingredients never merge; duplicate source rows aggregate only by ingredient ID and canonical-unit ID with drill-down lineage.
- [ ] Purchased and issued actual entry creates no procurement, warehouse, stock or ledger records.
- [ ] Corrections are append-only with old/new/actor/time/reason and stale concurrent writes are rejected.
- [ ] Exact comparison fixtures cover shortage, surplus, zero and equality at tolerance; only values greater than tolerance are `Cần kiểm tra`.
- [ ] Completion requires explicit purchased/issued values for every line and disposition/reason for every exceptional line.
- [ ] Explicit quantity zero is distinguishable from missing input; an empty batch cannot complete.
- [ ] Completed batches reject actual mutation and remain unchanged after source/config edits.
- [ ] Reconciliation default view prioritizes exceptions and exposes a secondary `Hiện tất cả` control.
- [ ] Corrected UI regions contain one concise state plus at most one action authorized for the actor.
- [ ] Short identifiers remain full-value inspectable/copyable/searchable and collision-safe in the visible result set.
- [ ] API/export/audit/source identities remain unchanged by presentation cleanup.
- [ ] Full backend/frontend regression, generated-contract parity, migration/model, architecture, hygiene and headed browser/DB evidence gates pass before Phase 29 closes.

## Edge Coverage

**Coverage:** 8/8 applicable edges resolved · 0 unresolved

| Category | Requirement | Status | Resolution / Reason |
|---|---|---|---|
| invalid/empty authority | OPM-01 | ✅ covered | Missing/invalid persisted mode fails closed; no implicit default. |
| concurrency | OPM-02/03 | 🧪 backstop | Race mode mutation against excluded backend mutation; excluded mutation must rollback/fail. |
| empty/unresolved input | MRC-01 | ✅ covered | Draft may expose diagnostics but cannot become ready without a valid resolved material line. |
| identity adjacency | MRC-01/02 | ✅ covered | Aggregate only by ingredient ID + canonical-unit ID and retain source contributors. |
| numeric boundary | MRC-05 | ✅ covered | `abs(difference) == tolerance` is within tolerance; only `>` is exceptional. |
| concurrency | MRC-04 | 🧪 backstop | Optimistic-concurrency held-out test rejects stale actual correction and preserves audit revisions. |
| empty completion | MRC-06 | ✅ covered | Empty batch cannot become ready/completed; explicit zero applies only to an existing line. |
| identifier collision | CLR-02 | 🧪 backstop | Held-out UI fixture requires distinguishing expansion/full value when short forms collide. |

Classifier-generated merge/order rows for route lists and prose rules were dismissed because they do not describe an independent merge or stable-sort operation beyond the concrete edges above.

## Prohibitions (must-NOT)

**Coverage:** 4/4 applicable prohibitions resolved · 0 unresolved

| Prohibition (must-NOT statement) | Requirement | Status | Verification / Reason |
|---|---|---|---|
| Mode MUST NOT grant permissions, rewrite assignments, or disguise a retained-route permission denial as mode unavailability. | OPM-03/04 | resolved | verification: test — role × mode × route/action/API matrix. |
| Reconciliation actual entry MUST NOT create or mutate PR/PO/receipt/issue, stock movement/current stock/lot/snapshot or historical warehouse provenance. | MRC-03 | resolved | verification: test — database before/after mutation inventory. |
| Mode switch, reimport, BOM/unit/tolerance edits MUST NOT rewrite frozen batch lines, verdicts, identity bindings, revisions or dispositions. | MRC-02/04 | resolved | verification: test — immutable-history regression. |
| Clarity cleanup MUST NOT erase source identity, decision quantity/status/reason, authorized actions, error/permission/stale/audit meaning, or use screenshots as the sole verdict. | CLR-01/02/03 | resolved | verification: judgment plus semantic DOM/runtime contracts; raw-ID access is mechanically tested. |

Generic injection, path traversal and standard web-security prohibitions remain owned by the project security review and secure-phase gates and are not duplicated here.

## Ambiguity Report

| Dimension | Score | Min | Status | Notes |
|---|---:|---:|---|---|
| Goal Clarity | 0.92 | 0.75 | ✓ | Global mode, bounded batch workflow and clarity outcome are explicit. |
| Boundary Clarity | 0.87 | 0.70 | ✓ | Full golden workflow and stock/procurement mutation are explicitly excluded. |
| Constraint Clarity | 0.84 | 0.65 | ✓ | Identity, unit, cache, concurrency, evidence and DB constraints are locked. |
| Acceptance Criteria | 0.82 | 0.70 | ✓ | Route/role/API/DB/history/UI pass-fail gates are listed. |
| **Ambiguity** | **0.14** | **≤0.20** | **✓** | Ready for implementation discussion. |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|---|---|---|---|
| 1 | Researcher | When does an import become reconciliation authority? | Commit creates draft; explicit “Sẵn sàng đối chiếu” establishes immutable authority. |
| 1 | Researcher | What owns purchased actuals? | Batch-owned direct entry; no PR/PO/receipt/stock mutation. |
| 1 | Researcher | What happens when mode changes with work in progress? | Change is allowed but requires Admin reason and preserves all data. |
| 2 | Researcher + Simplifier | What owns issued actuals? | Warehouse enters batch-owned issued values without inventory issue or stock mutation. |
| 2 | Researcher + Simplifier | Can actuals be corrected? | Yes before completion, only through append-only audited revisions. |
| 2 | Researcher + Simplifier | What makes completion meaningful? | Every line has explicit purchased/issued values and every exception has disposition/reason. |
| Edge probe | Failure Analyst | Invalid mode, races, empty batch, duplicate identity, tolerance boundary and code collisions | E1–E8 accepted with explicit criteria or held-out backstop tests. |
| Prohibition probe | Failure Analyst | What could the feature silently become that is forbidden? | P1–P4 accepted: no permission laundering, fake stock lifecycle, history rewriting or meaning-erasing cleanup. |

---

*Phase: 29-system-operation-mode-and-material-reconciliation*  
*Spec created: 2026-08-25*  
*Next step: `$gsd-discuss-phase 29` — implementation decisions for the locked specification*
