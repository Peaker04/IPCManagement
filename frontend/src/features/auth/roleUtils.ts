export type AppRole =
  | 'admin'
  | 'quanly'
  | 'dieuphoi'
  | 'beptruong'
  | 'thukho'
  | 'thumua'
  | 'staff'

const normalizeRoleText = (value?: string | null) =>
  (value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toUpperCase()

export const normalizeUserRole = (roleCode?: string | null, roleName?: string | null): AppRole => {
  const candidates = [normalizeRoleText(roleCode), normalizeRoleText(roleName)]

  if (candidates.some((role) => ['ADMIN', 'QUAN TRI'].includes(role))) return 'admin'
  if (candidates.some((role) => ['MANAGER', 'QUAN LY', 'QUANLY'].includes(role))) return 'quanly'
  if (candidates.some((role) => ['COORDINATOR', 'DIEU PHOI', 'DIEUPHOI'].includes(role))) return 'dieuphoi'
  if (candidates.some((role) => ['CHEF', 'HEADCHEF', 'HEAD CHEF', 'BEP TRUONG', 'BEPTRUONG', 'KITCHEN'].includes(role))) return 'beptruong'
  if (candidates.some((role) => ['WAREHOUSEMANAGER', 'WAREHOUSE MANAGER', 'WAREHOUSESTAFF', 'WAREHOUSE STAFF', 'THU KHO', 'THUKHO'].includes(role))) return 'thukho'
  if (candidates.some((role) => ['PURCHASING', 'PURCHASESTAFF', 'PURCHASE STAFF', 'NHAN VIEN MUA HANG', 'THU MUA', 'THUMUA'].includes(role))) return 'thumua'

  return 'staff'
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Giám đốc / Admin',
  quanly: 'Quản lý',
  dieuphoi: 'Điều phối',
  beptruong: 'Bếp trưởng',
  thukho: 'Thủ kho',
  thumua: 'Thu mua',
  staff: 'Nhân viên',
}

export const canAccessRole = (user: { role: string; isAdminFullAccess?: boolean } | null | undefined, allowedRoles: AppRole[]) => {
  if (!user) return false
  if (user.isAdminFullAccess || user.role === 'admin') return true
  return allowedRoles.includes(user.role as AppRole)
}
