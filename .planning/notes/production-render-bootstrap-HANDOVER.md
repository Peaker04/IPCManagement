---
title: Production Render/Railway bootstrap handover
status: active-handover
owner: GSD
scope: production-deployment-and-database-bootstrap
updated: 2026-09-11
---
# Production Render/Railway bootstrap handover

## Goal and current state

IPCManagement backend is live on Render at `https://ipcmanagement.onrender.com`, backed by the new Railway MySQL database `IPC`. Current repository state is `main@50e84176bc285b6c79fac9ac5d4a4395388c8855`, aligned with `origin/main`; index/worktree were clean when this handover was written.

Production runtime postflight:

- `/health/ready` HTTP 200.
- `database`: `Healthy`.
- `migrations`: `Healthy`, 77 rows, last `20260904045405_AllowSupplementalReconciliationIssues`.
- `lifecycle-outbox`: `Degraded` because relay is intentionally disabled; readiness maps Degraded to HTTP 200.
- Login succeeded for an imported Admin account.
- `systemoperationmodes` singleton is `id=1`, `mode=DEFAULT`, `version=1`.
- Operational warehouse is `WH-SAMPLE`, exact-one active with `OperationalSingletonKey=1`; `OperationalWarehouse__WarehouseId` is optional after commit `50e84176`.

## Code deployed

- `fae3cda5 fix(deploy): avoid database I/O during EF registration`
  - Replaced `ServerVersion.AutoDetect` with fixed MySQL 8.0.36 provider contract.
  - Added regression proving `DbContext` resolution performs no network I/O.
- `50e84176 fix(deploy): make operational warehouse id optional`
  - Missing warehouse-ID configuration resolves the exact single active warehouse.
  - Zero/multiple active rows, malformed configured GUID, and configured/active mismatch remain fail-closed.

Focused tests passed before push; GitHub Verify and both CodeQL language analyses passed for `fae3cda5`. Render deployed `50e84176` successfully.

## Database bootstrap performed

Owner supplied explicit authority and a Railway target connection string. Never copy that credential into repository/docs/logs. The password was exposed in chat and **must be rotated**; after rotation update Render `ConnectionStrings__DefaultConnection` and restart the service.

Because EF migrations cannot build from white database, bootstrap used:

1. `backend/database/IPCmanagement.sql` on verified-empty `IPC`.
2. `backend/database/Init_EF_History_For_Old_DB.sql`.
3. Baseline history reconciliation for five schema-present migration IDs omitted by the history script.
4. Remaining EF migrations through the 77th/current migration.

Fresh-install migration caveats discovered:

- Direct `dotnet ef database update` fails first because the first migration references baseline tables.
- The baseline history script omits several schema-present IDs.
- `20260803210000_AddCustomerWeekMenuTier` backfill called `MD5`, unavailable on the Railway server. Since the new database had zero `menuschedules`, the no-op backfill was safely skipped after exact zero-row verification; its table/index/FK/triggers/history marker were completed explicitly.
- Do not repeat these manual steps on a non-empty database. A future code task should repair the fresh-install/bootstrap path with disposable MySQL regression coverage rather than editing production blindly.

## Master/account import and cleanup

Source authority was reconstructed from prior checkpoints: canonical latest data was `ipc_lane9`; source snapshot:

`D:/IPCManagement-backups/phase34-browser-preflight/ipc_lane9-20260909T142446Z.sql`

Only account/master/BOM/configuration tables were imported. Workflow/session/audit/E2E transaction tables were excluded. Password hashes were retained without printing them.

Initial imported counts included 7 roles, 7 users, 2 warehouses, 43 units, 11 customers, 64 suppliers, 773 ingredients, 359 dishes, 10 customer contracts, 1,957 BOM rows and 51 supplier quotations.

A subsequent production cleanup was explicitly authorized and executed in one transaction after zero-FK preflight:

- deleted 9 E2E customers and their 9 contracts;
- deleted 4 explicit test ingredients with zero BOM/quotation references;
- deleted one explicit E2E missing-BOM dish with zero BOM references;
- preserved legitimate codes that happened to contain `E2E` and had BOM references;
- preserved all login accounts, suppliers, warehouses and referenced BOM/master records.

Final production counts:

| Table | Rows |
|---|---:|
| customers | 2 |
| customercontracts | 1 |
| ingredients | 769 |
| dishes | 358 |
| dishbom | 1,957 |
| users | 7 |
| warehouses | 2 |

E2E workflow/session/audit tables checked after import remained zero, including refresh tokens, menus, production plans, purchase requests, receipts, issues, stock movements, service runs, lifecycle transitions and audit logs. A successful real login subsequently creates ordinary production auth/audit/session state; do not expect those tables to remain permanently empty.

## Known warnings and residual work

- Render logs health probes frequently; lifecycle-outbox warning repeats because relay is disabled.
- Data Protection keys use ephemeral container storage. JWT login works, but cookie/Data Protection payload continuity across redeploy is not certified.
- `UseHttpsRedirection` logs inability to determine HTTPS port because Render terminates TLS outside the container; public URL is HTTPS and service is live. Direct-host/trusted-proxy topology requires a separate approved change.
- EF warns about `Take(2)` without `OrderBy` in exact-count guard queries. It does not change zero/one/multiple semantics, but can be removed in a focused warning-cleanup task.
- Initial production login took about 8.5 seconds; no performance verdict was claimed.
- Rotate the exposed Railway password immediately. Do not paste the replacement into chat or docs.

## Exact next steps for a new session

1. Read `AGENTS.md`, `MEMORY.md`, this handover, `docs/DEPLOYMENT.md`, and `LESSONS.md` before any database/deployment mutation.
2. Revalidate branch/HEAD/status and `https://ipcmanagement.onrender.com/health/ready`.
3. Confirm Railway credential rotation and Render restart without reading/dumping secrets.
4. Test login and the required read-only master/BOM pages through the public frontend/backend.
5. If frontend still shows stale mode error, hard refresh/relogin; mode singleton is now valid DEFAULT.
6. Do not import the full `ipc_lane9` dump or transaction history. Preserve the final production denominator above.
7. Treat any further production delete/update/migration as separately authorized and capture pre/post counts plus rollback evidence.
