# Iter1 Daily Operations Checklist

Last verified: 2026-07-09  
Use with: `.docs/ITER1_ACTOR_RUNBOOK.md`, `.docs/ITER1_RELEASE_GATE.md`

This checklist is for a real operating day. Complete it top to bottom unless a blocking exception says otherwise.

## Before The Day Starts

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Admin | Backend is reachable and the target environment is correct. | [ ] |
| 2 | Admin | Demo reset is used only for local/demo: `scripts/Invoke-Iter1SeedMode.ps1 -Mode DemoReset`. | [ ] |
| 3 | Admin | Production baseline does not call sample-data import. | [ ] |
| 4 | Operations | Service date and shifts are known. | [ ] |
| 5 | Planner | Menu schedule exists for the service date. | [ ] |
| 6 | Admin | Data-quality report has no urgent blocker for missing BOM, invalid unit, inactive supplier, or stale documents. | [ ] |

## Import And Validate

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Operations | Import or confirm customer order quantities. | [ ] |
| 2 | Planner | Open `/weekly-menu` and confirm customer, date, shift, menu, and dishes. | [ ] |
| 3 | Admin | If a dish has missing BOM, fix it in `/admin-data` before demand generation. | [ ] |
| 4 | Admin | If unit conversion is missing, fix ingredient/unit data before demand generation. | [ ] |
| 5 | Operations | Lock/sign off quantity plan when quantities are final. | [ ] |

Do not continue to demand generation if quantities are still draft or forecast-only.

## Demand Generation

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Planner | Generate material demand from completed quantity plans. | [ ] |
| 2 | Planner | Confirm material request code, service date, scope, and line count. | [ ] |
| 3 | Planner | Check shortage lines and missing BOM/conversion warnings. | [ ] |
| 4 | Manager | Approve material demand when ready. | [ ] |
| 5 | Planner | If stale demand appears, read reasons, fix source data, rerun demand. | [ ] |

Expected blocker text if skipped: `Cần hoàn tất số suất trước khi tạo nhu cầu nguyên liệu.`

## Purchase And Approval

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Purchasing | Generate purchase request from demand shortage lines. | [ ] |
| 2 | Purchasing | Confirm supplier, unit price, purchase quantity, and expected delivery date. | [ ] |
| 3 | Purchasing | Submit purchase request. | [ ] |
| 4 | Manager | Approve or reject purchase request in `/approvals` with a clear reason. | [ ] |
| 5 | Purchasing | If rejected, fix supplier/price/quantity issue and resubmit or stop intentionally. | [ ] |
| 6 | Purchasing | Create purchase orders only after approval. | [ ] |

Stop when a purchase request is stale or has price warnings. Fix the warning before approval.

## Warehouse Receipt And Issue

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Warehouse | Receive goods from purchase order into the correct warehouse. | [ ] |
| 2 | Warehouse | Confirm stock movement report shows receipt movement. | [ ] |
| 3 | Warehouse | Create inventory issue from approved material demand. | [ ] |
| 4 | Warehouse | If HTTP 409 stock shortage appears, create replenishment/purchase action before issuing. | [ ] |
| 5 | Warehouse | Confirm issue code and issued line quantities. | [ ] |
| 6 | Warehouse | Confirm stock movement report shows ISSUE rows. | [ ] |

Never override a shortage by issuing a larger quantity than current stock can support.

## Kitchen Close

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Chef | Open `/chef-dashboard` for the active date and shift. | [ ] |
| 2 | Chef | Confirm live issued materials are visible in the checklist. | [ ] |
| 3 | Chef | Confirm receipt when materials match the issue. | [ ] |
| 4 | Chef | Record excess/waste return if applicable. | [ ] |
| 5 | Chef | Leave unissued or mismatched material in exception/waiting state. | [ ] |
| 6 | Operations | Verify production can close without hidden missing-material state. | [ ] |

## Reports And Audit

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Manager | `/reports` demand tab has current service-date rows. | [ ] |
| 2 | Manager | Purchase demand and purchase order status are visible. | [ ] |
| 3 | Warehouse | Current stock and stock movements reflect receipt/issue/return. | [ ] |
| 4 | Chef | Kitchen issues and issue-vs-return usage reflect the shift. | [ ] |
| 5 | Admin | Audit changes show business area, actor, entity, field, old/new value, and reason. | [ ] |
| 6 | Admin | Data-quality issues are resolved, reopened, or assigned with owner/SLA visible. | [ ] |

## Weekly Checklist

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Admin | Review employees, roles, and inactive accounts. | [ ] |
| 2 | Admin | Review destructive/reset endpoints and environment mode. | [ ] |
| 3 | Planner | Review menu/BOM coverage for next week. | [ ] |
| 4 | Purchasing | Review supplier quotations and inactive supplier warnings. | [ ] |
| 5 | Warehouse | Review negative stock, ledger mismatch, and old stock movements. | [ ] |
| 6 | Manager | Run release audit before demo/release: `npm run verify:release:audit`. | [ ] |
| 7 | QA | Run exception evidence before release: `npm run e2e:exceptions`. | [ ] |

## Exception Response

| Exception | Owner | Action | Continue when |
| --- | --- | --- | --- |
| Missing BOM | Admin | Add/correct BOM in `/admin-data`; rerun demand. | Demand no longer lists missing BOM for target context. |
| Stale demand | Planner | Fix source change and regenerate demand. | Staleness check is false or reasons are acknowledged. |
| Rejected approval | Request owner | Read reason, correct source data, resubmit if needed. | New request is approved or old request is intentionally stopped. |
| Stock shortage | Warehouse/Purchasing | Replenish stock through purchase/receipt. | Issue can be created without HTTP 409. |
| Empty report | Relevant owner | Confirm the source workflow actually ran and date filters are correct. | Report tab has expected rows. |

## End Of Day

| Step | Owner | Check | Done |
| --- | --- | --- | --- |
| 1 | Operations | All active shifts are signed off or intentionally left open with reason. | [ ] |
| 2 | Purchasing | Open purchase requests/orders are known for tomorrow. | [ ] |
| 3 | Warehouse | Pending receipts/issues/returns are visible. | [ ] |
| 4 | Chef | Kitchen receipt/return exceptions are closed or assigned. | [ ] |
| 5 | Manager | Reports and audit evidence are saved for the day. | [ ] |
| 6 | Admin | Data-quality unresolved urgent issues have owner and next action. | [ ] |

## Evidence To Save

- Release gate summary path when running release checks.
- E2E summary path for happy path or exception path.
- Screenshot/export only when stakeholder asks for manual evidence.
- Tracker note in the form `[YYYY-MM-DD] Done: <what>; Verify: <artifact or command>.`
