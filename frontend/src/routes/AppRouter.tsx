import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/lib/routeConfig';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { MainLayout } from '@/app/layout/MainLayout';
import { SystemOperationProvider } from '@/features/system-operation/SystemOperationProvider';
import { ModeGuard } from '@/features/system-operation/ModeGuard';
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
  WarehousePage,
  WeeklyMenuPage,
} from './routeLoaders';

// The timeout dialog is only meaningful after the protected shell mounts.
// Keep its Base UI dialog/floating-ui dependency out of the initial auth/router entry.
const SessionTimeoutModal = lazy(() => import('../features/auth/components/SessionTimeoutModal').then(({ SessionTimeoutModal }) => ({ default: SessionTimeoutModal })));
const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const ForbiddenPage = lazy(() => import('../features/auth/pages/ForbiddenPage'));

const routeFallback = (
  <section
    aria-busy="true"
    aria-live="polite"
    className="ipc-operational-frame min-h-[580px]"
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
      <Suspense fallback={null}>
        <SessionTimeoutModal />
      </Suspense>
      <Routes>
        {/* Public Routes */}
        <Route path={ROUTES.LOGIN} element={<Suspense fallback={routeFallback}><LoginPage /></Suspense>} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<SystemOperationProvider><MainLayout /></SystemOperationProvider>}>
            <Route path={ROUTES.FORBIDDEN} element={<Suspense fallback={routeFallback}><ForbiddenPage /></Suspense>} />
            <Route path={ROUTES.DASHBOARD} element={<Suspense fallback={routeFallback}><DashboardPage /></Suspense>} />
            <Route path={ROUTES.WEEKLY_MENU} element={<ModeGuard><RoleGuard requiredPermissions={['coordination.read']}><Suspense fallback={routeFallback}><WeeklyMenuPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.REPORTS} element={<ModeGuard><RoleGuard requiredPermissions={['report.read']}><Suspense fallback={routeFallback}><ReportsPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.MEAL_ORDERS} element={<ModeGuard><RoleGuard requiredPermissions={['coordination.read']}><Suspense fallback={routeFallback}><CoordinationPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.CHEF_DASHBOARD} element={<ModeGuard><RoleGuard requiredPermissions={['production.read']}><Suspense fallback={routeFallback}><ChefDashboardPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.APPROVALS} element={<ModeGuard><RoleGuard requiredPermissions={['purchase.request.approve']}><Suspense fallback={routeFallback}><ApprovalPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.PURCHASING} element={<RoleGuard requiredPermissions={['purchase.read']}><Suspense fallback={routeFallback}><PurchasingPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.WAREHOUSE} element={<RoleGuard requiredPermissions={['warehouse.read']}><Suspense fallback={routeFallback}><WarehousePage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.ADMIN_DATA} element={<RoleGuard requiredPermissions={['*']}><Suspense fallback={routeFallback}><AdminDataPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.APPROVAL_RULES} element={<ModeGuard><RoleGuard requiredPermissions={['*']}><Suspense fallback={routeFallback}><ApprovalRulesPage /></Suspense></RoleGuard></ModeGuard>} />
            <Route path={ROUTES.ADVANCED_SETTINGS} element={<RoleGuard requiredPermissions={['*']}><Suspense fallback={routeFallback}><AdvancedDisplaySettingsPage /></Suspense></RoleGuard>} />
          </Route>
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
