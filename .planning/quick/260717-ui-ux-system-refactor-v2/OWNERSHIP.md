# Ownership and commit boundaries — 2026-07-17

## Protected user-owned work

The following files were already dirty before the current refactor slice and must not be staged by UI refactor commits:

- `frontend/src/features/dashboard/pages/DashboardPage.tsx` — 479-line existing diff covering the dashboard workflow/risk queue redesign and KPI presentation.
- `frontend/src/features/projects/pages/WeeklyMenuPage.tsx` — 135-line existing diff covering weekly-menu/BOM and production-plan behavior.
- `frontend/src/features/workflow/pages/AdminDataPage.tsx` — 621-line existing diff covering BOM/import/contract data behavior.
- `frontend/src/styles/index.css` — global style changes; protected until the token and visual baseline are reconciled.
- Existing dirty backend services, DTOs, migrations, tests and workbook/template builders — outside this UI refactor.
- Existing dashboard visual snapshots — user-owned visual changes; do not regenerate as part of a shell migration.

## Refactor allowlist for the next clean slice

Only these files may be changed without an ownership handoff:

- `frontend/src/components/common/DataTableShell.test.tsx`
- `frontend/src/components/common/PaginationBar.tsx`, `PaginationBar.test.tsx`, `CursorPaginationBar.tsx`, `CursorPaginationBar.test.tsx` — shared pagination primitives migrated with explicit impact gates.
- `frontend/src/components/common/TableViewport.tsx`
- `frontend/src/lib/paginationMeta.ts`
- `frontend/src/lib/paginationContract.ts`
- `frontend/src/lib/useLocalPagination.ts`
- `frontend/src/lib/usePaginatedRows.ts` and `frontend/src/lib/usePaginatedRows.test.ts` — compatibility delegate and contract coverage completed in `a82286f`/`421c904`.
- `.planning/quick/260717-ui-ux-system-refactor-v2/*`

Any route consumer migration requires an explicit ownership decision if the route file is already dirty. The decision must identify which hunks belong to the existing feature work and which hunk is the UI refactor, then verify both before staging. The WeeklyMenu purchase-summary footer has passed this gate in `2854243`; `AdminDataPage` has not.

## Reconciliation gate before route migration

1. Capture `git diff -- <route>` and classify each hunk by feature ownership.
2. Confirm the user’s feature changes are retained verbatim or covered by tests.
3. Obtain an explicit handoff for the route file.
4. Run GitNexus impact for the exact symbols to be changed.
5. Stage only the isolated refactor hunk and run `git diff --cached --check` plus `detect_changes`.

Until this gate is complete, `WeeklyMenuPage` and `AdminDataPage` remain compatibility consumers and are not candidates for global shell replacement.

## Visual reconciliation evidence — 2026-07-18

- The current working-tree diff is not a single UI-refactor change: `DashboardPage.tsx` contains 378 added and 101 removed lines, `WeeklyMenuPage.tsx` contains 120 added and 15 removed lines, `AdminDataPage.tsx` contains 502 added and 119 removed lines, and `styles/index.css` contains 641 added lines.
- The Admin visual diff shows simultaneous sidebar duplication, BOM import/current-BOM geometry changes, and mobile content-height drift. The Reports mobile diff shows the same class of overlay across shell, filters, KPI cards, tabs and table content. These are route/feature baseline changes, not an isolated `DataTableShell` geometry regression.
- `DataTableShell` has one remaining product consumer: the dirty BOM-current table in `AdminDataPage`. No clean, low-impact consumer is currently available for a safe caller migration in this slice.
- Decision: do not edit `DashboardPage.tsx`, `WeeklyMenuPage.tsx`, `AdminDataPage.tsx`, `styles/index.css`, or visual snapshots in the next compatibility slice. An explicit feature handoff or a clean baseline commit is required before route-level UI reconciliation.
- GitNexus was force-refreshed on 2026-07-18. Its exact graph still reports `DataTableShell` as CRITICAL with 16 impacted symbols and 12 flows, while source inventory reports one remaining production consumer. Until this graph/source discrepancy is explained, the higher-risk graph result is authoritative for cleanup decisions; shell deletion and global delegation remain prohibited.
- Re-index evidence on 2026-07-18: `node .gitnexus/run.cjs analyze` completed successfully (`7,017 nodes`, `19,960 edges`, `300 flows`), but the exact `DataTableShell` impact remains CRITICAL (`16` symbols, `12` flows). Direct source inventory still finds only the `AdminDataPage` import/consumer plus its test/barrel references. This is now a reproducible graph/source discrepancy, not an unverified stale-index assumption; keep the shell protected until the graph edge model is reconciled or a handoff covers every affected caller.
