# Baseline — 2026-07-17

## Verified before refactor v2

- Frontend unit: 60/60 passed.
- Frontend lint: passed.
- Frontend build: passed.
- Playwright UI audit: 2/2 passed, including global overflow/action checks and Admin data-quality stress table.
- Playwright controls: 0/4 passed in this run; all four stopped at login because the protected route remained `/login` after `admin/admin` submission.
- Playwright route smoke: login route passed at desktop/tablet/mobile; protected-route and report workflow cases were blocked by the same login/API precondition. The run was interrupted before its final summary.
- In-app browser runtime: unavailable; browser discovery returned no available browser. Playwright Chromium remains available through the project test runner.

## Worktree constraints

- Existing dirty backend/frontend changes are user-owned and must not be included in UI refactor commits.
- `frontend/src/features/workflow/pages/AdminDataPage.tsx` has a large dirty BOM/contract change set.
- `frontend/src/styles/index.css` is dirty and is protected until the token baseline is audited.
- `DataTableShell.tsx` and `PaginationBar.tsx` remain protected due CRITICAL GitNexus blast radius.

## Existing implementation inventory

- Shared UI foundation: `frontend/src/lib/uiCopy.ts`, `frontend/src/lib/usePaginatedRows.ts`, `frontend/src/components/common/PaginatedTableFrame.tsx`, `frontend/src/styles/ui-redesign.css`.
- Migrated route families: Coordination, Warehouse, Purchasing, Reports and selected Admin long tables.
- Remaining architectural issue: existing and new table patterns coexist; v2 must converge them through a typed canonical contract before further route changes.

## First v2 implementation slice

- Commits `f1393df`, `0d3a7ff` and `33efacf` add `TableViewport`, the `PaginationContract` mode distinction (`local`, `page-number`, `cursor`), `useLocalPagination`, and migrate `DemandSummary` plus `ApprovalQueue`.
- Commit `0a64f5b` migrates Coordination `OrderTable` to the same viewport/controller contract while preserving mutation and rollback behavior.
- Commit `c4aaf92` migrates the local paginated tables in `ReportsPage`; cursor-based stock movement remains on its existing boundary by design.
- Commit `7f988a1` migrates the Warehouse current-stock table to the same canonical contract; document and cursor shared components remain unchanged.
- Commit `7a8e963` migrates Purchasing supplier, quotation and purchase-order local tables; cursor-based movement remains on its existing boundary by design.
- Verification after the Purchasing slice: unit 62/62, lint pass, build pass, `git diff --check` pass. GitNexus reported LOW page-level impact before editing and MEDIUM aggregate staged scope for the single Purchasing flow; nested helper symbols were not separately indexed.
- Post-migration inventory: only shared `RoleInbox`, `DocumentRail`, `StockMovementTable`, compatibility helpers and dirty `AdminDataPage` still reference the legacy local table patterns.
- Post-migration UI audit: `npm run test:ui-audit --workspace frontend` passed 2/2; no global overflow or broken action-control regression was detected in the audited protected-route fixtures.
- Shared migrations: `2ecb972` (`DocumentRail`), `a198124` (`StockMovementTable`) and `32688c3` (`RoleInbox`) now use `useLocalPagination` and/or `TableViewport`; each passed unit 62/62, lint, build and UI audit 2/2 before commit.
- Current legacy inventory: `PaginatedTableFrame` and `usePaginatedRows` remain in `AdminDataPage.tsx` only for product code; the helper source/test and compatibility export remain until that dirty page is reconciled.
- Compatibility adapter: `fd1af9e` makes `PaginatedTableFrame` render the canonical `TableViewport`, retaining the legacy class/props for `AdminDataPage` while preventing a second viewport implementation.
- Semantic copy: `dc989ef` centralizes Reports labels such as “Nhật ký thay đổi”, “Chất lượng dữ liệu”, “Người phụ trách”, “Lỗi” and “Cảnh báo” in `uiCopy`; no API or report value contract changed.
- Workflow copy: `00da341` centralizes owner/deadline/action labels for shared operational surfaces; callback and row data contracts are unchanged.
- Pagination architecture: `1200311` extracts pure metadata and formalizes mode-specific contract fields; legacy `usePaginatedRows` API remains available for dirty `AdminDataPage` compatibility.
