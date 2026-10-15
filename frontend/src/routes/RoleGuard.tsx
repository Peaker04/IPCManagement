import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/useAuth';

export interface RoleGuardProps {
  roles?: string[];
  permissions?: string[];
  children: ReactNode;
}

export function RoleGuard({ roles, permissions, children }: RoleGuardProps) {
  const { user, hasRole, hasPermission } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !hasRole(roles)) {
    return <Navigate to="/forbidden" replace />;
  }

  if (permissions && permissions.length > 0) {
    const isAllowed = permissions.some((perm) => hasPermission(perm));
    if (!isAllowed) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <>{children}</>;
}
