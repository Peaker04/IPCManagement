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

- Commits `f1393df` and `0d3a7ff` add `TableViewport`, the `PaginationContract` mode distinction (`local`, `page-number`, `cursor`), `useLocalPagination`, and migrate `DemandSummary` as the low-risk pilot.
- Verification: unit 62/62, lint pass, build pass, `git diff --check` pass, GitNexus staged risk MEDIUM for the single `DemandSummary` flow.
