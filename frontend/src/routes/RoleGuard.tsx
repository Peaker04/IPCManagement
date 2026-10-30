import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CANONICAL_ROUTES } from './routeRegistry';
import { isRouteEligible } from './navigationEligibility';
import { useAuth } from '../store/useAuth';

export interface RoleGuardProps {
  roles?: string[];
  permissions?: string[];
  children: ReactNode;
}

export function RoleGuard({ roles, permissions, children }: RoleGuardProps) {
  const { user, hasRole, hasPermission, operationalMode } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isRouteEligible(CANONICAL_ROUTES, location.pathname, location.search, user, operationalMode)) {
    return <Navigate to="/forbidden" replace />;
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
