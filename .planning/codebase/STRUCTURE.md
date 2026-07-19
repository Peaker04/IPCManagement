# Codebase Structure

**Analysis Date:** 2026-06-12

## Directory Layout

```text
IPCManagement/
├── backend/                         # .NET solution and ASP.NET Core API
│   ├── IPCManagement.slnx           # Backend solution file
│   ├── src/
│   │   └── IPCManagement.Api/       # Main API project
│   │       ├── Controllers/         # HTTP controllers
│   │       ├── Data/                # EF Core context, unit of work, repositories
│   │       ├── Helpers/             # Response, GUID, pagination, mapper helpers
│   │       ├── Middlewares/         # ASP.NET Core middleware
│   │       ├── Migrations/          # EF Core migrations and model snapshot
│   │       ├── Models/              # Entities, DTOs, validators
│   │       ├── Properties/          # Launch profile settings
│   │       ├── Security/            # JWT token implementation
│   │       ├── Services/            # Business services and interfaces
│   │       ├── Program.cs           # API composition root
│   │       └── IPCManagement.Api.csproj
│   └── tests/                       # xUnit backend test projects
├── frontend/                        # Vite React frontend workspace
│   ├── public/                      # Static public assets
│   ├── src/
│   │   ├── api/                     # RTK Query API base slice
│   │   ├── app/                     # Redux store and typed hooks
│   │   ├── assets/                  # Bundled image/SVG assets
│   │   ├── components/              # Shared layout and UI components
│   │   ├── features/                # Feature modules by workflow/domain
│   │   ├── lib/                     # Shared utilities and generic types
│   │   ├── routes/                  # Route config, router, protected route
│   │   ├── styles/                  # Global and app CSS
│   │   ├── types/                   # Shared API/client types
│   │   ├── App.tsx                  # App component delegating to router
│   │   └── main.tsx                 # React entry point
│   ├── index.html                   # Vite HTML entry
│   ├── package.json                 # Frontend package scripts/dependencies
│   └── vite.config.ts               # Vite configuration
├── .husky/                          # Git hooks
├── .planning/                       # GSD planning and generated codebase maps
├── commitlint.config.js             # Conventional commit linting
├── package.json                     # Root npm workspace and helper scripts
├── package-lock.json                # Root npm lockfile
├── CONTRIBUTING.md                  # Contribution workflow
└── README.md                        # Project overview
```

## Directory Purposes

**`backend/`:**
- Purpose: Contains the .NET backend solution, API project, and backend tests.
- Contains: `backend/IPCManagement.slnx`, `backend/src/IPCManagement.Api`, `backend/tests`.
- Key files: `backend/src/IPCManagement.Api/Program.cs`, `backend/src/IPCManagement.Api/DependencyInjection.cs`, `backend/src/IPCManagement.Api/IPCManagement.Api.csproj`.

**`backend/src/IPCManagement.Api/Controllers`:**
- Purpose: HTTP transport layer for API endpoints.
- Contains: Controller classes such as `AuthController.cs`, `IngredientsController.cs`, `InventoryReceiptsController.cs`, `InventoryIssuesController.cs`, `ProductionPlansController.cs`.
- Key files: `backend/src/IPCManagement.Api/Controllers/AuthController.cs`, `backend/src/IPCManagement.Api/Controllers/IngredientsController.cs`.

**`backend/src/IPCManagement.Api/Services`:**
- Purpose: Business logic layer and service contracts.
- Contains: One interface and one implementation per service, plus cross-domain services such as stock ledger handling.
- Key files: `backend/src/IPCManagement.Api/Services/IIngredientService.cs`, `backend/src/IPCManagement.Api/Services/IngredientService.cs`, `backend/src/IPCManagement.Api/Services/IStockLedgerService.cs`, `backend/src/IPCManagement.Api/Services/StockLedgerService.cs`.

**`backend/src/IPCManagement.Api/Data`:**
- Purpose: EF Core data access composition.
- Contains: `IpcManagementContext`, `IUnitOfWork`, `UnitOfWork`, and repository folder.
- Key files: `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`, `backend/src/IPCManagement.Api/Data/IUnitOfWork.cs`, `backend/src/IPCManagement.Api/Data/UnitOfWork.cs`.

**`backend/src/IPCManagement.Api/Data/Repositories`:**
- Purpose: Repository interfaces and EF Core implementations.
- Contains: `GenericRepository<T>`, `IGenericRepository<T>`, entity-specific repository pairs.
- Key files: `backend/src/IPCManagement.Api/Data/Repositories/GenericRepository.cs`, `backend/src/IPCManagement.Api/Data/Repositories/IIngredientRepository.cs`, `backend/src/IPCManagement.Api/Data/Repositories/IngredientRepository.cs`.

**`backend/src/IPCManagement.Api/Models/Entities`:**
- Purpose: EF Core entity classes representing database tables and navigation properties.
- Contains: Entity classes such as `Ingredient.cs`, `Inventoryreceipt.cs`, `Inventoryissue.cs`, `Currentstock.cs`, `Stockmovement.cs`, `User.cs`.
- Key files: `backend/src/IPCManagement.Api/Models/Entities/Ingredient.cs`, `backend/src/IPCManagement.Api/Models/Entities/Currentstock.cs`.

**`backend/src/IPCManagement.Api/Models/DTOs`:**
- Purpose: API request and response contracts grouped by domain.
- Contains: DTO folders for `Auth`, `Common`, `Dish`, `Ingredient`, `Inventory`, `ProductionPlan`, `User`, `Warehouse`.
- Key files: `backend/src/IPCManagement.Api/Models/DTOs/Common/PagedRequestDto.cs`, `backend/src/IPCManagement.Api/Models/DTOs/Ingredient/IngredientDto.cs`, `backend/src/IPCManagement.Api/Models/DTOs/Inventory/InventoryDto.cs`.

**`backend/src/IPCManagement.Api/Models/Validators`:**
- Purpose: FluentValidation rules for incoming DTOs.
- Contains: Domain validator classes.
- Key files: `backend/src/IPCManagement.Api/Models/Validators/IngredientValidators.cs`, `backend/src/IPCManagement.Api/Models/Validators/InventoryValidators.cs`.

**`backend/src/IPCManagement.Api/Helpers`:**
- Purpose: Shared backend utilities and mapper classes.
- Contains: `ApiResponse`, `GuidHelper`, pagination options, and `Mappers`.
- Key files: `backend/src/IPCManagement.Api/Helpers/ApiResponse.cs`, `backend/src/IPCManagement.Api/Helpers/GuidHelper.cs`, `backend/src/IPCManagement.Api/Helpers/Mappers/IngredientMapper.cs`.

**`backend/src/IPCManagement.Api/Middlewares`:**
- Purpose: Custom ASP.NET Core middleware.
- Contains: Global exception handling middleware.
- Key files: `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`.

**`backend/src/IPCManagement.Api/Security`:**
- Purpose: Authentication/token implementation details.
- Contains: JWT token service implementation.
- Key files: `backend/src/IPCManagement.Api/Security/JwtTokenService.cs`.

**`backend/src/IPCManagement.Api/Migrations`:**
- Purpose: EF Core migration history and model snapshot.
- Contains: Timestamped migration files and `IpcManagementContextModelSnapshot.cs`.
- Key files: `backend/src/IPCManagement.Api/Migrations/IpcManagementContextModelSnapshot.cs`.

**`backend/tests`:**
- Purpose: Backend test projects.
- Contains: API tests and application test project skeleton.
- Key files: `backend/tests/IPCManagement.Api.Tests/AuthServiceTests.cs`, `backend/tests/IPCManagement.Api.Tests/InventoryReceiptServiceTests.cs`, `backend/tests/IPCManagement.Api.Tests/InventoryIssueServiceTests.cs`.

**`frontend/`:**
- Purpose: React/Vite SPA workspace.
- Contains: Vite config, TypeScript configs, package scripts, public assets, and `src`.
- Key files: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/src/main.tsx`.

**`frontend/src/routes`:**
- Purpose: Routing definitions and route guards.
- Contains: Route constants, root router, protected route component.
- Key files: `frontend/src/routes/routeConfig.ts`, `frontend/src/routes/AppRouter.tsx`, `frontend/src/routes/ProtectedRoute.tsx`.

**`frontend/src/app`:**
- Purpose: Redux application wiring and typed hooks.
- Contains: Store setup and app hooks.
- Key files: `frontend/src/app/store.ts`, `frontend/src/app/hooks.ts`.

**`frontend/src/api`:**
- Purpose: Shared RTK Query API base.
- Contains: `apiSlice` with base URL and auth header preparation.
- Key files: `frontend/src/api/apiSlice.ts`.

**`frontend/src/components`:**
- Purpose: Shared layout and reusable UI primitives.
- Contains: `layout/MainLayout.tsx` and shadcn-style primitives under `ui`.
- Key files: `frontend/src/components/layout/MainLayout.tsx`, `frontend/src/components/ui/button.tsx`, `frontend/src/components/ui/card.tsx`, `frontend/src/components/ui/table.tsx`.

**`frontend/src/features`:**
- Purpose: Feature modules by workflow/domain.
- Contains: Auth, dashboard, reports, projects/menu, coordination, and chef workflows.
- Key files: `frontend/src/features/auth/authSlice.ts`, `frontend/src/features/auth/authApi.ts`, `frontend/src/features/coordination/coordinationSlice.ts`, `frontend/src/features/chef/pages/ChefDashboardPage.tsx`.

**`frontend/src/features/auth`:**
- Purpose: Login, auth API endpoints, auth state, and public exports.
- Contains: `authSlice.ts`, `authApi.ts`, `pages/LoginPage.tsx`, `index.ts`.
- Key files: `frontend/src/features/auth/authSlice.ts`, `frontend/src/features/auth/pages/LoginPage.tsx`.

**`frontend/src/features/coordination`:**
- Purpose: Meal order coordination and lock workflow.
- Contains: `coordinationSlice.ts`, `types.ts`, page and components.
- Key files: `frontend/src/features/coordination/pages/CoordinationPage.tsx`, `frontend/src/features/coordination/components/order-table.tsx`.

**`frontend/src/features/chef`:**
- Purpose: Chef production dashboard and material workflows.
- Contains: Chef dashboard page and production/material components.
- Key files: `frontend/src/features/chef/pages/ChefDashboardPage.tsx`, `frontend/src/features/chef/components/head-chef-dashboard.tsx`.

**`frontend/src/features/projects`:**
- Purpose: Weekly menu screen and backend dish catalog integration for menu/BOM calculations.
- Contains: `pages/WeeklyMenuPage.tsx`, `dishCatalogApi.ts`.
- Key files: `frontend/src/features/projects/pages/WeeklyMenuPage.tsx`, `frontend/src/features/projects/dishCatalogApi.ts`.

**`frontend/src/lib`:**
- Purpose: Generic frontend utilities and shared type helpers.
- Contains: Utility and type files.
- Key files: `frontend/src/lib/utils.ts`, `frontend/src/lib/types.ts`.

**`frontend/src/styles`:**
- Purpose: Frontend CSS entry files.
- Contains: Global and app CSS.
- Key files: `frontend/src/styles/index.css`, `frontend/src/styles/App.css`.

**`frontend/src/types`:**
- Purpose: Shared frontend API type definitions.
- Contains: API response and auth-related types.
- Key files: `frontend/src/types/api.ts`.

## Key File Locations

**Entry Points:**
- `backend/src/IPCManagement.Api/Program.cs`: Backend API host, service configuration, middleware pipeline, Swagger/root endpoints.
- `backend/src/IPCManagement.Api/DependencyInjection.cs`: Backend dependency registration entry for repositories/services/EF.
- `frontend/src/main.tsx`: Frontend React root and Redux provider.
- `frontend/src/App.tsx`: App wrapper that renders `AppRouter`.
- `frontend/src/routes/AppRouter.tsx`: Frontend route tree.

**Configuration:**
- `package.json`: Root npm workspace scripts for frontend/backend helpers and commitlint.
- `frontend/package.json`: Frontend dependencies and Vite scripts.
- `frontend/vite.config.ts`: Vite setup.
- `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`: Frontend TypeScript config.
- `frontend/eslint.config.js`: Frontend lint configuration.
- `backend/src/IPCManagement.Api/IPCManagement.Api.csproj`: Backend target framework and NuGet package references.
- `backend/src/IPCManagement.Api/appsettings.json.example`: Example backend app settings. Do not put real secrets in docs or committed examples.
- `backend/src/IPCManagement.Api/Properties/launchSettings.json`: Local backend launch profiles.
- `commitlint.config.js`: Commit message linting config.

**Core Logic:**
- `backend/src/IPCManagement.Api/Controllers`: HTTP API endpoints.
- `backend/src/IPCManagement.Api/Services`: Business services and interfaces.
- `backend/src/IPCManagement.Api/Data/Repositories`: EF Core repositories and interfaces.
- `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`: Database mapping.
- `backend/src/IPCManagement.Api/Helpers/Mappers`: Entity-to-DTO conversion.
- `frontend/src/features`: Frontend feature pages, components, state, API extensions, and types.
- `frontend/src/api/apiSlice.ts`: Frontend API client base.
- `frontend/src/app/store.ts`: Frontend Redux store composition.

**Testing:**
- `backend/tests/IPCManagement.Api.Tests`: API/service unit tests.
- `backend/tests/IPCManagement.Application.Tests`: Application test project skeleton.
- Frontend test configuration and test files are not detected.

## Naming Conventions

**Files:**
- Backend controllers use PascalCase plural controller names with `Controller` suffix: `IngredientsController.cs`, `InventoryReceiptsController.cs`.
- Backend service interfaces use `I{Name}Service.cs` and implementations use `{Name}Service.cs`: `IIngredientService.cs`, `IngredientService.cs`.
- Backend repository interfaces use `I{Name}Repository.cs` and implementations use `{Name}Repository.cs`: `IIngredientRepository.cs`, `IngredientRepository.cs`.
- Backend DTO files are grouped by domain and use `{Domain}Dto.cs` when several related DTOs are in one file: `Models/DTOs/Inventory/InventoryDto.cs`.
- Backend validators group related request validators by domain: `IngredientValidators.cs`, `InventoryValidators.cs`.
- Backend mapper files use `{Domain}Mapper.cs`: `IngredientMapper.cs`, `InventoryMapper.cs`.
- Frontend route/page components use PascalCase: `AppRouter.tsx`, `ProtectedRoute.tsx`, `LoginPage.tsx`, `CoordinationPage.tsx`.
- Frontend UI and feature component files are mixed; preserve local folder style. Shared shadcn-style UI uses lowercase names such as `button.tsx`, `card.tsx`, while layout/page components use PascalCase.
- Frontend Redux files use `*Slice.ts`: `authSlice.ts`, `coordinationSlice.ts`.
- Frontend API endpoint files use `*Api.ts`: `authApi.ts`.
- Frontend feature barrel files use `index.ts`.

**Directories:**
- Backend namespaces map to PascalCase directories under `backend/src/IPCManagement.Api`: `Controllers`, `Services`, `Models`, `Helpers`, `Middlewares`, `Security`.
- Backend DTO domains use PascalCase directories: `Models/DTOs/Ingredient`, `Models/DTOs/Inventory`.
- Frontend top-level source directories use lowercase: `api`, `app`, `components`, `features`, `routes`, `styles`, `types`.
- Frontend feature directories use lowercase domain names: `auth`, `coordination`, `chef`, `projects`.
- Frontend feature pages live in `pages`; feature-local UI lives in `components`.

## Where to Add New Code

**New Backend Feature/API Resource:**
- Controller: `backend/src/IPCManagement.Api/Controllers/{Resource}Controller.cs`
- Service contract: `backend/src/IPCManagement.Api/Services/I{Resource}Service.cs`
- Service implementation: `backend/src/IPCManagement.Api/Services/{Resource}Service.cs`
- Repository contract: `backend/src/IPCManagement.Api/Data/Repositories/I{Resource}Repository.cs`
- Repository implementation: `backend/src/IPCManagement.Api/Data/Repositories/{Resource}Repository.cs`
- DTOs: `backend/src/IPCManagement.Api/Models/DTOs/{Resource}/{Resource}Dto.cs`
- Validators: `backend/src/IPCManagement.Api/Models/Validators/{Resource}Validators.cs`
- Mapper: `backend/src/IPCManagement.Api/Helpers/Mappers/{Resource}Mapper.cs`
- DI registration: `backend/src/IPCManagement.Api/DependencyInjection.cs`
- Tests: `backend/tests/IPCManagement.Api.Tests/{Resource}ServiceTests.cs`

**New Backend Entity/Table Mapping:**
- Entity: `backend/src/IPCManagement.Api/Models/Entities/{Entity}.cs`
- DbSet/model mapping: `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`
- Migration: `backend/src/IPCManagement.Api/Migrations`
- Repository: `backend/src/IPCManagement.Api/Data/Repositories/I{Entity}Repository.cs` and `backend/src/IPCManagement.Api/Data/Repositories/{Entity}Repository.cs`
- DTO/mapper/service/controller files follow the backend feature pattern above.

**New Backend Cross-Cutting Service:**
- Interface and implementation: `backend/src/IPCManagement.Api/Services`
- DI registration: `backend/src/IPCManagement.Api/DependencyInjection.cs`
- If security-specific, implementation may live under `backend/src/IPCManagement.Api/Security` like `JwtTokenService.cs` while the interface remains in `Services`.

**New Frontend Route/Page:**
- Route constant: `frontend/src/routes/routeConfig.ts`
- Route registration: `frontend/src/routes/AppRouter.tsx`
- Navigation item/page title: `frontend/src/components/layout/MainLayout.tsx`
- Page component: `frontend/src/features/{feature}/pages/{FeaturePage}.tsx`
- Feature exports: `frontend/src/features/{feature}/index.ts`

**New Frontend Feature State:**
- Slice: `frontend/src/features/{feature}/{feature}Slice.ts`
- Types: `frontend/src/features/{feature}/types.ts`
- Store registration: `frontend/src/app/store.ts`
- Typed selector/hook helpers: `frontend/src/app/hooks.ts` when reusable across features.

**New Frontend API Endpoints:**
- Shared base: keep `frontend/src/api/apiSlice.ts` as the only base API definition.
- Feature endpoints: `frontend/src/features/{feature}/{feature}Api.ts` using `apiSlice.injectEndpoints`.
- Shared API response types: `frontend/src/types/api.ts` when reused across features.

**New Frontend Component:**
- Shared UI primitive: `frontend/src/components/ui/{component}.tsx`
- Shared app layout/component: `frontend/src/components/{area}/{Component}.tsx`
- Feature-specific component: `frontend/src/features/{feature}/components/{component}.tsx`
- Route-level page: `frontend/src/features/{feature}/pages/{FeaturePage}.tsx`

**Utilities:**
- Backend helper: `backend/src/IPCManagement.Api/Helpers/{HelperName}.cs`
- Backend mapper: `backend/src/IPCManagement.Api/Helpers/Mappers/{Domain}Mapper.cs`
- Frontend helper: `frontend/src/lib/utils.ts` for generic helpers or `frontend/src/features/{feature}/components/hooks.ts` for feature-local hooks.

## Special Directories

**`.planning`:**
- Purpose: GSD planning artifacts and generated codebase mapping documents.
- Generated: Yes
- Committed: Project-dependent; preserve existing planning files unless explicitly asked to clean them.

**`.codex-run`:**
- Purpose: Codex/GSD runtime artifacts.
- Generated: Yes
- Committed: Not applicable for source logic; do not place application code here.

**`.husky`:**
- Purpose: Git hook scripts for repository workflow.
- Generated: Partly
- Committed: Yes

**`node_modules`:**
- Purpose: Installed npm dependencies for the root workspace/frontend.
- Generated: Yes
- Committed: No

**`backend/src/IPCManagement.Api/Migrations`:**
- Purpose: EF Core schema migration history.
- Generated: Yes
- Committed: Yes

**`backend/src/IPCManagement.Api/Properties`:**
- Purpose: Local .NET launch profile configuration.
- Generated: Partly
- Committed: Yes

**`backend/tests`:**
- Purpose: Backend automated tests.
- Generated: No
- Committed: Yes

**`frontend/public`:**
- Purpose: Static files served by Vite without bundling transforms.
- Generated: No
- Committed: Yes

**`frontend/src/assets`:**
- Purpose: Bundled images and SVGs imported by frontend code.
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-06-12*
