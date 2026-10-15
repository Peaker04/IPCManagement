import type { ReactNode } from 'react';
import { useAuth } from '../../store/useAuth';

export interface ActionGuardProps {
  roles?: string | string[];
  permissions?: string | string[];
  children: ReactNode;
  fallback?: ReactNode;
  mode?: 'hide' | 'disable';
  reason?: string;
}

/**
 * ActionGuard (Rule NFR-SEC-01)
 * Enforces role-based action permissions for write/mutation buttons.
 */
export function ActionGuard({
  roles,
  permissions,
  children,
  fallback = null,
  mode = 'hide',
  reason,
}: ActionGuardProps) {
  const { hasRole, hasPermission, user } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  let isAllowed = true;

  if (roles) {
    isAllowed = hasRole(roles);
  }

  if (isAllowed && permissions) {
    const perms = Array.isArray(permissions) ? permissions : [permissions];
    isAllowed = perms.some((p) => hasPermission(p));
  }

  if (isAllowed) {
    return <>{children}</>;
  }

  if (mode === 'disable') {
    return (
      <span
        className="inline-flex cursor-not-allowed opacity-50 select-none"
        title={reason || 'Bạn không có quyền thực hiện thao tác này.'}
      >
        <span className="pointer-events-none">{children}</span>
      </span>
    );
  }

  return <>{fallback}</>;
}
