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
- Visual regression: `8/20` passed and `12/20` failed, matching the previously recorded baseline failure shape. Failures remain concentrated in WeeklyMenu, Reports, AdminData and mobile geometry; no snapshots were regenerated. This is evidence that the visual/ownership blocker persists, not authorization to update snapshots.
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

Status: in progress. Shared feedback normalization and one isolated CSS cleanup slice are complete; route-wide layout migration remains gated by dirty-route ownership and visual-baseline reconciliation.

Objective: xử lý các lỗi layout giống ảnh tham chiếu trên toàn bộ route, giữ lại CSS thực sự tạo ra token/layout/accessibility cần thiết, loại bỏ CSS chết hoặc lặp, đồng thời thay các feedback JavaScript thô và trạng thái rải rác bằng surface React/TypeScript có ngữ nghĩa rõ ràng.

Design read: đây là redesign-preserve cho sản phẩm B2B vận hành; ưu tiên clarity, trust và density trung bình. Dials: `DESIGN_VARIANCE=3`, `MOTION_INTENSITY=2`, `VISUAL_DENSITY=5`. Một accent IPC blue, một hệ radius, không thêm UI kit thứ hai. `lucide-react` được giữ vì project đã dùng sẵn; không đưa thêm icon library.

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

Current blockers and next route order:

- `DataTableShell` remains CRITICAL in GitNexus; do not globally replace or delete it.
- `AdminDataPage`, `WeeklyMenuPage`, and `styles/index.css` still contain mixed user-owned feature changes; reconcile ownership before route-level layout edits or snapshot updates.
- Next clean route group is reports/chef/purchasing/warehouse, using existing canonical viewport and feedback primitives. Each route requires an upstream impact check, mobile/desktop UI audit, and isolated commit.

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
