import { useSelector } from 'react-redux'

type PermissionState = {
  auth: {
    user: {
      isAdminFullAccess: boolean
      permissions: string[]
    } | null
  }
}

export const useHasPermission = (permission: string) =>
  useSelector((state: PermissionState) => {
    const user = state.auth.user
    if (!user) return false
    if (user.isAdminFullAccess || user.permissions.includes('*')) return true
    return user.permissions.includes(permission)
  })
