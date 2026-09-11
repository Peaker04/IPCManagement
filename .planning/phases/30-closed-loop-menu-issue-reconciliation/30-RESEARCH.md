# Phase 30 Research — Closed-loop Menu → Warehouse Issue → Reconciliation

**Date:** 2026-08-28
**Method:** source and contract inspection; no GitNexus requested or used

## Current state

- `SystemOperationEligibility` currently retains `purchasing`, `warehouse`, `reports` and `admin-data`; reconciliation-mode tab policy is explicit only for Weekly Menu.
- `ReconciliationWorkspace` is duplicated into Weekly Menu, Purchasing, Warehouse and Reports and changes mutation ownership through an `owner` prop.
- `ReconciliationLineDto` still exposes required, purchased and issued quantities plus three differences.
- Issued reconciliation actual is currently a separately entered value through `PUT /api/reconciliation/lines/{id}/issued`; it is not projected from warehouse issue authority.
- Warehouse real issue authority is `InventoryIssueService`: it creates `InventoryIssue`/`InventoryIssueLine`, updates stock through `_stockLedgerService.RemoveStockWithCheckAsync`, writes lifecycle identity and supports idempotent command replay.
- Current `InventoryIssue` requires one `MaterialRequestId`; `InventoryIssueLine` optionally links `MaterialRequestLineId`. Reconciliation has no durable FK to either issue header or line.
- Warehouse UI currently contains purchase receipt/default workflow content above its three-tab switcher and mounts `ReconciliationWorkspace` at the page bottom.
- Weekly Menu currently initializes workflows for cost, production, purchase summary and dish material views even when only a subset is visible; page trimming must prove hidden owners do not issue requests.

## Architecture conclusion

A reliable two-authority reconciliation cannot infer warehouse issue by ingredient/date/name. Phase 30 needs a durable explicit origin on real inventory issues.

Recommended additive compatibility design:

- `InventoryIssue.MaterialRequestId` becomes nullable for newly supported reconciliation-origin issue documents.
- Add nullable `InventoryIssue.ReconciliationBatchId`.
- Add nullable `InventoryIssueLine.ReconciliationBatchLineId`.
- New writes enforce exactly one source family:
  - default issue: MaterialRequest/MaterialRequestLine;
  - reconciliation issue: ReconciliationBatch/ReconciliationBatchLine.
- Preserve legacy nullable line provenance without guessed backfill.
- Add indexes/FKs and application/DB constraints that prevent cross-batch or duplicate source-line ownership.
- A reconciliation-owned transfer/list endpoint exposes exact frozen lines to Warehouse; Warehouse issue creation continues to call the canonical stock ledger transaction rather than writing reconciliation actuals.
- Reconciliation read projection aggregates linked `InventoryIssueLine.IssuedQty` by exact batch-line ID and computes signed `issued - required` using canonical decimals and frozen tolerance.

If generated MySQL constraints cannot safely express legacy compatibility, application invariant plus unique/FK indexes must still fail closed; the plan must not invent historical links.

## Minimal capability target

```json
{
  "navigation": ["dashboard", "weekly-menu", "warehouse", "reconciliation", "admin-data"],
  "pageTabs": {
    "weekly-menu": ["schedule", "material-demand"],
    "warehouse": ["demand", "movement"],
    "admin-data": ["bom-import", "audit"]
  }
}
```

`inventory` is deliberately omitted until source inspection proves the existing tab is a material-master surface rather than stock workflow. A lower-confidence label swap is prohibited.

## Lowest owners

| Concern | Lowest owner |
|---|---|
| mode navigation/tab authority | backend `SystemOperationEligibility` + typed frontend capability resolver |
| direct route/preload eligibility | `routeConfig`, `ModeGuard`, `routeLoaders`, `routeDataPreloaders` |
| material source import/read | existing Weekly Menu import/query seams |
| transfer to warehouse | reconciliation service/controller, not page-local API composition |
| stock mutation | existing `InventoryIssueService` and stock ledger transaction |
| exact issue lineage | entity configuration/migration + issue service resolver |
| required-vs-issued projection | reconciliation query/service/DTO |
| table presentation | existing `Table`/`TableViewport`, formatters, status vocabulary |
| selected customer/week/batch | one reconciliation context/query-param seam, not independent page local storage copies |
| user display preferences | existing navigation/page-tab preferences intersected with backend authority |

## Main risks

1. **Double stock mutation:** retry or duplicate transfer may create a second issue. Mitigate with source-scoped command identity, expected version, unique lineage and serializable transaction.
2. **False issue matching:** ingredient/date aggregation can cross customers, weeks or batches. Require batch-line FK.
3. **Legacy schema break:** making MaterialRequest nullable can weaken default invariants. Add explicit source-family validation and full DEFAULT regression.
4. **Hidden query leakage:** KeepAlive/initialized hooks can call excluded APIs despite hidden UI. Add source-contract and runtime request assertions.
5. **Historical semantic rewrite:** removing purchased fields from current mode must not alter completed Phase 29 history/export. Keep compatibility read/export or version the projection.
6. **Inventory shortage:** the business assumption of sufficient stock does not justify bypassing stock checks. Existing stock validation remains and failure is a mode invariant error.
7. **Overloaded page:** moving all lifecycle into one route can recreate the same clutter. Enforce one table, one primary action, one page-level drawer and 5–7 decision fields.

## Verification strategy

- Tracer first: one controlled source, one material line, one transfer, one real warehouse issue, one projected comparison and reload.
- Then expand to partial/multiple issue documents, exact-match, short, excess, unissued, stale/concurrent replay and completion conditions.
- Browser evidence captures visible controls, retained/excluded requests, issue API response, raw DB lineage/stock movement and reconciliation render after reload.
- Final database mode must be restored to `DEFAULT`; no procurement authority may change.

## Planning recommendation

Exactly three waves:

1. **Authority tracer:** requirements, capability, durable issue lineage, transfer and two-sided projection.
2. **Focused work surfaces:** route and trimmed Weekly Menu/Warehouse/Reconciliation/Admin UI with exact query ownership.
3. **Expansion and closeout:** edge cases, full regression, protected MySQL/browser evidence, documentation and final state reconciliation.
