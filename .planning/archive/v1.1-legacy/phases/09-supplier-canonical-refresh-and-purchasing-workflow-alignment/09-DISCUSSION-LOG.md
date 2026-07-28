# Phase 9: Supplier canonical refresh and purchasing workflow alignment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 09-supplier-canonical-refresh-and-purchasing-workflow-alignment
**Areas discussed:** Canonical supplier and Excel normalization, historical reconciliation and cleanup, purchasing workflow and approval gates, import exposure and operational ownership

---

## Canonical supplier and Excel normalization

| Decision | Alternatives considered | Selected |
|---|---|---|
| Canonical supplier membership | SUMMARY only; keep every active DB supplier; SUMMARY plus valid data-bearing sheets | SUMMARY plus valid data-bearing sheets |
| Item/supplier separation | Split every delimiter; keep raw names; deterministic separation with ambiguous-row blockers | Deterministic separation with blockers |
| Package conversion | Global `BICH` factor; separate unit per package; ingredient/supplier/effective conversion snapshot | Scoped conversion snapshot |
| Missing package size | Always block; infer; allow `BICH` only without cross-unit conversion | Conditional allow |
| Date outliers | Accept all; silently discard; bounded source window with blockers | Bounded source window |

**User's choice:** Accepted the recommended safe combined policy and clarified that not every package contains ten items.
**Notes:** `Tên hàng` in this workbook is treated as ingredient data; supplier remains separate.

---

## Historical reconciliation and cleanup

| Option | Description | Selected |
|---|---|---|
| Dependency-aware reconciliation | Update/create by deterministic keys; preserve immutable history; delete true sample orphans only | ✓ |
| Append only | Never remove obsolete source rows | |
| Delete and rebuild | Recreate all sample receipts and downstream rows | |

**User's choice:** Dependency-aware reconciliation.
**Notes:** Requires dry-run, backup/restore evidence and a no-op second run.

---

## Purchasing workflow and approval gates

| Decision | Alternatives considered | Selected |
|---|---|---|
| Demand approval | Before Purchasing; draft before approval; approve in Weekly Menu | Before Purchasing in Duyệt vận hành |
| Scope navigation | Week with nested days; date only; one weekly PR | Week with date-specific PRs |
| Supplier assignment | Evidence-backed suggestion; fully automatic; fully manual | Evidence-backed suggestion plus confirmation |
| Price threshold | Audited exception; force price reduction; warning only | Audited exception approval |

**User's choice:** All recommended workflow gates.
**Notes:** The UI must show where work is blocked and provide a direct next action rather than disconnected tabs.

---

## Import exposure and operational ownership

| Option | Description | Selected |
|---|---|---|
| Development importer plus guarded cleanup | Refresh sample source through preview/dry-run/apply without a production path contract | ✓ |
| Production Admin upload now | Add the final production workbook UI and upload endpoint in this phase | |
| Warehouse-owned receiving | Purchasing hands off PO; Warehouse records actual receipt and stock | ✓ |
| Purchasing-owned receiving | Purchasing records actual receipt and stock | |
| Dual ownership | Both pages may receive the same PO | |

**User's choice:** Guarded Development import and Warehouse-owned receiving.

## the agent's Discretion

- Component naming and compact guided-workbench presentation within existing IPC/shadcn patterns.
- Internal schema names for manifests, conversion snapshots and price exceptions, provided audit and safety contracts hold.

## Deferred Ideas

- Production Admin workbook upload.
- Repository-wide dish-name normalization outside the purchase workbook.
