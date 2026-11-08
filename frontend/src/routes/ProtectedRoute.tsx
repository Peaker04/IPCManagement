import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../store/useAuth';
import { StateBoundary } from '../components/workbench/StateBoundary';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, isOperationalModeReady, operationalModeError, reloadOperationalMode } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-xs text-slate-500">
        Đang xác thực thông tin...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isOperationalModeReady) {
    if (operationalModeError) {
      return <div className="app-bootstrap">
        <StateBoundary error={operationalModeError} onRetry={() => {
          // The provider owns the displayed bootstrap error, including a failed retry.
          void reloadOperationalMode().catch(() => undefined);
        }}><></></StateBoundary>
      </div>;
    }
    return <div className="app-bootstrap" role="status">Đang tải không gian làm việc…</div>;
  }

  return <Outlet />;
}
