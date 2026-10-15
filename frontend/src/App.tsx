import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/authContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppShell } from './components/workbench/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { ForbiddenPage } from './features/auth/ForbiddenPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
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
import { CANONICAL_ROUTES } from './routes/routeRegistry';

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
              <Route path="/" element={<DashboardPage />} />
              <Route path="/weekly-menu" element={<WeeklyMenuPage />} />
              <Route path="/meal-orders" element={<MealOrdersPage />} />
              <Route path="/chef" element={<ChefDashboardPage />} />
              <Route path="/purchasing" element={<PurchasingPage />} />
              <Route path="/warehouse" element={<WarehousePage />} />
              <Route path="/approvals" element={<ApprovalPage />} />
              <Route path="/reconciliation" element={<ReconciliationPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/admin-data" element={<AdminDataPage />} />
              <Route path="/settings/approval-rules" element={<ApprovalRulesPage />} />
              <Route path="/settings/advanced" element={<AdvancedSettingsPage />} />
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
