# Ownership and commit boundaries — 2026-07-17

## Protected user-owned work

The following files were already dirty before the current refactor slice and must not be staged by UI refactor commits:

- `frontend/src/features/projects/pages/WeeklyMenuPage.tsx` — 135-line existing diff covering weekly-menu/BOM and production-plan behavior.
- `frontend/src/features/workflow/pages/AdminDataPage.tsx` — 613-line existing diff covering BOM/import/contract data behavior.
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
