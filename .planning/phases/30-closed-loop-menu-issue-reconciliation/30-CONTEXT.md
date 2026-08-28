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

<verification>
## Required verification

- Backend domain, authorization, operation-mode, migration and idempotency tests.
- Generated OpenAPI/frontend contract parity.
- Frontend route/capability/query-ownership tests proving removed routes/tabs produce zero requests.
- Focused semantic tests for each retained work surface.
- Full backend/frontend regression, lint, build, EF pending-model and hygiene gates.
- Headed Chrome across the five current desktop viewports.
- End-to-end evidence: Weekly Menu source → required lines → transfer → inventory issue/stock movement → reconciliation difference → disposition/completion → reload.
- DB evidence must use raw .NET GUID storage representation and preserve final operation mode `DEFAULT`.
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
