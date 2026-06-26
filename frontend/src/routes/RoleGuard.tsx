import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../app/hooks';
import { ROUTES } from './routeConfig';

interface RoleGuardProps {
  /** Danh sách role được phép vào route này. Admin luôn được phép bất kể danh sách. */
  allowedRoles: string[];
  children: ReactNode;
}

/**
 * Bọc bên trong <ProtectedRoute> để kiểm tra quyền theo role.
 * - Admin (isAdminFullAccess) → luôn cho qua
 * - Role phù hợp → cho qua
 * - Không đủ quyền → redirect /403
 */
export const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const user = useAppSelector((state) => state.auth.user);

  // ProtectedRoute đã xử lý trường hợp chưa đăng nhập trước đó.
  // Ở đây chỉ cần kiểm tra role.
  if (!user) return null;

  if (user.isAdminFullAccess || allowedRoles.includes(user.role)) {
    return <>{children}</>;
  }

  return <Navigate to={ROUTES.FORBIDDEN} replace />;
};
