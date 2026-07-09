import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routeConfig';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { MainLayout } from '../components/layout/MainLayout';
import { SessionTimeoutModal } from '../features/auth/components/SessionTimeoutModal';
import LoginPage from '../features/auth/pages/LoginPage';
import ForbiddenPage from '../features/auth/pages/ForbiddenPage';

const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const WeeklyMenuPage = lazy(() => import('../features/projects/pages/WeeklyMenuPage'));
const ReportsPage = lazy(() => import('../features/reports/pages/ReportsPage'));
const CoordinationPage = lazy(() => import('../features/coordination/pages/CoordinationPage'));
const ChefDashboardPage = lazy(() => import('../features/chef/pages/ChefDashboardPage'));
const ApprovalPage = lazy(() => import('../features/workflow/pages/ApprovalPage'));
const PurchasingPage = lazy(() => import('../features/workflow/pages/PurchasingPage'));
const WarehousePage = lazy(() => import('../features/workflow/pages/WarehousePage'));
const AdminDataPage = lazy(() => import('../features/workflow/pages/AdminDataPage'));
const ApprovalRulesPage = lazy(() => import('../features/workflow/pages/ApprovalRulesPage'));

const routeFallback = (
  <div className="flex min-h-[240px] items-center justify-center text-sm font-medium text-slate-500">
    Đang tải màn hình...
  </div>
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
