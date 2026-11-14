# MRX menu → missing BOM → ingredient recovery

## Research and current flow

MRX source preview retains dishes with missing BOM and blocks batch creation. Its recovery banner opens the existing Excel BOM importer or `/admin-data?view=bom`. The BOM editor only selects among the first 200 loaded ingredients. The ingredient catalog page is read-only, although `POST /api/Ingredients` and `GET /api/Units` already exist. Excel BOM import can create an ingredient when its code is blank, but that path is difficult for a single dish and is not discoverable from the manual editor.

ERPNext and Odoo both treat components as catalog items referenced by BOM lines, with quantities held by BOM. Odoo's current BOM UI permits creating a missing component from the component selector. The project must retain its own catalog validation and BOM authority.

## Options

1. Add only a link to catalog: few UI changes, but catalog has no create action and the user loses the dish context.
2. Add an inline create panel within the existing BOM modal: preserves dish, tier and customer scope; reuses catalog and BOM APIs; respects one blocking modal. **Chosen.**
3. Add a new combined backend create-ingredient-and-BOM endpoint: atomic, but enlarges API and transaction scope for a single recovery action.

## Contract

- From MRX missing-BOM diagnostics, open the BOM management view filtered to missing dishes. Existing Excel batch import remains for many dishes and may create ingredients under its current parser contract.
- For many missing dishes, the primary recovery is: download the missing-dish Excel template for the current customer and tier, fill one row per ingredient with quantity/unit, leave ingredient code blank for truly new catalog items, preview warnings and errors, commit the workbook, then refresh the MRX source and recheck readiness. A failed preview must not create catalog items or BOM lines. Reuploading a corrected file repeats preview before commit. The menu itself is not reimported merely to add BOM.
- The Excel preview shows row-level errors and warnings. When invalid, it prioritizes all error rows and pages them; otherwise it pages every row in file order, so a late new-ingredient warning remains reachable.
- Generated ingredient codes reserve active and inactive catalog codes. Repeated name+unit within one workbook receives one generated code; a concurrent code collision may only reuse an active ingredient with the same name and unit, otherwise commit fails for repreview.
- The ingredient catalog route has a visible `Thêm nguyên liệu` action for authorized catalog writers. It creates the same master record and refreshes the list, so an operator can prepare ingredients before using either BOM path.
- After a catalog create succeeds, the list searches by the new code so the new record is visible even if the operator had an unrelated filter active.
- In the manual BOM editor, the user searches existing ingredients first. A clear `Tạo nguyên liệu mới` action opens an inline form for code, name, unit, freshness and reference price. It does not open another modal.
- The BOM selector queries the catalog as the user types, because the generic ingredient endpoint caps a page at 100 rows. The selected ingredient remains available after list refresh or a BOM save.
- Unit options come from `GET /api/Units`. Before POST, search catalog for the exact name and unit; if found, select the existing item and keep BOM quantity untouched. The server remains authoritative for duplicate code and validation.
- A successful catalog POST selects the new ingredient in the BOM form. The user explicitly enters positive quantity per serving and saves the BOM separately. An ingredient create never silently creates a BOM line.
- The UI preserves draft fields and blocks duplicate writes. On an unknown POST outcome, it requires a catalog lookup before retrying. The server determines permission; edit controls use the existing BOM edit role gate.
- Existing frozen MRX batch facts and issued-day edits remain unchanged. Missing BOM keeps batch creation blocked until a valid BOM is saved and source is rechecked.

## Coverage and boundaries

Test existing-ingredient reuse, new ingredient POST shape and selection, duplicate-code error, unknown outcome, unit-load error, and no accidental BOM write. Verify catalog page create/refresh and RBAC, Excel preview/commit warnings and MRX source refresh, MRX link scope, frontend build/lint, focused UI tests and code review. This scope does not add a new warehouse, stock movement or auto-price. Reference price zero is allowed by the current backend, but should be visibly marked as incomplete costing.

Research: https://docs.frappe.io/erpnext/bill-of-materials ; https://www.odoo.com/documentation/20.0/applications/inventory_and_mrp/manufacturing/management/bill_configuration.html
