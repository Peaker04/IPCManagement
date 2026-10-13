# Active work

Status: IDLE

## Last closed task
Universal Operational Workspace Floorplan refactoring across `/weekly-menu` and core shared primitives:
1. `QueryViewBoundary.tsx`: Replaced the alert-box loading anti-pattern with structured `TableSkeleton` (for `geometry="table"`), `TabContentSkeleton` (for `geometry="workspace"`), and custom `skeleton` prop support, ensuring real DOM footprints during loading.
2. `MaterialDemandSection.tsx`: Replaced all ad-hoc empty text loading containers with structured `TableSkeleton` (5 columns for initial load, 6 columns for daily inventory fetch). Standardized 48px header with `<PackageSearch size={18}>` and flush bottom pagination.
3. `PurchaseSummarySection.tsx`: Integrated `TableSkeleton` via `QueryViewBoundary`, differentiated true empty from search `filter-empty` (with clear button), and stabilized pagination bar.
4. CSS standardization: Cleaned up `ui-redesign.css` and `demand.css` to unify the 48px Header, Sub-Toolbar, TableViewport min-height, and Flush Pagination footer across all pages.
5. Verification:
   - `npm run lint:fe`: PASS (0 errors, 1 warning)
   - `npm run build:fe`: PASS
   - `npm run depcruise:fe`: PASS
   - Vitest unit & contract suites: 45 test files, 218 tests PASS
   - Playwright visual pagination tests across 4 viewports (`s-390`, `m-768`, `l-1280`, `xl-1440`): 4/4 PASS
