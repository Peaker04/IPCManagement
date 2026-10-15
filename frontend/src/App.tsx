import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/authContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppShell } from './components/workbench/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { ForbiddenPage } from './features/auth/ForbiddenPage';
import { CANONICAL_ROUTES } from './routes/routeRegistry';

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
    <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
      <div className="flex flex-col items-center gap-2.5 text-slate-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
        <span className="text-xs font-medium text-slate-600">Đang tải phân hệ...</span>
      </div>
    </div>
  );
}

export function App() {
  void CANONICAL_ROUTES;
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          {/* Protected routes wrapped in AppShell — 100% Real Canonical Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<Suspense fallback={<WorkbenchLoadingFallback />}><DashboardPage /></Suspense>} />
              <Route path="/weekly-menu" element={<Suspense fallback={<WorkbenchLoadingFallback />}><WeeklyMenuPage /></Suspense>} />
              <Route path="/meal-orders" element={<Suspense fallback={<WorkbenchLoadingFallback />}><MealOrdersPage /></Suspense>} />
              <Route path="/chef" element={<Suspense fallback={<WorkbenchLoadingFallback />}><ChefDashboardPage /></Suspense>} />
              <Route path="/purchasing" element={<Suspense fallback={<WorkbenchLoadingFallback />}><PurchasingPage /></Suspense>} />
              <Route path="/warehouse" element={<Suspense fallback={<WorkbenchLoadingFallback />}><WarehousePage /></Suspense>} />
              <Route path="/approvals" element={<Suspense fallback={<WorkbenchLoadingFallback />}><ApprovalPage /></Suspense>} />
              <Route path="/reconciliation" element={<Suspense fallback={<WorkbenchLoadingFallback />}><ReconciliationPage /></Suspense>} />
              <Route path="/reports" element={<Suspense fallback={<WorkbenchLoadingFallback />}><ReportsPage /></Suspense>} />
              <Route path="/admin-data" element={<Suspense fallback={<WorkbenchLoadingFallback />}><AdminDataPage /></Suspense>} />
              <Route path="/settings/approval-rules" element={<Suspense fallback={<WorkbenchLoadingFallback />}><ApprovalRulesPage /></Suspense>} />
              <Route path="/settings/advanced" element={<Suspense fallback={<WorkbenchLoadingFallback />}><AdvancedSettingsPage /></Suspense>} />
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
