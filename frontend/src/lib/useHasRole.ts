import { useSelector } from 'react-redux'

type RoleState = {
  auth: {
    user: {
      isAdminFullAccess: boolean
      role: string
    } | null
  }
}

export const useHasRole = (allowedRoles: string[]) =>
  useSelector((state: RoleState) => {
    const user = state.auth.user
    if (!user) return false
    if (user.isAdminFullAccess || user.role === 'admin') return true
    return allowedRoles.includes(user.role)
  })
