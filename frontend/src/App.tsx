import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/authContext';
import { useAuth } from './store/useAuth';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppShell } from './components/workbench/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { ForbiddenPage } from './features/auth/ForbiddenPage';
import { CANONICAL_ROUTES } from './routes/routeRegistry';
import { resolveEligibleNavigation, resolveLandingPath } from './routes/navigationEligibility';
import { DirtyNavigationProvider } from './components/workbench/DirtyNavigation';
import { RoleGuard } from './routes/RoleGuard';

import { DashboardPage } from './features/dashboard/DashboardPage';
import { ReconciliationDashboardPage } from './features/dashboard/ReconciliationDashboardPage';
import { WeeklyMenuPage } from './features/weekly-menu/WeeklyMenuPage';
import { MealOrdersPage } from './features/coordination/MealOrdersPage';
import { ChefDashboardPage } from './features/chef/ChefDashboardPage';
import { PurchasingPage } from './features/purchasing/PurchasingPage';
import { WarehousePage } from './features/warehouse/WarehousePage';
import { ApprovalPage } from './features/approvals/ApprovalPage';
import { ReconciliationPage } from './features/reconciliation/ReconciliationPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AdminDataPage } from './features/admin/AdminDataPage';
import { ApprovalRulesPage } from './features/admin/ApprovalRulesPage';
import { AdvancedSettingsPage } from './features/admin/AdvancedSettingsPage';

const getRouteRoles = (path: string) => CANONICAL_ROUTES.find((r) => r.path === path)?.allowedRoles;

function RootLandingRoute() {
  const { operationalMode } = useAuth();
  if (operationalMode === 'MATERIAL_RECONCILIATION') {
    return <ReconciliationDashboardPage />;
  }
  return (
    <RoleGuard roles={getRouteRoles('/')}>
      <DashboardPage />
    </RoleGuard>
  );
}

function AuthorizedAppShell() {
  const { user, operationalMode } = useAuth();
  const eligibleRoutes = resolveEligibleNavigation(
    CANONICAL_ROUTES,
    user ?? {},
    operationalMode
  );
  return <AppShell navigation={eligibleRoutes} homePath="/" />;
}

export function App() {
  return (
    <AuthProvider resolveLanding={(user, mode) => resolveLandingPath(CANONICAL_ROUTES, user, mode)}>
      <BrowserRouter>
        <DirtyNavigationProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          {/* Protected routes wrapped in AppShell with RoleGuard — 100% Real Canonical Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AuthorizedAppShell />}>
              <Route path="/" element={<RootLandingRoute />} />
              <Route
                path="/weekly-menu"
                element={
                  <RoleGuard roles={getRouteRoles('/weekly-menu')}>
                    <WeeklyMenuPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/meal-orders"
                element={
                  <RoleGuard roles={getRouteRoles('/meal-orders')}>
                    <MealOrdersPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/chef"
                element={
                  <RoleGuard roles={getRouteRoles('/chef')}>
                    <ChefDashboardPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/purchasing"
                element={
                  <RoleGuard roles={getRouteRoles('/purchasing')}>
                    <PurchasingPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/warehouse"
                element={
                  <RoleGuard roles={getRouteRoles('/warehouse')}>
                    <WarehousePage />
                  </RoleGuard>
                }
              />
              <Route
                path="/approvals"
                element={
                  <RoleGuard roles={getRouteRoles('/approvals')}>
                    <ApprovalPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/reconciliation"
                element={
                  <RoleGuard roles={getRouteRoles('/reconciliation')}>
                    <ReconciliationPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/reports"
                element={
                  <RoleGuard roles={getRouteRoles('/reports')}>
                    <ReportsPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/admin-data"
                element={
                  <RoleGuard roles={getRouteRoles('/admin-data')}>
                    <AdminDataPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/settings/approval-rules"
                element={
                  <RoleGuard roles={getRouteRoles('/settings/approval-rules')}>
                    <ApprovalRulesPage />
                  </RoleGuard>
                }
              />
              <Route
                path="/settings/advanced"
                element={
                  <RoleGuard roles={getRouteRoles('/settings/advanced')}>
                    <AdvancedSettingsPage />
                  </RoleGuard>
                }
              />
            </Route>
          </Route>

          {/* Catch-all redirect to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </DirtyNavigationProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
