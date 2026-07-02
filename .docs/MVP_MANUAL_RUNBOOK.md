# MVP Manual Runbook

Use this checklist for a 10-15 minute Iter1 demo.

Scope reference: `.docs/ITER1_PROD_READY_SCOPE.md` defines the official Iter1 production-ready acceptance boundary.

## Setup

1. Start backend and frontend.
2. Open the frontend and login with `admin` / `admin`.
3. Use customer `DAV` and week start `2026-06-15`.

## Flow

1. Weekly menu import
   - Go to Weekly Menu.
   - Choose customer `DAV`.
   - Set week start to `2026-06-15`.
   - Preview `.docs/THỰC ĐƠN DRAXLMAIER TỪ NGÀY 15.06 - 20.06.xlsx`.
   - Confirm that preview shows valid rows and skipped rows.
   - Save import and reload the committed menu.

2. Meal quantity
   - Go to Coordination.
   - Pick a day/shift with quantity data.
   - Edit a draft forecast serving value.
   - Blur the field and reload to confirm the value persists.

3. Demand and shortage
   - Return to Weekly Menu.
   - Open the `KHSX và nhu cầu` tab.
   - Click `Tạo demand từ KHSX`.
   - Confirm the page reports generated KHSX lines, ingredient demand lines, shortage lines, and missing BOM items.

4. Purchasing
   - Open Purchasing.
   - Confirm purchase demand lines show required quantity, current stock, purchase quantity, unit, supplier, and status.
   - Demo anchor: `PR-20260618-FULLDAY`.

5. Warehouse
   - Open Warehouse.
   - Confirm the current stock table is visible.
   - Confirm shortage rows route the operator toward issue or purchase handling.

6. Chef and reports
   - Open Chef Dashboard and confirm KHSX / material checklist is visible.
   - Open Reports.
   - Check ingredient demand, purchase demand, current stock, and audit sections.
   - Confirm audit includes demand and purchasing events with actor and timestamp.

## Expected Demo Anchors

- Material request: `MR-20260618-FULLDAY`
- Purchase request: `PR-20260618-FULLDAY`
- Example shortage: `Sữa chua`, required `129 Kilogram`, current stock `0`, purchase `129 Kilogram`
- Missing BOM list should include items such as `TÔM THỊT RIM DƯA MUỐI`

## Pass Criteria

- Import preview/save/reload succeeds.
- A serving edit persists after reload.
- Demand generation creates material demand and missing-BOM feedback.
- Purchase shortage list is generated from demand.
- Warehouse stock is visible from live current-stock data.
- Reports show demand, purchase, current stock, and audit rows.
