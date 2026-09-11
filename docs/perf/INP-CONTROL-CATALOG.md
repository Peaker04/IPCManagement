# INP control catalog — Wave 7

This catalog joins the probe matrix to the table-standardization wave. A cell is
only gradable when the control is a real user affordance in the active route/tab;
absence is retained as machine-readable `N/A` with a reason.

| Route/tab family | Required control owners | Probe interaction IDs | Current disposition |
|---|---|---|---|
| Weekly Menu: `schedule` | tab switch, date/week scope, cell action, modal/dialog, search where present | `tab-switch`, `scope-change`, `row-action`, `modal-open`, `search-keystroke` | Run per active tab; add owner selectors for date and cell actions before closure |
| Weekly Menu: `demand`, `production-plan`, `purchase-summary`, `cost`, `dish-materials` | tab switch, scope/date, table row action, export/modal where present | same catalog, selector must be panel-scoped | Conditional controls require owner evidence; no route-shell inference |
| Reports: price/demand/stock/data-quality | tab switch, search, sort, pagination, export/action | `tab-switch`, `search-keystroke`, `table-sort`, `pagination`, `row-action`, `modal-open` | Pagination now has a semantic navigation selector; export still needs an explicit owner where user-visible |
| Admin Data: BOM/contracts/cleanup/inventory/statistics/employees/audit | tab switch, search, sort, pagination, row action, modal/submit | full catalog including `pagination` | Keep technical diagnostics out; measure only user-facing actions |
| Warehouse: movement/demand/exceptions | tab switch, search, pagination, row action, modal/submit | full catalog | Search and tab-switch have five-repeat evidence; geometry load gate is green |
| Chef, Approvals, Approval Rules | tab switch, filters/date, row action, modal/decision, pagination | full catalog | Build target-specific owner selectors; `N/A` must identify absent vs hidden vs no entry |

## Required additions before Wave 7 close

- Add semantic interaction IDs for pagination, date/week scope, export, form
  submit, decision/approval, and modal confirm when those controls exist.
- Give each added interaction a stable `data-*` or accessible role/label owner;
  do not use Tailwind class selectors.
- Run each populated cell five times on a cold context and retain all three
  timing components plus dominance classification.
- Keep `row-action` in every target matrix, even when it returns justified `N/A`.
- Reconcile every `N/A` against the rendered DOM and conditional state before
  declaring a wave complete.
