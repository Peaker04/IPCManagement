# Phase 30: Closed-loop Menu → Warehouse Issue → Reconciliation — Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Refine `MATERIAL_RECONCILIATION` into one deliberately smaller closed workflow:

`Weekly Menu import → material quantity calculation → warehouse issue list → actual warehouse issue → required-versus-issued reconciliation → completion`.

This mode has no Purchasing step and assumes the operational warehouse has sufficient material. Warehouse issue remains a real stock mutation owned by the existing Warehouse authority; reconciliation reads that authority and never asks the user to type the issued quantity again.
</domain>

<locked_decisions>
## Product decisions locked by Kỳ

- `DEFAULT` remains unchanged, including Purchasing and its complete golden path.
- `MATERIAL_RECONCILIATION` removes Purchasing and Reports from navigation and query/preload ownership.
- Reconciliation-mode navigation is exactly: Dashboard, Weekly Menu, Warehouse, Reconciliation, Admin Data. Admin-only Advanced Settings remains available as configuration, not a primary workflow item.
- Weekly Menu keeps only `schedule` and one material-quantity work area. User-facing label is **Định lượng xuất kho**; a clean technical identity such as `material-demand` is preferred over `purchase-summary`.
- Warehouse keeps only **Danh sách cần xuất** and **Lịch sử xuất kho**. It performs the real inventory issue and stock movement.
- Reconciliation is a new top-level route with no tabs and one compact comparison table.
- Admin Data keeps only the smallest source-maintenance surfaces required by this mode: BOM/material validation and audit. Do not relabel a stock-oriented page as a catalog page if its source ownership does not match.
- Reconciliation compares exactly two authorities: frozen/materialized `requiredQuantity` and warehouse-derived `issuedQuantity`.
- Purchased quantity and all purchase-related differences/actions are absent from this mode UI and workflow. Existing Phase 29 schema/history may remain for compatibility; do not destructively rewrite completed historical batches.
- `issuedQuantity` is projected from linked warehouse issue lines. It is not independently editable in Reconciliation.
- Hidden tabs/routes must not mount queries, preload bundles or expose actions.
- Each retained page/tab must also remove unrelated default-mode content; this is not merely a tab-hiding change.
</locked_decisions>

<workflow>
## Target workflow

1. Authorized user imports or selects one Weekly Menu customer/week source.
2. Existing canonical quantity commit/materialization calculates exact ingredient demand from menu, servings and BOM.
3. User reviews **Định lượng xuất kho** and explicitly transfers the frozen list to Warehouse.
4. Warehouse receives one source-linked issue list and creates real inventory issue document(s) through existing stock ledger authority.
5. Reconciliation projects actual issued quantity from exact linked inventory issue lines.
6. The single table shows ingredient, required, issued, signed difference, verdict and one contextual action.
7. Unresolved differences receive a structured disposition; completion rechecks that no line is unissued or unresolved.
</workflow>

<information_architecture>
## Minimal information architecture

- **Dashboard:** one current-scope progress summary and one next action; no broad KPIs/charts.
- **Weekly Menu / Kế hoạch tuần:** customer/week/import/source confirmation only.
- **Weekly Menu / Định lượng xuất kho:** ingredient, canonical unit, required quantity, source diagnostic and transfer-to-Warehouse action; no cost, supplier, stock or purchase fields.
- **Warehouse / Danh sách cần xuất:** required, issued, remaining, issue state and issue action for the selected reconciliation source.
- **Warehouse / Lịch sử xuất kho:** only linked issue documents/lines for the selected reconciliation source.
- **Reconciliation:** one table with `Nguyên liệu | Cần xuất | Đã xuất kho | Sai lệch | Kết quả | Thao tác`; default filter is actionable rows.
- **Admin Data:** only source/BOM/material validation and workflow audit relevant to the selected scope.
</information_architecture>

<safety>
## Authority and data safety

- No Purchasing API, PR, PO, receipt or supplier mutation is allowed in this mode.
- Transfer to Warehouse does not itself change stock.
- Only the existing warehouse issue transaction/stock ledger changes stock.
- Every warehouse issue line must have durable exact reconciliation source-line identity. Never correlate by ingredient name, display code, week text or approximate date.
- Replays/concurrency must not create duplicate transfer authority, duplicate issue document or duplicate stock movement.
- Warehouse stock shortage is an invariant failure in this mode, not a route to Purchasing. It fails closed with user guidance and audit.
- Source/menu/BOM changes after transfer do not rewrite the issued list. They require a new batch/version.
- Completed Phase 29 records remain readable and immutable.
</safety>

<ui_rules>
## UI rules

- Follow `docs/DASHBOARD-UI-RULES.md`, especially P1–P8, L1–L6, T1–T16, E1–E8, F12–F24 and accessibility requirements.
- One primary action per work surface.
- Main tables expose at most 5–7 decision fields; technical provenance belongs in drawers/detail.
- Ingredient name is primary, code secondary; UUID is hidden by default.
- Numbers use centralized quantity/unit formatters and tabular numerals.
- Empty/loading/error/mode/permission states remain distinct.
- Screenshots are reviewer artifacts only; verdicts require DOM/query/request/DB/reload evidence.
</ui_rules>

<data_isolation_decisions>
## Locked L2 continuation decisions (E1-1 through E5-1)

- **E1-1 — exact family authority:** transactional issue ownership is permanently one of `DEFAULT` (`MaterialRequest` / `MaterialRequestLine`), `MATERIAL_RECONCILIATION` (`ReconciliationBatch` / `ReconciliationBatchLine`) or historical `LEGACY_UNCLASSIFIED`. The legacy class is audit/detail read-only and excluded from both business aggregates; no inferred backfill is allowed.
- **E2-1 — transactional mode/version authority:** every mode-sensitive command rechecks the active server mode and expected mode version inside the same database transaction immediately before its first durable write. A race with a mode change rolls back workflow state, issue header/lines, stock movement, lifecycle/audit and idempotency response together.
- **E3-1 — stale client handling:** frontend caches, URL scope, persisted selection and preloads are subordinate to the server mode/version. A version change clears or partitions mode-owned state and relocates invalid routes; delayed clients still lose at the backend transaction fence.
- **E4-1 — immutable materialization:** once a reconciliation batch is materialized/READY, its source menu/version, servings contributors, BOM selection, ingredient, canonical unit, required quantity and tolerance are frozen. Later shared-master edits affect only a newly materialized batch.
- **E5-1 — labelled audit without mixed business totals:** audit may expose all source families only with `sourceFamily` and exact source identity on every row/filter/export. Business lists, processing owners and aggregates remain family-exact and never sum across families.
- All nine prohibitions in `30-SPEC.md` are locked. In particular: no name/code/week/date lineage inference, no record conversion on mode switch, no duplicate inventory/master authority, no permission bypass, and no protected `ipc_lane7` mutation.
- The approved execution scope is local deterministic verification only. Protected MySQL/API/headed-browser mutation is removed from the remaining plan and remains a separately authorized activity outside this continuation.
</data_isolation_decisions>

<ownership_matrix>
## Entity × read × write × aggregate × mode-switch ownership matrix

| Entity / authority | DEFAULT reads | RECONCILIATION reads | Write owner and transactional fence | Aggregate membership | Mode-switch behavior |
|---|---|---|---|---|---|
| Shared Material / Unit / Dish / BOM / Customer | Retained authorized business/admin readers | Retained Admin Data BOM/material validation and exact source readers | Existing Admin Data permission owners only; mode grants no permission | Never duplicated by mode; frozen batches do not re-read them | Shared facts remain available; no workflow re-parenting |
| Physical `CurrentStock` / `StockMovement` | Canonical Warehouse views and transactions | Canonical Warehouse views and source-linked issue transaction | Warehouse stock ledger only; mode/version + permission checked before write | Shared physical truth, but each movement contributes through one exact issue-line family | Preserved; switching mode creates no stock delta |
| `MaterialRequest` / `MaterialRequestLine` | Business list/detail/approval/cleanup/background owners may process exact MaterialRequest lineage | Excluded from reconciliation business views; audit/detail only when family labelled | Existing DEFAULT workflow owners under DEFAULT and permission fences | DEFAULT totals only | Frozen while inactive; same IDs/version/state resume on return |
| `ReconciliationBatch` / line / contributor snapshot | Historical labelled detail only where authorized | Primary closed-loop list/detail/transfer/completion authority | Reconciliation service commands under RECONCILIATION plus expected mode/version transaction fence | RECONCILIATION required totals only from persisted frozen lines | Frozen while inactive; no delete/copy/convert/recompute |
| `InventoryIssue` header | Only MaterialRequest-origin business rows; legacy only labelled audit/detail | Only ReconciliationBatch-origin source list/history; legacy only labelled audit/detail | `InventoryIssueService` + canonical Warehouse permission; header has exactly one family | Classified by exact header lineage; unclassified excluded | Existing records preserved; inactive-family mutation rejected |
| `InventoryIssueLine` | Only exact `MaterialRequestLineId` | Only exact `ReconciliationBatchLineId` | Same issue transaction; header/line family must agree before stock mutation | One line contributes to one family only | Identity and quantities preserved |
| Return/correction linked to issue line | Net semantics for exact DEFAULT source line | Net semantics for exact reconciliation source line | Existing canonical Warehouse return/correction authority | Subtract/include only through exact original issue-line lineage; never name/date joins | Preserved and counted with original family |
| Lifecycle command / idempotency response | Keyed to exact DEFAULT aggregate/source | Keyed to exact reconciliation aggregate/source | Staged in the same transaction as owning mutation after mode/version recheck | Replay returns original result; no second contribution | Stale replay fails or returns prior committed result; never crosses family |
| Audit row / export | May read all authorized families with explicit labels | May read all authorized families with explicit labels | Existing audited owner; source identity is mandatory | No mixed business sum; audit grouping is family-labelled | Preserved across switches |
| Frontend RTK cache / URL / persisted selection / preload | Partitioned or invalidated by `DEFAULT` + mode version | Partitioned or invalidated by `MATERIAL_RECONCILIATION` + mode version | Browser is never authority; mutations carry expected server version | No client-side cross-family merge | Version change clears stale selected records, blocks preload and relocates invalid routes |
| `LEGACY_UNCLASSIFIED` issue records | Authorized audit/detail only | Authorized audit/detail only | Immutable until exact evidence is explicitly established by a separately authorized process | Excluded from both business aggregates | Preserved unchanged |
</ownership_matrix>

<verification>
## Required verification for the approved continuation

- Local deterministic backend tests at confirmed controller/service seams for exact-family read/write/aggregate behavior, in-transaction mode/version races, frozen snapshots and idempotent stock projection.
- Generated OpenAPI/frontend contract parity when a public contract changes.
- Frontend provider/router/cache/query-ownership tests for mode-version invalidation, URL/selection cleanup, route relocation and zero excluded preload/request ownership.
- DEFAULT compatibility suites, full bounded backend/frontend regression, lint, build, EF pending-model and hygiene gates.
- No database command may target `ipc_lane7`; no protected browser/API mutation is part of these plans.
</verification>

<out_of_scope>
## Out of scope

- Redesigning the `DEFAULT` workflow.
- Reintroducing Purchasing in reconciliation mode.
- Procurement, supplier, receipt or purchase-price behavior.
- Broad Dashboard/report redesign or charts.
- Automatic stock repair, seed/reset or fabricated sufficient stock.
- Editing issued quantities directly in Reconciliation.
- Recomputing completed batches in place.
- A new UI framework, generic page renderer or duplicate table/drawer primitive.
</out_of_scope>

---

*Phase: 30-closed-loop-menu-issue-reconciliation*
