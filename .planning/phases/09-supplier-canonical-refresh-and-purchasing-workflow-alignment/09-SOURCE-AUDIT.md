# Phase 09 Multi-Source Coverage Audit

## GOAL coverage

| Source item | Disposition | Plan coverage |
|---|---|---|
| Reconcile the audited 20.7 supplier purchase history without damaging immutable operations | COVERED | 09-01 through 09-05 |
| Deliver the approved-demand-to-Warehouse purchasing flow with explicit supplier and price decisions | COVERED | 09-06 through 09-13 |

## REQ coverage

| Requirement | Disposition | Plan coverage |
|---|---|---|
| SUP-01 | COVERED | 09-01, 09-02 |
| SUP-02 | COVERED | 09-02 |
| SUP-03 | COVERED | 09-03 |
| SUP-04 | COVERED | 09-04, 09-05 |
| PUR-01 | COVERED | 09-06, 09-07 |
| PUR-02 | COVERED | 09-07 |
| PUR-03 | COVERED | 09-08, 09-09 |
| PUR-04 | COVERED | 09-08, 09-09 |
| PUR-05 | COVERED | 09-08, 09-09 |
| WHR-01 | COVERED | 09-04, 09-10 |
| PUI-01 | COVERED | 09-11, 09-12, 09-13 |

## RESEARCH coverage

| Research feature or constraint | Disposition | Plan coverage |
|---|---|---|
| Verify the 20.7 workbook hash and audited 34-sheet/3,209-key baseline at execution time | COVERED | 09-01, 09-02 |
| Keep parser/normalization pure and reuse the same policy for preview and apply | COVERED | 09-02, 09-03, 09-05 |
| Preview is `AsNoTracking`, drift-protected, and produces exact counts/blockers | COVERED | 09-03 |
| Forward-only persistence and atomic/idempotent apply with immutable-history protection | COVERED | 09-04, 09-05 |
| Use material-demand approval before purchase-request generation | COVERED | 09-06, 09-07 |
| Replace first-active-supplier selection with quote/receipt evidence and explicit confirmation | COVERED | 09-08, 09-09 |
| Use a purchase-specific strict `> 15%` predicate, not the shared reporting `>= 15%` helper | COVERED | 09-09 |
| Make purchase-order creation idempotent by purchase request and supplier | COVERED | 09-08, 09-09 |
| Consolidate receiving behind a Warehouse-owned writer and preserve package snapshots | COVERED | 09-04, 09-10 |
| Preserve routes, RTK Query server state, bounded tables, and Phase 8 feature decomposition | COVERED | 09-11, 09-12 |
| Restore a disposable lane and execute the focused end-to-end path twice | COVERED | 09-13 |
| Package legitimacy audit reports no new package installs | COVERED | Every plan forbids dependency additions and verifies package manifests remain unchanged |

## CONTEXT decision coverage

| Decision | Disposition | Plan coverage |
|---|---|---|
| D-09-01 | COVERED | 09-02 |
| D-09-02 | COVERED | 09-02 |
| D-09-03 | COVERED | 09-02 |
| D-09-04 | COVERED | 09-02 |
| D-09-05 | COVERED | 09-02, 09-04, 09-10 |
| D-09-06 | COVERED | 09-02 |
| D-09-07 | COVERED | 09-01, 09-03, 09-05 |
| D-09-08 | COVERED | 09-03, 09-04, 09-05, 09-08 |
| D-09-09 | COVERED | 09-03, 09-05 |
| D-09-10 | COVERED | 09-01, 09-05, 09-13 |
| D-09-11 | COVERED | 09-06 through 09-13 |
| D-09-12 | COVERED | 09-06, 09-07, 09-11 |
| D-09-13 | COVERED | 09-07, 09-11, 09-12 |
| D-09-14 | COVERED | 09-08, 09-09, 09-12 |
| D-09-15 | COVERED | 09-08, 09-09, 09-11, 09-12 |
| D-09-16 | COVERED | 09-11, 09-12 |
| D-09-17 | COVERED | 09-02, 09-03, 09-05, 09-13 |
| D-09-18 | COVERED | 09-10, 09-11, 09-12 |

## Explicit exclusions

- Production upload/path selection is a deferred idea under D-09-17 and is not planned.
- Repository-wide dish-name normalization is a deferred idea and is not planned.
- `backend/database/Clean_Legacy_Imported_Bom_Idempotent.sql` is user-owned, untracked, and excluded from every plan, command scope, and commit scope.

## Audit result

All in-scope GOAL, REQ, RESEARCH, and CONTEXT items are covered. No deferred idea is included. No phase split is required because each implementation plan is bounded to one contract or vertical workflow slice and remains below the single-agent context limit.
