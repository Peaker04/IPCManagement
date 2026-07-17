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
- Weekly-menu production-detail table: `347253e` migrates one isolated `DataTableShell` consumer to `TableViewport` with a caption. The existing weekly-menu feature diff remains unstaged.
- Weekly-menu production-plan table: `10d1916` migrates one isolated `560px` table to `TableViewport` while preserving the explicit viewport height and adding a caption.
- Weekly-menu import surfaces: `6dd531d` and `6787897` migrate pending-job and history tables to `TableViewport`, preserving `260px` max-height and adding captions; feature-owned import logic remains unstaged.
- Weekly-menu cost surfaces: `e755b56` and `0034875` migrate linked-cost and daily-ingredient tables, retaining `ipc-cost-table-shell` and explicit viewport heights while adding captions.
- Weekly-menu cost surfaces 2: `9a5c0af` and `85ba461` migrate purchase-summary and tray-cost tables with the same preserved class/height approach.
- Weekly-menu layout matrix: `d420da6` removes the final `DataTableShell` consumer from `WeeklyMenuPage` and preserves `ipc-weekly-menu-shell` plus dynamic max-height.
- Admin statistics table: `d105f55` migrates one clean `DataTableShell` consumer to `TableViewport`; the dirty BOM/contract hunks remain unstaged.
- Admin contract table: `ae91b02` migrates the contract listing wrapper and leaves the surrounding contract-form changes untouched.
- Post-migration inventory: WeeklyMenu has no `DataTableShell`/`PaginatedTableFrame`/`usePaginatedRows` references. Admin retains one user-owned BOM `DataTableShell`; legacy pagination hooks remain compatibility-only pending route ownership reconciliation.
- Compatibility adapter: `fd1af9e` makes `PaginatedTableFrame` render the canonical `TableViewport`, retaining the legacy class/props for `AdminDataPage` while preventing a second viewport implementation.
- Semantic copy: `dc989ef` centralizes Reports labels such as “Nhật ký thay đổi”, “Chất lượng dữ liệu”, “Người phụ trách”, “Lỗi” and “Cảnh báo” in `uiCopy`; no API or report value contract changed.
- Workflow copy: `00da341` centralizes owner/deadline/action labels for shared operational surfaces; callback and row data contracts are unchanged.
- Pagination architecture: `1200311` extracts pure metadata and formalizes mode-specific contract fields; legacy `usePaginatedRows` API remains available for dirty `AdminDataPage` compatibility.
- Legacy pagination delegate: `a82286f` makes `usePaginatedRows` delegate to `useLocalPagination`, preserving its public return shape while removing duplicate page-state/slicing logic. AdminDataPage callsites and query payloads were not changed.
- Delegate verification: unit `65/65`, lint pass, build pass, UI audit `2/2`, staged diff check pass. Contract test `421c904` covers the legacy return API and canonical local contract. GitNexus `detect_changes --scope staged` returned `No changes detected` because `usePaginatedRows` is outside the current symbol index; direct file inventory is the evidence boundary for this helper.
- Table viewport semantics: `4d02c59` links every provided caption to its scroll region with `aria-describedby` using a stable per-instance React id; no props, CSS class, table content or scroll geometry changed. Unit is now `67/67`, lint/build/UI audit remain green.
- Chef viewport: `f8aaae4` migrates `MaterialChecklist` to `TableViewport` with caption while preserving checkbox signoff callbacks and empty-row behavior.
- Chef BOM viewport: `c1d62b4` migrates `ActiveDishesGrid` expanded ingredient tables to `TableViewport` with captions; expand/collapse behavior is unchanged.
- Chef production viewport: `288ac13` migrates the daily production-plan table to `TableViewport`; send-to-kitchen action and readiness rendering remain unchanged.
- Dashboard swimlane: `80b52d8` migrates the workflow lane table to `TableViewport` and shared labels; active lane and action renderers remain unchanged.

- Visual isolation for `347253e`: weekly-menu desktop failed with `33280` differing pixels in both legacy and canonical wrapper runs; mobile remained `390×1997` with `64371` differing pixels in both runs. This proves the current mismatch is not introduced by the isolated wrapper change.
- Visual isolation for `d420da6`: the layout-matrix wrapper is the first WeeklyMenu consumer with a measured canonical geometry delta: `+36` desktop pixels and `+369` mobile pixels relative to the legacy A/B run. This is retained as intentional canonical-boundary evidence, not hidden by snapshot regeneration.
- Visual isolation for `d105f55`: canonical and legacy wrappers matched exactly for the admin route (`40384` desktop diff pixels; `109378` mobile diff pixels), confirming the route-level mismatch predates this migration.

## Critical shell visual gate evidence

- A `DataTableShell` → `TableViewport` compatibility prototype preserved the public props and legacy class, and passed unit `62/62`, lint, build and UI audit `2/2`.
- Playwright visual result: `8/20` passed, `12/20` failed. Failures included weekly menu, reports, admin data and multiple mobile routes with page-height/geometry drift; this is not an acceptable snapshot update condition.
- The prototype and its compatibility CSS were reverted. Current baseline therefore keeps `DataTableShell` unchanged and treats the visual mismatch as an explicit blocker for global shell replacement.
