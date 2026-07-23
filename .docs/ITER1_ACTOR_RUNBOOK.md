# Iter1 Actor Runbook

Last verified: 2026-07-09  
Scope: Iter1 production workflow from menu/order planning to demand, purchase, warehouse, kitchen, reporting, and admin remediation.

## Start Here

Use this runbook when onboarding a new operator. The operator should be able to follow the route names and actions without a developer beside them.

Local demo entrypoints:

- Backend: `http://localhost:5262`
- Frontend: usual frontend dev URL from `npm run fe`
- Seed demo data: `powershell -ExecutionPolicy Bypass -File scripts/Invoke-Iter1SeedMode.ps1 -Mode DemoReset -BaseUrl http://localhost:5262`
- Happy path E2E evidence: `.artifacts/e2e/20260709-004127175/happy-path-e2e-summary.md`
- Exception path E2E evidence: `.artifacts/e2e/20260709-103742321/exception-path-e2e-summary.md`

## Role Map

| Actor | Main routes | Primary output |
| --- | --- | --- |
| Admin | `/admin-data`, `/approval-rules`, `/reports` | Users, BOM/contracts, data-quality fixes, audit visibility |
| Operations | `/meal-orders`, `/weekly-menu`, `/reports` | Daily order quantity and workflow status |
| Planner | `/weekly-menu`, `/meal-orders`, `/approvals` | Menu/order signoff and material demand |
| Purchasing | `/purchasing`, `/approvals`, `/reports` | Purchase request, supplier/quotation, purchase order |
| Warehouse | `/warehouse`, `/purchasing`, `/reports` | Goods receipt, stock issue, current stock movements |
| Chef | `/chef-dashboard` | Kitchen receipt confirmation and excess return |
| Manager | `/`, `/approvals`, `/reports`, workflow lanes | Approval decisions and release readiness view |

## Admin

Daily goal: keep master data valid so the workflow can run without hidden blockers.

1. Open `/admin-data`.
2. Check the data-quality/statistics area first.
3. For `missing_bom`, open the remediation route shown by the issue, add or correct BOM lines, then rerun demand for the affected date/scope.
4. For stale workflow data, confirm whether quantity, stock, BOM, or supplier data changed after the latest generation. Rerun the affected demand or purchase step.
5. Open the employees tab only with admin access. Create/update employee role, active status, and route permission as needed.
6. Open audit/statistics when a stakeholder asks who changed a record. Filter by business area and date.

Stop and escalate when:

- A data-quality issue has no route or suggested action.
- A user can access a route outside their role.
- A destructive/reset action is visible in a non-demo production environment.

## Operations

Daily goal: make the kitchen production day visible and signed off.

1. Open `/meal-orders` or `/weekly-menu`.
2. Confirm the service date and shift.
3. Verify customer/order quantities before signoff.
4. Lock or sign off the quantity plan when the numbers are final.
5. If a signed-off quantity must change, create an adjustment with a reason and send it for approval.
6. After approval or rejection, verify the plan status and rerun demand if quantities changed.

Expected result:

- Completed quantity plans exist for the service date.
- Demand generation is not blocked by "Cần hoàn tất số suất trước khi tạo nhu cầu nguyên liệu."

## Planner

Daily goal: convert signed-off orders and menu/BOM into material demand.

1. Open `/weekly-menu`.
2. Confirm menu schedule, customer, service date, and shift.
3. Generate material demand from completed quantity plans.
4. Review missing BOM and missing conversion warnings before sending downstream.
5. Approve demand when it is ready for warehouse/purchasing.
6. If staleness appears, read the stale reasons and rerun generation after the source data is fixed.

Expected result:

- A material request like `MR-<customer>-<date>-FULLDAY` exists.
- Demand lines show required quantity, stock quantity, and suggested purchase quantity.

## Purchasing

Daily goal: turn demand shortage into purchase request/order and receive supplier goods.

1. Open `/purchasing`.
2. In demand/purchase demand view, filter the service date.
3. Generate a purchase request from demand shortage lines.
4. Confirm supplier, unit price, expected delivery date, and notes on purchase lines.
5. Submit the purchase request.
6. If the request appears in `/approvals`, ask Manager to approve or reject with a reason.
7. After approval, create purchase orders and record receipt into a warehouse.

Stop and fix when:

- Purchase request says it is stale: rerun it from current demand.
- A supplier is inactive or missing: Admin/Purchasing must fix supplier/quotation data.
- A price warning blocks approval: review quotation/reference price before approving.

## Warehouse

Daily goal: keep stock accurate and issue ingredients only when enough stock exists.

1. Open `/warehouse`.
2. Check current stock and shortage signals.
3. After purchasing receives goods, verify stock movement rows in reports.
4. Create inventory issue from approved material demand.
5. If the API returns HTTP 409 stock shortage, follow the suggested action: create replenishment/purchase request before issuing.
6. Confirm issued lines, issue date, shift, warehouse, and material request before submitting.

Expected result:

- Inventory issue code is created.
- Stock movement report includes ISSUE rows.
- Kitchen can see the issue for receipt confirmation.

## Chef

Daily goal: acknowledge received materials and record exceptions.

1. Open `/chef-dashboard`.
2. Select the active service date/shift.
3. Review material checklist from live issued material rows.
4. Confirm receipt when received quantity matches the issue.
5. If there is surplus or waste, create an inventory return with reason.
6. If material has not been issued yet, leave the item in waiting/exception state instead of marking production complete.

Expected result:

- Kitchen receipt audit exists.
- Issue-vs-return usage report reflects returns or matched usage.

## Manager

Daily goal: decide exceptions quickly and verify release health.

1. Open `/` for workflow overview, then `/approvals` for pending decisions.
2. Approve demand/purchase/order adjustments only after checking reason, amount, supplier, and exception context.
3. Reject requests with a short reason when data is wrong or the business should not proceed.
4. Open `/reports` to confirm demand, purchase, stock movement, kitchen issue, usage, audit, and data-quality tabs have current rows.
5. Before release/demo, run or request:
   - `npm run verify:release:audit`
   - `npm run e2e:exceptions`
   - selected happy path evidence from `.artifacts/e2e/`

Stop and escalate when:

- A rejected item cannot be corrected and rerun.
- Reports are empty for a workflow that operators claim was completed.
- Release gate evidence is missing or stale.

## Exception Recovery Quick Reference

| Exception | Where seen | Operator action | Continue when |
| --- | --- | --- | --- |
| Missing BOM | `/admin-data`, `/reports` data quality | Admin adds/corrects BOM, then Planner reruns demand | Missing BOM issue is resolved or removed |
| Stale demand | `/material-demand/staleness`, data-quality report | Fix source change, rerun demand | Demand regenerates successfully |
| Rejected approval | `/approvals`, audit | Read reason, correct source data, resubmit if needed | New approval/request is created or old flow is intentionally stopped |
| Stock shortage | `/warehouse`, inventory issue HTTP 409, data-quality | Create purchase/replenishment before issue | Stock exists and issue can be created |

## Verification Commands

```powershell
npm run e2e:exceptions
npm run verify:release:audit
```

The exception E2E must show PASS for stale demand, missing BOM, shortage, rejected approval, remediation, and recovery continuation.
