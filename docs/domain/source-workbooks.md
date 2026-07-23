# Source Workbooks

The `.docs/` directory contains real business references for the IPC operation.
Use these files to understand workflow and reporting requirements. They should
not be treated as application-generated files unless a future import/export
feature explicitly supports them.

## File Inventory

| File | Purpose |
| --- | --- |
| `Document Database Lastest.docx` | Domain brief covering scope, actors, workflow, proposed database, reports, web screens, indexes, and performance notes. |
| `IPCmanagement.sql` | Proposed MySQL schema for the domain model. |
| `THỰC ĐƠN DRAXLMAIER TỪ NGÀY 15.06 - 20.06.xlsx` | Weekly DAV/Draxlmaier menu by day, vegetarian/non-vegetarian menu, and morning/afternoon shift. |
| `IPC. Định lượng 22.xlsx` | Quantity/BOM calculation workbook with order, calculation, data, and ingredient/supplier sheets. |
| `Đơn đặt hàng T5.2025.xlsx` | Daily order summary sheets with morning quantity, afternoon quantity, grand total, and notes. |
| `IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx` | Supplier/order tracking workbook with source ingredient lists, supplier sheets, debt/invoice summary, quantities, unit price, amount, and notes. |

## Workbook Semantics

### Weekly Menu Workbook

`THỰC ĐƠN DRAXLMAIER TỪ NGÀY 15.06 - 20.06.xlsx` maps naturally to:

- `customers`
- `menus`
- `menuItems`
- `menuSchedules`
- shift concepts such as `MORNING` and `AFTERNOON`

It separates:

- savory morning menu
- vegetarian morning menu
- savory afternoon menu
- vegetarian afternoon menu

Note: the workbook title says `15/06/2026` to `20/06/2026`, while the extracted
Excel date values read as `2025-06-15` to `2025-06-20`. Confirm the intended
year before using this file for imports or seed data.

### Quantity/BOM Workbook

`IPC. Định lượng 22.xlsx` is the closest operational source for the system's
calculation engine. It includes:

- order/menu inputs for morning and afternoon
- calculated required mass
- current stock
- required purchase quantity
- supplier and ingredient data
- cost and imported price fields

This should inform future work on BOM import, material request generation, and
production planning.

### Daily Order Summary Workbook

`Đơn đặt hàng T5.2025.xlsx` contains one sheet per service day. The pattern is:

- title: `BẢNG ORDER NGÀY ...`
- rows grouped by supplier or supplier category
- columns: `Ca sáng`, `Ca chiều`, `Grand Total`, `Ghi chú`

This maps to meal quantity plans and material request summaries rather than
direct customer ordering screens.

### Supplier Tracking Workbook

`IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx` contains:

- `NGUỒN`: source ingredient lists grouped by supplier/category
- `SUMMARY`: supplier summary, debt policy, invoice policy, and monthly totals
- supplier sheets such as vegetables, spices, groceries, frozen food, rice,
  fresh meat, drinks, eggs, and packaging
- order rows with delivery date, item name, unit, quantity, unit price, amount,
  notes, invoice confirmation, and daily totals

This maps to suppliers, ingredients, purchase requests, inventory receipts, and
receipt price reporting.

## Suggested Future Import Boundaries

If workbook import is added later, keep imports narrow and auditable:

1. Import menus from the weekly menu workbook into staging records before
   writing `menus`, `menuItems`, and `menuSchedules`.
2. Import BOM data separately from quantity plans so BOM changes can be audited.
3. Import daily order summaries as forecast/confirmed quantity batches, not as
   direct inventory movements.
4. Import supplier order tracking into purchase request or receipt staging, then
   require warehouse confirmation before stock is changed.
5. Preserve original file name, upload time, imported by user, and row-level
   validation errors through `quantityImportBatches` or a future equivalent
   staging table.
