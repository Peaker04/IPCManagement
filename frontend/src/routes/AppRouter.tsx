import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routeConfig';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { MainLayout } from '@/app/layout/MainLayout';
import { SystemOperationProvider } from '@/app/providers/SystemOperationProvider';
import { ModeGuard } from '@/features/system-operation/ModeGuard';
import { RouteDocumentTitle } from './RouteDocumentTitle';
import { routeRegistry } from './routeRegistry';
import {
  AdminDataPage,
  ApprovalPage,
  ApprovalRulesPage,
  AdvancedDisplaySettingsPage,
  ChefDashboardPage,
  CoordinationPage,
  DashboardPage,
  PurchasingPage,
  ReportsPage,
  ReconciliationPage,
  WarehousePage,
  WeeklyMenuPage,
} from './routeLoaders';

// The timeout dialog is only meaningful after the protected shell mounts.
// Keep its Base UI dialog/floating-ui dependency out of the initial auth/router entry.
const SessionTimeoutModal = lazy(() => import('../features/auth/components/SessionTimeoutModal').then(({ SessionTimeoutModal }) => ({ default: SessionTimeoutModal })));
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const ForbiddenPage = lazy(() => import('../features/auth/pages/ForbiddenPage'));
const planningPreviewEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_KIT_PREVIEW === 'true';
const SchedulePreviewPage = planningPreviewEnabled
  ? lazy(() => import('../features/planning/schedule/SchedulePreviewPage'))
  : null;

const routeFallback = (
  <section
    aria-busy="true"
    aria-live="polite"
    className="ipc-operational-frame"
  >
    <span className="sr-only">Đang tải màn hình...</span>
    <div aria-hidden="true" className="ipc-operational-head space-y-2 motion-reduce:animate-none">
      <div className="h-12 w-full animate-pulse rounded-md border border-slate-200 bg-slate-50/80" />
      <div className="h-9 w-full animate-pulse rounded-md border border-slate-200 bg-slate-50/60" />
    </div>
    <div aria-hidden="true" className="ipc-operational-body space-y-3 motion-reduce:animate-none">
      <div className="h-10 w-72 animate-pulse rounded-md bg-slate-100" />
      <div className="min-h-[380px] rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <div className="h-9 w-full animate-pulse rounded bg-slate-100" />
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`route-fallback-row-${index}`} className="h-10 w-full animate-pulse rounded bg-slate-50" />
          ))}
        </div>
      </div>
    </div>
  </section>
);

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <RouteDocumentTitle />
      <Suspense fallback={null}>
        <SessionTimeoutModal />
      </Suspense>
      <Routes>
        {/* Public Routes */}
        <Route path={ROUTES.LOGIN} element={<Suspense fallback={routeFallback}><LoginPage /></Suspense>} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          {planningPreviewEnabled && SchedulePreviewPage && (
            <>
              <Route path="/__kit/planning/schedule" element={<RoleGuard requiredPermissions={routeRegistry[ROUTES.WEEKLY_MENU].requiredPermissions!}><SystemOperationProvider><Suspense fallback={routeFallback}><SchedulePreviewPage /></Suspense></SystemOperationProvider></RoleGuard>} />
              <Route path="/__kit/planning/demand" element={<RoleGuard requiredPermissions={routeRegistry[ROUTES.WEEKLY_MENU].requiredPermissions!}><SystemOperationProvider><Suspense fallback={routeFallback}><SchedulePreviewPage /></Suspense></SystemOperationProvider></RoleGuard>} />
            </>
          )}
          <Route element={<MainLayout />}>
            <Route path={ROUTES.FORBIDDEN} element={<Suspense fallback={routeFallback}><ForbiddenPage /></Suspense>} />
            <Route path={ROUTES.DASHBOARD} element={<Suspense fallback={routeFallback}><DashboardPage /></Suspense>} />
            <Route path={ROUTES.WEEKLY_MENU} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.WEEKLY_MENU].requiredPermissions!}><Suspense fallback={routeFallback}><WeeklyMenuPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.REPORTS} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.REPORTS].requiredPermissions!}><Suspense fallback={routeFallback}><ReportsPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.MEAL_ORDERS} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.MEAL_ORDERS].requiredPermissions!}><Suspense fallback={routeFallback}><CoordinationPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.CHEF_DASHBOARD} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.CHEF_DASHBOARD].requiredPermissions!}><Suspense fallback={routeFallback}><ChefDashboardPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.APPROVALS} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.APPROVALS].requiredPermissions!}><Suspense fallback={routeFallback}><ApprovalPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.PURCHASING} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.PURCHASING].requiredPermissions!}><Suspense fallback={routeFallback}><PurchasingPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.WAREHOUSE} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.WAREHOUSE].requiredPermissions!}><Suspense fallback={routeFallback}><WarehousePage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.RECONCILIATION} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.RECONCILIATION].requiredPermissions!}><Suspense fallback={routeFallback}><ReconciliationPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.ADMIN_DATA} element={<RoleGuard requiredPermissions={routeRegistry[ROUTES.ADMIN_DATA].requiredPermissions!}><Suspense fallback={routeFallback}><AdminDataPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.APPROVAL_RULES} element={<ModeGuard><RoleGuard requiredPermissions={routeRegistry[ROUTES.APPROVAL_RULES].requiredPermissions!}><Suspense fallback={routeFallback}><ApprovalRulesPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.ADVANCED_SETTINGS} element={<RoleGuard requiredPermissions={routeRegistry[ROUTES.ADVANCED_SETTINGS].requiredPermissions!}><Suspense fallback={routeFallback}><AdvancedDisplaySettingsPage /></Suspense></RoleGuard>} />
          </Route>
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
