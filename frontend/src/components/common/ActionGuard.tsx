import type { ReactNode } from 'react'
import { useSelector } from 'react-redux'

import { canAccessRole, type AppRole } from '@/lib/auth/roleUtils'
import type { AuthState } from '@/lib/auth/authTypes'

interface ActionGuardProps {
  allowedRoles?: AppRole[]
  requiredPermissions?: string[]
  children: ReactNode
  fallback?: ReactNode
}

type ActionGuardState = { auth: AuthState }

export const ActionGuard = ({ allowedRoles = [], requiredPermissions = [], children, fallback = null }: ActionGuardProps) => {
  const user = useSelector((state: ActionGuardState) => state.auth.user)

  if (!user) {
    return <>{fallback}</>
  }

  const hasRoleAccess = allowedRoles.length === 0 || canAccessRole(user, allowedRoles)
  const hasPermissionAccess =
    requiredPermissions.length === 0 ||
    user.isAdminFullAccess ||
    user.permissions.includes('*') ||
    requiredPermissions.some((permission) => user.permissions.includes(permission))

  if (hasRoleAccess && hasPermissionAccess) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
