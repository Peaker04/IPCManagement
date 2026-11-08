# Filter/search/pagination B — approved design and first vertical slice

Owner chose B (“Chốt”): shared behavior and small feature-appropriate patterns, not one mega-toolbar. This is the approved short design, preserving the existing UI world.

## Approaches
A shares behavior but leaves layout fragmentation; B shares behavior plus catalogue / queue-history / editable-document / report patterns. Choose B; do not make one configurable component that owns all four workflows.

## Behavior contract
- URL owns committed catalogue query, page and page size. Input always follows navigation; changing query/size resets page atomically. Page navigation creates browser history; typing replaces the current entry. Reset search preserves view and business-context parameters.
- Server search waits300ms after typing, cancels obsolete requests, and never searches just one returned page while implying global coverage. Initial/deep-link and page requests are immediate. During criteria changes retain actual previous data, mark it pending/inert, disable paging, settle errors with explicit retry. Unknown counts are “—”, not0.
- Parse positive finite integer paging inputs; default page1/size25, cap size100 per PagedRequestDto. Page size controls25/50/100 and a currently valid URL size. Unsupported sorting/property filters are not invented; backend endpoints remain authority.
- Reuse one numbered PaginationBar for real paged consumers. Use backend counts/hasPrev/hasNext; do not pretend a cursor endpoint has a total. No replacement query/cache framework.
- Local finding inside a fully loaded MRX day/week is immediate, accent/case-insensitive, clearly scoped, with result count and explicit clear. Filtering must not change quantity/reason drafts, line IDs, selection or authoritative totals. No client pagination of editable lines.
- Preserve DEFAULT/MRX, actor partitions, permissions, frozen lineage, plain6, dirty-navigation protections and source identities. CSS authority is index.css; existing primitives only.

## First independently shippable slice
Catalogue ingredients/dishes end-to-end; shared paging reused in Reports; scoped local finding in Warehouse MRX. Later slices inventory actual queue/history and report query fields, advanced filters/apply semantics and sorting endpoint-by-endpoint. This slice does not certify or silently migrate all14routes.

## MRX-wide rollout — owner continuation and scope correction

Owner authorizes continuation/coverage across the web **only in MATERIAL_RECONCILIATION**. This extends approved B, not a new visual direction or DEFAULT migration. MRX-visible shared master data remains shared; do not fork it by mode or change its authority.

- Include MRX Dashboard; weekly source/batch/editor/inbox; Warehouse daily/history/preparation/source-history; Chef cooking; Reconciliation lines/variances/transactions/audit/source/completed; shared ingredients/dishes/BOM/customers; advanced mode and auth/403 exits.
- Exclude DEFAULT purchasing/approvals/meal-orders/reports/approval-rules and DEFAULT branches of otherwise shared route roots. Keep earlier B1 Reports work intact; no new DEFAULT rollout.
- Fix supported server pagination and criteria at the real endpoint boundary. Audit/completed DTOs supply totalCount, so derive page boundaries from that count and the actual fixed page size, not rows.length. Batch selectors must expose subsequent pages without silently selecting a different batch.
- Reuse PaginationBar for real numbered results; toolbar placement must not reserve the footer's floating-menu space. No universal filter engine or unsupported server sort/search controls.
- Complete-document finding uses one Vietnamese accent/đ/whitespace normalizer where real owners need it. Explicit local scope/count/clear; no filtering a server page and implying global results. Keep full-document quantities, frozen rows, exports and selected IDs independent of visible matches.
- Six states, actor/mode partition, dirty drafts, day locks, plain6 and fail-closed frozen lineage remain mandatory. Do not fabricate customer prices/servings, data or lineage as part of UI filtering.
- Coverage is per MRX surface and meaningful behavior, including permissions and states. Inventory/source review is not rendered PASS; intercepted browser proof is not live backend/business persistence proof. No pressure to attach paging/search to mode settings, login or forbidden screens.
- Keep WORK as sole live ledger; inline execution, no delegation/worktree/commit/install/DB/process replacement. Tests selected by changed risk; no blanket campaign after each tiny edit.

## Owners
useUrlWorkbenchState: URL parsing and atomic navigation. Existing useWorkbenchQuery: enabled search scheduling gate and optional AbortSignal to actual I/O; generation protection stays. Catalog uses exact criterion snapshots and actor/mode/view remount boundary. Existing UI primitives compose PaginationBar. Reports owns its own query/filter semantics. MRX daily branch owns local filtering and reuses one toolbar across day/week.

## Acceptance
Deep link/back/forward/clear keep search and URL aligned; rapid typing causes only settled server search; abort/race does not publish obsolete rows; pending is not empty; paging and size boundaries use server metadata; typed drafts survive local filter/clear. Verify selected real component/API contracts, scoped lint/build, and isolated intercepted desktop/mobile browser checks, no real credentials/business writes. No whole-product performance/RBAC certification.
