# Iter1 UAT Matrix

Date locked: 2026-07-02
Source of truth: `Project_Tracking (1).xlsx`, sheet `Iter1_ProdReady_Plan`

This document closes PRD-003. It defines actor-route-action UAT coverage for Iter1. A test does not count as UAT when it only opens a page; each case must execute or verify a business action, persisted output, validation error, authorization block, report row, or evidence log.

## Evidence Sources

- Routes: `frontend/src/routes/routeConfig.ts`
- Frontend role gates: `frontend/src/routes/AppRouter.tsx`, `frontend/src/components/layout/MainLayout.tsx`
- Backend policies: `backend/src/IPCManagement.Api/Security/AuthorizationPolicies.cs`
- Smoke coverage baseline: `frontend/tests/route-smoke.spec.ts`
- Release gate: `.docs/ITER1_RELEASE_QUALITY_GATE.md`

## Actor Map

| Actor | Frontend role | Backend role/policy family | Main routes |
| --- | --- | --- | --- |
| Quản lý vận hành | `quanly` | Manager / broad workflow policies | `/`, `/weekly-menu`, `/meal-orders`, `/approvals`, `/purchasing`, `/warehouse`, `/chef-dashboard`, `/reports` |
| Điều phối | `dieuphoi` | Coordinator / Coordination + Demand | `/weekly-menu`, `/meal-orders` |
| Thu mua | `thumua` | Purchasing / Purchase + Inventory read | `/purchasing` |
| Thủ kho | `thukho` | Warehouse / Warehouse + Inventory approval | `/warehouse` |
| Bếp trưởng | `beptruong` | Chef / Production | `/chef-dashboard` |
| Admin dữ liệu | `admin` | AdminAccess | `/admin-data` |
| Chưa đăng nhập | none | none | `/login`, protected routes redirect |

## UAT Cases

| ID | Actor | Route | Action / API | Happy path acceptance | Exception path acceptance |
| --- | --- | --- | --- | --- | --- |
| UAT-LOGIN-01 | Chưa đăng nhập | `/login` | Login via `POST /api/auth/login`, load profile via `/api/auth/profile` | Valid account lands on `/` and sees app shell with role-based nav. | Invalid/expired profile prevents protected route access and redirects to `/login` or `/403`. |
| UAT-MGR-01 | Quản lý vận hành | `/approvals` | Review inbox via `GET /api/approvals/inbox`, approve/reject via `POST /api/approvals/{targetType}/{id}` | Pending purchase/issue/adjustment item can be approved with reason; history records actor, timestamp, old/new status. | Duplicate decision is rejected; reject without reason is blocked. |
| UAT-MGR-02 | Quản lý vận hành | `/reports` | Review workflow reports via `GET /api/workflow-reports/*` | Price, demand, purchase, stock, movement, kitchen, usage, and audit tabs show rows matching seeded workflow data. | Missing or stale data appears as empty/error state or data-quality issue, not as silent success. |
| UAT-COORD-01 | Điều phối | `/meal-orders` | Lock/signoff/adjust orders via `POST /api/coordination/orders/lock`, `/adjust`, `/{id}/signoff` | Forecast and confirmed servings can be locked; approved adjustment updates final servings and audit. | Locked order cannot be edited directly; adjustment after lock goes through approval path. |
| UAT-COORD-02 | Điều phối | `/weekly-menu` | Import weekly menu and generate demand via `/api/coordination/weekly-menu/import/*`, `POST /api/material-demand/generate` | Valid Excel preview shows readable errors/warnings, commit persists menu, demand creates KHSX/material lines. | Week/customer mismatch, duplicate slot, missing BOM, or missing conversion is shown as validation/data-quality feedback. |
| UAT-BUY-01 | Thu mua | `/purchasing` | Generate/update/submit purchase request via `POST /api/purchase-workflow/from-demand`, `POST /requests/{id}/submit` | Approved demand creates purchase shortage lines with supplier, quantity, price, and submitted status. | Demand not approved, stale shortage, inactive supplier, invalid quantity/price, or price warning blocks submit with clear message. |
| UAT-BUY-02 | Thu mua | `/purchasing` | Handoff to warehouse through receipt preparation | Submitted/approved purchase has enough line detail for warehouse receipt. | Direct access to approval-only action or unrelated admin route is hidden or rejected. |
| UAT-WH-01 | Thủ kho | `/warehouse` | Receive from purchase via `POST /api/inventory-receipts` | Receipt tied to purchase updates current stock and stock movement, and purchase status progresses when received. | Receipt for unknown purchase/invalid line/over-receipt is blocked or listed as warehouse exception. |
| UAT-WH-02 | Thủ kho | `/warehouse` | Issue stock via `POST /api/inventory-issues` | Approved demand creates issue voucher, decrements stock, and records movement. | Issue before demand approval, over-demand, or insufficient stock is blocked unless a later override approval task covers it. |
| UAT-CHEF-01 | Bếp trưởng | `/chef-dashboard` | Confirm kitchen material handoff and review production checklist | KHSX, issued materials, and return/supplemental documents are visible for the active shift. | Missing issue voucher or unreceived material shows waiting/exception state, not completed production. |
| UAT-CHEF-02 | Bếp trưởng | `/chef-dashboard` | Return surplus via `POST /api/inventory-returns` | Return after issue increases stock and appears in issue-vs-return report. | Return for unknown issue or invalid quantity is rejected. |
| UAT-ADMIN-01 | Admin dữ liệu | `/admin-data` | Maintain contracts, BOM, data cleanup, inventory and audit views | Contract/BOM/data-quality/admin tabs expose the records needed to fix workflow blockers. | Non-admin route access to `/admin-data` is rejected by FE role gate; destructive or invalid edits require validation. |
| UAT-ADMIN-02 | Admin dữ liệu | `/admin-data` | Manage employees via `GET/POST/PUT /api/admin/employees` | Admin can list roles and create/update users with expected role access. | Non-admin cannot call employee APIs directly; inactive/invalid users cannot bypass auth. |
| UAT-SEC-01 | Any wrong role | Protected route/API | Direct route/API call without required role | Allowed actor sees only permitted nav/actions and successful APIs. | Wrong actor gets `/403`, disabled/hidden action, or backend `403`; FE hiding alone is not sufficient. |
| UAT-REL-01 | QA Lead | release terminal | Run release gate via `npm run verify:release` | Dated summary/log contains backend build/tests, FE lint/build/smoke, seed reset, and E2E evidence. | Missing seed reset or E2E evidence returns blocked status and prevents release signoff. |

## Minimum UAT Evidence Per Release

For each release candidate, QA should attach or reference:

- One completed happy path and one completed exception path for every actor above.
- `quality-gate-summary.md` from `scripts/Invoke-Iter1QualityGate.ps1`.
- At least one E2E log that walks the full chain: menu -> order -> demand -> purchase -> approval -> warehouse -> kitchen -> reports.
- Screenshots or API logs only when they prove the business assertion in the matrix.

## Not Accepted As UAT

- Opening a route and checking only that the title exists.
- Checking only mock/fallback data when a real API-backed path exists.
- Passing frontend role guard while backend direct API authorization is untested.
- Marking a row `Done` without dated evidence in the tracker, docs, test output, or release gate log.
