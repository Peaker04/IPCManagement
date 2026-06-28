import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppSelector } from '../app/hooks'
import { canAccessRole, type AppRole } from '../features/auth'
import { ROUTES } from './routeConfig'

interface RoleGuardProps {
  allowedRoles: AppRole[]
  children: ReactNode
}

export const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const user = useAppSelector((state) => state.auth.user)

  if (!user) {
    return null
  }

  if (!canAccessRole(user, allowedRoles)) {
    return <Navigate to={ROUTES.FORBIDDEN} replace />
  }

  return <>{children}</>
}
