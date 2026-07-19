# MVP Demo Runbook & Data Reference

> Merged from MVP_DEMO_DATA.md + MVP_MANUAL_RUNBOOK.md on 2026-07-08.

---

## Demo Data Reference

# MVP Demo Data

Use this compact data path for the Iter1 demo flow.

## Source Files

- Weekly menu: `.docs/THỰC ĐƠN DRAXLMAIER TỪ NGÀY 15.06 - 20.06.xlsx`
- BOM and ingredient catalog: `.docs/IPC. Định lượng 22.xlsx`
- Meal quantities: `.docs/Đơn đặt hàng T5.2025.xlsx`
- Inventory and stock history: `.docs/IPC. Theo dõi đặt hàng ngày 19.5.2026.xlsx`

## Demo Anchors

- Login: `admin` / `admin`
- Reset/seed script: `scripts/MVP_DEMO_SEED_RESET.ps1`
- Customer: `DAV`
- Menu week: `2026-06-15` to `2026-06-20`
- Confirmed demand day: `2026-06-18`
- Material request: `MR-DAV-20260618-FULLDAY`
- Purchase request: `PR-20260618-FULLDAY`

## Verified Local Snapshot

- Latest evidence: `.artifacts/release-gates/20260707-123452/quality-gate-summary.md`
- Customers created/updated: 0/1
- Dishes created/updated: 0/573
- Current stock created/updated: 0/1571
- Generated demand: `MR-DAV-20260618-FULLDAY`, 490 lines, 332 shortage lines, 0 missing BOM dishes
- Generated purchase request: `PR-20260618-FULLDAY`, 53 lines
- Data-quality report in the seed log: 20 errors, 0 warnings, 0 missing BOM, 0 negative stock, 0 orphan documents

The dataset is now tuned so the reset-script demand generation has no missing BOM blockers, while the data-quality report can still surface bounded sample-data cleanup issues.

## Repeatable Local Seed

Run this after starting the backend in Development:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/MVP_DEMO_SEED_RESET.ps1 -BaseUrl http://localhost:5262
```

Use `-DryRun` to validate the sample files without writing or generating demand.

The script imports the sample data idempotently, generates material demand, generates purchase requests when shortages exist, and prints the data-quality summary at the end.


---

## Manual Runbook (10-15 minute demo)

# MVP Manual Runbook

> For click-by-click browser instructions, see [`docs/MVP_WEB_FLOW.md`](../docs/MVP_WEB_FLOW.md).

Use this checklist for a 10-15 minute Iter1 demo.

Scope reference: `.docs/ITER1_PROD_READY_SCOPE.md` defines the official Iter1 production-ready acceptance boundary.

Latest verified evidence: `.artifacts/release-gates/20260707-123452/quality-gate-summary.md`.

## Setup

1. Apply local EF migrations if the database came from an older dump:
   `dotnet ef database update --project backend/src/IPCManagement.Api/IPCManagement.Api.csproj --startup-project backend/src/IPCManagement.Api/IPCManagement.Api.csproj`
2. Start backend at `http://localhost:5262` and confirm `http://localhost:5262/swagger` opens.
3. Reset/seed demo data:
   `powershell -ExecutionPolicy Bypass -File scripts/MVP_DEMO_SEED_RESET.ps1 -BaseUrl http://localhost:5262`
4. Start frontend at `http://localhost:5173`.
5. Open the frontend and login with `admin` / `admin`.
6. Use customer `DAV`, week start `2026-06-15`, and service date `2026-06-18`.

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
   - Demo anchor from reset script: `MR-DAV-20260618-FULLDAY`.

4. Purchasing
   - Open Purchasing.
   - Confirm purchase demand lines show required quantity, current stock, purchase quantity, unit, supplier, and status.
   - Demo anchor: `PR-20260618-FULLDAY`.
   - If the request is still pending, open Approvals and approve it with a short note before returning to Purchasing.

5. Warehouse
   - Open Warehouse.
   - Confirm the current stock table is visible.
   - Confirm shortage rows route the operator toward issue or purchase handling.
   - For receive testing, choose a warehouse before recording a purchase-order receipt so the stock ledger/current stock update is visible.

6. Chef and reports
   - Open Chef Dashboard and confirm KHSX / material checklist is visible.
   - Open Reports.
   - Check ingredient demand, purchase demand, current stock, and audit sections.
   - Confirm audit includes demand and purchasing events with actor and timestamp.

## Expected Demo Anchors

- Material request: `MR-DAV-20260618-FULLDAY`
- Purchase request: `PR-20260618-FULLDAY`
- Latest seed reset generated 490 demand lines, 332 shortage lines, and 53 purchase request lines.
- Missing BOM count should be `0` in the reset-script demand output.
- Data quality can still show bounded sample-data issues; the 2026-07-07 evidence showed 20 errors, 0 warnings, 0 negative stock, and 0 orphan documents.

## Pass Criteria

- Import preview/save/reload succeeds.
- A serving edit persists after reload.
- Demand generation creates material demand and missing-BOM feedback.
- Purchase shortage list is generated from demand.
- Warehouse stock is visible from live current-stock data.
- Reports show demand, purchase, current stock, and audit rows.
- `scripts/Invoke-Iter1QualityGate.ps1 -RunSeedReset -E2ELogPath <dated-log>` passes before handoff.
