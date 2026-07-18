---
name: 260717-ui-ux-system-refactor-v2
date: 2026-07-17
status: wave-4-gates-executed-visual-ownership-blocked
type: refactor-plan
parent: 260717-ui-ux-system-redesign
---

# UI/UX Refactor v2 — Canonical Surface Synchronization

## 1. Decision

Tạm dừng Wave 4 của plan cũ. Không tiếp tục thêm pagination adapter hoặc chỉnh CSS cục bộ cho từng route cho tới khi có một kiến trúc UI canonical.

Mục tiêu của plan v2 là refactor có kiểm soát: xác định một nguồn sự thật cho layout, table, pagination, trạng thái, copy và responsive behavior; sau đó migrate từng route bằng compatibility layer có thời hạn. UI hiện có phải được tái cấu trúc theo contract mới, không bị ghi đè mù hoặc ghép nhiều pattern song song.

## 2. Design read

Đây là công cụ vận hành B2B cho điều phối, bếp, kho, thu mua và admin; người dùng cần quét nhanh trạng thái và hoàn tất thao tác có hậu quả dữ liệu. Ngôn ngữ thiết kế là operational clarity: nền trắng/slate, một accent IPC blue, density trung bình, motion thấp, trạng thái có chữ, table có boundary rõ và focus dễ nhận biết.

Dials cố định cho v2:

- `DESIGN_VARIANCE`: 3/10 — ưu tiên nhất quán hơn trang trí.
- `MOTION_INTENSITY`: 2/10 — chỉ dùng transition cho focus, open/close và feedback ngắn.
- `VISUAL_DENSITY`: 5/10 — đủ dữ liệu cho vận hành nhưng không dồn card/table thành cockpit.

## 3. Current-state problems to solve

1. Có nhiều lớp table song song: `DataTableShell`, `PaginatedTableFrame`, native table wrapper và local slice/pagination; cùng mục tiêu nhưng khác geometry, copy và state handling.
2. Pagination đang trộn ba contract: local collection page, server cursor page và server page-number; một số route có thể hiển thị pager nhưng payload/query không đổi.
3. Route đã migrate và route chưa migrate không cùng page anatomy, spacing, heading, loading/error/empty geometry.
4. Copy tiếng Việt chưa được quản trị tập trung; một số từ kỹ thuật (`Audit`, `Pending`, `Owner`, `Contract`, `Action`, `Error`, `Warning`) xuất hiện không đồng nhất ngữ cảnh.
5. `AdminDataPage.tsx` và global style đang có dirty worktree lớn; không thể xem chúng là baseline sạch để refactor trực tiếp.
6. `DataTableShell` và `PaginationBar` có blast radius CRITICAL; sửa trực tiếp trước khi có replacement contract sẽ làm tăng rủi ro toàn hệ thống.
7. Playwright UI audit đã pass phần overflow/action ở môi trường hiện tại, nhưng controls/smoke protected-route thất bại do login/API fallback; chưa được xem là bằng chứng visual hoàn chỉnh.

## 4. Scope fences

### In scope

- Canonical page anatomy, table viewport, pagination state, copy/semantic labels, loading/error/empty states, focus and responsive behavior.
- Route migration sau khi canonical primitives được chốt.
- Contract tests, static audit, Playwright controls/smoke/ui-audit/visual.
- Documentation và ownership manifest cho từng migration slice.

### Out of scope until separately approved

- Thay đổi backend API shape, cursor semantics hoặc database schema chỉ để phục vụ UI.
- Đổi icon family, font, brand palette hoặc thêm UI kit thứ hai.
- Refactor business mutation handlers chỉ vì layout.
- Sửa các dirty backend/frontend files không thuộc allowlist.
- Cập nhật visual snapshots khi chưa có root-cause và evidence của thay đổi.

## 5. Execution waves

### Wave 0 — Baseline, ownership and failure reproduction

Status: completed for the current execution slice. GitNexus was refreshed; `RoleInbox` was classified HIGH and excluded from the pilot; `DemandSummary` was classified LOW and selected as the pilot.

Deliverables:

- `BASELINE.md`: inventory route → shell → table → data contract → pagination contract → test coverage.
- `OWNERSHIP.md`: file allowlist, protected files, dirty-file map và commit boundary.
- Reproduce controls/smoke failures with exact cause classification: auth, backend availability, fixture, selector or UI regression.
- GitNexus context/impact report for `MainLayout`, `DataTableShell`, `PaginationBar`, `PaginatedTableFrame`, `usePaginatedRows`, `AdminDataPage` and `ReportsPage`.

Exit criteria:

- Không còn unknown dirty-file ownership cho slice chuẩn bị sửa.
- Mỗi route được gán một data/pagination contract duy nhất.
- Test failures có owner và repro command; không còn dùng “bỏ qua cảnh báo” làm trạng thái.

### Wave 1 — Canonical design tokens and semantic language

Status: initial contract established; full token/copy audit remains.

Deliverables:

- Three-layer tokens: primitive → semantic → component; không hardcode color/spacing mới trong route.
- `uiCopy`/`uiSemantics` contract gồm labels, status, required, reason, pagination, technical identifier và action vocabulary.
- Canonical page anatomy: route header, command/action row, context strip, content region, feedback region.
- State vocabulary: `loading`, `ready`, `empty`, `no-result`, `error`, `mutating`, `stale`.

Exit criteria:

- Token validator/static scan không phát hiện token mới bị hardcode ngoài allowlist.
- Copy map có test cho label/status/pagination và không làm thay đổi API payload.
- Một route pilot và một dialog pilot render đúng anatomy.

### Wave 2 — Canonical table and pagination architecture

Status: route-family pilot slice complete for local/shared consumers that passed risk gates. `TableViewport`, typed `PaginationContract` and `useLocalPagination` now exist; all migrated route tables plus `DocumentRail`, `StockMovementTable` and `RoleInbox` use the canonical controller/viewport. `PaginatedTableFrame` is now a thin adapter over `TableViewport`; `AdminDataPage` remains explicitly gated by dirty ownership before its consumer code is migrated/removed.

Deliverables:

- `TableViewport`: một boundary native table, sticky opaque header, local scroll, stable scrollbar gutter, caption/aria label, mobile behavior.
- `PaginationController`: adapter cho local collection, server page-number và server cursor; API phải biểu đạt rõ loại contract.
- `TableState` slots: loading/error/empty/no-result giữ cùng geometry với bảng thật.
- `TableActionCell`/cell wrapping rule để tránh action wrap và page overflow.
- Deprecation map cho `DataTableShell`, `PaginationBar`, `PaginatedTableFrame`; không xóa ngay, nhưng không cho thêm consumer mới.

Pilot migration note — Coordination `OrderTable`:

- Current pattern: `PaginatedTableFrame` + `usePaginatedRows` + `PaginationBar`.
- Target contract: `TableViewport` + `useLocalPagination` + existing `PaginationBar` compatibility boundary.
- Impact: GitNexus upstream impact LOW before edit; one direct caller (`CoordinationPage`), one affected execution flow.
- Preserved behavior: page size 12, local slicing, page navigation, optimistic quantity/forecast mutations and rollback handling.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass; staged GitNexus detect scope was one file, three symbols, two expected Coordination flows, MEDIUM aggregate risk.
- Rollback: revert commit `0a64f5b` without touching the dirty user-owned worktree.

Pilot migration note — Reports:

- Current pattern: ten local report tables used `PaginatedTableFrame` plus `usePaginatedRows`; cursor movement and audit pagination were separate contracts.
- Target contract: local tables use `TableViewport` plus `useLocalPagination`; cursor movement keeps its existing cursor boundary and `StockMovementTable` remains protected.
- Impact: GitNexus returned two parser candidates for `ReportsPage`, both LOW with no upstream callers; staged detection covered one Reports execution flow at MEDIUM aggregate scope.
- Preserved behavior: all page sizes, local row slicing, pagination callbacks, report query payloads, cursor navigation and export/mutation behavior.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass.
- Rollback: revert commit `c4aaf92` if visual or route-level regression appears.

Pilot migration note — Warehouse inventory:

- Current pattern: `WarehousePage` used `PaginatedTableFrame` and `usePaginatedRows` for the local current-stock collection.
- Target contract: `TableViewport` + `useLocalPagination`, with an accessible table caption and the existing `PaginationBar` compatibility boundary.
- Impact: GitNexus upstream impact LOW before edit; staged detection covered one Warehouse flow at MEDIUM aggregate scope.
- Preserved behavior: query limit 12, local page size 8, empty-state row, pagination callbacks, inventory issue mutation, document rail and cursor stock movement table.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass.
- Rollback: revert commit `7f988a1` if route-level regression appears.

Pilot migration note — Purchasing:

- Current pattern: supplier lines, quotations and purchase orders used `PaginatedTableFrame` plus `usePaginatedRows` in three local component sections.
- Target contract: all four local table surfaces use `TableViewport` plus `useLocalPagination`; cursor-based movement and shared rails stay outside the slice.
- Impact: GitNexus page-level impact was LOW before edit; nested component symbols were not indexed separately; staged detection covered one Purchasing flow at MEDIUM aggregate scope.
- Preserved behavior: supplier/quotation/order page sizes, local row slicing, pagination callbacks, purchase mutations, approval actions and stock-movement cursor behavior.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass.
- Rollback: revert commit `7a8e963` if route-level regression appears.

Exit criteria:

- Unit tests cho page clamp, filter reset, cursor previous/next, disabled state, total count và payload invariants.
- Contract test chứng minh local page không thay đổi request/query payload.
- Pilot route pass lint/build/unit/controls.

### Wave 3 — Route migration by family

Thứ tự bắt buộc:

1. Shell/login/dashboard/work queue.
2. Coordination/weekly menu.
3. Approval/purchasing/warehouse.
4. Chef.
5. Reports.
6. Admin.

Mỗi route phải có một migration note gồm: current pattern, target contract, changed symbols, impact, preserved behavior, test evidence và rollback path.

Exit criteria mỗi family:

- Không còn trộn hai table/pagination pattern trong cùng một page.
- Loading/error/empty/no-result có cùng geometry.
- Technical copy có label giải thích.
- Visual snapshot chỉ cập nhật sau khi controls và overflow pass.

Current Wave 3 evidence:

- Coordination, Reports, Warehouse and Purchasing safe local table consumers now use the canonical local controller and viewport.
- `npm run test:ui-audit --workspace frontend`: 2/2 passed after the migrations.
- Remaining route-family work is not silently skipped: shared `RoleInbox`, `DocumentRail`, `StockMovementTable` are HIGH-impact; `AdminDataPage` is dirty user-owned work. They require a separate impact/ownership gate before editing.
- Shared HIGH migrations completed with compatibility-preserving changes: `DocumentRail` (`2ecb972`), `StockMovementTable` (`a198124`) and `RoleInbox` (`32688c3`). Each changed only local pagination/viewport implementation and retained public props, row actions and mutation boundaries.
- Remaining legacy consumer is `AdminDataPage.tsx`, which has an existing 613-line user-owned dirty diff and must be reconciled separately before its six table instances can migrate.
- Compatibility cleanup: `PaginatedTableFrame` now delegates to `TableViewport` (`fd1af9e`), preserving its public props and legacy class while removing duplicate viewport DOM behavior. GitNexus does not index this symbol, so direct repository inventory plus regression gates are the evidence boundary.
- Semantic copy slice: `uiCopy.reports` now owns report tab, status and technical labels; `ReportsPage` consumes those labels for UI and CSV headers (`dc989ef`). Backend enums, query payloads and exported values remain unchanged.
- Workflow copy slice: `uiCopy.workflow` now owns owner, deadline, action, SLA and document-code labels; `DocumentRail`, `RoleInbox` and `ApprovalQueue` consume the shared vocabulary (`00da341`).
- Pagination contract slice: pure `paginationMeta.ts` now owns local page math; `usePaginatedRows` re-exports it for compatibility, `useLocalPagination` imports it directly, and `PaginationContract` is a discriminated union for local/page-number/cursor (`1200311`).
- Legacy helper convergence: `usePaginatedRows` now delegates to `useLocalPagination` (`a82286f`), so legacy consumers share the canonical local controller without changing their public API or server-query behavior. The dirty `AdminDataPage` consumer remains protected for ownership reconciliation.
- Table semantics slice: `TableViewport` now associates its optional caption with the scroll region via `aria-describedby` (`4d02c59`); `TableViewport.test.tsx` covers both captioned and uncaptioned regions without changing layout classes or table content.
- Pagination bar convergence: `PaginationBar` now consumes canonical pagination metadata and Vietnamese range/action copy (`6f47c33`), preserving the public callback/class contract while clamping invalid page input. Upstream impact was recorded as CRITICAL; staged detection covered exactly 2 symbols with LOW aggregate scope.
- Cursor contract convergence: Reports now consumes shared `CursorPaginationBar` (`fd6def4`), while cursor endpoints retain `hasNext`/cursor-token semantics and never receive local numeric pagination fields. The three pagination modes remain explicit: local, page-number and cursor.
- Weekly-menu local pagination convergence: the purchase-summary footer now consumes shared `PaginationBar` (`2854243`); data aggregation and page-index state remain unchanged, while the route-local range/button markup is removed. Ownership was enforced hunk-by-hunk because the route remains dirty.
- Grouped-page convergence: production-plan navigation now consumes `PageStepper` (`d844ed9`), a distinct helper for domain page groups. It deliberately avoids item-range copy and preserves the service-day summary and page-index contract.
- Chef slice: `MaterialChecklist` now uses `TableViewport` with an accessible caption instead of the critical `DataTableShell`; checkbox/signoff behavior remains unchanged (`f8aaae4`).
- Chef BOM slice: `ActiveDishesGrid` now uses `TableViewport` for expanded dish ingredient tables, retaining expand/collapse, row keys and existing data (`c1d62b4`).
- Chef production slice: `ChefDashboardPage` daily production-plan table now uses `TableViewport` with a caption; send-to-kitchen action and row readiness rendering are unchanged (`288ac13`).
- Dashboard slice: `SwimlaneProgress` now uses `TableViewport` and shared semantic workflow copy for lane/status/waiting/blocked/next-action columns (`80b52d8`).
- Weekly-menu slice: the clean production-detail table inside `WeeklyMenuPage` now uses `TableViewport` with an accessible caption (`347253e`). The feature-owned import and production-plan hunks were not staged.
- Weekly-menu slice 2: the weekly production-plan table now uses `TableViewport`, preserving its `560px` geometry through an explicit max-height and adding an accessible caption (`10d1916`).
- Weekly-menu slice 3: pending import jobs and import history now use canonical viewports with explicit captions and preserved `260px` max-height (`6dd531d`, `6787897`).
- Weekly-menu slice 4: the linked cost table and daily ingredient cost table now use canonical viewports while preserving their legacy cost-table class and explicit `560px`/`360px` heights (`e755b56`, `0034875`).
- Weekly-menu slice 5: purchase-summary and tray-cost tables now use the same canonical viewport contract, preserving `560px` geometry and cost-table styling (`9a5c0af`, `85ba461`).
- Weekly-menu slice 6: `ImportedLayoutMatrix` now uses `TableViewport`; `DataTableShell` has no remaining consumer in `WeeklyMenuPage` (`d420da6`). The legacy class and dynamic max-height remain intact.
- Imported-layout A/B evidence: canonical vs legacy changed the weekly-menu visual diff from `33280` to `33316` desktop pixels and `64371` to `64740` mobile pixels. This is an explained canonical viewport geometry change; snapshots remain frozen until the dirty route feature work is reconciled.
- Admin slice: the clean statistics table between dirty BOM/contract hunks now uses `TableViewport` with an accessible caption (`d105f55`). BOM tables and legacy pagination consumers remain untouched.
- Admin statistics A/B evidence: canonical and legacy wrappers produced identical visual results (`40384` desktop pixels; `390×2080`, `109378` mobile pixels). The current admin visual failure is therefore attributable to the pre-existing dirty route feature diff, not this isolated migration.
- Admin contracts slice: the contract listing table now uses `TableViewport` with a semantic caption (`ae91b02`); adjacent dirty contract-form hunks were not staged.
- Current legacy inventory: `WeeklyMenuPage` has zero legacy shell references. `AdminDataPage` retains `DataTableShell` only for the user-owned BOM-current table; all remaining `PaginatedTableFrame` surfaces are already canonical-backed adapters and remain until pagination ownership is reconciled.
- Ownership correction: clean-baseline comparison confirms the Admin BOM-current `DataTableShell` was added by the dirty BOM feature itself. The attempted wrapper migration was reverted and no Admin feature hunk was committed; explicit feature handoff remains required.
- Weekly-menu visual evidence: legacy wrapper and canonical wrapper produced the same baseline mismatch (`33280` desktop pixels; mobile `390×1997` vs baseline `390×1958`). The mismatch is therefore pre-existing to this isolated wrapper migration and remains tracked as an ownership/baseline blocker; no snapshot was changed.

Pagination contract gap evidence:

- The workflow-report list endpoints for current stock, ingredient demand, purchase plan, price variance, kitchen issues, issue-vs-return and data quality accept only `limit` and return bounded lists/aggregates.
- Only `stock-movements/page` and `audit-changes/page` currently return cursor metadata. Their shared cursor control is therefore valid; converting the list endpoints to numeric UI pages without backend metadata would be a false lazy-pagination implementation.
- The exact endpoint matrix, risk decision and required follow-up are recorded in `PAGINATION-CONTRACT-GAP.md`.
- True server pagination is deferred to a separately owned backend/API phase because `WorkflowReportService` and `AdminDataPage` have user-owned dirty changes. Local pagination remains a DOM-containment measure and must not be described as server lazy loading.

Current-stock server-pagination slice:

- Added `GET /api/workflow-reports/current-stock/page` with `pageNumber`, `pageSize`, existing warehouse/ingredient filters and `PagedResponseDto` metadata (`totalCount`, `totalPages`, `hasPrev`, `hasNext`).
- `ReportsPage` now requests only the active stock page and renders the server response directly; the previous `limit: 100` + local slice path is removed for this route.
- Ownership was preserved with hunk-level staging: the pre-existing BOM/tier changes in `WorkflowReportService.cs` remain unstaged and were not included in commit `0139148`.
- Evidence: relational SQLite contract test passed; backend `267/267` tests, frontend unit `72/72`, lint and build passed; staged GitNexus detection was 8 files, 2 symbols, 1 Reports flow, MEDIUM.
- Runtime note: unauthenticated endpoint correctly returns `401`. Swagger generation remains unavailable because the pre-existing dirty `DishesController.PreviewBomImport` `[FromForm] IFormFile` contract crashes Swashbuckle; this is tracked as a separate backend/docs blocker and is not caused by the pagination slice.

Price-variance server-pagination slice:

- Added `GET /api/workflow-reports/receipt-price-variance/page` using the shared `WorkflowReportPageQueryDto` contract and the same filters/stable ordering as the legacy list endpoint.
- `ReportsPage` price-line view now requests only its active server page and renders `totalCount` metadata through the canonical `PaginationBar`; the old `limit: 100` local slice is removed for this view.
- The shared page query contract is now reused by current stock and price variance, while endpoint-specific DTO names keep controller contracts explicit.
- Evidence: backend `267/267` tests, frontend unit `72/72`, build and lint pass; staged GitNexus detection was 9 files, 2 ReportsPage symbols, 1 flow, MEDIUM. Commit: `327761d`.

Ingredient-demand server-pagination slice:

- Added `GET /api/workflow-reports/ingredient-demand/page` with page metadata plus `shortageCount`, so the table can be lazy-loaded without corrupting the dashboard context metric.
- ReportsPage demand view now requests the active page only; `PaginationBar` consumes server totals and the context strip consumes server-calculated shortage count. The previous `limit:100` local slice is removed for this table.
- Preserved behavior: filters, row mapping, status/tone semantics, handoff links, export payload shape and the distinction between shortage (`suggestedPurchaseQty > 0`) and cancelled warning rows.
- Evidence: backend `267/267` tests, frontend unit `72/72`, build and lint pass; staged GitNexus detection was 7 files, 2 ReportsPage symbols, 1 flow, MEDIUM. Commit: `532573f`.

Purchase-plan server-pagination slice:

- Added `GET /api/workflow-reports/purchase-plan/page` with grouped-row metadata and server-calculated `totalShortageQty`/`totalEstimatedAmount`.
- ReportsPage purchase view now requests only the active grouped page; its context strip uses server totals instead of summing only the visible page.
- The legacy endpoint retains its source limit behavior (`500`), while the page endpoint removes that source truncation before grouping so grouped totals are not mathematically incomplete.
- Known boundary: grouping and pending-receipt aggregation currently materialize the filtered source lines in the service before slicing the grouped response. This solves bounded UI payloads and correct metadata, but a future DB-level grouped query is required for large-data performance; it is not silently claimed as full database lazy loading.
- Evidence: backend `267/267` tests, frontend unit `72/72`, build and lint pass; staged GitNexus detection was 7 files, 2 ReportsPage symbols, 1 flow, MEDIUM. Commit: `78fdd34`.

Kitchen/usage server-pagination slice:

- Added `GET /api/workflow-reports/kitchen-issues/page` and `GET /api/workflow-reports/issue-vs-return/page` using the shared page-number contract, stable ordering and `PagedResponseDto` metadata.
- ReportsPage kitchen-issue and issue-vs-return views now request only the active server page and render server totals through the canonical `PaginationBar`; the previous full-list fetch plus local slicing is removed for these views.
- Usage semantics are preserved: return and waste quantities are aggregated for the issue IDs on the requested page, then mapped to the same issued/returned/wasted/variance/used row fields as before.
- Ownership was preserved with hunk-level staging: the unrelated BOM/tier edits in `WorkflowReportService.cs` remain unstaged.
- Evidence: backend `267/267` tests, frontend unit `72/72`, lint and build pass; staged GitNexus detection was 7 files, 2 symbols, 1 Reports flow, MEDIUM. Commit: `54d2e51`.

Data-quality server-pagination slice:

- Added `GET /api/workflow-reports/data-quality/page` with page-number metadata and the existing quality summary counters in a single response contract.
- ReportsPage data-quality now requests the active issue page only and renders that page through the canonical `PaginationBar`; the previous full report plus local slice is removed from this route.
- Preserved issue mapping, severity/status copy, summary counters and remediation routes. `AdminDataPage` continues using its existing endpoint and remains outside this ownership boundary.
- Known boundary: the current data-quality generator still materializes and sorts up to the service safety cap (`1000`) before page slicing because its issue sources are heterogeneous. This commit bounds the UI payload and establishes the API contract; a future data-quality query decomposition is required before claiming fully database-lazy evaluation at very large issue volumes.
- Evidence: backend `267/267` tests, frontend unit `72/72`, lint and build pass; staged GitNexus detection was 7 files, 2 ReportsPage symbols, 1 flow, MEDIUM. Commit: `95ac13c`.

Admin audit cursor-pagination slice:

- `AdminDataPage` Audit now uses the existing `audit-changes/page` cursor contract with a page size of 8 and only requests audit data while the Audit tab is active.
- Filter changes and reset clear cursor history; next/previous navigation uses the canonical `CursorPaginationBar`. The table no longer downloads the full audit list before slicing locally.
- Ownership was enforced hunk-by-hunk. GitNexus classified `AdminDataPage` as LOW impact; the staged scope contained only that file and no BOM/import/contract changes.
- Evidence: frontend lint/unit/build pass, backend `267/267` tests pass, staged `detect_changes` reported 1 file, 1 symbol, 0 processes, LOW. Commits: `ea4938b` (Audit cursor wiring) and `8f39660` (Audit display cleanup plus current-stock page migration).
- Known boundary: Admin statistics still uses bounded legacy kitchen/usage list endpoints because the current page contracts do not expose report-wide quantity aggregates; replacing them with an 8-row page would silently change totals.

Admin price-warning page slice:

- Added the explicit `warningOnly` report contract and migrated the Admin price-warning table to `receipt-price-variance/page` with server page metadata and page size 8.
- Warning counts and summary status now use API `totalCount`; the table renders only warning rows, so page navigation no longer filters a full client list after download.
- Risk note: warning eligibility is expressed in the query as `UnitPrice >= ReferencePrice * 1.15` for positive reference prices, matching the existing 15% calculator threshold. A future central threshold setting should replace this literal when the domain policy becomes configurable.
- Ownership was preserved despite the pre-existing dirty `WorkflowReportService.cs`; only the DTO/query-builder hunk and owned Admin/frontend contract hunks were staged. GitNexus staged detection: 4 files, 1 indexed symbol, 0 processes, LOW. Commit: `e152b06`.
- Evidence: frontend lint/unit/build pass (`72/72`); backend tests pass `267/267` with `--no-build` because the running API process locked apphost during the build-enabled test command.

Admin data-quality page slice:

- `AdminDataPage` cleanup now consumes `data-quality/page` with page size 8, renders only the server page and keeps the shared `PaginationBar` bound to API metadata.
- Summary semantics remain report-wide: total issues, error tone, missing BOM, unit/conversion, negative stock, orphan, SLA and resolved counters still come from the report summary rather than the visible page.
- Ownership was enforced hunk-by-hunk; BOM and contract feature changes remained unstaged. GitNexus classified `AdminDataPage` as LOW, with 1 staged file, 1 symbol and 0 affected processes.
- Evidence: frontend lint/unit/build pass (`72/72` unit tests); commit: `f7d5501`.
- Known boundary: Admin statistics remains the next contract-design slice; it needs explicit report-wide quantity aggregates before its bounded table endpoints can be reused without changing semantics.

Reports semantic-status slice:

- Reports UI and CSV output now pass operational status values through the shared `formatWorkflowStatus` helper. `open`, `resolved`, `reopened`, `warning` and `error` are presented as Vietnamese user-facing labels while raw values remain unchanged in API/query logic.
- Evidence: frontend lint pass, unit `76/76`, and production build pass. No API payload, mutation handler or route contract changed.
- The three aggregate views now use dedicated page-number endpoints with `totalCount` metadata; Reports no longer fetches `limit: 100` and slices those rows locally. Legacy list endpoints remain for compatibility.
- Known boundary: aggregate calculation still materializes filtered receipt lines before grouping, so response paging is bounded but database-level lazy aggregation is not yet complete. A future query decomposition should push grouping/count/order into SQL before very large-history release.
- Evidence: backend compile-only pass, backend tests `267/267` pass with `--no-build`, frontend lint/unit `76/76`/build pass, staged GitNexus detection reported 7 files, 1 Reports flow, MEDIUM. Commit: `2946327`.

Purchasing semantic-status slice:

- Purchasing request and purchase-order status badges now use the shared `formatWorkflowStatus` helper; duplicate route-local maps were removed while raw enum values remain unchanged for action branching.
- Evidence: frontend lint/unit `76/76`/build pass; staged GitNexus detection reported 3 files, 1 Purchasing flow, MEDIUM. Commit: `8bb3f2b`.
- Remaining contract gap: purchase requests, supplier quotations and purchase orders are still list endpoints with route-local pagination or a `100`-row request. They require separate page-number contracts and ownership checks before claiming full lazy loading for Purchasing.

Purchasing supplier-quotation page slice:

- Added `GET /api/supplier-quotations/ingredient/{ingredientId}/page` with bounded `items` and `totalCount` metadata. The quotation manager now requests the active page and binds `PaginationBar` to server metadata; the legacy list endpoint remains for inline supplier-line lookup compatibility.
- Evidence: backend compile-only pass, frontend lint/unit `76/76`/build pass, staged GitNexus detection reported 7 files, 1 Purchasing flow, MEDIUM. Commit: `30b87d6`.
- Remaining boundary: purchase requests and purchase orders still need page contracts; inline supplier-line lookup still uses the legacy quotation list for best-price suggestions and is tracked separately.

Purchasing request/order page slices:

- Purchase Requests now expose `/api/purchase-requests/page`; the Supplier workbench uses server page metadata, while the Orders tab keeps its legacy full request list only for cross-request action analysis.
- Purchase Orders now expose `/api/purchase-orders/page`; the response includes bounded order rows plus `OrderCountByRequest`, preserving the “create order” eligibility calculation across pages. The Orders table no longer uses `useLocalPagination`.
- Evidence: backend compile-only pass, frontend lint/unit `76/76`/build pass, staged GitNexus detection reported 8 files, 1 Purchasing flow, MEDIUM. Commit: `3e5365d`.
- Remaining boundary: inline supplier-line best-price lookup still uses the legacy quotation list endpoint per row; it is not used for the paged quotation manager and requires a later batched/lookup contract to avoid repeated fetches.

Admin purchase-summary query slice:

- Statistics no longer requests up to 500 purchase-plan rows just to calculate one total. It now uses `purchase-plan/page` with the existing aggregate `totalShortageQty` contract and a bounded page size of 8.
- The user-facing statistic remains the same while the payload is bounded; no purchase table or backend behavior was changed.
- GitNexus impact/detect for the owned `AdminDataPage` change was LOW: 1 file, 1 symbol, 0 processes. Commit: `c1379ac`.
- Evidence: frontend lint/unit/build pass (`72/72`).

Admin ingredient-demand summary slice:

- Statistics now uses `ingredient-demand/page` with page size 8 and reads the report-wide `shortageCount` aggregate instead of downloading 100 demand rows to count shortage lines.
- The visible statistic and status copy remain unchanged; only the transport payload and source of the aggregate were corrected.
- GitNexus impact/detect: LOW, 1 file, 1 symbol, 0 processes. Commit: `eb084b7`.
- Evidence: frontend lint/build pass and unit suite `72/72`.

Admin current-stock page slice:

- `AdminDataPage` inventory now consumes `current-stock/page` with an API page size of 8, binds the table rows directly to the server page and preserves the context-strip total through `totalCount`.
- The existing `PaginationBar` remains the shared control; local `usePaginatedRows` slicing is removed for this table. Audit's missing display binding was corrected in the same ownership-safe pass after verification caught it.
- Evidence: frontend lint/unit/build pass (`72/72` unit tests); staged GitNexus detection reported 1 file, 1 symbol, 0 processes, LOW. Commit: `8f39660`.
- Known boundary: Admin statistics, cleanup and price-warning transport slices are now migrated; remaining Admin work is visual reconciliation and compatibility cleanup, not another unbounded list fetch.

Admin stock-adjustment cursor slice:

- `AdminDataPage` Inventory now requests `stock-movements/page` only while the Inventory tab is active, with `movementType=adjustment` and a cursor page size of 8; the previous `limit:100` fetch plus client-side filtering is removed.
- `WorkflowReportQueryDto`/`WorkflowReportService` now support an optional case-insensitive `MovementType` filter. Existing callers remain unchanged when the filter is absent, while the Admin page can page only adjustment rows without losing rows because other movement types occupied the source page.
- The table keeps `StockMovementTable` as a presentation component and uses the canonical `CursorPaginationBar` for server navigation. Its internal local pager is inert for an 8-row server page, so no duplicate controls are rendered.
- Ownership was enforced with a five-file narrow stage; the pre-existing BOM/contract changes in `AdminDataPage`, `WorkflowReportService` and `WorkflowGenerationTests` remained outside the commit. GitNexus staged detection reported 5 files, 1 indexed symbol, 0 processes, LOW.
- Evidence: backend build and `267/267` tests pass; frontend lint, unit `72/72` and production build pass. Commit: `342a681`.
- Risk boundary: GitNexus could not index the backend service/DTO symbols (`UNKNOWN` impact), so the filter was verified through direct compile and focused regression assertion rather than treated as zero-risk. The endpoint still materializes up to `limit + 1` rows before cursor metadata; this is bounded UI pagination, not a claim of fully database-lazy history scanning.

Admin kitchen-statistics aggregate slice:

- `OperationalKpiSummaryDto` now exposes report-wide issued, used and returned kitchen quantities. The service calculates them from issue lines and matching return/waste records, preserving the existing used-quantity rule (`max(0, issued - returned - waste)`).
- `AdminDataPage` statistics no longer requests kitchen-issue and usage lists with `limit:100` merely to sum visible rows; it reads the bounded KPI response instead. Existing KPI count fields and all other consumers remain unchanged.
- Ownership was preserved with a four-file narrow stage; the dirty BOM/contract changes in `AdminDataPage` and `WorkflowReportService` remained outside the commit. Commit: `71f69ff`.
- Evidence: backend build, `267/267` tests, frontend lint, unit `72/72` and production build pass. GitNexus returned UNKNOWN for backend KPI symbols and LOW for the Admin page; this remains an explicit contract risk, not an ignored warning.
- Known boundary: the aggregate currently loads distinct issue IDs before summing matching return records. This is correct and bounded at the UI boundary, but a future DB-side grouped aggregate should replace the ID materialization for very large histories.

Critical shell gate result — `DataTableShell`:

- GitNexus upstream impact: CRITICAL; 16 impacted symbols, 10 direct callers and 12 affected execution flows.
- A compatibility bridge to `TableViewport` was prototyped with the public props and `ipc-table-shell` class preserved. Unit `62/62`, lint, build and UI audit `2/2` passed.
- Visual verification remained `8/20` passed and `12/20` failed, including route-height and mobile geometry drift. The bridge was reverted and no snapshots were updated.
- Decision: keep `DataTableShell` protected. The next plan slice must first create a route-scoped visual fixture/geometry contract, then migrate one legacy consumer at a time; deletion or direct global replacement is prohibited.
- Contract tests: `DataTableShell.test.tsx` locks the public accessible-name, region, tabindex and legacy-class contract without changing runtime geometry (`a3a2c2c`); `usePaginatedRows.test.ts` locks the legacy API plus canonical local contract (`421c904`). Full unit suite is now 70/70.
- Direct inventory boundary: GitNexus does not index `usePaginatedRows`; its impact/detect scope is therefore recorded as `UNKNOWN`/`No changes detected`, with source diff, compatibility API review and full frontend gates used as the verification evidence.
- Ownership manifest: `OWNERSHIP.md` defines the dirty route boundaries and the exact reconciliation gate required before touching `WeeklyMenuPage` or `AdminDataPage`.

Wave 4 gate execution:

- Controls gate: `4/4` passed. Dialog naming, action reachability and protected-route controls remain addressable.
- Route smoke: `13/13` passed after updating fixtures to the current page-number/cursor contracts. The test now waits for lazy tab activation before asserting the relevant request, instead of assuming every report tab loads eagerly.
- UI audit: `2/2` passed, including the Admin data-quality stress table and action readability check.
- Visual regression: the latest sequential run is `6/20` passed and `14/20` failed. Failures remain concentrated in WeeklyMenu, Reports, AdminData, stale Chef/Purchasing/Warehouse baselines and mobile geometry; no snapshots were regenerated. This is evidence that the visual/ownership blocker persists, not authorization to update snapshots.
- The visual gate was run sequentially to avoid Vite cache races (`EPERM` rename) observed when Playwright projects were launched in parallel. Commit `859c97d` records only fixture contract corrections; no product snapshot or protected global-style change was staged.
- Release verification initially caught two stale Admin badge references after removing the legacy kitchen/usage hooks; they were changed to use the new KPI aggregates and reverified by a successful frontend production build. Fix commit: `874de3b`.

### Wave 4 — Accessibility and visual verification

Chỉ bắt đầu lại sau khi Wave 0–3 đạt exit criteria.

- Viewports: 1365×900, 1280×900, 768×1024, 390×844.
- Keyboard tab order, focus visible, dialog naming, table region naming, aria-current/selected, reduced motion.
- Body overflow, nested scroll, sticky header, action reachability, long-cell wrapping.
- Playwright controls, route smoke, ui-audit, visual routes; nếu auth/backend fail thì phân loại và sửa root cause trước khi rerun.

Wave 4 remains blocked for visual completion. Functional/accessibility gates pass, but the critical shell and dirty route/global-style ownership boundaries still prevent trustworthy snapshot updates or global shell migration.

Evidence added on 2026-07-18 confirms the blocker is composite rather than a single shell defect: the dirty `WeeklyMenuPage` and `AdminDataPage` feature diffs change route structure and content geometry, while `index.css` carries a large global-style diff. The remaining `DataTableShell` consumer is the user-owned BOM-current table in `AdminDataPage`; there is no clean caller available for the planned low-risk migration. The next step is ownership handoff or baseline reconciliation, not more route code or snapshot changes.

GitNexus was force-refreshed after a stale-index discrepancy was detected. The graph still reports `DataTableShell` as CRITICAL (16 symbols, 12 flows), despite the current source inventory showing one production consumer. This unresolved discrepancy is itself a risk gate: cleanup must wait until graph edges are reconciled with source, and the higher-risk result must not be dismissed.

Wave 4.5 visual evidence is recorded in `UI-REVIEW.md`: desktop dashboard/chef routes pass; mobile failures are bounded height/copy/date drift rather than duplicate shell rendering. Snapshot updates and broad CSS deletion remain prohibited until fixture and ownership reconciliation.

### Next execution slice — Refactor legacy shell safely

1. Freeze the current visual baseline and separate failures caused by the dirty dashboard snapshots, the dirty `WeeklyMenuPage`/`AdminDataPage`, and the uncommitted shell prototype. This evidence is now recorded in `OWNERSHIP.md`.
2. Add a small contract test for `DataTableShell` public props, region semantics and legacy class preservation; do not change geometry in this step.
3. Select one clean, low-impact legacy consumer and migrate its caller to `TableViewport`; do not make `DataTableShell` delegate globally. This step is pending because the current inventory has no clean `DataTableShell` consumer.
4. Run the complete gate set for that consumer. A visual failure must produce an actual-vs-baseline diff and root-cause note; snapshot updates are forbidden until the diff is explained.
5. Re-run GitNexus impact for every edited symbol. If the shared shell remains CRITICAL, keep it as a compatibility boundary and move the migration to callers.
6. Reconcile ownership for `WeeklyMenuPage` and `AdminDataPage` before touching either file. Their existing user changes are not implementation debt that can be overwritten.
7. Only after all consumers are migrated, remove `DataTableShell`/legacy CSS in a separate cleanup commit with a full visual and accessibility gate.

### Wave 4.5 — CSS/JavaScript debt and feedback-surface normalization

Status: in progress. Shared feedback normalization and one isolated CSS cleanup slice are complete; Task 4.5.1a inventory is recorded in `CSS-JS-INVENTORY.md`; route-wide layout migration remains gated by dirty-route ownership and visual-baseline reconciliation.

Objective: xử lý các lỗi layout giống ảnh tham chiếu trên toàn bộ route, giữ lại CSS thực sự tạo ra token/layout/accessibility cần thiết, loại bỏ CSS chết hoặc lặp, đồng thời thay các feedback JavaScript thô và trạng thái rải rác bằng surface React/TypeScript có ngữ nghĩa rõ ràng.

Design read: đây là redesign-preserve cho sản phẩm B2B vận hành; ưu tiên clarity, trust và density trung bình. Dials: `DESIGN_VARIANCE=3`, `MOTION_INTENSITY=2`, `VISUAL_DENSITY=5`. Một accent IPC blue, một hệ radius, không thêm UI kit thứ hai. `lucide-react` được giữ vì project đã dùng sẵn; không đưa thêm icon library.

#### Task 4.5.2 — Approval inbox server cursor contract

Status: implementation committed, representative transition proof complete, production-shape ordering follow-up still required. Commits `e0e7ba1`, `2ab826b` and `684bc97` replace the HTTP list-only contract, add cross-source replay coverage and make price-alert selection resumable in batches.

- **Outcome:** `/api/approvals/inbox` returns a bounded page envelope with stable continuation metadata; `ApprovalPage` requests one server page at a time and uses `CursorPaginationBar`. Approval actions, decision modal semantics and raw workflow values remain unchanged.
- **Contract:** define typed query/page DTOs with bounded `limit`, opaque cursor, `items`, `hasNext` and `nextCursor`; sort by the same due-date/code/item-id tuple for every source type and encode the complete tuple in the cursor. Do not expose a cosmetic total when the backend cannot calculate one safely.
- **Implementation boundary:** update approval DTO/controller/service, the `getApprovalRecords` RTK Query mapper, `ApprovalPage` cursor state and the shared queue pagination boundary. Preserve a compatibility service method only where existing backend tests require the list shape; the HTTP endpoint must use the page envelope.
- **Evidence:** frontend route smoke proves the next request carries the continuation cursor; controls `14/14`, smoke `15/15`, UI audit `2/2`, unit `86/86`, lint and production build pass. Backend alternate-output compile and filtered ApprovalInbox tests pass `3/3`, including the cross-source replay with `Limit = 1`, all four item types, unique IDs and exact full-order equality (`2ab826b`); price-alert keyset batching is implemented in `684bc97`.
- **Follow-up evidence still required:** `684bc97` changes price-alert selection to resumable keyset batches and the ApprovalInbox suite passes `3/3`, including the cross-source replay. Keep R61 Critical until same-code/item-id sibling ordering and a production-shaped large-volume test are covered.
- **Risk gate:** GitNexus currently does not resolve several backend/API symbols, so source call graph plus backend tests are authoritative until reindex. Any cursor implementation that materializes an unbounded heterogeneous source, changes approval payloads, or returns a page that cannot be resumed must stop and be redesigned before commit.

#### Task 4.5.1 — CSS giữ có chủ đích, JavaScript feedback chuẩn hóa và sửa layout toàn route

1. **Objective and user-visible outcome**
   - Giữ token, layout primitive, responsive rule, focus/contrast và state style có trách nhiệm rõ; chỉ xóa CSS chết, selector trùng hoặc fixed-width gây overflow khi có source inventory/computed layout/visual evidence.
   - Thay `window.alert`, `window.confirm`, `window.prompt`, feedback bằng `console`/timer và state tạm lặp bằng `ToastProvider`/`useToast`, `InlineAlert` hoặc shadcn/Radix `Dialog` đúng ngữ nghĩa.
   - Chuẩn hóa mọi route về một shell, page header, command area, feedback region và table viewport. Ở 320–390px, action vẫn truy cập được, bảng cuộn trong vùng của nó và không có nested scroll hoặc trang kéo dài do dữ liệu chưa phân trang.

2. **Files allowed to change**
   - `frontend/src/components/common/*`, `frontend/src/components/ui/*` và tests liên quan.
   - `frontend/src/styles/ui-redesign.css` và stylesheet sạch khác sau selector/reference inventory. `frontend/src/styles/index.css` là stylesheet global đang dirty, chỉ được sửa sau ownership handoff hoặc hunk-level approval; `styles/components.css` không tồn tại trong repo hiện tại và đã bị loại khỏi allowlist.
   - Mỗi route sạch chỉ theo một commit; `WeeklyMenuPage`, `AdminDataPage`, `DashboardPage` và `styles/index.css` chỉ sửa sau ownership handoff hoặc hunk-level approval.
   - `frontend/tests/*` và planning artifacts cho inventory, risk, visual evidence.

3. **Symbols to edit and GitNexus upstream impact**
   - Trước khi sửa: `OperationalFrame`, `ContextStrip`, `TableViewport`, `ViewSwitcher`, `ToastProvider`, `ConfirmDialog`, `InlineAlert` và mọi caller phát hiện từ inventory.
   - HIGH/CRITICAL phải cảnh báo, giữ compatibility contract và migrate caller theo nhóm. UNKNOWN do index stale phải được ghi rõ, đối chiếu source callers và chạy đủ route gates.

4. **Existing behavior to preserve**
   - Không đổi route slug, nav label, form field name/order, endpoint, DTO, enum/raw identifier, mutation payload, callback ownership hoặc quyền truy cập.
   - Destructive confirmation vẫn là Dialog có focus/keyboard behavior; lỗi theo ngữ cảnh dùng InlineAlert; thành công tạm thời dùng toast.
   - Giữ aria relationship, visible focus, reduced-motion, table region semantics và public props/classes của compatibility boundary.

5. **Risk classification and mitigation**
   - CSS deletion là Critical nếu thuộc stylesheet dirty hoặc caller chưa phân loại; chỉ xóa rule isolated có bằng chứng zero source reference.
   - Shared layout/feedback là High/Critical tùy impact; thay đổi display-only trước, giữ logic/payload, chạy controls/smoke/UI-audit serial.
   - Native feedback replacement là High nếu che mất quyết định bắt buộc; phân loại toast/InlineAlert/Dialog và test focus, close, error path.
   - Visual baseline là High; không update snapshot nếu thiếu actual-vs-baseline note, viewport list và root cause.

6. **Exact implementation steps**
   - 4.5.1a: tạo selector/reference inventory và scan feedback trong `frontend/src`.
   - 4.5.1b: chạy impact cho shared symbols, chốt allowlist và phân loại dirty ownership.
   - 4.5.1c: sửa một route-family slice bằng Tailwind/scoped CSS mobile-first, `min-w-0`, bounded table viewport, one command region và semantic Vietnamese copy.
   - 4.5.1d: thay feedback theo taxonomy, thêm component/route tests cho title, variant, focus, dismiss, keyboard và reduced motion.
   - 4.5.1e: chạy static scan, unit, lint, build, controls, smoke, UI-audit và visual evidence; ghi blocker nếu baseline không đáng tin cậy.
   - 4.5.1f: chạy `detect_changes` trên staged scope, commit một route-family slice và cập nhật plan/risk evidence.

   **Bàn giao bắt buộc của task:** `CSS-JS-INVENTORY.md` phải ghi rõ CSS được giữ/xóa theo source reference; static scan phải phân loại toàn bộ native feedback, timer và logging; mỗi route slice phải có responsive/overflow evidence và dùng đúng Toast, InlineAlert hoặc Dialog theo taxonomy. Không được coi việc không tìm thấy `alert` là bằng chứng đã sửa xong bố cục toàn bộ route.

7. **Tests and commands**
   - `rg -n "window\\.(alert|confirm|prompt)|console\\.(log|warn|error)|setTimeout" frontend/src` và phân loại từng kết quả.
   - `npm run test:unit --workspace frontend`, `npm run lint --workspace frontend`, `npm run build --workspace frontend`.
   - `npm run test:controls --workspace frontend`, `npm run test:smoke --workspace frontend`, `npm run test:ui-audit --workspace frontend`.
   - `npm run test:visual --workspace frontend` để thu thập evidence; không tự động update snapshot.
   - `git diff --check` và `node .gitnexus/run.cjs detect_changes --repo IPCManagement --scope staged` trước mỗi commit.

8. **Rollback/undo condition**
   - Dừng và revert riêng task nếu action bị mất, API/payload đổi, focus/keyboard regression, overflow tăng, toast trùng hoặc CSS ownership chưa chứng minh được.
   - Không dùng `git reset --hard`; rollback bằng commit/task manifest, giữ nguyên dirty user-owned files.

9. **Commit boundary**
   - Mỗi commit chỉ gồm một route-family/component contract, test tương ứng và evidence plan/risk; không trộn backend feature work, dirty route work hoặc snapshot update chưa giải thích.

Scope:

- Audit toàn bộ `frontend/src` và route snapshots cho duplicate CSS, fixed widths gây overflow, nested scroll, mobile stacking, sidebar/content duplication, heading/button wrapping và feedback đặt sai vùng.
- Giữ CSS có trách nhiệm rõ: design tokens, layout primitives, responsive rules, focus/contrast và state styles. Xóa hoặc gom CSS chỉ khi có evidence từ source inventory, computed layout hoặc visual test.
- Tìm và loại bỏ `window.alert`, `window.confirm`, `window.prompt`, console-driven user feedback và các `setTimeout`/effect chỉ dùng để giả lập thông báo. Không xóa logging phục vụ chẩn đoán backend nếu không có replacement phù hợp.
- Xây shared `ToastProvider`/`useToast` typed cho feedback tạm thời; dùng `InlineAlert` cho lỗi/loading/empty theo vùng; dùng shadcn/Radix `Dialog` cho confirm hoặc nội dung cần người dùng quyết định. Mỗi surface phải có title, variant, close/focus behavior và reduced-motion-safe styling.
- Chuẩn hóa page anatomy: một `OperationalFrame`, một page header, một command area, một status/feedback region và một table viewport; không lặp sidebar, user panel, breadcrumb, title hoặc cùng một action ở nhiều tầng.
- Migrate route theo nhóm: shell/dashboard, workflow/coordination, weekly-menu/admin (chỉ sau ownership handoff), reports, chef/purchasing/warehouse.

Completed clean slices:

- `ToastProvider`/`useToast` and `ConfirmDialog` are mounted through the app root; approval and purchasing flows no longer use browser-native alert/confirm feedback (`0121d88`, `0757cb2`).
- Static scan reports no remaining unapproved browser-native feedback calls in `frontend/src`.
- Removed only the unreferenced `.ipc-textarea` selector branches from the protected global stylesheet; the dirty 641-line CSS addition remains unstaged (`49c7b3f`).
- Lint, 74 frontend unit tests, and production build pass after the clean slices.
- Chef dashboard no longer short-circuits the whole route when the selected shift has no meals; the production empty state stays inside its tab while documents and shift journal remain reachable (`f16b250`). UI audit `2/2` and route smoke `13/13` pass.
- Purchasing no longer renders the inactive “Gửi cảnh báo biến động giá” button, which had no handler and created a misleading action surface (`7ed0db3`). Controls `4/4` pass.
- Warehouse stock movements now use the existing server cursor endpoint with a backward-compatible `StockMovementTable` controller; the route no longer requests 100 movement rows and then slices locally (`fd85c9a`). Route smoke `14/14`, controls `4/4`, and UI audit `2/2` pass.
- Purchasing’s “Kế hoạch thu mua” now uses the existing page-number endpoint with an 8-row page and canonical `PaginationBar` instead of the unbounded `limit: 100` collection (`225780b`). The purchase-request and current-stock collections remain unchanged until their route-specific data contract is reconciled.
- Purchasing handoff history now uses the receipt-filtered cursor endpoint and price warning context uses the page-number endpoint; both remove the previous unbounded report collections without changing order/receipt mutations (`ba71e7e`).
- CSS inventory found 251 `.ipc-*` selectors in the clean stylesheet; four isolated selectors had zero non-CSS source references and were removed without staging the dirty dashboard CSS addition (`36bd716`). UI audit `2/2` and lint/build pass.
- A second CSS inventory batch removed three more unreferenced component selectors (`ipc-compact-select`, `ipc-chef-action-button`, `ipc-dialog-action`) and their associated state rules (`2c7d055`). UI audit `2/2` and lint/build pass again.
- The next inventory batch removed the obsolete audit-log list block (`ipc-audit-log-*`), which had no non-CSS references (`42692d9`). UI audit `2/2` and lint/build pass.
- Removed the stale weekly-command action rules and their responsive overrides after confirming zero source references (`5bb26af`). UI audit `2/2` and lint/build pass.
- Purchasing context status now translates request enums into Vietnamese user-facing labels while preserving raw enum values for business branching (`3d9c643`). Unit `75/75` and lint/build pass.
- Workflow document statuses now use a shared `formatWorkflowStatus` label map for the shared `DocumentRail`; the Warehouse exception copy uses the same helper while raw values remain available for logic (`08e7b3f`). Unit `76/76`, lint, build, controls `4/4`, smoke `14/14` and UI audit `2/2` pass. GitNexus classified `DocumentRail` as HIGH because it has four direct page callers; mitigation is display-only mapping plus serial route gates.
- Approval queue status badges now consume the same semantic status formatter; raw enum values remain unchanged in the record model (`6e9126d`). CSS inventory also removed the isolated, unreferenced `.ipc-chef-action-note` block after confirming it was outside the dirty stylesheet diff (`430f5ed`); UI audit `2/2` and lint/build pass.
- Stock movement status and next-action cells now consume the shared formatter without changing movement types, cursor/local pagination or copy behavior (`4a987ab`). The demand summary no longer maintains a duplicate status map and now shares the same vocabulary (`43d2a7e`). A further CSS inventory pass removed the unreferenced `.ipc-approval-record-meta` block with selective staging; the 641-line dirty stylesheet addition remains preserved (`8de0110`).
- Role inbox action renderers now receive a display-safe copy of `nextAction`, translating technical workflow enums without mutating the source item or route logic (`7729347`). The purchase-request list in ApprovalPage also uses the shared status formatter (`7dc6453`). Unit `76/76`, build, controls `4/4`, smoke `14/14` and UI audit `2/2` remain green.
- Chef dashboard now consolidates stacked catalog/issue/KHSX loading, error and warning alerts into one bounded “Trạng thái dữ liệu bếp” region while keeping the shift lock alert and mutation feedback separate (`f5f1507`). The clean route gates remain green; visual baseline remains intentionally unupdated because the source already retains KHSX/table/journal content absent from the old Chef snapshot.
- Shared stock-movement copy feedback now uses the typed `ToastProvider` for success and clipboard failure; the component no longer owns a transient `useState`/`window.setTimeout` feedback loop. Props, row actions, cursor/local pagination and document-copy behavior are unchanged. Component tests cover both outcomes. Evidence: unit `77/77`, lint, production build, controls `4/4`, smoke `14/14` and UI audit `2/2` pass. The four-caller HIGH impact was reviewed and mitigated as a display-only internal change.
- `DocumentRail` now uses the same typed toast feedback for document-ID copy success/failure, removing its duplicate timer/local-copy state while preserving document actions, pagination and semantics. Its HIGH impact (6 callers, including dirty route files) was mitigated by changing only the internal feedback surface; the same full route gates remain green.
- CSS inventory removed the unreferenced `.ipc-paginated-table-frame` block from `ui-redesign.css`; `PaginatedTableFrame` remains as a public compatibility adapter and `TableViewport` remains the canonical geometry owner. Source inventory found no production consumer beyond the adapter. Evidence: CSS bundle reduced, lint/build pass, controls `4/4`, smoke `14/14` and UI audit `2/2` pass.
- Supplier quotation page contract now performs `Count`, best-price ID lookup and `Skip/Take` in the EF query instead of loading the complete ingredient quotation list before slicing. The legacy list endpoint remains unchanged for compatibility; page items still carry the correct `IsBestPrice` flag. Backend compile passes. Full backend test build is currently blocked by the already-running API process locking `IPCManagement.Api.exe` (PID 19884), so this remains a runtime verification follow-up.
- Purchasing supplier-line controls now expose semantic Vietnamese labels and accessible names for supplier, estimated price, delivery date and note; “Lưu NCC” is now “Lưu nhà cung cấp”, the price suggestion is a live status region, and numeric input constraints are explicit. API payloads and mutation handlers are unchanged. Evidence: unit `77/77`, lint, build and smoke `14/14` pass.
- Shared operational copy audit replaced user-facing `NCC`, `Theo NCC`, `Báo giá NCC`, and the admin lane’s `audit/BOM` shorthand in clean route/config surfaces with Vietnamese labels that explain the action. Raw codes and API enum values remain untouched. Evidence: unit `77/77`, lint/build, controls `4/4`, smoke `14/14` and UI audit `2/2` pass.
- Warehouse current-stock slice now consumes the existing `current-stock/page` endpoint with an 8-row server page and canonical `PaginationBar`; the previous `limit: 12` collection plus local `useLocalPagination` path was removed from `WarehousePage`. Mutation selection still reads the visible live row and stock movement cursor behavior is unchanged. The route smoke fixture now covers the page contract for desktop and mobile operations. Evidence: targeted smoke pass, full smoke `14/14`, controls `4/4`, UI audit `2/2`, unit `76/76`, lint and production build pass. Commit pending after staged GitNexus detection.
- Chef dashboard clean-copy slice replaces user-facing `KHSX`, `BOM`, `API` and `catalog` shorthand with “kế hoạch sản xuất”, “định lượng”, “hệ thống” and “danh mục”; raw identifiers and production-plan behavior remain unchanged. Evidence: unit `77/77`, lint, production build, controls `4/4`, smoke `14/14` and UI audit `2/2` pass. The `ChefDashboardPage` impact was LOW with no direct callers.
- Coordination and Reports clean-copy slice removes user-facing `API/backend` implementation terms from loading and error feedback, replacing them with operational language while preserving query behavior and error handling. Both page impacts were LOW with no direct callers. Evidence: unit `77/77`, lint, production build, controls `4/4`, smoke `14/14` and UI audit `2/2` pass.
- Coordination status banner now describes the latest order state instead of exposing the `API` implementation detail. `OrderStatusBanner` has one direct caller and GitNexus classified the display-only change as LOW risk. Evidence: unit `77/77`, lint and controls `4/4` pass.
- Reports terminology now explains the former `BOM` shorthand as “định lượng nguyên liệu/định lượng” in report titles and data-quality context. The report query and missing-count field remain unchanged. Evidence: unit `77/77`, lint, production build and targeted Reports smoke `3/3` pass.
- Reports now consumes the shared `uiCopy.technical.bom` vocabulary for the weighted-variance and audit headings, preserving the canonical “Định mức nguyên liệu (BOM)” explanation instead of duplicating terminology in the page. Evidence: unit `77/77`, lint, production build and targeted Reports smoke `3/3` pass.
- Warehouse exception feedback now explains `demand/KHSX` as “nhu cầu nguyên liệu và kế hoạch sản xuất”, preserving the validation branch and export behavior. `WarehousePage` impact was LOW with no direct callers. Evidence: unit `77/77`, lint, production build and Warehouse smoke `3/3` pass.
- Shared `ViewSwitcher` tabs now receive equal flexible sizing so wrapped mobile tab rows do not leave a narrow orphan tab; selection semantics and all eight callers remain unchanged. GitNexus could not resolve this stale-index symbol (UNKNOWN), so source inventory and full route gates were used as mitigation. Evidence: new component contract tests bring unit coverage to `79/79`, lint/build, controls `4/4`, smoke `14/14` and UI audit `2/2` pass. Visual baseline remains intentionally unupdated.
- `TableViewport` now explicitly opts into `min-width: 0` and contained horizontal overscroll so long operational tables stay bounded inside flex layouts. Its accessibility contract is unchanged; the existing component test covers the geometry classes. Evidence: unit `79/79`, lint/build, smoke `14/14` and UI audit `2/2` pass. GitNexus could not resolve this stale-index symbol (UNKNOWN); the source inventory identified the production callers and no API/state dependencies were changed.
- `ApprovalRulesPage` now stacks rule metadata, threshold fields and assignment rows at narrow widths, then restores multi-column layouts from `sm`/`md` breakpoints. Mutation handlers, dialogs and payloads are unchanged. GitNexus could not resolve this route symbol (UNKNOWN), so the change is constrained to page-local Tailwind classes. The control-surface fixture now includes the admin wildcard permission and approval-rule/employee responses, preventing an unrelated auth fallback from masking the route check. Evidence: unit `79/79`, lint/build, controls `5/5`, smoke `14/14` and UI audit `2/2` pass; direct in-app browser verification remains unavailable because no browser backend was exposed.
- Reports mobile filter controls now use a stable two-column grid for date/shift fields and keep the export action full-width, preventing flex-wrap from producing inconsistent filter rows at 390px. Query state, export behavior and labels are unchanged. The route-local change has no resolved upstream callers in the current GitNexus graph; controls now cover the three labeled filters and horizontal overflow. Evidence: unit `79/79`, lint/build, controls `6/6`, smoke `14/14` and UI audit `2/2` pass (`85d9fc3`). Visual snapshots remain unchanged because their data/copy baselines are stale.
- Chef empty-state layout now removes the shared 220px reservation only for the no-meal production panel, so the shift journal follows the empty state without an artificial desktop gap. The global `EmptyState` contract, documents tab and production data behavior are unchanged. `ChefDashboardPage` impact is exact LOW with no upstream callers; the route test asserts `min-height: 0px` and journal reachability. Evidence: unit `79/79`, lint/build, controls `7/7`, smoke `14/14` and UI audit `2/2` pass (`41f0e8f`).
- Coordination empty-state layout now removes the 560px desktop reservation on mobile and the nested order empty state no longer reserves 360px before the action toolbar. Desktop keeps the existing minimum, table pagination and optimistic order handlers are unchanged. GitNexus staged detection classified `OrderTable` as MEDIUM because of two affected execution flows; mitigation is CSS-only markup usage plus controls `8/8`. Evidence: unit `79/79`, lint/build, smoke `14/14` and UI audit `2/2` pass (`005bdbe`). The control fixture now mocks empty orders/menu/plans so auth fallback cannot hide the layout assertion.
- Warehouse action controls now use a route-scoped responsive grid on mobile: the three primary actions have equal width, the secondary action remains separate, and desktop returns to the existing inline layout. `CommandBar` itself is unchanged because its shared impact is CRITICAL. GitNexus classified `WarehousePage` staged scope as MEDIUM with one flow; mitigation is CSS/prop-only plus geometry and overflow assertions. Evidence: unit `79/79`, lint/build, controls `9/9`, smoke `14/14` and UI audit `2/2` pass (`17aa8c0`).
- Purchasing action controls now reuse the same route-scoped responsive grid as Warehouse: the three primary actions have equal width on mobile, the secondary action remains separate, and desktop keeps the inline layout. `CommandBar` remains unchanged because its shared impact is CRITICAL. GitNexus classified `PurchasingPage` staged scope as MEDIUM with one flow; mitigation is CSS/prop-only plus geometry and overflow assertions. Evidence: unit `79/79`, lint/build, controls `10/10`, smoke `14/14` and UI audit `2/2` pass (`0ddd160`).
- Approval action controls now use a route-scoped two-row grid on mobile: primary decision buttons and navigation links remain grouped, named and reachable without horizontal overflow; desktop returns to the existing inline layout. `CommandBar` remains unchanged because its shared impact is CRITICAL. GitNexus classified `ApprovalPage` staged scope as MEDIUM with one flow; mitigation is CSS/prop-only plus the existing decision-modal and full route gates. Evidence: unit `79/79`, lint/build, controls `11/11`, smoke `14/14` and UI audit `2/2` pass (`2d3e363`).
- Approval Rules now translates technical document and approver keys into Vietnamese labels in the rendered cards, and mutation failures use a bounded user-facing fallback instead of dumping `JSON.stringify(error)`. Payload keys and select values remain unchanged for API compatibility. The route-local control fixture proves `Đơn mua thêm`/`Quản lý` are visible and raw keys are absent; evidence: unit `79/79`, lint/build, controls `12/12`, smoke `14/14`, UI audit pass (`90c62bc`). GitNexus could not map `ApprovalRulesPage` in the refreshed index; this is recorded as an index coverage limitation, not treated as zero risk.
- Approval Rules form now collapses its primary fields to one column at 320px, wraps the assignment header, and keeps technical role keys out of visible option labels. The mobile control test measures stacked, wide fields and document-level overflow; evidence: unit `79/79`, lint/build, controls `13/13`, smoke `14/14`, UI audit `2/2` (`22733b9`).
- Purchasing quotation entry now stacks its five fields on mobile instead of forcing a two-column form; desktop retains the five-column layout. The control fixture seeds one ingredient, measures all five fields on the same mobile column, and asserts no document overflow. Evidence: `PurchasingPage` upstream impact LOW before edit, unit `79/79`, lint/build, controls `14/14`, smoke `14/14`, UI audit `2/2` (`b5719e7`).
- Chef excess-material dialog now presents its three condition choices in one mobile column and three columns from the small breakpoint upward. The initial upstream impact was HIGH because the shared dialog has three Chef callers; mitigation was CSS-only plus a focused unit contract, with no state, handler or payload change. Evidence: unit `80/80`, lint/build, controls `14/14`, smoke `14/14`, UI audit `2/2` (`55dfd63`).
- Chef supplemental-request dialog now uses sentence-case Vietnamese labels and a clearer reason placeholder; internal validation and request payloads are unchanged. The initial upstream impact was HIGH because the dialog has three Chef callers; mitigation was presentation-only copy changes plus a focused unit contract. Evidence: unit `81/81`, lint/build, controls `14/14`, smoke `14/14`, UI audit `2/2` (`986d4dd`).
- Chef summary cards and the expanded BOM table now use sentence-case Vietnamese labels; the summary's uppercase utility class was removed while data/state and table behavior remain unchanged. The component impacts were exact LOW, limited to the Chef dashboard flows. Evidence: focused unit `2/2`, full unit `83/83`, lint/build, controls `14/14`, smoke `14/14`, UI audit `2/2`.
- Chef material checklist headers now use sentence-case Vietnamese labels (`Nguyên liệu`, `Đơn vị`, `Số lượng`, `Trạng thái`); signoff availability, checkbox callbacks and material status values are unchanged. `MaterialChecklist` impact was exact LOW across the two Chef flows. Evidence: focused unit `3/3`, full unit `84/84`, lint/build, controls `14/14`, smoke `14/14`, UI audit `2/2` (`e8ddfbd`).
- Chef excess-material dialog now uses sentence-case field labels and condition choices, and removes redundant uppercase utility classes. Dialog state, validation, focus/close behavior, callback and submitted payload remain unchanged. Upstream impact was conservatively HIGH across three flows; staged detection saw only the shared dialog symbol with no process mutation. Evidence: focused unit `1/1`, full unit `84/84`, lint/build, controls `14/14`, serial smoke `14/14`, UI audit `2/2` (`2da39fe`).
- Chef quick-guide heading no longer forces uppercase rendering; the operational action buttons, dialog ownership and callbacks are unchanged. `OperationalActions` impact was exact LOW upstream, while staged detection classified the shared flow as MEDIUM. Evidence: focused unit `4/4`, full unit `85/85`, lint/build, controls `14/14`, serial smoke `14/14`, UI audit `2/2` (`334b520`).
- Supplemental-request dialog field labels no longer force uppercase rendering; the existing sentence-case copy, required markers, validation and submitted request payload are unchanged. Upstream impact was HIGH across three Chef flows; staged detection classified the direct flow as MEDIUM. Evidence: focused unit `1/1`, full unit `85/85`, lint/build, controls `14/14`, serial smoke `14/14`, UI audit `2/2` (`9c4532a`).
- Approval history now translates decision and old/new status enums into Vietnamese user-facing labels without changing the raw values used by the workflow API. The formatter lives outside the page component to preserve Fast Refresh lint rules. `ApprovalPage` impact was exact LOW; staged detection classified one route flow as MEDIUM. Evidence: focused unit `1/1`, full unit `86/86`, lint/build, controls `14/14`, serial smoke `14/14`, UI audit `2/2` (`746de4b`).
- Purchasing table headers now explain `Số lượng cần mua` and `Mã đơn mua hàng` instead of code-like abbreviations; field names, request payloads and table behavior are unchanged. `PurchasingPage` impact was exact LOW, while staged detection did not map the clean route hunk. Evidence: full unit `86/86`, lint/build, controls `14/14`, serial smoke `14/14`, UI audit `2/2`, source diff review (`524276a`).
- Approval inbox ownership re-audit: `ApprovalsController`, `ApprovalInboxService` and approval DTOs are clean; the remaining `workflowApi.ts` working-tree hunk reorders `movementType` and is unrelated to approvals. The HTTP cursor contract is now committed; R61 tracks same-code/item-id ordering and large-volume proof.
- Purchasing and Warehouse table viewports now enforce a route-scoped `min-width: 720px`, so wide operational tables scroll inside their bounded viewport on 390px screens without document-level overflow. Purchasing only mounts the table after the “Giá và nhà cung cấp” tab is activated; the control test covers that real interaction. Warehouse receives an explicit viewport class. Evidence: `e3f3c27`, unit `86/86`, lint, build, controls `17/17`, serial smoke `15/15`, UI audit `2/2`, staged `diff --check` pass. GitNexus impact for both route symbols was exact LOW; staged detection returned “No changes detected” because the current index did not map the clean route/CSS hunk, so source diff and full gates are the mitigation.
- Coordination empty-state layout now overrides the legacy 220px generic empty-state reservation only for the coordination order panel. On mobile, the locked shift’s empty message no longer leaves a large artificial gap before the action toolbar; the lock state, action ownership and payloads are unchanged. Evidence: `eb3528c`, `OrderTable` upstream impact LOW with one direct caller, staged detection MEDIUM across two display/action flows, unit `86/86`, lint/build, controls `17/17`, smoke `15/15`, UI audit `2/2`. Visual actual at 390px changed from 1652px to 1596px; the old 1613px snapshot remains unchanged because it is a stale baseline, not a reason to add compensating spacing.
- Weekly Menu’s customer-layout matrix now keeps a 980px minimum table width inside its canonical viewport. The seven day columns remain readable and scroll horizontally within the table region at 390px instead of collapsing into vertical header text; the dirty route JSX and import/data behavior were untouched. Evidence: `e3d9efe`, controls `18/18`, unit `86/86`, lint/build, smoke `15/15`, UI audit `2/2`. Visual actual height changed from 2011px to 1809px; the old snapshot remains unchanged because the corrected geometry is intentionally different.
- Admin Data’s import command surface now uses user-facing labels (`Kiểm tra file`, `Nhập dữ liệu`) and removes the inactive `Gửi thông báo vận hành` button. Only presentation text and inactive command chrome were staged; BOM/import handlers, payloads and the remaining dirty feature diff were preserved. `AdminDataPage` upstream impact was LOW with no indexed callers; evidence: unit `86/86`, lint/build, controls `19/19`, smoke `15/15`, UI audit `2/2`, staged diff check and `detect_changes` (stale graph returned `No changes detected`). Commit: `b9772ce`.
- Reports now keeps report requests bounded with `limit: 20` instead of the previous `100`, while preserving each endpoint’s page/cursor contract. The inventory KPI reads server `totalCount` rather than only the current page, and data-quality metrics use Vietnamese labels (`Tổng vấn đề`, `Vấn đề ưu tiên SLA`). The first attempt to remove `limit` exposed a smoke-contract regression and was corrected before commit. Evidence: `ReportsPage` impact exact LOW, focused control `1/1`, unit `86/86`, lint/build, controls `19/19`, smoke `15/15`, UI audit `2/2`; staged source diff and `detect_changes` (`No changes detected`). Commit: `05e0e5a`.

Current blockers and next route order:

- `DataTableShell` remains CRITICAL in GitNexus; do not globally replace or delete it.
- `CommandBar` is also a CRITICAL compatibility boundary: GitNexus reports 8 direct callers across 6 flows, including dirty route callers. Do not change its shared action grouping/geometry globally; prefer route-local `actionsClassName` only when a concrete visual defect is reproduced.
- `AdminDataPage`, `WeeklyMenuPage`, and `styles/index.css` still contain mixed user-owned feature changes; reconcile ownership before route-level layout edits or snapshot updates.
- Approval inbox now uses a bounded server cursor page (`e0e7ba1`) and route-level cursor navigation; the remaining contract follow-up is R61’s same-code/item-id ordering and large-volume proof, not another client-side pager.
- Visual evidence refresh on 2026-07-18: `test:visual` is `6/20` pass and `14/20` baseline mismatches. Actual Purchasing/Warehouse screenshots show the desktop sidebar/content shell and mobile bounded surfaces working; remaining mismatches are recorded as data/copy/height drift in dirty or stale-baseline routes. No snapshot was updated.
- Reports mobile table slice: all Reports tables now keep a 720px minimum inside the canonical `TableViewport`, so seven-column headers remain readable and horizontal scrolling stays local to the table at 390px. The new control assertion proves table scroll width exceeds the viewport while document width remains bounded. Evidence: targeted controls `2/2`, full controls `15/15`, smoke `15/15`, UI audit `2/2`, unit `86/86`, lint/build; commit `59fda66`. GitNexus route mapping remained stale/`No changes detected`, so source impact and staged diff review are the evidence boundary.
- Purchasing, Warehouse and Coordination clean route slices are now covered by the canonical viewport/empty-state geometry rules, semantic status copy and typed feedback primitives. Reports is covered by page-number contracts for all primary and grouped price views, and Approval mobile has been re-audited as baseline/content drift with no CSS change. The next work is ownership reconciliation for `DashboardPage`, `WeeklyMenuPage`, `AdminDataPage` and `styles/index.css`; `DataTableShell` remains the CRITICAL compatibility boundary. Each further route still requires an upstream impact check, responsive evidence and an isolated commit.
- GitNexus re-index completed successfully on 2026-07-18, but `DataTableShell` still reports CRITICAL impact (`16` symbols, `12` flows) while direct source inventory finds one runtime consumer in dirty `AdminDataPage`. The discrepancy is reproducible after re-index, so the graph result remains the conservative gate; no shell deletion, global delegation or snapshot update is authorized from this evidence alone.
- UI audit coverage now includes the full protected-route matrix at `390×844` in addition to desktop. Both desktop suites and both mobile suites pass (`4/4` tests): no document overflow, vertical action-label fragments, narrow table actions or unnamed visible dialogs were detected. Commit: `6ff9b11`.
- Reports icon colors now consume the existing `--ipc-slate-600` semantic token instead of five repeated `#475569` literals. The route markup, icon meaning, API behavior and warning color remain unchanged. Evidence: exact LOW impact, lint/build, Reports controls `2/2`, UI audit `4/4`, staged diff check; commit `73ea59b`.
- Coordination order-table zebra rows now use `--ipc-slate-50` instead of an inline `#f8fafc` literal. The row parity, hover state, order data and mutation handlers are unchanged. `OrderTable` upstream impact was LOW; staged detection reported MEDIUM across two display/action flows. Evidence: targeted coordination control `1/1`, lint, UI audit `4/4`; commit `0bf1bda`.

Allowed files for the first clean slice:

- `frontend/src/components/common/*` feedback/layout primitives and tests.
- `frontend/src/components/ui/dialog.tsx` and new typed toast primitive if required by the existing stack.
- `frontend/src/styles/*` only after token/static audit identifies an isolated safe rule; global `index.css` remains protected for route-owned changes.
- planning artifacts and test fixtures. Dirty route files remain protected until handoff.

Implementation contract:

1. Build an inventory of every feedback mechanism and CSS class before editing.
2. Run GitNexus upstream impact for each shared symbol before modification; HIGH/CRITICAL results require a warning and caller-by-caller migration.
3. Preserve mutation handlers, API payloads, route labels, technical identifiers and existing focus/keyboard behavior.
4. Use typed semantic copy such as `Đã lưu`, `Không thể tải dữ liệu`, `Cần xác nhận`, `Đang xử lý`; do not expose raw enum names such as `Error`, `Pending`, `Action` or `Contract` without a user-facing label.
5. Test desktop and mobile geometry after each route group. No snapshot update is allowed until actual-vs-baseline diff has a root-cause note.

Exit criteria:

- Static scan reports no unapproved browser alert/confirm/prompt or user-facing console feedback.
- Shared feedback primitive tests cover success, warning, danger, dismiss, focus and reduced-motion behavior.
- Each route has one shell/header/feedback region and no known horizontal overflow or duplicated navigation surface at 390px and desktop viewports.
- Existing mutation/API and accessibility gates remain green; visual failures are either fixed or documented with exact root cause.
- CSS cleanup has a before/after inventory and does not remove tokens, focus styles, responsive rules or styles still referenced by dirty user-owned work.

### Wave 5 — Cleanup and release gate

- Migrate/remove deprecated consumers.
- Remove duplicate CSS and route-local pagination copies.
- Run `git diff --check`, token validation, ownership check, unit/lint/build, backend compatibility checks and GitNexus `detect_changes --scope all`.
- Produce `UI-REVIEW.md`, `VERIFICATION.md` and final migration matrix.

## 6. Per-task implementation template

Mỗi plan nhỏ phải chứa:

1. Objective and user-visible outcome.
2. Files allowed to change.
3. Symbols to edit and GitNexus upstream impact.
4. Existing behavior to preserve.
5. Risk classification and mitigation.
6. Exact implementation steps.
7. Tests and commands.
8. Rollback/undo condition.
9. Commit boundary.

Không bắt đầu task nếu chưa có mục 2–5.

## 7. Verification matrix

| Gate | Command/evidence | Required |
|---|---|---|
| Type safety | `npm run build --workspace frontend` | pass |
| Lint | `npm run lint --workspace frontend` | pass |
| Unit | `npm run test:unit --workspace frontend` | pass |
| Controls | `npm run test:controls --workspace frontend` | pass or classified blocker |
| Smoke | `npm run test:smoke --workspace frontend` | pass or classified blocker |
| UI audit | `npm run test:ui-audit --workspace frontend` | pass |
| Visual | `npm run test:visual --workspace frontend` | pass or intentional snapshot diff |
| Static | `git diff --check`, token/ownership scan | pass |
| Dependency | GitNexus impact + detect_changes | expected scope |

## 8. Stop conditions

Dừng task và quay lại plan nếu:

- impact là HIGH/CRITICAL mà chưa có mitigation được ghi rõ.
- một file dirty ngoài allowlist cần sửa để tiếp tục.
- test fail không phân loại được sau một lần reproduction.
- pagination UI không chứng minh được contract với request/query.
- visual fix làm thay đổi business behavior hoặc API payload.

## 9. Definition of done

Plan v2 chỉ hoàn tất khi:

- Một canonical table/pagination contract được áp dụng nhất quán toàn route.
- Không còn duplicate table viewport/pagination implementation ngoài compatibility allowlist.
- Các route operational không kéo dài page vì table hoặc nested scroll.
- Copy, status, required/reason và technical identifiers nhất quán.
- Visual/accessibility/regression evidence pass ở đủ viewport hoặc blocker được ghi rõ và được chấp thuận.
- Dirty worktree của user không bị commit hoặc mất dữ liệu.
