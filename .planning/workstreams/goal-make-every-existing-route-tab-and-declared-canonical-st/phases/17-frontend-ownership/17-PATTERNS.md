# Phase 17: Frontend ownership - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 23 explicit/recommended files and file groups
**Analogs found:** 21 / 23

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/api/workflowApi.ts` | compatibility barrel | request-response / registration | `frontend/src/api/dishCatalogApi.ts` and existing barrel consumers | partial |
| `frontend/src/features/dashboard/dashboardApi.ts` | service/API injector | request-response | `frontend/src/features/admin/adminApi.ts` | exact |
| `frontend/src/features/reports/reportsApi.ts` | service/API injector | request-response / transform | `frontend/src/features/coordination/coordinationApi.ts` | exact |
| `frontend/src/features/purchasing/purchasingApi.ts` | service/API injector | CRUD / request-response | `frontend/src/features/coordination/coordinationApi.ts` | exact |
| `frontend/src/features/warehouse/warehouseApi.ts` | service/API injector | CRUD / request-response | `frontend/src/features/coordination/coordinationApi.ts` | exact |
| `frontend/src/features/chef/chefApi.ts` | service/API injector | request-response / transform | `frontend/src/features/coordination/coordinationApi.ts` | exact |
| `frontend/src/features/approvals/approvalsApi.ts` | service/API injector | CRUD / request-response | `frontend/src/features/admin/adminApi.ts` | exact |
| `frontend/src/features/admin/adminApi.ts` | service/API injector (modify) | CRUD / request-response | same file, employee endpoints | exact |
| `frontend/src/api/workflowDocumentsApi.ts` (if neutral owner chosen) | service/API injector | request-response | `frontend/src/features/admin/adminApi.ts` | role-match |
| `frontend/src/api/coordinationApi.ts` | service/API boundary (move) | CRUD / file-I/O / transform | `frontend/src/features/coordination/coordinationApi.ts` | exact, path-only ownership move |
| `frontend/src/types/coordination.ts` | model/contracts (move or create) | transform | `frontend/src/features/coordination/types.ts` | exact |
| dependency-safe auth/store/permission contracts under `frontend/src/shared/**` | model/hook/middleware | event-driven / request-response | `frontend/src/app/hooks.ts`, `frontend/src/features/auth/logoutSession.ts`, `frontend/src/routes/ActionGuard.tsx` | role-match; final location unresolved |
| `frontend/src/app/layout/MainLayout.tsx` | component/layout (move) | event-driven / request-response | `frontend/src/components/layout/MainLayout.tsx` | exact, path-only move |
| `frontend/src/routes/AppRouter.tsx` | route (modify imports) | request-response | current `AppRouter.tsx` | exact |
| `frontend/src/routes/routeDataPreloaders.ts` | utility (modify imports) | request-response / cache prefetch | current `routeDataPreloaders.ts` | exact |
| Admin panel models under `frontend/src/app/pages/admin-data/**` | hook/page model | request-response / transform / CRUD | `useAdminDataPageModel.ts` panel blocks | exact extraction seam |
| Reports panel models under `frontend/src/features/reports/pages/**` | hook/page model | request-response / transform | `useReportsPageModel.ts` view blocks | exact extraction seam |
| `frontend/src/api/workflowApi.publicSurface.test.ts` | test/characterization | transform / registration | `workflowApi.cacheInvalidation.test.ts` | role-match |
| `frontend/src/api/workflowApi.cacheContract.test.ts` | test/characterization | request-response / cache | `workflowApi.cacheInvalidation.test.ts` | exact |
| `frontend/src/app/layout/MainLayout.ownership.test.tsx` | test/architecture | event-driven / source transform | `coordinationQueryOwnership.test.ts` | role-match |
| `frontend/src/features/projects/weekly-menu/coordinationBoundary.test.ts` | test/architecture | source transform | `weekly-menu/coordinationQueryOwnership.test.ts` | exact |
| `frontend/.dependency-cruiser-known-violations.json` | config/baseline | batch | current baseline with `.dependency-cruiser.cjs` | exact |
| generated `openapi.json` / `schema.ts` | generated contract | batch / transform | generator output only | no hand-edit analog |

Consumer imports across app/features/tests also change as ownership moves. Treat those as mechanical dependency-edge updates, preserving hook names and arguments; do not duplicate endpoint/type definitions at consumers.

## Pattern Assignments

### Feature-owned endpoint modules

**Applies to:** dashboard, reports, purchasing, warehouse, chef, approvals, admin, and optional neutral workflow-documents API modules.

**Primary analog:** `frontend/src/features/admin/adminApi.ts`

**Imports and generated-contract pattern** (lines 1-16):

```ts
import { apiSlice } from '@/api/apiSlice';
import type { components, paths } from '@/shared/api/contracts/schema';
import type { ApiResponse } from '@/types/api';

export type AdminEmployee = components['schemas']['EmployeeDto'];
type GeneratedAdminEmployeeQuery = NonNullable<
  paths['/api/admin/employees']['get']['parameters']['query']
>;
export type AdminEmployeeQuery = {
  [Key in keyof GeneratedAdminEmployeeQuery as Uncapitalize<Key & string>]: GeneratedAdminEmployeeQuery[Key];
};
```

**Single-slice injector and CRUD pattern** (lines 24-63):

```ts
export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdminEmployees: builder.query<ApiResponse<AdminEmployeePage>, AdminEmployeeQuery>({
      query: (params) => ({ url: '/admin/employees', params }),
      providesTags: ['Employee'],
    }),
    createAdminEmployee: builder.mutation<ApiResponse<AdminEmployee>, CreateEmployeeRequest>({
      query: (body) => ({ url: '/admin/employees', method: 'POST', body }),
      invalidatesTags: ['Employee'],
    }),
  }),
  overrideExisting: false,
});
```

**Public hook export pattern** (lines 65-71):

```ts
export const {
  useGetAdminRolesQuery,
  useGetAdminEmployeesQuery,
  useCreateAdminEmployeeMutation,
  useUpdateAdminEmployeeMutation,
  useUpdateAdminEmployeeStatusMutation,
} = adminApi;
```

Copy the endpoint bodies byte-for-byte from `workflowApi.ts`; retain endpoint keys, URL/params/body transforms, tag arrays, and `overrideExisting: false`. Do not add local `try/catch`: transport/session and error normalization remain in the shared `apiSlice` base query.

### Endpoint transforms, file I/O, and cross-domain invalidation

**Applies to:** reports, purchasing, warehouse, chef, and the coordination lower-level boundary.

**Analog:** `frontend/src/features/coordination/coordinationApi.ts`

**Generated request mapping and file-I/O helper** (lines 31-47, 94-105):

```ts
type WeeklyMenuImportWire = NonNullable<
  paths['/api/coordination/weekly-menu/import/preview']['post']['requestBody']
>['content']['multipart/form-data'];

const buildWeeklyMenuImportFormData = ({ file, customerId, weekStartDate, priceTierAmount }: WeeklyMenuImportRequest) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('customerId', customerId);
  if (weekStartDate) formData.append('weekStartDate', weekStartDate);
  if (priceTierAmount) formData.append('priceTierAmount', String(priceTierAmount));
  return formData;
};
```

**Cross-owner cache fan-out** (lines 147-162):

```ts
updateMenuScheduleRules: builder.mutation<ApiResponse<MenuScheduleDto>, { menuScheduleId: string; body: UpdateMenuScheduleRulesRequest }>({
  query: ({ menuScheduleId, body }) => ({
    url: `/coordination/menu-schedules/${menuScheduleId}/rules`,
    method: 'PATCH',
    body,
  }),
  invalidatesTags: [
    'Coordination',
    'MaterialDemandStaleness',
    workflowCacheTags.documents,
    workflowCacheTags.ingredientDemand,
    workflowCacheTags.materialRequestCandidates,
    workflowCacheTags.purchasePlan,
    workflowCacheTags.productionPlans,
  ],
}),
```

**Wire-to-view transform** (lines 202-222):

```ts
getCoordinationOrders: builder.query<ApiResponse<OrderRow[]>, CoordinationQuery>({
  query: ({ dayOfWeek, serviceDate, shift }) => ({
    url: '/coordination/orders',
    params: { dayOfWeek, serviceDate, shiftName: toApiShiftName(shift) },
  }),
  transformResponse: (response: ApiResponse<readonly CoordinationOrderWire[]>) => ({
    ...response,
    data: response.data?.map((order) => ({
      ...order,
      shift: (order.shiftName ? toDisplayShift(order.shiftName) : undefined) ?? order.shift,
      dishes: order.dishes.map((dish) => ({ ...dish })),
    })),
  }),
  providesTags: ['Coordination'],
}),
```

Keep `workflowCacheTags.ts` as the sole workflow tag registry. Shared coordination DTOs move with the API boundary or to `src/types/coordination.ts`; feature presentation types remain private.

### `frontend/src/api/workflowApi.ts` compatibility barrel

**Analog:** no exact compatibility barrel exists. Compose existing injector behavior using the research-approved shape:

```ts
import { apiSlice } from '@/api/apiSlice';
import '@/features/reports/reportsApi';
import '@/features/purchasing/purchasingApi';
// Import each owner injector exactly once in deterministic order.

export const workflowApi = apiSlice;
export * from '@/features/reports/reportsApi';
export * from '@/features/purchasing/purchasingApi';
```

The public-surface test must prove all pre-split endpoint keys and 75 hook exports exist after importing the barrel and that `workflowApi === apiSlice`. Do not retain a second endpoint implementation in this file.

### `frontend/src/app/layout/MainLayout.tsx`

**Analog/source:** `frontend/src/components/layout/MainLayout.tsx` — move without behavioral rewrite.

**App orchestration imports** (lines 1-10):

```tsx
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { ROLE_LABELS, selectCurrentUser } from '../../features/auth';
import { store } from '../../app/store';
import { logoutSession } from '../../features/auth/logoutSession';
import { preloadRoute, preloadRouteData } from '../../routes/routeLoaders';
```

**Permission and preload contract** (lines 75-105):

```tsx
const handleLogout = async () => {
  await logoutSession(dispatch, store.getState);
  navigate(ROUTES.LOGIN, { replace: true });
};
const visibleMenuItems = useMemo(() => menuItems.filter((item) => {
  if (!item.requiredPermissions) return true;
  if (isAdmin) return true;
  return item.requiredPermissions.some((perm) => currentUser?.permissions?.includes(perm));
}), [currentUser?.permissions, isAdmin]);
// Idle loop calls preloadRoute(path).finally(scheduleNextRoute).
```

**Intent preload and DOM contract** (lines 183-207, 271-274):

```tsx
<Link
  to={item.path}
  onPointerEnter={() => preloadNavigationTarget(item.path)}
  onFocus={() => preloadNavigationTarget(item.path)}
  onTouchStart={() => preloadNavigationTarget(item.path)}
  onClick={() => setIsMobileNavOpen(false)}
  aria-current={isActive ? 'page' : undefined}
>
  ...
</Link>
<main id="ipc-main-content" className="ipc-main" tabIndex={-1}>
  <Outlet />
</main>
```

Update `AppRouter.tsx` to the new app path. Preserve menu order, permission filtering, mobile state, idle/data-saver behavior, event handlers, class names, accessibility attributes, and `Outlet` markup.

### Reports panel models

**Analog/source:** `frontend/src/features/reports/pages/useReportsPageModel.ts`

**Stable query-view adapter** (lines 57-60):

```ts
const toReportView = <T,>(query: QuerySnapshot<T> & { refetch: () => unknown }, label: string) => toQueryView(query, {
  instruction: `Mở báo cáo ${label} để tải dữ liệu.`, retry: () => query.refetch(),
  errorMessage: `Không tải được báo cáo ${label}.`, forbiddenMessage: `Bạn không có quyền xem báo cáo ${label}.`,
});
```

**Panel query ownership and skip contract** (lines 217-266):

```ts
const priceVarianceResult = useGetPriceVariancePageQuery({
  ...reportQuery, pageNumber: pricePage, pageSize: pricePageSize,
}, { skip: activeView !== 'price' || priceSubView !== 'lines' });
const currentStockResult = useGetCurrentStockPageQuery({
  ...reportQuery, pageNumber: stockPage, pageSize: stockPageSize,
}, { skip: activeView !== 'stock' });
const auditResult = useGetAuditChangePageQuery({
  ...reportQuery,
  cursorDate: auditCursor?.cursorDate,
  cursorId: auditCursor?.cursorId,
  cursorOffset: auditCursor?.cursorOffset,
  limit: reportPageSize,
  sortDirection,
}, { skip: activeView !== 'audit' });
```

Extract models by existing view groups: price (including four subviews), demand/purchase, stock/movement, kitchen/usage, audit/data-quality. The composition hook must preserve the current returned property names (return object begins at line 491), URL/pagination state, cursor behavior, and unconditional hook ordering.

### Admin panel models

**Analog/source:** `frontend/src/app/pages/admin-data/useAdminDataPageModel.ts`

**Shared view-state semantics** (lines 15-20):

```ts
const EMPTY_ADMIN_LIST: never[] = [];
const toAdminView = <T,>(query: QuerySnapshot<T> & { refetch: () => unknown }, label: string) => toQueryView(query, {
  instruction: `Mở mục ${label} để tải dữ liệu.`, retry: () => query.refetch(),
  errorMessage: `Không tải được ${label}.`, forbiddenMessage: `Bạn không có quyền xem ${label}.`,
});
```

**BOM/contracts extraction seam** (lines 71-110):

```ts
const isBomView = activeView === 'bom-import';
const isContractView = activeView === 'contracts';
const dishCatalogQuery = useGetAdminDishCatalogQuery(undefined, { skip: !isBomView });
const customerContractsQuery = useGetCustomerContractsQuery(undefined, { skip: !isContractView && !isBomView });
const menuSchedulesQuery = useGetMenuSchedulesQuery(
  { customerId: selectedContract?.customerId, serviceDate: selectedContract?.latestServiceDate ?? undefined },
  { skip: !isContractView || !selectedContract?.customerId },
);
```

**Inventory/statistics/employees extraction seam** (lines 178-244):

```ts
const dataQualityQuery = useGetDataQualityPageQuery(
  { pageNumber: qualityPage, pageSize: 8, serviceDate: operationalDate },
  { skip: !isCleanupView },
);
const currentStockQuery = useGetCurrentStockPageQuery(
  { pageNumber: currentStockPage, pageSize: 8 },
  { skip: !isInventoryView && !isStatisticsView },
);
const employeesQuery = useGetAdminEmployeesQuery(employeeQuery, {
  skip: !canManageEmployees || activeView !== 'employees',
});
```

Extract BOM, contracts/schedules, cleanup/data-quality, inventory, statistics, audit, and employees independently, then compose the unchanged public model. Preserve mutation timing/toasts and the exact `skip`, args, `QueryView` conversions, permissions, and stale-data behavior.

### Characterization and boundary tests

**Cache/public registration analog:** `frontend/src/api/workflowApi.cacheInvalidation.test.ts`

**One-slice identity setup** (lines 4-12):

```ts
import { workflowApi } from '@/api/workflowApi';
const createWorkflowApiStore = () => configureStore({
  reducer: { [workflowApi.reducerPath]: workflowApi.reducer, auth: (state = { token: null }) => state },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(workflowApi.middleware),
});
```

**Cache fan-out assertion** (lines 78-108): subscribe through `workflowApi.endpoints.*.initiate()`, dispatch the mutation, wait for refetches, and assert the exact request paths and pending-query count. Extend this style for deterministic endpoint-name/tag descriptors; do not replace behavioral cache checks with implementation snapshots only.

**Raw-source architecture analog:** `frontend/src/features/projects/weekly-menu/coordinationQueryOwnership.test.ts` (lines 1-24):

```ts
import weeklyMenuSource from '../pages/WeeklyMenuPage.tsx?raw';
import productionModelSource from './production-plan/useWeeklyProductionPlan.ts?raw';
const queryOwners = [weeklyMenuSource, productionModelSource, importModelSource].join('\n');

it('uses common presentation boundaries without adding a feature-to-feature import', () => {
  expect(weeklyMenuSource).toContain('<QueryViewBoundary preserveFallback');
  expect(importHistorySource).toContain('<QueryViewBoundary');
});
```

Use `?raw` ownership tests to assert no `features/coordination` import remains in projects and that `AppRouter` imports `MainLayout` from `@/app/layout`. Behavioral component tests remain necessary for navigation and query state.

## Shared Patterns

### Authentication and authorization

**Sources:** `frontend/src/api/apiSlice.ts`, `frontend/src/features/auth/logoutSession.ts`, `frontend/src/routes/ActionGuard.tsx`, and current `MainLayout.tsx` lines 75-85.

Apply the existing base-query refresh/session pipeline to every endpoint by injecting into `apiSlice`; never create another `createApi`. Preserve server permissions, `*`/admin handling, forbidden QueryView behavior, logout navigation, and action eligibility. Dependency cleanup may move contracts downward but must not change semantics.

### Error and query-state handling

**Sources:** `useReportsPageModel.ts` lines 57-60 and `useAdminDataPageModel.ts` lines 15-20.

Endpoint modules declaratively return query configurations. UI/page models convert RTK Query snapshots with `toQueryView`, preserve retry only for retryable errors, and keep forbidden/uninitialized/loading/refreshing/ready distinctions. Mutation handlers retain existing toast/error mapping.

### Cache identity and invalidation

**Sources:** `frontend/src/api/workflowCacheTags.ts`, `coordinationApi.ts` lines 147-162, and `workflowApi.cacheInvalidation.test.ts` lines 78-108.

Endpoint name + args remain cache identity. Copy `providesTags`/`invalidatesTags` exactly, keep the central registry, and verify exact refetch fan-out after every owner slice.

### Imports and dependency direction

Use the existing `@/` alias for stable cross-directory imports. App/routes may compose features; features import shared API/types/contracts, never app/routes or sibling feature internals. Do not weaken R1-R6 or expand the known baseline. Remove baseline entries only as their edges disappear, reaching zero.

### Verification

Colocate Vitest characterization/model tests; retain generated OpenAPI types and run the deterministic contract gate. Layout/navigation changes additionally use existing route smoke, `cache-navigation.spec.ts`, and `navigation-performance.spec.ts`, followed at phase closeout by the required headed real-lane three-viewport evidence. No database reset/seed/import/mutation is part of this phase.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `frontend/src/api/workflowApi.ts` compatibility-only barrel | compatibility barrel | registration | No current multi-injector compatibility barrel; use the explicit research pattern and prove evaluation order with the new public-surface test. |
| final dependency-safe shared auth/store/permission file(s) | hook/model/middleware | event-driven | Research intentionally leaves exact placement unresolved. Planner must choose a downward boundary that satisfies unchanged R1-R6, then characterize auth refresh/logout and permission behavior. |

## Metadata

**Analog search scope:** `frontend/src/api`, `frontend/src/features`, `frontend/src/app`, `frontend/src/components/layout`, `frontend/src/routes`, and frontend unit/browser tests.

**Files scanned:** phase context/research plus relevant endpoint, layout, page-model, dependency, and characterization sources; analog search stopped after five strong pattern families.

**GitNexus:** index refreshed on 2026-07-29 to current commit `6dc0aa7`; graph reports 10,681 nodes, 29,447 edges, 300 flows. Query confirmed the workflow endpoint definition at `workflowApi.ts:985-1940`, existing injectors (`adminApi.ts`, `authApi.ts`), and layout integration with `AppRouter`, route loaders, cache-navigation, and navigation-performance tests.

**Pattern extraction date:** 2026-07-29
