import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/authContext';
import { useAuth } from './store/useAuth';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppShell } from './components/workbench/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { ForbiddenPage } from './features/auth/ForbiddenPage';
import { CANONICAL_ROUTES } from './routes/routeRegistry';
import { isRouteEligible, resolveEligibleNavigation, resolveLandingPath } from './routes/navigationEligibility';
import { DirtyNavigationProvider } from './components/workbench/DirtyNavigation';
import { RoleGuard } from './routes/RoleGuard';

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ReconciliationDashboardPage = lazy(() => import('./features/dashboard/ReconciliationDashboardPage').then((m) => ({ default: m.ReconciliationDashboardPage })));
const WeeklyMenuPage = lazy(() => import('./features/weekly-menu/WeeklyMenuPage').then((m) => ({ default: m.WeeklyMenuPage })));
const MealOrdersPage = lazy(() => import('./features/coordination/MealOrdersPage').then((m) => ({ default: m.MealOrdersPage })));
const ChefDashboardPage = lazy(() => import('./features/chef/ChefDashboardPage').then((m) => ({ default: m.ChefDashboardPage })));
const PurchasingPage = lazy(() => import('./features/purchasing/PurchasingPage').then((m) => ({ default: m.PurchasingPage })));
const WarehousePage = lazy(() => import('./features/warehouse/WarehousePage').then((m) => ({ default: m.WarehousePage })));
const ApprovalPage = lazy(() => import('./features/approvals/ApprovalPage').then((m) => ({ default: m.ApprovalPage })));
const ReconciliationPage = lazy(() => import('./features/reconciliation/ReconciliationPage').then((m) => ({ default: m.ReconciliationPage })));
const ReportsPage = lazy(() => import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const AdminDataPage = lazy(() => import('./features/admin/AdminDataPage').then((m) => ({ default: m.AdminDataPage })));
const ApprovalRulesPage = lazy(() => import('./features/admin/ApprovalRulesPage').then((m) => ({ default: m.ApprovalRulesPage })));
const AdvancedSettingsPage = lazy(() => import('./features/admin/AdvancedSettingsPage').then((m) => ({ default: m.AdvancedSettingsPage })));

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
    <AuthProvider
      resolveLanding={(user, mode) => resolveLandingPath(CANONICAL_ROUTES, user, mode)}
      resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}
    >
      <BrowserRouter>
        <DirtyNavigationProvider>
        <Suspense fallback={<div className="flex-1 min-h-0 w-full bg-white" aria-busy="true" />}>
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
        </Suspense>
        </DirtyNavigationProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
