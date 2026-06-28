import type { ReactNode } from 'react'
import { canAccessRole, type AppRole } from '../features/auth'
import { useAppSelector } from '../app/hooks'

interface ActionGuardProps {
  allowedRoles: AppRole[]
  children: ReactNode
  fallback?: ReactNode
}

export const ActionGuard = ({ allowedRoles, children, fallback = null }: ActionGuardProps) => {
  const user = useAppSelector((state) => state.auth.user)

  if (!canAccessRole(user, allowedRoles)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
