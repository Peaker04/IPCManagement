# Iter1 Destructive Endpoint Audit

Last verified: 2026-07-09  
PRD: PRD-190 Destructive Endpoint Audit  
Goal: production must not expose demo reset/import actions to normal users, and every destructive/regenerate action must have an owner and guard.

## Summary

Status: PASS

Evidence:

- `SampleDataProductionGuardMiddleware` hides `/api/sample-data/*` outside Development by returning HTTP 404 before controller execution.
- Focused verification passed: `dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter SampleDataProductionGuard --no-restore`
- Seed mode separates demo reset from production baseline: `scripts/Invoke-Iter1SeedMode.ps1 -Mode DemoReset|ProductionBaseline`
- `DemoReset` wrapper blocks public/non-private hosts unless `-AllowRemoteDemoReset` is explicitly passed.
- `ProductionBaseline` does not call sample-data import.

## Endpoint Register

| Surface | Route / command | Risk | Guard | Production rule |
| --- | --- | --- | --- | --- |
| Demo sample import/reset | `POST /api/sample-data/import` | Replaces/imports demo catalog, menu, stock, demand anchors | `SampleDataProductionGuardMiddleware`; dev/demo wrapper host check | Hidden as 404 outside Development; do not call in production |
| Seed wrapper demo reset | `scripts/Invoke-Iter1SeedMode.ps1 -Mode DemoReset` | Calls sample-data import and demo workflow preparation | Private/local host check unless explicit override | Use only local/demo; never in production runbook |
| Seed wrapper production baseline | `scripts/Invoke-Iter1SeedMode.ps1 -Mode ProductionBaseline` | Environment smoke only | Does not call sample-data import | Safe production startup check |
| Weekly menu preview/import/commit | `/api/coordination/weekly-menu/import/preview`, `/commit` | Changes menu schedules and import batches | Auth + coordination/catalog role gate, validation feedback | Allowed only for authorized operators with source workbook validation |
| Weekly menu rollback | `/api/coordination/weekly-menu/import/{menuVersionId}/rollback` | Removes/restores committed menu import state | Auth + coordination/catalog role gate | Must be operator intentional; review audit after rollback |
| Bulk weekly menu update | `PUT /api/coordination/weekly-menu/bulk-update` | Rewrites menu schedule rows | Auth + role gate + validation | Use only for planned correction windows |
| Demand generation/regeneration | `POST /api/material-demand/generate` | Recalculates material request lines and prunes stale lines | Auth + demand generation role gate; stale reasons visible | Allowed after quantity/BOM/source data is validated |
| Material demand approval | `POST /api/material-demand/{id}/approve` | Moves demand into downstream purchasing/warehouse workflow | Auth + demand generation role gate | Must include operational reason in release/demo evidence |
| Purchase request generation | `POST /api/purchase-workflow/from-demand` | Creates/updates purchase request from shortage lines | Auth + purchase generation role gate | Allowed after demand is approved/current |
| Purchase request submit | `POST /api/purchase-workflow/requests/{id}/submit` | Sends purchase request for approval | Auth + purchase generation role gate | Block if stale, missing supplier, or price warning |
| Approval decision | `POST /api/approvals/{targetType}/{id}` | Approves/rejects purchase/issue/adjustment | Auth + target permission check + approval history duplicate guard | Approve/reject with reason; audit history must remain |
| Purchase order creation | `POST /api/purchase-orders/from-request/{purchaseRequestId}` | Creates supplier purchase orders | Auth + purchase role gate | Only after approved PR |
| Purchase order receive/cancel | `POST /api/purchase-orders/{id}/receive`, `/cancel` | Mutates stock and PO status | Auth + purchase/warehouse workflow gate | Receive exact lines; cancel only with business reason |
| Inventory issue create | `POST /api/inventory-issues` | Removes stock and creates issue document | Auth + inventory/production role gate + stock shortage check | HTTP 409 shortage must stop issue |
| Kitchen receipt confirmation | `POST /api/inventory-issues/{id}/confirm-receipt` | Closes kitchen handoff audit | Auth + role gate | Use discrepancy note when mismatch exists |
| Inventory return create/confirm | `POST /api/inventory-returns`, `/confirm-receipt` | Adds returned stock movement | Auth + inventory/production role gate | Return quantity must match source issue context |
| Stock snapshot generate | `POST /api/workflow-reports/stock-snapshots/generate` | Generates reporting snapshot rows | Auth + report access | Use as reporting operation, not stock mutation |
| Data-quality remediation | `POST /api/workflow-reports/data-quality/issues/remediation` | Resolves/reopens computed issue state | Auth + report/admin workflow | Must include note for release evidence |
| Admin employee create/update/status | `/api/admin/employees/*` | Changes user access | Admin role gate | Admin only; audit role changes |
| Approval rule create/update/delete | `/api/approval-rules/*` | Changes approval routing | Approval/admin role gate | Manager/admin controlled change window |

## Required Operator Rules

1. Production uses `ProductionBaseline`, never `DemoReset`.
2. Any route containing `sample-data` must be inaccessible outside Development.
3. Any regenerate action must be followed by report or data-quality verification.
4. Any approval/reject action must leave approval history or audit evidence.
5. Any stock mutation must be visible in stock movement reports.
6. Any reset/import/rollback must have a dated tracker/runbook note.

## Verification Notes

Focused test command:

```powershell
dotnet test backend/tests/IPCManagement.Api.Tests/IPCManagement.Api.Tests.csproj --filter SampleDataProductionGuard --no-restore
```

Expected result:

- Passed: 1
- Confirms `/api/sample-data/import` returns 404 before next middleware in Production-like environment.

Release gate reference:

- `.docs/ITER1_RELEASE_GATE.md`
- `.docs/ITER1_DAILY_CHECKLIST.md`
- `.docs/ITER1_ACTOR_RUNBOOK.md`
