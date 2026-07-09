import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { ROUTES } from './routeConfig'

interface RoleGuardProps {
  requiredPermissions: string[]
  children: ReactNode
}

export const RoleGuard = ({ requiredPermissions, children }: RoleGuardProps) => {
  const user = useAppSelector((state) => state.auth.user)

  if (!user) {
    return null
  }

  const isAdmin = user.isAdminFullAccess || user.role === 'admin' || user.permissions?.includes('*')
  const hasPermission =
    isAdmin ||
    requiredPermissions.length === 0 ||
    requiredPermissions.some((perm) => user.permissions?.includes(perm))

  if (!hasPermission) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />
  }

  return <>{children}</>
}
