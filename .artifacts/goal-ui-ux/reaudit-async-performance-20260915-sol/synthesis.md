# Performance / visual stability / async UI re-audit synthesis

Source baseline: current dirty worktree on `chore/systemic-ui-performance-artifact-retention-20260915`; focused runtime evidence was later captured on owned `3001/8001` against read-only `ipc_lane7`. External brief: `C:/Users/Administrator/Downloads/AGENT_REAUDIT_AND_REMEDIATE.md`. Project authority overrides the brief.

## Coverage denominator

The brief was normalized into 17 hypothesis families. Source inventory: 361 production TS/TSX files; 114 RTK query-hook callsites in 47 files; 35 shared async-boundary callsites; 32 Dialog and 2 Drawer callsites; 39 `EmptyState` callsites; 8 `TableSkeleton` callsites; 40 numbered and 4 cursor pagination callsites. Backend deep trace was bounded to the source-supported Service Run hot path. This is source coverage, not runtime performance certification.

## Hypothesis matrix

| ID | Hypothesis | Result | Primary evidence |
|---|---|---|---|
| H01 | Async footprint / late insertion | CONFIRMED_SOURCE | In-flow `RefreshStatus` and conditional notices across shared boundaries |
| H02 | Initial loading vs refreshing | PARTIAL_CURRENT | `toQueryView` retains stale data correctly; Reports replaces whole shell on initial/error |
| H03 | Multi-query readiness | PARTIAL_CURRENT | Grouped boundaries exist; presentation/geometry policy remains inconsistent |
| H04 | Page orchestration | PARTIAL_CURRENT | Weekly Menu owns broad route/query/workflow graph; cost needs profiling |
| H05 | Cache invalidation / duplicate requests | CONFIRMED_SOURCE scoped | Broad `Coordination` tag; exact same-key requests are already coalesced |
| H06 | Unnecessary waterfall | NOT_FOUND_CURRENT in inspected chains | Inspected chains depend on authoritative IDs/security scope; exhaustive browser trace remains open |
| H07 | Async alert/banner insertion | CONFIRMED_SOURCE | Shared/domain refresh and warning rows are conditionally inserted above retained content |
| H08 | Empty-state misuse | NOT_FOUND_CURRENT | Shared `EmptyState` is compact; table-specific owner has no production consumers |
| H09 | Table async contract | CONFIRMED_SOURCE scoped | Reports boundary replaces heading/filter/header/pagination with generic fallback |
| H10 | React rerender hotspot | NEEDS_RUNTIME | Broad owners exist but no Profiler evidence |
| H11 | List keys/rendering | CONFIRMED_SOURCE scoped | Six Reports row render sites include position/page in data keys; virtualization unsupported |
| H12 | Backend read path | CONFIRMED_SOURCE scoped | Service Run page reuses detail projection per row and status filter materializes all candidates |
| H13 | FE/BE N+1 | CONFIRMED_SOURCE | Report per-row adjustment requests; backend per-row query fanout |
| H14 | DB/index bottleneck | NEEDS_EVIDENCE | No execution plan, rows scanned, p95/p99, or active-lane evidence; no index change justified |
| H15 | API payload | CONFIRMED_SOURCE scoped | Full Service Run lifecycle/detail DTO used for list/blocker/report consumers |
| H16 | Dialog/drawer contract | PARTIAL_CURRENT / CONFLICT_BLOCKED | Mechanics are strong; supported modal stack conflicts with project M1.2; production overlap unproven |
| H17 | Visual stability / CLS | NEEDS_RUNTIME | Source risk seams exist; no current headed CLS attribution |

Equality: 17 = 8 confirmed-source + 5 partial/needs-runtime + 2 not-found + 1 needs-evidence + 1 conflict-blocked.

## Confirmed findings

### RA-01 — Shared async feedback changes retained-content geometry (P1 Frontend/Cross-cutting)
Evidence: `QueryViewBoundary`, `AdminQueryBoundary`, `ReportQueryBoundary`, `ChefQueryBoundary`, and in-flow `RefreshStatus`. Root cause: semantic state and notice geometry are coupled. Scope denominator: 35 boundary callsites. Fix only after mounted geometry red plus representative headed browser evidence; converge existing owners rather than add another async abstraction.

### RA-02 — Reports loading/error replaces the whole work surface (P1 Frontend)
Evidence: `ReportQueryBoundary` wraps `SectionPanel`; generic fallback removes actual heading/search/columns/pagination across 11 uses. Fix: move async state to the result/body seam while preserving real section/table shell and retained rows during refresh. Validate loading/ready/refresh/empty/error, focus and geometry.

### RA-03 — `Coordination` tag invalidates unrelated resource families (P1 Frontend data flow)
Evidence: contracts, weekly menu, schedules, meal plans, orders, amendments, history and production plans all provide one plain tag; narrow mutations invalidate it. Fix: endpoint/resource/scope tags with explicit cross-resource invalidation. Validate with store-level exact request-fanout tests before browser mutation evidence.

### RA-04 — Warehouse demand loads three unusable overview resources (P1 Frontend data flow)
Evidence: Warehouse consumes only `roleInboxItems` for lane `warehouse`, while `useWorkflowOverview` always starts documents, demand, price and movement reads; only documents can produce warehouse inbox items. Fix: direct document query plus existing pure derivation, preserving rendered inbox semantics. Validate exact endpoint/request ownership.

### RA-05 — Service Run Reports issues per-row full adjustment-history requests (P1 Cross-cutting)
Evidence: each closed row mounts `useGetServiceRunAdjustmentsQuery`, reads only item zero, while list lifecycle already contains latest `correctionOverlay`. Fix: render from list projection; keep full history for explicit on-demand detail. Validate 20-row fixture emits zero adjustment requests.

### RA-06 — Service Run page backend query count scales with rows (P1 Backend)
Evidence: `GetPageAsync` calls detail `GetProjectionAsync` plus multiple EF queries inside its row loop. Fix: bounded page read model that bulk-loads related datasets for page run IDs/scopes and groups in memory; preserve domain predicates and close snapshots. Validate query-count ceiling with existing `DbCommandInterceptor` pattern and 1-vs-20 row fixtures.

### RA-07 — Service Run status filter materializes/enriches all candidates before paging (P1 Backend)
Evidence: status-filter path calls `ToListAsync`, enriches every row, then filters/counts/pages in memory. Fix requires canonical pre-page status expression/read model; do not substitute stored status without equivalence proof. Validate membership/count/order and off-page query exclusion.

### RA-08 — Service Run list over-fetches detailed lifecycle/command state (P1 Cross-cutting)
Evidence: one detailed nested DTO serves Reports, blocker panels and operational lists; consumers use bounded subsets. Fix after RA-05/06 evidence: additive/versioned list/read DTO or dedicated blocker summary, generated contract migration, payload measurement. No breaking contract rewrite.

### RA-09 — Reports data keys depend on index/page (P2 Frontend)
Evidence: six row sites use `id-index` or `id-page-index`. Fix only with exact business-grain identity and uniqueness tests; do not remove index until composite grain is proven.

### RA-10 — Generic async min-height reservations are not content-shaped (P2 Frontend)
Evidence: generic 180/380px and Chef 32rem initial-only reservations. Address together with RA-01/02 using structural shells; no blanket min-height replacement.

## Not confirmed / intentionally unchanged

- Exact duplicate requests for identical endpoint+args are already coalesced by RTK Query and request single-flight tests.
- Inspected request chains are genuinely dependent; no speculative parallelization.
- Shared `EmptyState` is not the claimed oversized universal surface.
- No blanket memoization, `useCallback`, virtualization, cache, Redis, skeleton, or mega endpoint.
- No database index/schema change without authorized plan/runtime evidence.
- Navigation focus preload is a measured-risk candidate only; no change before clean-cache Network comparison.
- Weekly Menu render blast radius requires React Profiler evidence before architectural split.
- Modal stack conflict requires production overlap/data-loss disposition before changing the primitive.

## Final H01–H17 reconciliation

| ID | Final disposition | Package / residual |
|---|---|---|
| H01 | PASS_FOCUSED; browser bounded PASS | RA-01/RA-10 stable shells; representative current-source CLS matrix captured. |
| H02 | PASS_FOCUSED | RA-01/RA-02 preserve blocking/refresh shell identity. |
| H03 | PASS_FOCUSED | Shared grouped boundaries and child-owned pending semantics; RA-18 removed dead wrapper. |
| H04 | NEEDS_PROFILER_EVIDENCE | No speculative Weekly Menu split without React commit/effect attribution. |
| H05 | PASS_FOCUSED | RA-03 seven canonical cache tags and exact store fanout. |
| H06 | NOT_FOUND_CURRENT | Inspected chains require authoritative IDs/security scope. |
| H07 | PASS_FOCUSED; browser bounded PASS | Feedback is geometry-neutral or retained-shell owned; representative routes had no attributable defect. |
| H08 | NOT_FOUND_CURRENT | Compact shared EmptyState; no universal oversized owner. |
| H09 | PASS_FOCUSED | RA-02 retained all 11 report shells. |
| H10 | MEASURED_NOT_REPRODUCED | Representative boundary routes had no long tasks after Warehouse exceptions owner paging; React-specific attribution is unavailable without instrumentation authority, so no architecture edit is justified. |
| H11 | PASS_FOCUSED/REVIEW_OK | RA-09 uses backend IDs/complete grains; receipt line primary key added. |
| H12 | PASS_FOCUSED/REVIEW_OK | RA-06 bounded page read and RA-07 two-phase status paging. |
| H13 | PASS_FOCUSED/REVIEW_OK | RA-05/06/07/12 removed confirmed FE/BE N+1 paths. |
| H14 | CONFIRMED_BUT_AUTHORITY_BLOCKED | No index/schema action without plan, rows scanned, frequency and p95/p99; field DB instrumentation requires database/deployment owner. |
| H15 | MEASURED_NOT_ACTIONABLE | Authenticated list payload: 15 rows / 55,554 uncompressed JSON bytes / 82ms local, average 3,704 bytes per populated row. An additive DTO/version is not justified without user-impact evidence. |
| H16 | CONFLICT_BLOCKED / NOT_REPRODUCED | Existing accessible modal mechanics retained; owned runtime produced no natural stacked business modal. Fabricating records or changing the supported stack would violate project authority. |
| H17 | BOUNDED_RUNTIME_PASS | Owned current-source matrix: 14 cells, zero console/page/request/API/mutation errors; demand/reports/admin/dashboard/chef CLS near zero. Warehouse exception high shift was attributed to a below-fold section leaving the viewport, while DOM was reduced 10,368→718 and long task 381ms→0 via bounded table paging. |

Final equality: `17 = 12 PASS/NOT_FOUND/MEASURED_NOT_REPRODUCED + 1 MEASURED_NOT_ACTIONABLE + 1 NEEDS_PROFILER_EVIDENCE + 1 CONFIRMED_BUT_AUTHORITY_BLOCKED + 1 CONFLICT_BLOCKED/NOT_REPRODUCED + 1 BOUNDED_RUNTIME_PASS`. There are no remaining source-actionable findings in this hypothesis set, but H04 remains an explicit evidence gap rather than an authority-blocked finding.

Runtime artifacts: `.artifacts/shipyard-live/goal-ui-ux/runtime-r3-r4-20260915-sol/final-current-source-retry/manifest.json`, the before/after Warehouse exception runs beside it, and `.artifacts/goal-ui-ux/ra08-payload-20260915-sol/metrics.json`.

## Execution order

1. RA-05 frontend N+1 removal — smallest source-proven, uses existing list data.
2. RA-04 Warehouse overview ownership — removes three statically unusable reads.
3. RA-03 Coordination tag matrix and exact fanout tests — broad but frontend-only contract refactor.
4. RA-02 Reports structural async state — mounted state matrix, then headed geometry.
5. RA-01/RA-10 shared feedback geometry convergence — only after representative red and browser attribution.
6. RA-06 backend Service Run bounded query-count read model.
7. RA-07 status-filter server paging/read-model contract.
8. RA-08 payload hypothesis — closed after authenticated measurement as `MEASURED_NOT_ACTIONABLE`; do not create another DTO without new user-impact evidence.
9. RA-09 stable report row grain.
10. Runtime-only candidates: H10 Profiler, preload Network comparison, H16 modal overlap, H17 CLS.

No whole-project performance PASS is justified until runtime cells and remaining BLOCKED/NEEDS_EVIDENCE items are reconciled.
