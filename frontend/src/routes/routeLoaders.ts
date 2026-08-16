import { createElement, lazy, type ComponentType } from 'react';
import { ROUTES } from '@/lib/routeConfig';

type PageModule = { default: ComponentType };

function createPreloadableRoute(importer: () => Promise<PageModule>) {
  let modulePromise: Promise<PageModule> | undefined;
  let resolvedComponent: ComponentType | undefined;
  const load = () => {
    modulePromise ??= importer()
      .then((module) => {
        resolvedComponent = module.default;
        return module;
      })
      .catch((error) => {
        modulePromise = undefined;
        resolvedComponent = undefined;
        throw error;
      });
    return modulePromise;
  };
  const LazyComponent = lazy(load);
  const Component = () => createElement(resolvedComponent ?? LazyComponent);

  return {
    Component,
    preload: () => load().then(() => undefined, () => undefined),
  };
}

const dashboardRoute = createPreloadableRoute(() => import('../features/dashboard/pages/DashboardPage'));
const weeklyMenuRoute = createPreloadableRoute(() => import('../features/projects/pages/WeeklyMenuPage'));
const reportsRoute = createPreloadableRoute(() => import('../features/reports/pages/ReportsPage'));
const coordinationRoute = createPreloadableRoute(() => import('../features/coordination/pages/CoordinationPage'));
const chefDashboardRoute = createPreloadableRoute(() => import('../features/chef/pages/ChefDashboardPage'));
const approvalRoute = createPreloadableRoute(() => import('../features/approvals/pages/ApprovalPage'));
const purchasingRoute = createPreloadableRoute(() => import('../features/purchasing/pages/PurchasingPage'));
const warehouseRoute = createPreloadableRoute(() => import('../features/warehouse/pages/WarehousePage'));
const adminDataRoute = createPreloadableRoute(() => import('../app/pages/AdminDataPage'));
const approvalRulesRoute = createPreloadableRoute(() => import('../features/admin/pages/ApprovalRulesPage'));
const advancedSettingsRoute = createPreloadableRoute(() => import('../features/admin/pages/AdvancedDisplaySettingsPage'));

export const DashboardPage = dashboardRoute.Component;
export const WeeklyMenuPage = weeklyMenuRoute.Component;
export const ReportsPage = reportsRoute.Component;
export const CoordinationPage = coordinationRoute.Component;
export const ChefDashboardPage = chefDashboardRoute.Component;
export const ApprovalPage = approvalRoute.Component;
export const PurchasingPage = purchasingRoute.Component;
export const WarehousePage = warehouseRoute.Component;
export const AdminDataPage = adminDataRoute.Component;
export const ApprovalRulesPage = approvalRulesRoute.Component;
export const AdvancedDisplaySettingsPage = advancedSettingsRoute.Component;

const routePreloaders: Partial<Record<string, () => Promise<void>>> = {
  [ROUTES.DASHBOARD]: dashboardRoute.preload,
  [ROUTES.WEEKLY_MENU]: weeklyMenuRoute.preload,
  [ROUTES.REPORTS]: reportsRoute.preload,
  [ROUTES.MEAL_ORDERS]: coordinationRoute.preload,
  [ROUTES.CHEF_DASHBOARD]: chefDashboardRoute.preload,
  [ROUTES.APPROVALS]: approvalRoute.preload,
  [ROUTES.PURCHASING]: purchasingRoute.preload,
  [ROUTES.WAREHOUSE]: warehouseRoute.preload,
  [ROUTES.ADMIN_DATA]: adminDataRoute.preload,
  [ROUTES.APPROVAL_RULES]: approvalRulesRoute.preload,
  [ROUTES.ADVANCED_SETTINGS]: advancedSettingsRoute.preload,
};

export function preloadRoute(path: string): Promise<void> {
  return routePreloaders[path]?.() ?? Promise.resolve();
}

export async function preloadRouteData(path: string): Promise<void> {
  try {
    const { prefetchRouteData } = await import('./routeDataPreloaders');
    await prefetchRouteData(path);
  } catch {
    // Intent prefetch is best-effort; normal route queries remain the fallback.
  }
}
