# Integrations

**Analysis date:** 2026-07-19

## Runtime integrations

| Integration | Boundary | Current behavior |
|---|---|---|
| Frontend → API | `frontend/src/api/apiSlice.ts` | Relative `/api` requests; Vite proxies to `http://localhost:5262`. Bearer token is attached for protected calls. |
| API → MySQL | `IpcManagementContext` + Pomelo EF Core | Connection comes from `ConnectionStrings:DefaultConnection`; migrations live under `backend/src/IPCManagement.Api/Migrations`. |
| Authentication | `/api/auth/login`, `/profile`, `/refresh`, `/logout` | JWT access token plus refresh-token rotation; `ProtectedRoute` verifies the current profile before rendering. |
| Authorization | `AuthorizationPolicies.cs` + `RoleGuard.tsx` | UI hides links and route guards check permissions; API remains the final enforcement boundary. |
| Swagger | `/swagger` | Available in Development for API contract inspection. |
| Sample/demo data | `scripts/MVP_DEMO_SEED_RESET.ps1` and `SampleDataController` | Development/demo-only import and reset path; do not use as production data migration. |

## Workflow integration contracts

The MVP operational path crosses these API families:

1. Customer/menu import and committed menu: coordination endpoints.
2. Meal quantities and sign-off: coordination order endpoints.
3. Production plan and demand generation: `/production-plans/*`, `/material-demand/*`.
4. Demand/shortage reports: `/workflow-reports/*`, including bounded aggregate ingredient demand pagination.
5. Purchase request and approval: `/purchase-workflow/*`, `/approvals/*`.
6. Purchase order and receipt: `/purchase-orders/*`, `/inventory-receipts/*`.
7. Warehouse issue/return and chef receipt: `/inventory-issues/*`, `/inventory-returns/*`.

## Frontend integration rule

Feature pages must consume RTK Query endpoints from their feature API module. Do not introduce direct `fetch`, route-local mock arrays, or a second API client. Shared page/table/pagination primitives are under `frontend/src/components/common` and `frontend/src/lib`.

## Known integration assumptions

- Frontend dev server must run at `http://localhost:5173` and backend at `http://localhost:5262` unless Vite proxy/config is changed.
- A valid database and applied EF migrations are required before login and workflow data can be used.
- The MVP seed script is the supported way to create a repeatable demo dataset; manually empty databases will not expose a usable workflow.
