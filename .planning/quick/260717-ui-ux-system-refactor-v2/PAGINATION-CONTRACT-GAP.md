# Pagination contract gap — workflow reports

Date: 2026-07-17
Status: confirmed backend contract blocker

## Finding

The Admin and report routes currently render local page controls over bounded
collections returned by the workflow-report API. This prevents unbounded DOM
growth, but it is not server-side lazy pagination.

The current backend query contract is `WorkflowReportQueryDto`: it exposes
filters, cursor fields and `Limit`, but it does not expose `PageNumber`,
`PageSize`, or a total-count response for the list-style report endpoints.

## Evidence

| Endpoint | Current response | Query contract | UI consequence |
|---|---|---|---|
| `current-stock` | list | `limit` only | local page over at most the requested limit |
| `ingredient-demand` | list | `limit` only | local page over at most the requested limit |
| `purchase-plan` | list | `limit` only | local page over at most the requested limit; current Admin request is 500 |
| `price-variance/*` | list | `limit` only | local page over at most the requested limit |
| `kitchen-issues` | list | `limit` only | bounded list; no server page metadata |
| `issue-vs-return` | list | `limit` only | bounded list; no server page metadata |
| `data-quality` | aggregate object with issue arrays | `limit` only | local page over returned issue arrays |
| `stock-movements/page` | cursor page | cursor + `limit` | canonical cursor navigation is valid |
| `audit-changes/page` | cursor page | cursor + `limit` | canonical cursor navigation is valid |

## Risk decision

Do not replace a list endpoint's `limit` with a UI `pageNumber` until the
backend supports the same contract. Doing so would show different pages of
the same in-memory payload while the network request remains unchanged, which
creates a false lazy-pagination guarantee.

The existing local pagination remains an intentional containment measure:
table rows are bounded in the DOM and the canonical viewport prevents long
tables from expanding the page. It must be labelled and tested as local
pagination, not server pagination.

## Required follow-up phase

Add dedicated page-number or cursor endpoints for the list surfaces that need
true lazy loading. Each endpoint must return its pagination metadata, preserve
the existing filters and stable ordering, and be migrated route-by-route:

1. current stock and price variance;
2. data-quality issues;
3. ingredient demand and purchase plan;
4. kitchen issue and issue-vs-return reports.

The backend change must be planned separately because `WorkflowReportService`
and `AdminDataPage` currently contain user-owned dirty work. No UI refactor in
this slice is allowed to overwrite that feature work.

## Verification commands

```powershell
rg -n "class WorkflowReportQueryDto|PageNumber|PageSize|CursorDate|CursorId|Limit" `
  backend/src/IPCManagement.Api/Models/DTOs/Workflow `
  backend/src/IPCManagement.Api/Models/DTOs/Common

rg -n "Get(CurrentStock|IngredientDemand|PurchasePlan|PriceVariance|KitchenIssues|IssueVsReturn|DataQuality)" `
  backend/src/IPCManagement.Api/Controllers/WorkflowReportsController.cs
```
