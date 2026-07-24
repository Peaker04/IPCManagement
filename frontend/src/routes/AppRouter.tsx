import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routeConfig';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { MainLayout } from '../components/layout/MainLayout';
import { SessionTimeoutModal } from '../features/auth/components/SessionTimeoutModal';
import LoginPage from '../features/auth/pages/LoginPage';
import ForbiddenPage from '../features/auth/pages/ForbiddenPage';
import {
  AdminDataPage,
  ApprovalPage,
  ApprovalRulesPage,
  ChefDashboardPage,
  CoordinationPage,
  DashboardPage,
  PurchasingPage,
  ReportsPage,
  WarehousePage,
  WeeklyMenuPage,
} from './routeLoaders';

const routeFallback = (
  <section
    aria-busy="true"
    aria-live="polite"
    className="min-h-[560px] overflow-hidden rounded-lg border border-slate-200 bg-white p-5"
  >
    <span className="sr-only">Đang tải màn hình...</span>
    <div aria-hidden="true" className="space-y-4 motion-reduce:animate-none">
      <div className="h-10 w-full animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="h-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        <div className="h-20 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
      </div>
      <div className="h-[380px] animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
    </div>
  </section>
);

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <SessionTimeoutModal />
      <Routes>
        {/* Public Routes */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path={ROUTES.FORBIDDEN} element={<ForbiddenPage />} />
            <Route path={ROUTES.DASHBOARD} element={<Suspense fallback={routeFallback}><DashboardPage /></Suspense>} />
            <Route path={ROUTES.WEEKLY_MENU} element={<RoleGuard requiredPermissions={['coordination.read']}><Suspense fallback={routeFallback}><WeeklyMenuPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.REPORTS} element={<RoleGuard requiredPermissions={['report.read']}><Suspense fallback={routeFallback}><ReportsPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.MEAL_ORDERS} element={<RoleGuard requiredPermissions={['coordination.read']}><Suspense fallback={routeFallback}><CoordinationPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.CHEF_DASHBOARD} element={<RoleGuard requiredPermissions={['production.read']}><Suspense fallback={routeFallback}><ChefDashboardPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.APPROVALS} element={<RoleGuard requiredPermissions={['purchase.request.approve']}><Suspense fallback={routeFallback}><ApprovalPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.PURCHASING} element={<RoleGuard requiredPermissions={['purchase.read']}><Suspense fallback={routeFallback}><PurchasingPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.WAREHOUSE} element={<RoleGuard requiredPermissions={['warehouse.read']}><Suspense fallback={routeFallback}><WarehousePage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.ADMIN_DATA} element={<RoleGuard requiredPermissions={['*']}><Suspense fallback={routeFallback}><AdminDataPage /></Suspense></RoleGuard>} />
            <Route path={ROUTES.APPROVAL_RULES} element={<RoleGuard requiredPermissions={['*']}><Suspense fallback={routeFallback}><ApprovalRulesPage /></Suspense></RoleGuard>} />
          </Route>
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
