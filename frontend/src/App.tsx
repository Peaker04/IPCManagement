import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/authContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppShell } from './components/workbench/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { ForbiddenPage } from './features/auth/ForbiddenPage';
import { CANONICAL_ROUTES } from './routes/routeRegistry';

import { RoleGuard } from './routes/RoleGuard';

// Route-level code splitting for production bundle optimization (NFR-PERF-01)
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
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

function WorkbenchLoadingFallback() {
  return (
    <div className="flex-1 min-h-0 w-full flex flex-col p-4 space-y-2 bg-white">
      <div className="h-8 w-full bg-slate-100 rounded animate-pulse" />
      <div className="space-y-1.5 flex-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-9 w-full bg-slate-50 border border-slate-100 rounded flex items-center px-4 space-x-4 animate-pulse"
          >
            <div className="h-3 w-1/4 bg-slate-200 rounded" />
            <div className="h-3 w-1/3 bg-slate-200 rounded" />
            <div className="h-3 w-1/6 bg-slate-200 rounded ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

const getRouteRoles = (path: string) => CANONICAL_ROUTES.find((r) => r.path === path)?.allowedRoles;

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          {/* Protected routes wrapped in AppShell with RoleGuard — 100% Real Canonical Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route
                path="/"
                element={
                  <RoleGuard roles={getRouteRoles('/')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <DashboardPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/weekly-menu"
                element={
                  <RoleGuard roles={getRouteRoles('/weekly-menu')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <WeeklyMenuPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/meal-orders"
                element={
                  <RoleGuard roles={getRouteRoles('/meal-orders')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <MealOrdersPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/chef"
                element={
                  <RoleGuard roles={getRouteRoles('/chef')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <ChefDashboardPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/purchasing"
                element={
                  <RoleGuard roles={getRouteRoles('/purchasing')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <PurchasingPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/warehouse"
                element={
                  <RoleGuard roles={getRouteRoles('/warehouse')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <WarehousePage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/approvals"
                element={
                  <RoleGuard roles={getRouteRoles('/approvals')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <ApprovalPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/reconciliation"
                element={
                  <RoleGuard roles={getRouteRoles('/reconciliation')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <ReconciliationPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/reports"
                element={
                  <RoleGuard roles={getRouteRoles('/reports')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <ReportsPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/admin-data"
                element={
                  <RoleGuard roles={getRouteRoles('/admin-data')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <AdminDataPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/settings/approval-rules"
                element={
                  <RoleGuard roles={getRouteRoles('/settings/approval-rules')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <ApprovalRulesPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
              <Route
                path="/settings/advanced"
                element={
                  <RoleGuard roles={getRouteRoles('/settings/advanced')}>
                    <Suspense fallback={<WorkbenchLoadingFallback />}>
                      <AdvancedSettingsPage />
                    </Suspense>
                  </RoleGuard>
                }
              />
            </Route>
          </Route>

          {/* Catch-all redirect to Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
