import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routeConfig';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { MainLayout } from '../components/layout/MainLayout';
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
            {/* Trang 403 — hiển thị bên trong layout (có sidebar/header) */}
            <Route path={ROUTES.FORBIDDEN} element={<ForbiddenPage />} />

            {/* Dashboard — tất cả role đều vào được */}
            <Route
              path={ROUTES.DASHBOARD}
              element={<Suspense fallback={routeFallback}><DashboardPage /></Suspense>}
            />

            {/* Thực đơn tuần — quản lý, điều phối */}
            <Route
              path={ROUTES.WEEKLY_MENU}
              element={
                <RoleGuard allowedRoles={['quanly', 'dieuphoi']}>
                  <Suspense fallback={routeFallback}><WeeklyMenuPage /></Suspense>
                </RoleGuard>
              }
            />

            {/* Điều phối đơn — điều phối */}
            <Route
              path={ROUTES.MEAL_ORDERS}
              element={
                <RoleGuard allowedRoles={['dieuphoi']}>
                  <Suspense fallback={routeFallback}><CoordinationPage /></Suspense>
                </RoleGuard>
              }
            />

            {/* Duyệt vận hành — quản lý */}
            <Route
              path={ROUTES.APPROVALS}
              element={
                <RoleGuard allowedRoles={['quanly']}>
                  <Suspense fallback={routeFallback}><ApprovalPage /></Suspense>
                </RoleGuard>
              }
            />

            {/* Thu mua — thu mua */}
            <Route
              path={ROUTES.PURCHASING}
              element={
                <RoleGuard allowedRoles={['thumua']}>
                  <Suspense fallback={routeFallback}><PurchasingPage /></Suspense>
                </RoleGuard>
              }
            />

            {/* Kho nguyên liệu — thủ kho */}
            <Route
              path={ROUTES.WAREHOUSE}
              element={
                <RoleGuard allowedRoles={['thukho']}>
                  <Suspense fallback={routeFallback}><WarehousePage /></Suspense>
                </RoleGuard>
              }
            />

            {/* Bếp trưởng — bếp trưởng */}
            <Route
              path={ROUTES.CHEF_DASHBOARD}
              element={
                <RoleGuard allowedRoles={['beptruong']}>
                  <Suspense fallback={routeFallback}><ChefDashboardPage /></Suspense>
                </RoleGuard>
              }
            />

            {/* Báo cáo / biến động giá — quản lý */}
            <Route
              path={ROUTES.REPORTS}
              element={
                <RoleGuard allowedRoles={['quanly']}>
                  <Suspense fallback={routeFallback}><ReportsPage /></Suspense>
                </RoleGuard>
              }
            />

            {/* Quản trị dữ liệu — admin only */}
            <Route
              path={ROUTES.ADMIN_DATA}
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Suspense fallback={routeFallback}><AdminDataPage /></Suspense>
                </RoleGuard>
              }
            />
          </Route>
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
