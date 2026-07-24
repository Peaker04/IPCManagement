import { store } from '../app/store';
import { ROUTES } from './routeConfig';

const dataPrefetchOptions = { ifOlderThan: 5 * 60 } as const;

const routeDataPreloaders: Partial<Record<string, () => Promise<void>>> = {
  [ROUTES.DASHBOARD]: async () => {
    const { workflowApi } = await import('../features/workflow/workflowApi');
    store.dispatch(workflowApi.util.prefetch('getWorkflowDocuments', { limit: 100 }, dataPrefetchOptions));
    store.dispatch(workflowApi.util.prefetch('getIngredientDemand', { limit: 100 }, dataPrefetchOptions));
    store.dispatch(workflowApi.util.prefetch('getPriceVariance', { limit: 100 }, dataPrefetchOptions));
    store.dispatch(workflowApi.util.prefetch('getStockMovements', { limit: 100 }, dataPrefetchOptions));
    store.dispatch(workflowApi.util.prefetch('getOperationalKpis', undefined, dataPrefetchOptions));
  },
  [ROUTES.WEEKLY_MENU]: async () => {
    const [{ coordinationApi }, { dishCatalogApi }] = await Promise.all([
      import('../features/coordination/coordinationApi'),
      import('../features/projects/dishCatalogApi'),
    ]);
    store.dispatch(dishCatalogApi.util.prefetch('getDishCatalog', undefined, dataPrefetchOptions));
    store.dispatch(coordinationApi.util.prefetch('getCoordinationCustomers', undefined, dataPrefetchOptions));
    store.dispatch(coordinationApi.util.prefetch('getCustomerContracts', undefined, dataPrefetchOptions));
    store.dispatch(coordinationApi.util.prefetch('getWeeklyMenuImportHistory', undefined, dataPrefetchOptions));
  },
  [ROUTES.REPORTS]: async () => {
    const { workflowApi } = await import('../features/workflow/workflowApi');
    store.dispatch(workflowApi.util.prefetch('getPriceVariancePage', {
      limit: 20,
      pageNumber: 1,
      pageSize: 6,
    }, dataPrefetchOptions));
  },
  [ROUTES.MEAL_ORDERS]: async () => {
    const { coordinationApi } = await import('../features/coordination/coordinationApi');
    const { currentDayOfWeek, currentShift } = store.getState().coordination;
    const shiftName = currentShift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON';
    store.dispatch(coordinationApi.util.prefetch('getCoordinationOrders', {
      dayOfWeek: currentDayOfWeek,
      shift: currentShift,
    }, dataPrefetchOptions));
    store.dispatch(coordinationApi.util.prefetch('getMenuSchedules', {
      dayOfWeek: currentDayOfWeek,
      shiftName,
    }, dataPrefetchOptions));
    store.dispatch(coordinationApi.util.prefetch('getMealQuantityPlans', {
      dayOfWeek: currentDayOfWeek,
      shiftName,
    }, dataPrefetchOptions));
  },
  [ROUTES.APPROVALS]: async () => {
    const { workflowApi } = await import('../features/workflow/workflowApi');
    store.dispatch(workflowApi.util.prefetch('getApprovalRecords', { limit: 20 }, dataPrefetchOptions));
    store.dispatch(workflowApi.util.prefetch('getWorkflowDocuments', { limit: 20 }, dataPrefetchOptions));
    store.dispatch(workflowApi.util.prefetch('getPurchaseRequestsPage', {
      pageNumber: 1,
      pageSize: 8,
    }, dataPrefetchOptions));
  },
  [ROUTES.PURCHASING]: async () => {
    const [{ workflowApi }, { resolvePurchasingRouteState }] = await Promise.all([
      import('../features/workflow/workflowApi'),
      import('../features/workflow/purchasing/purchasingModel'),
    ]);
    const { week } = resolvePurchasingRouteState({}, []);
    store.dispatch(workflowApi.util.prefetch('getPurchaseWorkbench', {
      week,
      page: 1,
      pageSize: 8,
    }, dataPrefetchOptions));
  },
  [ROUTES.WAREHOUSE]: async () => {
    const { workflowApi } = await import('../features/workflow/workflowApi');
    store.dispatch(workflowApi.util.prefetch('getPurchaseOrdersPage', {
      pageNumber: 1,
      pageSize: 8,
    }, dataPrefetchOptions));
    store.dispatch(workflowApi.util.prefetch('getWarehouseSelector', undefined, dataPrefetchOptions));
    store.dispatch(workflowApi.util.prefetch('getWorkflowDocuments', { limit: 20 }, dataPrefetchOptions));
  },
  [ROUTES.APPROVAL_RULES]: async () => {
    const [{ workflowApi }, { adminApi }] = await Promise.all([
      import('../features/workflow/workflowApi'),
      import('../features/admin/adminApi'),
    ]);
    store.dispatch(workflowApi.util.prefetch('getApprovalRules', undefined, dataPrefetchOptions));
    store.dispatch(adminApi.util.prefetch('getAdminRoles', undefined, dataPrefetchOptions));
    store.dispatch(adminApi.util.prefetch('getAdminEmployees', {
      pageNumber: 1,
      pageSize: 200,
    }, dataPrefetchOptions));
  },
};

export function prefetchRouteData(path: string): Promise<void> {
  return routeDataPreloaders[path]?.() ?? Promise.resolve();
}
