import type { ReactNode } from 'react';
import type { OperationalMode } from '../../types';
import { useAuth } from '../../store/useAuth';

export interface ActionGuardProps {
  capabilityId: string;
  roles?: string | string[];
  permissions?: string | string[];
  allowedModes?: OperationalMode[];
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
  capabilityId,
  roles,
  permissions,
  allowedModes,
  children,
  fallback = null,
  mode = 'hide',
  reason,
}: ActionGuardProps) {
  const { hasRole, hasPermission, user, operationalMode } = useAuth();

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

  const isModeAllowed = !allowedModes?.length || allowedModes.includes(operationalMode);

  if (isAllowed && isModeAllowed) {
    return <>{children}</>;
  }

  if (mode === 'disable') {
    const blockedReason = reason || (!isModeAllowed
      ? 'Thao tác không khả dụng trong chế độ vận hành hiện tại.'
      : 'Bạn không có quyền thực hiện thao tác này.');
    return (
      <fieldset
        disabled
        role="group"
        aria-label={blockedReason}
        data-capability-id={capabilityId}
        className="inline-flex border-0 p-0 m-0 cursor-not-allowed opacity-50"
        title={blockedReason}
      >
        {children}
      </fieldset>
    );
  }

  return <>{fallback}</>;
}
