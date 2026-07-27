<!-- refreshed: 2026-07-27 -->
# Architecture

**Analysis Date:** 2026-07-27

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│ React 19 browser application                                        │
│ `frontend/src/main.tsx` → `frontend/src/routes/AppRouter.tsx`        │
├─────────────────────┬──────────────────────┬─────────────────────────┤
│ Feature pages       │ Shared UI/layout     │ RTK Query + Redux       │
│ `src/features/*`    │ `src/components/*`   │ `src/api/*`, `src/app`  │
└──────────┬──────────┴──────────┬───────────┴────────────┬────────────┘
           └─────────────────────┴────────────────────────┘
                                  │ HTTP JSON / JWT cookie + bearer
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ ASP.NET Core 9 API host and middleware                              │
│ `backend/src/IPCManagement.Api/Program.cs`                           │
├─────────────────────┬──────────────────────┬─────────────────────────┤
│ Feature controllers │ Feature services     │ Cross-cutting security  │
│ `Features/*/...`    │ `Features/*/...`     │ `Security`, `Middleware`│
└──────────┬──────────┴──────────┬───────────┴─────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Shared persistence: repositories, Unit of Work, EF Core DbContext   │
│ `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`         │
└──────────────────────────────────┬───────────────────────────────────┘
                                   ▼
                              MySQL 8+
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Browser bootstrap | Mount React, Redux provider, and global styles | `frontend/src/main.tsx` |
| Route composition | Lazy-load pages and enforce authentication/permission guards | `frontend/src/routes/AppRouter.tsx` |
| API core | Configure RTK Query base URL, auth headers, refresh, and shared cache | `frontend/src/api/apiSlice.ts` |
| Feature UI | Own domain pages, local hooks, endpoint modules, and components | `frontend/src/features/*` |
| Multi-feature UI composition | Combine admin, auth, and coordination data | `frontend/src/app/pages/AdminDataPage.tsx`, `frontend/src/app/pages/admin-data/useAdminDataPageModel.ts` |
| API host | Configure middleware, authorization, health checks, rate limiting, and endpoints | `backend/src/IPCManagement.Api/Program.cs` |
| Dependency composition | Register persistence and feature services | `backend/src/IPCManagement.Api/DependencyInjection.cs` |
| Backend slices | Group controllers, contracts, services, and validators by domain | `backend/src/IPCManagement.Api/Features/*` |
| Persistence | Map all domain entities and expose shared database access | `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs` |

## Pattern Overview

**Overall:** Modular monolith with VSA-lite feature folders, layered internals, and a React feature-module frontend.

**Key Characteristics:**
- Deploy the backend as one ASP.NET Core process and one EF Core model; feature slices are source organization, not independently deployable modules.
- Route HTTP work through controller → service → repository/DbContext. Controllers remain thin in most slices, although `Features/Coordination/Controllers/CoordinationController.cs` is 678 lines.
- Keep frontend route ownership in `frontend/src/features/*`, while shared HTTP/session behavior stays centralized in `frontend/src/api/apiSlice.ts`.
- Treat the VSA-lite boundary as porous. Backend feature namespaces import one another directly; all slices share `Data`, entities, security, helpers, and one DI root.

### Measured Boundary Evidence

- Backend has 10 feature folders. Largest by measured non-generated C# volume are `SampleData` (13 files/7,009 lines), `Reports` (12/4,577), `Purchasing` (33/3,893), `Inventory` (26/3,660), and `Coordination` (11/3,616).
- Frontend has 10 named feature directories, but `frontend/src/features/workflow/pages` is empty. Largest measured TypeScript/TSX slices are `projects` (56 files/5,450 lines), `coordination` (17/2,447), `chef` (27/2,295), and `purchasing` (12/2,206).
- Cross-slice backend imports are concrete: Planning calls Purchasing in `Features/Planning/Services/MaterialDemandService.cs`; Purchasing calls Reports in `Features/Purchasing/Services/PurchaseRequestWorkflowService.cs`; Purchasing calls Inventory in `Features/Purchasing/Services/PurchaseReceivingService.cs`; Catalog calls SampleData in `Features/Catalog/Services/DishService.cs`; Coordination calls Approvals and Purchasing in `Features/Coordination/Services/CoordinationService.cs`.
- Cross-feature contracts are also coupled: `Features/Purchasing/Contracts/PurchasePlanPageDto.cs` imports Reports contracts, while `Features/Reports/Services/IWorkflowReportService.cs` imports Purchasing contracts. This makes the Reports/Purchasing boundary bidirectional rather than a strict vertical slice.
- Frontend core depends on auth feature state (`frontend/src/api/apiSlice.ts`), and the app store depends on auth and coordination reducers (`frontend/src/app/store.ts`). `frontend/src/app/pages/admin-data/useAdminDataPageModel.ts` intentionally composes admin, auth, and coordination.

## Layers

**Frontend Route/Composition Layer:**
- Purpose: Select the feature page, guard access, and provide a persistent application shell.
- Location: `frontend/src/routes`, `frontend/src/App.tsx`, `frontend/src/components/layout`
- Contains: Router, lazy loaders, role/action guards, and `MainLayout`.
- Depends on: Feature pages, auth state, route configuration, shared UI.
- Used by: `frontend/src/main.tsx`.

**Frontend Feature Layer:**
- Purpose: Own domain screens and interaction logic.
- Location: `frontend/src/features/{admin,approvals,auth,chef,coordination,dashboard,projects,purchasing,reports,warehouse}`
- Contains: Pages, components, feature API modules, hooks, slices, and feature tests.
- Depends on: `frontend/src/api`, `frontend/src/components`, `frontend/src/lib`, and occasionally other features.
- Used by: `frontend/src/routes/AppRouter.tsx` and multi-feature composition under `frontend/src/app/pages`.

**Frontend Shared Infrastructure:**
- Purpose: Provide HTTP/session cache, reusable components, formatting, pagination, and generated API contracts.
- Location: `frontend/src/api`, `frontend/src/components`, `frontend/src/lib`, `frontend/src/shared/api/contracts`
- Contains: `apiSlice`, workflow endpoints, reusable workbench primitives, utilities, and OpenAPI schema.
- Depends on: Auth feature for token/session transitions.
- Used by: All feature modules.

**Backend Host/Cross-Cutting Layer:**
- Purpose: Compose the application and enforce policies around every request.
- Location: `backend/src/IPCManagement.Api/Program.cs`, `DependencyInjection.cs`, `Middlewares`, `Security`, `HealthChecks`, `OpenApi`
- Contains: JWT, CORS, rate limiting, logging, exception handling, health, and DI.
- Depends on: Feature services and persistence.
- Used by: Runtime host and all controllers.

**Backend Feature Layer:**
- Purpose: Group HTTP contracts, controllers, validators, and application services by business capability.
- Location: `backend/src/IPCManagement.Api/Features/*`
- Contains: `Contracts`, `Controllers`, `Services`, and optional `Validators`.
- Depends on: Shared persistence/entities plus direct service/contract dependencies across slices.
- Used by: ASP.NET controller discovery and DI composition.

**Persistence Layer:**
- Purpose: Maintain relational mappings and transaction boundaries.
- Location: `backend/src/IPCManagement.Api/Data`, `backend/src/IPCManagement.Api/Models/Entities`, `backend/src/IPCManagement.Api/Migrations`
- Contains: 2,563-line `IpcManagementContext`, repositories, Unit of Work, entities, and generated migrations.
- Depends on: EF Core/Pomelo.
- Used by: Feature services across all slices.

## Data Flow

### Primary Authenticated Request Path

1. `frontend/src/main.tsx` mounts `App`, Redux, and global CSS.
2. `frontend/src/routes/AppRouter.tsx` selects a lazy feature page; `ProtectedRoute.tsx` and `RoleGuard.tsx` validate session and permissions.
3. A feature hook invokes an injected RTK Query endpoint through `frontend/src/api/apiSlice.ts`; the base query adds authentication and coordinates token refresh.
4. `backend/src/IPCManagement.Api/Program.cs` applies forwarded headers, correlation ID, access logging, exception handling, CORS, authentication, rate limiting, and authorization.
5. A controller in `backend/src/IPCManagement.Api/Features/*/Controllers` validates route/body and delegates to a feature service.
6. The service coordinates repositories and/or `backend/src/IPCManagement.Api/Data/IpcManagementContext.cs`, commits a transaction, and returns a contract DTO.
7. RTK Query normalizes cache state and the feature page rerenders from the response.

### Demand-to-Purchase Cross-Feature Flow

1. Coordination data is captured by `Features/Coordination/Controllers/CoordinationController.cs` and `CoordinationService.cs`.
2. Planning generates material demand through `Features/Planning/Controllers/MaterialDemandController.cs` and `MaterialDemandService.cs`.
3. Planning relies on the Purchasing-owned `IMaterialDemandService` contract in `Features/Purchasing/Services/IMaterialDemandService.cs`.
4. Purchasing creates and advances requests in `Features/Purchasing/Services/PurchaseRequestWorkflowService.cs` and invokes report calculations from `Features/Reports/Services`.
5. Approval handlers in `Features/Approvals/Services/ApprovalHandlers.cs` call Purchasing services to apply decisions.
6. Receiving crosses back from Purchasing into Inventory via `Features/Purchasing/Services/PurchaseReceivingService.cs`.

**State Management:**
- Browser server state lives in one RTK Query API cache (`frontend/src/api/apiSlice.ts`). Client state uses Redux reducers for auth and coordination in `frontend/src/app/store.ts`; page-local state remains in React hooks/models.
- Backend request state is scoped through DI. Durable state and transactions live in MySQL through one `IpcManagementContext`; memory cache is process-local and registered in `Program.cs`.

## Key Abstractions

**Feature Service Interface:**
- Purpose: Separate controller contracts from business orchestration and permit test substitution.
- Examples: `Features/Coordination/Services/ICoordinationService.cs`, `Features/Purchasing/Services/IPurchaseRequestWorkflowService.cs`, `Features/Inventory/Services/IStockLedgerService.cs`
- Pattern: Interface and implementation usually colocated in the slice; register in `DependencyInjection.cs`.

**Unit of Work / Repository:**
- Purpose: Centralize persistence and save boundaries.
- Examples: `backend/src/IPCManagement.Api/Data/UnitOfWork.cs`, `backend/src/IPCManagement.Api/Data/Repositories`
- Pattern: Shared infrastructure used across features; do not create per-feature DbContexts.

**RTK Query API Slice:**
- Purpose: Share base transport, authentication, cache tags, and refresh behavior.
- Examples: `frontend/src/api/apiSlice.ts`, `frontend/src/api/workflowApi.ts`, `frontend/src/features/coordination/coordinationApi.ts`
- Pattern: Inject endpoints into the common slice; keep domain-facing hooks close to their owning feature unless the endpoint is deliberately cross-feature.

**Page Model:**
- Purpose: Move orchestration and derived state out of large presentation shells.
- Examples: `frontend/src/app/pages/admin-data/useAdminDataPageModel.ts`, `frontend/src/features/reports/pages/useReportsPageModel.ts`
- Pattern: Use for multi-query workbenches; split panels/components by cohesive responsibility.

## Entry Points

**Backend API:**
- Location: `backend/src/IPCManagement.Api/Program.cs`
- Triggers: `dotnet run`, deployed ASP.NET host, Shipyard hooks.
- Responsibilities: Host configuration, middleware order, health routes, controller mapping, lifecycle logging.

**Backend Composition Root:**
- Location: `backend/src/IPCManagement.Api/DependencyInjection.cs`
- Triggers: Called from `Program.cs`.
- Responsibilities: Register DbContext, repositories, Unit of Work, security, and feature services.

**Frontend Browser:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite-served `frontend/index.html`.
- Responsibilities: Mount React providers, application, and ordered global styles.

**Frontend Router:**
- Location: `frontend/src/routes/AppRouter.tsx`
- Triggers: Rendered by `frontend/src/App.tsx`.
- Responsibilities: Public/private route split, layout nesting, lazy feature resolution, role permissions.

## Architectural Constraints

- **Threading:** ASP.NET request processing is asynchronous and multi-request; process-local memory cache and singletons must be thread-safe. React executes on the browser main thread, with route/chunk preload scheduled during idle time.
- **Global state:** One Redux store in `frontend/src/app/store.ts`, one RTK Query cache in `frontend/src/api/apiSlice.ts`, Serilog global logger in `Program.cs`, and process-local memory cache registered in `Program.cs`.
- **Database boundary:** All backend slices share `IpcManagementContext`; schema and entity changes affect the whole monolith.
- **Circular dependencies:** Namespace-level bidirectional coupling exists between Purchasing and Reports (`PurchasePlanPageDto.cs`/`IWorkflowReportService.cs`), and service orchestration crosses Planning→Purchasing, Purchasing→Reports/Inventory, Approvals→Purchasing, Catalog→SampleData, Coordination→Approvals/Purchasing.
- **Generated files:** Do not hand-edit `frontend/src/shared/api/contracts/schema.ts` (13,340 lines) or EF migration designer/snapshot files under `backend/src/IPCManagement.Api/Migrations`.

## Anti-Patterns

### Treating Feature Folders as Hard Modules

**What happens:** Code imports services and contracts directly across `Features/*`, including bidirectional Purchasing/Reports dependencies.
**Why it's wrong:** Moving files into slice folders does not provide compile-time isolation; a local contract change can ripple through multiple business capabilities.
**Do this instead:** Put genuinely cross-slice DTOs in `backend/src/IPCManagement.Api/Shared/Contracts`, expose narrow application ports, and keep orchestration direction acyclic. Use existing shared contracts as the placement model.

### Growing God Services and Controllers

**What happens:** `Features/Reports/Services/WorkflowReportService.cs` is 3,633 lines, `Features/Coordination/Services/CoordinationService.cs` is 2,416, `Features/Catalog/Services/DishService.cs` is 1,620, and `Features/Coordination/Controllers/CoordinationController.cs` is 678.
**Why it's wrong:** Large files combine unrelated queries, workflow transitions, mapping, and validation, making feature ownership less meaningful and regression scope broad.
**Do this instead:** Split by use case behind the existing service interfaces and keep controller actions delegating to focused handlers; retain one transaction boundary where a workflow truly spans operations.

### Putting Domain API Everywhere

**What happens:** Some endpoints are feature-owned (`features/coordination/coordinationApi.ts`) while the 1,955-line `frontend/src/api/workflowApi.ts` owns many cross-domain workflow calls.
**Why it's wrong:** Feature dependency direction becomes difficult to infer, and changes accumulate in a shared endpoint hub.
**Do this instead:** Keep authentication/base-query/cache infrastructure in `frontend/src/api`, but add domain-specific endpoint modules in the owning `frontend/src/features/<feature>` and re-export only stable shared hooks.

## Error Handling

**Strategy:** Convert uncaught backend exceptions into consistent API responses, attach a correlation ID, and surface query errors through shared frontend components.

**Patterns:**
- Use `backend/src/IPCManagement.Api/Middlewares/ExceptionMiddleware.cs` and typed exceptions under `Exceptions`; do not duplicate broad try/catch in controllers.
- Use `frontend/src/components/common/QueryErrorAlert.tsx` and toast infrastructure for user-visible failures; allow RTK Query to retain transport metadata.

## Cross-Cutting Concerns

**Logging:** Serilog bootstrap and request logging in `backend/src/IPCManagement.Api/Program.cs`; correlation IDs from `Middlewares/CorrelationIdMiddleware.cs`.
**Validation:** FluentValidation assembly scanning in `Program.cs`, validators colocated under feature `Validators` folders, plus ASP.NET model binding.
**Authentication:** JWT access token plus refresh flow; backend policies in `Program.cs`, browser refresh/session behavior in `frontend/src/api/apiSlice.ts`, and route enforcement in `frontend/src/routes`.

---

*Architecture analysis: 2026-07-27*
