# Codebase Structure

**Analysis Date:** 2026-07-27

## Directory Layout

```text
IPCManagement/
├── backend/
│   ├── src/IPCManagement.Api/
│   │   ├── Features/              # 10 VSA-lite business slices
│   │   ├── Shared/Contracts/      # Contracts intentionally shared across slices
│   │   ├── Data/                  # DbContext, repositories, Unit of Work
│   │   ├── Models/Entities/       # Shared EF entities
│   │   ├── Security/              # JWT/current-user/policy support
│   │   ├── Middlewares/           # HTTP pipeline cross-cutting behavior
│   │   ├── HealthChecks/          # Liveness/readiness checks
│   │   ├── OpenApi/               # API contract generation
│   │   ├── Migrations/            # EF migrations and generated snapshots
│   │   ├── Program.cs             # Runtime entry/composition
│   │   └── DependencyInjection.cs # Service registration root
│   ├── tests/                      # API and application xUnit projects
│   ├── tools/                      # Database helper executable
│   └── database/                   # SQL bootstrap/repair scripts
├── frontend/
│   ├── src/
│   │   ├── features/              # Route/domain-owned UI modules
│   │   ├── app/                   # Redux store and cross-feature page composition
│   │   ├── api/                   # Shared RTK Query base and workflow endpoints
│   │   ├── components/            # Shared UI, common workbench, layout
│   │   ├── routes/                # Router, guards, code/data preload
│   │   ├── lib/                   # Stateless shared domain/UI utilities
│   │   ├── shared/api/contracts/  # Generated OpenAPI artifacts
│   │   ├── styles/                # Ordered global/component/redesign CSS
│   │   ├── types/                 # Cross-feature TypeScript types
│   │   ├── main.tsx               # Browser entry point
│   │   └── App.tsx                # Top-level composition
│   └── tests/                      # Playwright browser/visual/performance tests
├── scripts/                        # E2E and operational PowerShell entry points
├── tools/                          # k6, DB, and browser-use tooling
├── shipyard/profiles/IPCManagement/# Local integration profile and lifecycle hooks
├── docs/                           # Maintained technical/runbook documentation
├── .docs/                          # Business/demo reference material
└── .planning/codebase/             # GSD-generated codebase maps
```

## Directory Purposes

**`backend/src/IPCManagement.Api/Features`:**
- Purpose: Organize backend API/application code by business capability.
- Contains: `Admin`, `Approvals`, `Auth`, `Catalog`, `Coordination`, `Inventory`, `Planning`, `Purchasing`, `Reports`, `SampleData`.
- Key files: `Features/Planning/Services/MaterialDemandService.cs`, `Features/Purchasing/Services/PurchaseRequestWorkflowService.cs`, `Features/Reports/Services/WorkflowReportService.cs`.
- Boundary rule: Add controller, request/response contracts, validators, and services to the owning feature. Do not assume the folder is isolated: verify direct imports of other feature namespaces before changing a contract.

**Backend Feature Subdirectories:**
- Purpose: Apply a consistent internal layer layout.
- Contains: `Contracts`, `Controllers`, `Services`; most slices also have `Validators`.
- Key files: `Features/Auth/Controllers/AuthController.cs`, `Features/Auth/Services/AuthService.cs`, `Features/Auth/Contracts/AuthDto.cs`.
- Boundary rule: Controllers own HTTP only, services own use cases, contracts own wire/application DTOs, validators own FluentValidation rules.

**`backend/src/IPCManagement.Api/Data`:**
- Purpose: Shared persistence infrastructure for the modular monolith.
- Contains: `IpcManagementContext.cs`, repositories, Unit of Work, seed/configuration support.
- Key files: `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`, `backend/src/IPCManagement.Api/Data/UnitOfWork.cs`.
- Measured evidence: `IpcManagementContext.cs` is 2,563 lines, so entity mapping changes require targeted review even when feature code is small.

**`backend/src/IPCManagement.Api/Models/Entities`:**
- Purpose: Store EF entities used by all slices.
- Contains: Inventory, purchase, approval, customer, dish, coordination, and auth persistence models.
- Key files: `Models/Entities/Ingredient.cs`, `Models/Entities/InventoryIssue.cs`, `Models/Entities/CustomerContract.cs`.

**`backend/tests`:**
- Purpose: Verify services, controllers, contracts, security, persistence, and end-to-end lifecycle behavior.
- Contains: `IPCManagement.Api.Tests`, `IPCManagement.Application.Tests`.
- Key files: `tests/IPCManagement.Api.Tests/Integration/WorkflowLifecycleE2ETests.cs`, `tests/IPCManagement.Application.Tests/FeatureNamespaceConventionTests.cs`.

**`frontend/src/features`:**
- Purpose: Own business-facing UI and route modules.
- Contains: `admin`, `approvals`, `auth`, `chef`, `coordination`, `dashboard`, `projects`, `purchasing`, `reports`, `warehouse`; `workflow/pages` is currently empty.
- Key files: `features/projects/pages/WeeklyMenuPage.tsx`, `features/purchasing/pages/PurchasingPage.tsx`, `features/warehouse/pages/WarehousePage.tsx`.
- Boundary rule: Place a route page and its dedicated hooks/components under the feature that owns the user workflow. Keep generic UI out of features.

**`frontend/src/app`:**
- Purpose: Own application-wide state setup and deliberate multi-feature composition.
- Contains: Redux store/hooks and `pages/admin-data` composition.
- Key files: `frontend/src/app/store.ts`, `frontend/src/app/pages/AdminDataPage.tsx`, `frontend/src/app/pages/admin-data/useAdminDataPageModel.ts`.
- Boundary rule: Use `app/pages` only when a screen composes multiple business features; a single-feature route belongs in `features/<name>/pages`.

**`frontend/src/api`:**
- Purpose: Provide shared RTK Query infrastructure and legacy/cross-feature workflow endpoints.
- Contains: `apiSlice.ts`, `workflowApi.ts`, cache tags, dish catalog endpoints.
- Key files: `frontend/src/api/apiSlice.ts`, `frontend/src/api/workflowApi.ts`.
- Measured evidence: `workflowApi.ts` is 1,955 lines and is a shared hub; prefer a feature-local endpoint module for new domain-specific operations.

**`frontend/src/components`:**
- Purpose: Store UI primitives, reusable operational components, and the application shell.
- Contains: `ui`, `common`, `layout`.
- Key files: `components/layout/MainLayout.tsx`, `components/common/OperationalFrame.tsx`, `components/ui/button.tsx`.

**`frontend/src/routes`:**
- Purpose: Centralize URL topology, access control, and route preload policy.
- Contains: `AppRouter.tsx`, guards, route loaders, and data preloaders.
- Key files: `frontend/src/routes/AppRouter.tsx`, `frontend/src/routes/routeLoaders.ts`, `frontend/src/routes/RoleGuard.tsx`.

**`frontend/src/styles`:**
- Purpose: Preserve ordered global CSS layers and component/redesign styling.
- Contains: `index.css`, `components/*`, `redesign/*`, `ui-redesign.css`.
- Key files: `frontend/src/styles/index.css`, `frontend/src/styles/components/shell.css`, `frontend/src/styles/redesign/fiori.css`.
- Boundary rule: Maintain import order in `frontend/src/main.tsx`; moving selectors between layers can alter cascade behavior even without markup changes.

**`frontend/src/shared/api/contracts`:**
- Purpose: Store generated OpenAPI source and TypeScript schema.
- Contains: `openapi.json`, `schema.ts`, generation notes.
- Key files: `frontend/src/shared/api/contracts/schema.ts` (13,340 lines), `frontend/src/shared/api/contracts/openapi.json`.
- Boundary rule: Regenerate; do not manually maintain generated schema output.

**`scripts`, `tools`, and `shipyard`:**
- Purpose: Run E2E workflows, performance checks, DB backup/restore, and local environment lifecycle.
- Contains: PowerShell orchestration, k6 tests, headed-browser helper configuration, Shipyard hooks.
- Key files: `scripts/Invoke-WeeklyHappyPathE2E.ps1`, `tools/perf/k6/load.js`, `shipyard/profiles/IPCManagement/hooks/boot.sh`.

## Feature Ownership Matrix

| Business capability | Backend owner | Frontend owner | Important cross-boundary dependency |
|---|---|---|---|
| Authentication | `backend/src/IPCManagement.Api/Features/Auth` | `frontend/src/features/auth` | Shared transport imports auth state in `frontend/src/api/apiSlice.ts` |
| Catalog/BOM | `backend/src/IPCManagement.Api/Features/Catalog` | Primarily `frontend/src/features/projects` and admin composition | Catalog service imports SampleData service in `Features/Catalog/Services/DishService.cs` |
| Customer/menu coordination | `backend/src/IPCManagement.Api/Features/Coordination` | `frontend/src/features/coordination` | Coordination imports Approvals/Purchasing; projects imports coordination API types |
| Planning/demand | `backend/src/IPCManagement.Api/Features/Planning` | `frontend/src/features/projects/weekly-menu` | Planning service uses Purchasing-owned material-demand port |
| Purchasing | `backend/src/IPCManagement.Api/Features/Purchasing` | `frontend/src/features/purchasing` | Imports Reports and Inventory services/contracts |
| Approval | `backend/src/IPCManagement.Api/Features/Approvals` | `frontend/src/features/approvals` | Approval handlers invoke Purchasing services |
| Warehouse/inventory | `backend/src/IPCManagement.Api/Features/Inventory` | `frontend/src/features/warehouse` and `frontend/src/features/chef` | Purchasing receiving/order services invoke Inventory services |
| Reporting | `backend/src/IPCManagement.Api/Features/Reports` | `frontend/src/features/reports` | Bidirectional contract/service coupling with Purchasing |
| Sample/import data | `backend/src/IPCManagement.Api/Features/SampleData` | Admin/projects surfaces | Used directly by Catalog and Coordination controllers/services |
| Admin | `backend/src/IPCManagement.Api/Features/Admin` | `frontend/src/features/admin` plus `frontend/src/app/pages/admin-data` | App-level page composes Admin, Auth, Coordination |

## Key File Locations

**Entry Points:**
- `backend/src/IPCManagement.Api/Program.cs`: ASP.NET Core process and middleware entry.
- `frontend/src/main.tsx`: Browser bootstrap and global CSS ordering.
- `frontend/src/routes/AppRouter.tsx`: Route tree and page composition.

**Configuration:**
- `backend/src/IPCManagement.Api/DependencyInjection.cs`: Backend dependency graph.
- `backend/src/IPCManagement.Api/appsettings.json.example`: Safe backend configuration template.
- `frontend/vite.config.ts`: Vite build/dev configuration.
- `frontend/tsconfig.app.json`: Frontend TypeScript paths/options.
- `package.json`: Root orchestration scripts.

**Core Logic:**
- `backend/src/IPCManagement.Api/Features/*/Services`: Backend use-case orchestration.
- `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`: Persistence model.
- `frontend/src/features/*`: Feature UI ownership.
- `frontend/src/api/apiSlice.ts`: Shared browser transport/cache.

**Testing:**
- `backend/tests/IPCManagement.Api.Tests`: Backend controller/integration tests.
- `backend/tests/IPCManagement.Application.Tests`: Application-level unit/architecture tests.
- `frontend/src/**/*.test.ts(x)`: Colocated unit/component tests.
- `frontend/tests`: Playwright route, visual, performance, and workflow tests.

## Naming Conventions

**Files:**
- Backend classes/interfaces use PascalCase and role suffixes: `PurchaseOrderService.cs`, `IPurchaseOrderService.cs`, `PurchaseOrdersController.cs`, `SupplierQuotationValidators.cs`.
- Frontend React components/pages use PascalCase: `WarehousePage.tsx`, `PurchaseDecisionPanel.tsx`.
- Frontend hooks/utilities use camelCase and `use` prefix for hooks: `useReportsPageModel.ts`, `warehouseIssueAllocation.ts`.
- Tests append `.test.ts`, `.test.tsx`, or backend `Tests.cs`; browser tests append `.spec.ts`.
- Feature API modules use `<feature>Api.ts`: `features/coordination/coordinationApi.ts`, `features/admin/adminApi.ts`.

**Directories:**
- Backend namespaces/directories use PascalCase: `Features/Purchasing/Services`.
- Frontend feature directories use lowercase or kebab-case: `features/projects/weekly-menu`.
- Page-bearing directories are named `pages`; reusable within-feature UI uses `components` or a use-case noun such as `quotation`, `receipts`, `production`.

## Where to Add New Code

**New Backend Feature Use Case:**
- Controller: `backend/src/IPCManagement.Api/Features/<Feature>/Controllers/<UseCase>Controller.cs`
- Contracts: `backend/src/IPCManagement.Api/Features/<Feature>/Contracts/<UseCase>Dto.cs`
- Service/port: `backend/src/IPCManagement.Api/Features/<Feature>/Services/<UseCase>Service.cs` and `I<UseCase>Service.cs`
- Validation: `backend/src/IPCManagement.Api/Features/<Feature>/Validators/<UseCase>Validators.cs`
- Registration: `backend/src/IPCManagement.Api/DependencyInjection.cs`
- Tests: `backend/tests/IPCManagement.Api.Tests/<UseCase>Tests.cs` or application tests when HTTP infrastructure is irrelevant.

**New Backend Cross-Feature Contract:**
- Stable shared DTO: `backend/src/IPCManagement.Api/Shared/Contracts`
- Guidance: Prefer a narrow shared contract over importing another feature's report/page DTO. Keep dependency direction one-way and document the owning use case.

**New Frontend Feature/Route:**
- Route page: `frontend/src/features/<feature>/pages/<Name>Page.tsx`
- Feature components/hooks/API: `frontend/src/features/<feature>`
- Route loader: `frontend/src/routes/routeLoaders.ts`
- Route declaration/permission: `frontend/src/routes/AppRouter.tsx`
- Unit tests: colocate next to implementation; browser route tests belong in `frontend/tests`.

**New Multi-Feature Page:**
- Composition shell/model: `frontend/src/app/pages/<page-name>` with a thin page entry in `frontend/src/app/pages`.
- Guidance: Use only when the page genuinely coordinates several feature APIs, following `frontend/src/app/pages/admin-data`.

**New Shared Component:**
- Primitive: `frontend/src/components/ui`
- Operational/reusable domain-neutral component: `frontend/src/components/common`
- Shell/navigation component: `frontend/src/components/layout`

**Utilities:**
- Shared stateless helper: `frontend/src/lib`
- Cross-feature TypeScript contract: `frontend/src/types`
- Feature-specific helper: keep under `frontend/src/features/<feature>`.

## Oversized and Sensitive Locations

- `frontend/src/shared/api/contracts/schema.ts` — 13,340 generated lines; regenerate only.
- `backend/src/IPCManagement.Api/Features/Reports/Services/WorkflowReportService.cs` — 3,633 lines; isolate report-calculation changes and add regression tests.
- `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs` — 2,563 lines; schema changes affect the entire persistence model.
- `backend/src/IPCManagement.Api/Features/Coordination/Services/CoordinationService.cs` — 2,416 lines; coordination workflow changes have broad cross-slice implications.
- `backend/src/IPCManagement.Api/Features/SampleData/Services/SampleDataImportService.CustomMenu.cs` — 2,047 lines, paired with 1,488-line `SampleDataImportService.cs`; preserve the partial-class split and import fixtures.
- `frontend/src/api/workflowApi.ts` — 1,955 lines; avoid extending it for isolated feature endpoints.
- `backend/src/IPCManagement.Api/Features/Catalog/Services/DishService.cs` — 1,620 lines.
- `backend/src/IPCManagement.Api/Features/Purchasing/Services/PurchaseRequestWorkflowService.cs` — 1,385 lines.
- `backend/src/IPCManagement.Api/Features/Planning/Services/MaterialDemandService.cs` — 1,280 lines.
- `frontend/src/features/reports/pages/ReportsPage.tsx` — 781 lines; extend its model/panel files instead of adding more inline concerns.
- `frontend/src/features/warehouse/pages/WarehousePage.tsx` — 720 lines.
- `frontend/src/app/pages/admin-data/useAdminDataPageModel.ts` — 692 lines; it is intentionally cross-feature and should not become a generic dumping ground.
- `backend/src/IPCManagement.Api/Features/Coordination/Controllers/CoordinationController.cs` — 678 lines; new actions should be assessed for a focused controller/use-case split.

## Special Directories

**`backend/src/IPCManagement.Api/Migrations`:**
- Purpose: EF Core schema history and generated model snapshots.
- Generated: Partly; designer and snapshot files are generated.
- Committed: Yes.

**`frontend/src/shared/api/contracts`:**
- Purpose: Generated OpenAPI JSON and TypeScript schema.
- Generated: Yes.
- Committed: Yes.

**`frontend/dist`, `frontend/coverage`, `backend/**/bin`, `backend/**/obj`, `backend/TestResults`:**
- Purpose: Build/test output.
- Generated: Yes.
- Committed: No; do not use as source locations.

**`.artifacts`:**
- Purpose: Browser/Shipyard visual and runtime evidence.
- Generated: Yes.
- Committed: Depends on evidence workflow; preserve existing user evidence and do not treat it as application source.

**`.planning/codebase`:**
- Purpose: GSD-consumable codebase reference maps.
- Generated: Yes, from current source analysis.
- Committed: Managed by the orchestrating workflow.

---

*Structure analysis: 2026-07-27*
