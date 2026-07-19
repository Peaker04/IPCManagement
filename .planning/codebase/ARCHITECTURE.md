<!-- refreshed: 2026-07-08 -->
# Architecture

> Refreshed 2026-07-19. The current MVP web walkthrough is documented in [`docs/MVP_WEB_FLOW.md`](../../docs/MVP_WEB_FLOW.md); aggregate ingredient demand pagination is exposed by `WorkflowReportsController` and consumed through RTK Query.

**Analysis Date:** 2026-07-08 (updated from 2026-06-12)

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                         │
├──────────────────┬──────────────────┬───────────────────────┤
│   Router/Layout  │  Feature Pages   │  Redux/RTK Query      │
│ `frontend/src/   │ `frontend/src/   │ `frontend/src/app`    │
│ routes`          │ features`        │ `frontend/src/api`    │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  ASP.NET Core Web API                        │
│ `backend/src/IPCManagement.Api/Program.cs`                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ Controllers → Services → Repositories → EF Core DbContext    │
│ `Controllers/` `Services/` `Data/Repositories/` `Data/`      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  MySQL database and generated migrations                     │
│  `Models/Entities/` `Migrations/`                            │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| API bootstrap | Configure Serilog, DI, JWT auth, CORS, FluentValidation, Swagger, rate limiting, middleware, and controller routing. | `backend/src/IPCManagement.Api/Program.cs` |
| Backend DI module | Register EF Core context, repositories, domain services, token service, and unit-of-work abstractions. | `backend/src/IPCManagement.Api/DependencyInjection.cs` |
| Controllers | Expose HTTP endpoints, authorize requests, bind DTOs, call services, and wrap results in `ApiResponse`. | `backend/src/IPCManagement.Api/Controllers/*.cs` |
| Services | Own business rules, DTO mapping, transaction orchestration, stock ledger updates, and repository coordination. | `backend/src/IPCManagement.Api/Services/*.cs` |
| Repositories | Encapsulate EF Core queries and persistence methods per aggregate/table. | `backend/src/IPCManagement.Api/Data/Repositories/*.cs` |
| EF Core context | Define `DbSet` properties, table mappings, indexes, relationships, enum columns, and MySQL schema configuration. | `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs` |
| Validators | Validate incoming DTOs with FluentValidation before controller action logic runs. | `backend/src/IPCManagement.Api/Models/Validators/*.cs` |
| Mappers | Convert EF entities to API DTOs and handle binary GUID string conversion. | `backend/src/IPCManagement.Api/Helpers/Mappers/*.cs` |
| Frontend entry | Mount React with `StrictMode` and Redux provider. | `frontend/src/main.tsx` |
| Frontend routing | Define public/protected routes and nested layout routing. | `frontend/src/routes/AppRouter.tsx` |
| Frontend store | Compose auth, coordination, and RTK Query reducers/middleware. | `frontend/src/app/store.ts` |
| API client | Centralize `/api` base URL and bearer-token header preparation. | `frontend/src/api/apiSlice.ts` |
| Feature modules | Own pages, local components, feature slices, types, and exports for business areas. | `frontend/src/features/*` |

## Pattern Overview

**Overall:** Split frontend/backend application with a layered ASP.NET Core API and feature-folder React client.

**Key Characteristics:**
- Backend request handling flows through controller classes, service interfaces, repository interfaces, and EF Core persistence. Keep new backend behavior inside this sequence.
- Backend dependencies are interface-first and registered explicitly in `backend/src/IPCManagement.Api/DependencyInjection.cs`.
- Multi-entity backend writes use `IUnitOfWork` and repository synchronous change tracking before one `SaveChangesAsync`, as shown by `backend/src/IPCManagement.Api/Services/InventoryReceiptService.cs`.
- Frontend routes are centralized in `frontend/src/routes/AppRouter.tsx` and `frontend/src/routes/routeConfig.ts`.
- Frontend feature state lives in Redux slices under `frontend/src/features/*`, while server API calls extend `frontend/src/api/apiSlice.ts` with `injectEndpoints`.
- Shared frontend primitives live under `frontend/src/components`, `frontend/src/app`, `frontend/src/lib`, `frontend/src/styles`, and `frontend/src/types`.

## Layers

**Frontend Shell:**
- Purpose: Mount the SPA, create the router, guard authenticated pages, and render the persistent sidebar/header shell.
- Location: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/routes`, `frontend/src/components/layout/MainLayout.tsx`
- Contains: React root setup, `BrowserRouter`, route config, `ProtectedRoute`, `MainLayout`.
- Depends on: `react`, `react-dom`, `react-router-dom`, Redux hooks, auth selectors, `lucide-react`.
- Used by: All frontend feature pages.

**Frontend State and API:**
- Purpose: Manage client state, attach auth tokens to API calls, and provide typed app hooks.
- Location: `frontend/src/app`, `frontend/src/api`, `frontend/src/features/*/*Slice.ts`, `frontend/src/features/*/*Api.ts`
- Contains: `configureStore`, `createApi`, `fetchBaseQuery`, `createSlice`, `createAsyncThunk`, selectors.
- Depends on: `@reduxjs/toolkit`, `react-redux`, browser `localStorage`.
- Used by: `frontend/src/routes/ProtectedRoute.tsx`, feature pages, feature components.

**Frontend Features:**
- Purpose: Package user-facing workflows by business domain.
- Location: `frontend/src/features/auth`, `frontend/src/features/coordination`, `frontend/src/features/chef`, `frontend/src/features/projects`, `frontend/src/features/dashboard`, `frontend/src/features/reports`, `frontend/src/features/workflow`, `frontend/src/features/admin`
- Contains: Pages, feature-local components, feature state, API endpoint modules, types, and barrel exports.
- Depends on: Shared UI components, app hooks, route constants, Redux slices, and RTK Query API modules.
- Used by: `frontend/src/routes/AppRouter.tsx`.

> **Thêm vào Phase 2**: `frontend/src/features/workflow` chứa ApprovalPage, PurchasingPage, WarehousePage, AdminDataPage, ApprovalRulesPage. `frontend/src/services/` chứa các service helpers.

**API Composition:**
- Purpose: Configure host-level concerns and request pipeline order.
- Location: `backend/src/IPCManagement.Api/Program.cs`, `backend/src/IPCManagement.Api/DependencyInjection.cs`
- Contains: Serilog bootstrap, JWT bearer auth, CORS, JSON serialization, FluentValidation, Swagger, rate limiter policies, exception middleware registration, DI registrations.
- Depends on: ASP.NET Core, Serilog, FluentValidation, EF Core, Pomelo MySQL, JWT packages.
- Used by: The running backend process via `dotnet run --project backend/src/IPCManagement.Api`.

**HTTP Controllers:**
- Purpose: Keep transport concerns at the edge and delegate business logic to services.
- Location: `backend/src/IPCManagement.Api/Controllers`
- Contains: `[ApiController]`, `[Route]`, `[Authorize]`, action methods, `ApiResponse` wrappers, status-code choices.
- Depends on: `IPCManagement.Api.Services`, DTOs, `ApiResponse`, ASP.NET MVC attributes.
- Used by: ASP.NET Core endpoint routing through `app.MapControllers()`.

**Business Services:**
- Purpose: Enforce business operations, parse external IDs, compose repository calls, map outputs, and manage transactions.
- Location: `backend/src/IPCManagement.Api/Services`
- Contains:
  - Core services: `IngredientService`, `InventoryReceiptService`, `InventoryIssueService`, `InventoryReturnService`, `StockLedgerService`, `StocktakeService`, `CoordinationService`, `DishService`, `AuthService`, `SupplierQuotationService`, `WarehouseService`, `ProductionPlanService`.
  - Workflow services (thêm Phase 2) trong `Services/Workflow/`: `MaterialDemandService`, `PurchaseRequestWorkflowService`, `PurchaseOrderService`, `WorkflowReportService`.
  - Admin services trong `Services/Admin/`.
  - Sample data import trong `Services/SampleData/` (Development-only).
- Depends on: Repository interfaces, `IUnitOfWork`, `GuidHelper`, mapper classes, DTOs, entity classes.
- Used by: Controllers and other services.

**Data Access:**
- Purpose: Isolate EF Core query shapes and persistence mechanics.
- Location: `backend/src/IPCManagement.Api/Data`, `backend/src/IPCManagement.Api/Data/Repositories`
- Contains: `IpcManagementContext`, `UnitOfWork`, `GenericRepository<T>`, aggregate repositories, repository interfaces.
- Depends on: EF Core, Pomelo MySQL provider, entity classes, pagination options.
- Used by: Business services.

**Domain Model and Contracts:**
- Purpose: Represent database entities and API request/response payloads.
- Location: `backend/src/IPCManagement.Api/Models/Entities`, `backend/src/IPCManagement.Api/Models/DTOs`
- Contains: EF entity classes generated from database tables, DTOs grouped by domain.
- Depends on: EF navigation conventions and helper mapping code.
- Used by: EF Core context, repositories, services, controllers, mappers.

**Validation and Error Handling:**
- Purpose: Normalize request validation and unhandled exception responses.
- Location: `backend/src/IPCManagement.Api/Models/Validators`, `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`, `backend/src/IPCManagement.Api/Helpers/ApiResponse.cs`
- Contains: FluentValidation validators, exception-to-status mapping, response envelope helpers.
- Depends on: FluentValidation, ASP.NET Core middleware pipeline.
- Used by: All backend controllers.

## Data Flow

### Authenticated API Request Path

1. Browser renders route content through `AppRouter` and protected layout (`frontend/src/routes/AppRouter.tsx:14`, `frontend/src/routes/ProtectedRoute.tsx:6`).
2. Frontend API calls go through `apiSlice` with `baseUrl: '/api'` and optional `authorization: Bearer {token}` from Redux auth state (`frontend/src/api/apiSlice.ts:4`).
3. ASP.NET Core executes global middleware in pipeline order: exception middleware, rate limiter, HTTPS redirect, CORS, authentication, authorization, controller routing (`backend/src/IPCManagement.Api/Program.cs:175`, `backend/src/IPCManagement.Api/Program.cs:201`, `backend/src/IPCManagement.Api/Program.cs:204`, `backend/src/IPCManagement.Api/Program.cs:206`).
4. Controller action binds DTO/query input, enforces `[Authorize]` where present, and calls an injected service (`backend/src/IPCManagement.Api/Controllers/IngredientsController.cs:13`).
5. Service parses GUID strings, performs business checks, calls repositories, and maps entities to DTOs (`backend/src/IPCManagement.Api/Services/IngredientService.cs`).
6. Repository executes EF Core queries against `IpcManagementContext` (`backend/src/IPCManagement.Api/Data/Repositories/IngredientRepository.cs`).
7. Controller wraps service output in `ApiResponse<T>` (`backend/src/IPCManagement.Api/Helpers/ApiResponse.cs`).

### Inventory Receipt Write Flow

1. `InventoryReceiptsController.Create` accepts `CreateInventoryReceiptDto`, reads the authenticated user ID, and calls `IInventoryReceiptService.CreateAsync` (`backend/src/IPCManagement.Api/Controllers/InventoryReceiptsController.cs:53`).
2. `InventoryReceiptService.CreateAsync` validates GUID strings, starts an EF transaction through `IUnitOfWork.BeginTransactionAsync`, creates the receipt and lines, and stages the receipt with the repository (`backend/src/IPCManagement.Api/Services/InventoryReceiptService.cs`).
3. For each line, `InventoryReceiptService` calls `IStockLedgerService.AddStockAsync` to stage `Stockmovement` rows and upsert `Currentstock` (`backend/src/IPCManagement.Api/Services/StockLedgerService.cs`).
4. `InventoryReceiptService` calls `IUnitOfWork.SaveChangesAsync`, commits the transaction, and returns a lightweight created DTO (`backend/src/IPCManagement.Api/Data/UnitOfWork.cs`).
5. Exceptions roll back the transaction and are converted to a normalized error response by `ExceptionMiddleware` (`backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`).

### Frontend Coordination/Chef Flow

1. `CoordinationPage` reads current day, shift, orders, weekly menu, and lock state from Redux (`frontend/src/features/coordination/pages/CoordinationPage.tsx`).
2. Coordination components dispatch actions from `coordinationSlice` to update orders, select shifts, lock order plans, adjust locked orders, and export reports (`frontend/src/features/coordination/coordinationSlice.ts`).
3. `ChefDashboardPage` reads coordination orders and lock state, then derives a production plan with `useMemo` from active day, active shift, menu price, loss rate, dishes, and raw materials (`frontend/src/features/chef/pages/ChefDashboardPage.tsx`).
4. Chef components receive the computed production plan and callbacks for supplemental requests, excess returns, and material signoff (`frontend/src/features/chef/components/head-chef-dashboard.tsx`).

**State Management:**
- Backend state is request-scoped through ASP.NET Core DI; `IpcManagementContext`, repositories, services, and `IUnitOfWork` are scoped per request in `backend/src/IPCManagement.Api/DependencyInjection.cs`.
- Backend durable state is stored in MySQL through EF Core entities and migrations in `backend/src/IPCManagement.Api/Models/Entities` and `backend/src/IPCManagement.Api/Migrations`.
- Frontend auth state is persisted to `localStorage` by `frontend/src/features/auth/authSlice.ts`; Redux stores the in-memory auth and coordination state.
- Frontend server cache state is held by RTK Query under the `api` reducer from `frontend/src/api/apiSlice.ts`.

## Key Abstractions

**Controller-Service-Repository:**
- Purpose: Separate HTTP handling, business rules, and persistence.
- Examples: `backend/src/IPCManagement.Api/Controllers/IngredientsController.cs`, `backend/src/IPCManagement.Api/Services/IngredientService.cs`, `backend/src/IPCManagement.Api/Data/Repositories/IngredientRepository.cs`
- Pattern: Define an interface per service/repository, register it in `DependencyInjection.cs`, inject the interface into the next layer.

**Generic Repository:**
- Purpose: Provide common CRUD/pagination behavior for EF Core-backed entities.
- Examples: `backend/src/IPCManagement.Api/Data/Repositories/GenericRepository.cs`, `backend/src/IPCManagement.Api/Data/Repositories/IngredientRepository.cs`
- Pattern: Inherit from `GenericRepository<T>` and override query methods when includes, search, sorting, or filters are domain-specific.

**Unit of Work:**
- Purpose: Create explicit transactions and defer `SaveChangesAsync` for multi-entity write flows.
- Examples: `backend/src/IPCManagement.Api/Data/IUnitOfWork.cs`, `backend/src/IPCManagement.Api/Data/UnitOfWork.cs`, `backend/src/IPCManagement.Api/Services/InventoryReceiptService.cs`
- Pattern: Use repository `Add`/`Update` methods for staged changes, then call `IUnitOfWork.SaveChangesAsync` once inside a transaction.

**Response Envelope:**
- Purpose: Standardize API responses as `{ success, message, data/errors }`.
- Examples: `backend/src/IPCManagement.Api/Helpers/ApiResponse.cs`, `backend/src/IPCManagement.Api/Controllers/IngredientsController.cs`
- Pattern: Return `ApiResponse<T>.SuccessResult(...)` for data responses and `ApiResponse.FailResult(...)` for known failures.

**GUID Binary Conversion:**
- Purpose: Convert public GUID strings to MySQL `binary(16)` IDs and back.
- Examples: `backend/src/IPCManagement.Api/Helpers/GuidHelper.cs`, `backend/src/IPCManagement.Api/Helpers/Mappers/IngredientMapper.cs`
- Pattern: Parse external string IDs at service boundaries and return string IDs from mappers.

**RTK Query API Slice:**
- Purpose: Centralize API base configuration and let features inject endpoints.
- Examples: `frontend/src/api/apiSlice.ts`, `frontend/src/features/auth/authApi.ts`
- Pattern: Add feature endpoint groups with `apiSlice.injectEndpoints`, export generated hooks from the feature module.

**Feature Folders:**
- Purpose: Keep page, component, state, type, and export files together by workflow.
- Examples: `frontend/src/features/auth`, `frontend/src/features/coordination`, `frontend/src/features/chef`
- Pattern: Place route-level pages in `pages/`, reusable feature-specific UI in `components/`, state in `*Slice.ts`, API endpoints in `*Api.ts`, and shared feature types in `types.ts`.

## Entry Points

**Backend API:**
- Location: `backend/src/IPCManagement.Api/Program.cs`
- Triggers: `npm run be` from root `package.json` or `dotnet run --project backend/src/IPCManagement.Api`.
- Responsibilities: Build and run the ASP.NET Core web host, configure services, configure middleware, and map controllers.

**Backend DI:**
- Location: `backend/src/IPCManagement.Api/DependencyInjection.cs`
- Triggers: Called by `builder.Services.AddBackendServices(builder.Configuration)` in `Program.cs`.
- Responsibilities: Register the database context, repositories, services, token service, and unit of work.

**Backend HTTP Controllers:**
- Location: `backend/src/IPCManagement.Api/Controllers/*.cs`
- Triggers: HTTP requests under `/api/*`.
- Responsibilities: Request binding, authorization attributes, service delegation, HTTP status selection, and response envelope creation.

**Frontend SPA:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite loads `frontend/index.html` and imports `/src/main.tsx`.
- Responsibilities: Create React root and wrap the app in the Redux provider.

**Frontend Routes:**
- Location: `frontend/src/routes/AppRouter.tsx`
- Triggers: Browser navigation inside the SPA.
- Responsibilities: Public login route, protected application routes, layout nesting, fallback redirect.

**Frontend Store:**
- Location: `frontend/src/app/store.ts`
- Triggers: Imported by `frontend/src/main.tsx`.
- Responsibilities: Configure reducers, RTK Query middleware, and app-level dispatch/state types.

## Architectural Constraints

- **Threading:** Backend uses ASP.NET Core async request handling and scoped EF Core `DbContext` instances; do not share `IpcManagementContext` across threads or static fields.
- **Global state:** Frontend auth initializes from browser `localStorage` in `frontend/src/features/auth/authSlice.ts`; this makes auth state browser-local and synchronous at app startup.
- **Global state:** Coordination currently stores generated mock orders and static defaults in module-level constants in `frontend/src/features/coordination/coordinationSlice.ts`.
- **Transactions:** Repository methods such as `GenericRepository<T>.AddAsync` save immediately; use sync staging methods plus `IUnitOfWork` for write flows that must commit atomically.
- **ID format:** Public APIs use GUID strings, while database entities use `byte[]` IDs. New service code must use `GuidHelper.ParseGuidString` and mapper code must use `GuidHelper.ToGuidString`.
- **Authorization:** Most resource controllers are class-level `[Authorize]`; auth endpoints selectively add `[Authorize]` for logout/profile. Add new protected APIs with explicit authorization attributes in `backend/src/IPCManagement.Api/Controllers`.
- **Circular imports:** No circular import chain was detected during static inspection. Keep frontend feature barrels limited to public exports to avoid route/store import cycles.
- **Configuration:** Do not read or commit real environment files. Backend has `backend/src/IPCManagement.Api/appsettings.json.example`; secrets and actual connection strings should stay outside committed docs/code.

## Anti-Patterns

### Controller Business Logic

**What happens:** Putting validation beyond HTTP concerns, database access, or stock calculations directly in controllers.
**Why it's wrong:** Existing controllers such as `backend/src/IPCManagement.Api/Controllers/IngredientsController.cs` are thin and delegate domain behavior to services.
**Do this instead:** Put business decisions in `backend/src/IPCManagement.Api/Services/*Service.cs` and call repositories through interfaces registered in `backend/src/IPCManagement.Api/DependencyInjection.cs`.

### Immediate Saves Inside Atomic Workflows

**What happens:** Calling repository `AddAsync`, `UpdateAsync`, or `DeleteAsync` inside a workflow that updates multiple tables.
**Why it's wrong:** `backend/src/IPCManagement.Api/Data/Repositories/GenericRepository.cs` saves immediately in those async methods, which can split a logical transaction.
**Do this instead:** For multi-entity writes, follow `backend/src/IPCManagement.Api/Services/InventoryReceiptService.cs`: begin a transaction, use repository `Add`/`Update`, call `IUnitOfWork.SaveChangesAsync`, then commit.

### Feature Logic in Shared Shell

**What happens:** Adding workflow-specific UI state or calculations to `frontend/src/components/layout/MainLayout.tsx` or `frontend/src/routes/AppRouter.tsx`.
**Why it's wrong:** The shell owns navigation and layout only; feature pages own workflow computation, as shown in `frontend/src/features/chef/pages/ChefDashboardPage.tsx`.
**Do this instead:** Put feature-specific state in `frontend/src/features/<feature>/*Slice.ts` or page-local hooks/components under `frontend/src/features/<feature>`.

### Direct Fetch Calls in Components

**What happens:** Calling `fetch('/api/...')` directly from route pages or components.
**Why it's wrong:** Auth headers and API base configuration already live in `frontend/src/api/apiSlice.ts`.
**Do this instead:** Add endpoints with `apiSlice.injectEndpoints` in a feature API file such as `frontend/src/features/auth/authApi.ts`.

## Error Handling

**Strategy:** Validate inputs before action logic with FluentValidation, return explicit `NotFound`/created/OK responses from controllers for expected outcomes, and let `ExceptionMiddleware` normalize unhandled exceptions.

**Patterns:**
- Use FluentValidation validators in `backend/src/IPCManagement.Api/Models/Validators` for DTO shape and range rules.
- Use `ApiResponse<T>.SuccessResult` and `ApiResponse.FailResult` in controllers and middleware.
- Throw `ArgumentException`, `InvalidOperationException`, `UnauthorizedAccessException`, or `KeyNotFoundException` from services when centralized exception mapping should determine response status.
- Return `null` from services for missing/invalid IDs when the controller should produce `404`.
- Log unhandled backend exceptions in `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs`.

## Cross-Cutting Concerns

**Logging:** Serilog writes to console and rolling files under `logs/ipc-.log` as configured in `backend/src/IPCManagement.Api/Program.cs`.

**Validation:** FluentValidation is registered globally with `AddFluentValidationAutoValidation()` and `AddValidatorsFromAssemblyContaining<Program>()` in `backend/src/IPCManagement.Api/Program.cs`; validators live in `backend/src/IPCManagement.Api/Models/Validators`.

**Authentication:** Backend uses JWT bearer authentication configured in `backend/src/IPCManagement.Api/Program.cs`; tokens are created by `backend/src/IPCManagement.Api/Security/JwtTokenService.cs` and frontend stores the access token in `localStorage` via `frontend/src/features/auth/authSlice.ts`.

**Authorization:** Use ASP.NET Core `[Authorize]` on controllers/actions in `backend/src/IPCManagement.Api/Controllers`; protected frontend pages are guarded by `frontend/src/routes/ProtectedRoute.tsx`.

**Rate limiting:** Backend applies `auth-strict` and `api-general` policies in `backend/src/IPCManagement.Api/Program.cs`. Attach policies to new endpoints when endpoint-specific limits are needed.

**CORS:** Backend uses `FrontendPolicy` in `backend/src/IPCManagement.Api/Program.cs`; development allows all origins, production uses `Cors:AllowedOrigins`.

**Serialization:** Backend JSON uses camelCase and ignores reference cycles in `backend/src/IPCManagement.Api/Program.cs`.

---

*Architecture analysis: 2026-06-12*
