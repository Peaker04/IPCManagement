# User workflows

Product navigation only; source permission/mode/version guards remain final. No scenario authorizes reset, seeding, mode changes or fabricated business records. [DOMAIN.md](../DOMAIN.md), [lifecycle](../LIFECYCLE-CONTRACT.md) and mode contracts own detailed rules.

## DEFAULT

1. Coordination selects customer/week/tier, authors menu and servings, resolves source/BOM readiness, then sends the selected date/shift to kitchen.
2. Demand is read by day/source line. Warehouse supplies physical stock; Purchasing handles the authorized shortage/proposal/supplier/order path.
3. Receipt is drafted, quality-checked, approved and explicitly posted by its respective actors. Draft/approval are not physical receipt proof.
4. Warehouse issues against actual source lines. Chef checks all lines and atomically acknowledges the whole issue; discrepancy follows return/supplemental/reconciliation owners.
5. Actual servings, variance decisions, confirmation/waiver and ServiceRun close are separate from issue handoff. Posted/closed facts are immutable; corrections compensate.

Aggregate demand, suggested purchase and physical handoff are different facts. Grouped rows must drill into source IDs; no automatic transfer or shortage prioritization across customers.

## MATERIAL_RECONCILIATION

Coordination owns menu/servings/BOM source readiness, preview/commit, frozen batch and warehouse transfer. Warehouse owns initial and supplemental issue per frozen service date. Manager owns discrepancy disposition and completion. Chef reads kitchen cooking export; Purchasing is not in this mode. A weekly summary is read-only and never submits an issue. Source changes after freeze require a new authorized batch/version, not rewriting retained facts.

Use the same customer/batch/date scope across action, request, ledger and reload. Mode is server authority and does not grant permission. Hidden controls do not replace API authorization. See [MRX contract](../domain/material-reconciliation.md).
