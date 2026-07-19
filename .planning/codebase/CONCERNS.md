# Current Concerns

**Analysis date:** 2026-07-19

## MVP operation blockers

1. The web flow depends on seeded customers, dishes, BOM, meal quantities and stock. A fresh or partially migrated database opens the UI but cannot complete demand/purchase steps.
2. Login and protected-route smoke tests are sensitive to backend availability and dev fallback-token behavior; verify `/api/auth/profile` rather than assuming a token means the session is valid.
3. The weekly-menu feature file and global styles have a large pre-existing dirty diff. Route-level refactors must be staged hunk-by-hunk until ownership is reconciled.
4. Remaining kitchen issue and weekly aggregate surfaces need server aggregate metadata before unbounded collections can be removed. Do not replace them with client-side slicing.

## Architecture risks

- `DataTableShell`, `PaginationBar` and workflow API modules have broad consumers; changes require impact analysis and regression gates.
- Existing legacy and canonical table wrappers coexist during migration. New consumers should use `TableViewport` and the explicit pagination contract.
- Development sample-data endpoints are useful for repeatable demo setup but are intentionally not a production provisioning mechanism.
- Visual snapshots include user-owned dashboard changes and should not be regenerated as a cleanup shortcut.

## Operational recovery

- If the API build reports a locked `IPCManagement.Api.exe`/DLL, inspect the owning process and stop only the intended local instance.
- If the UI has no data, check backend `5262`, Swagger, database migrations, then run `MVP_DEMO_SEED_RESET.ps1`.
- If a role cannot see a menu item, inspect the permission listed in `MainLayout.tsx` and the matching API policy; this is expected authorization behavior until the user is granted that permission.
