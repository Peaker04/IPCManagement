import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routeConfig';
import { ProtectedRoute } from './ProtectedRoute';
import { MainLayout } from '../components/layout/MainLayout';
import LoginPage from '../features/auth/pages/LoginPage';

const DashboardPage = lazy(() => import('../features/dashboard/pages/DashboardPage'));
const WeeklyMenuPage = lazy(() => import('../features/projects/pages/WeeklyMenuPage'));
const ReportsPage = lazy(() => import('../features/reports/pages/ReportsPage'));
const CoordinationPage = lazy(() => import('../features/coordination/pages/CoordinationPage'));
const ChefDashboardPage = lazy(() => import('../features/chef/pages/ChefDashboardPage'));
const ApprovalPage = lazy(() => import('../features/workflow/pages/ApprovalPage'));
const PurchasingPage = lazy(() => import('../features/workflow/pages/PurchasingPage'));
const WarehousePage = lazy(() => import('../features/workflow/pages/WarehousePage'));
const AdminDataPage = lazy(() => import('../features/workflow/pages/AdminDataPage'));

const routeFallback = (
  <div className="flex min-h-[240px] items-center justify-center text-sm font-medium text-slate-500">
    Đang tải màn hình...
  </div>
);

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<Suspense fallback={routeFallback}><DashboardPage /></Suspense>} />
            <Route path={ROUTES.WEEKLY_MENU} element={<Suspense fallback={routeFallback}><WeeklyMenuPage /></Suspense>} />
            <Route path={ROUTES.REPORTS} element={<Suspense fallback={routeFallback}><ReportsPage /></Suspense>} />
            <Route path={ROUTES.MEAL_ORDERS} element={<Suspense fallback={routeFallback}><CoordinationPage /></Suspense>} />
            <Route path={ROUTES.CHEF_DASHBOARD} element={<Suspense fallback={routeFallback}><ChefDashboardPage /></Suspense>} />
            <Route path={ROUTES.APPROVALS} element={<Suspense fallback={routeFallback}><ApprovalPage /></Suspense>} />
            <Route path={ROUTES.PURCHASING} element={<Suspense fallback={routeFallback}><PurchasingPage /></Suspense>} />
            <Route path={ROUTES.WAREHOUSE} element={<Suspense fallback={routeFallback}><WarehousePage /></Suspense>} />
            <Route path={ROUTES.ADMIN_DATA} element={<Suspense fallback={routeFallback}><AdminDataPage /></Suspense>} />
          </Route>
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
