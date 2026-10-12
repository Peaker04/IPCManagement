import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { canAccessRole } from '@/lib/auth/roleUtils'
import { ROUTES } from '@/lib/routeConfig'
import { useSystemOperation } from '@/lib/systemOperationContext'
import { routeMetadataForPath } from './routeRegistry'

interface RoleGuardProps {
  requiredPermissions: readonly string[]
  children: ReactNode
}

export const RoleGuard = ({ requiredPermissions, children }: RoleGuardProps) => {
  const user = useAppSelector((state) => state.auth.user)
  const location = useLocation()
  const systemOperation = useSystemOperation()

  if (!user) {
    return null
  }

  const isAdmin = user.isAdminFullAccess || user.role === 'admin' || user.permissions?.includes('*')
  const hasPermission =
    isAdmin ||
    requiredPermissions.length === 0 ||
    requiredPermissions.some((perm) => user.permissions?.includes(perm))
  const routeMeta = routeMetadataForPath(location.pathname)
  const hasReconciliationRole =
    systemOperation?.mode !== 'MATERIAL_RECONCILIATION' ||
    !routeMeta?.reconciliationRoles ||
    canAccessRole(user, [...routeMeta.reconciliationRoles])

  if (!hasPermission || !hasReconciliationRole) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />
  }

  return <>{children}</>
}
