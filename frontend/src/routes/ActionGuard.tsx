import type { ReactNode } from 'react'
import { canAccessRole, type AppRole } from '../features/auth'
import { useAppSelector } from '../app/hooks'

interface ActionGuardProps {
  allowedRoles?: AppRole[]
  requiredPermissions?: string[]
  children: ReactNode
  fallback?: ReactNode
}

export const ActionGuard = ({ allowedRoles = [], requiredPermissions = [], children, fallback = null }: ActionGuardProps) => {
  const user = useAppSelector((state) => state.auth.user)

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
