import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from './routeConfig';
import { ProtectedRoute } from './ProtectedRoute';
import { MainLayout } from '../components/layout/MainLayout';
import LoginPage from '../features/auth/pages/LoginPage';
import DashboardPage from '../features/dashboard/pages/DashboardPage';
import WeeklyMenuPage from '../features/projects/pages/WeeklyMenuPage';
import ReportsPage from '../features/reports/pages/ReportsPage';
import CoordinationPage from '../features/coordination/pages/CoordinationPage';
import ChefDashboardPage from '../features/chef/pages/ChefDashboardPage';
import ApprovalPage from '../features/workflow/pages/ApprovalPage';
import PurchasingPage from '../features/workflow/pages/PurchasingPage';
import WarehousePage from '../features/workflow/pages/WarehousePage';
import AdminDataPage from '../features/workflow/pages/AdminDataPage';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.WEEKLY_MENU} element={<WeeklyMenuPage />} />
            <Route path={ROUTES.REPORTS} element={<ReportsPage />} />
            <Route path={ROUTES.MEAL_ORDERS} element={<CoordinationPage />} />
            <Route path={ROUTES.CHEF_DASHBOARD} element={<ChefDashboardPage />} />
            <Route path={ROUTES.APPROVALS} element={<ApprovalPage />} />
            <Route path={ROUTES.PURCHASING} element={<PurchasingPage />} />
            <Route path={ROUTES.WAREHOUSE} element={<WarehousePage />} />
            <Route path={ROUTES.ADMIN_DATA} element={<AdminDataPage />} />
          </Route>
        </Route>

        {/* Fallback Redirect */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </BrowserRouter>
  );
};
