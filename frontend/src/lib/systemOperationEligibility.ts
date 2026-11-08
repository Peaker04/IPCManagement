import { ROUTES } from '@/lib/routeConfig'
import type { SystemOperationMode } from './systemOperationTypes'

export type { SystemOperationMode } from './systemOperationTypes'
export const modeLabels: Record<SystemOperationMode, string> = { DEFAULT: 'Mặc định', MATERIAL_RECONCILIATION: 'Đối chiếu nguyên liệu' }

const reconciliationWorkflowRoutes = [
  ROUTES.DASHBOARD,
  ROUTES.WEEKLY_MENU,
  ROUTES.WAREHOUSE,
  ROUTES.RECONCILIATION,
  ROUTES.ADMIN_DATA,
] as const
const reconciliationRouteSet = new Set<string>([
  ...reconciliationWorkflowRoutes,
  ROUTES.LOGIN,
  ROUTES.FORBIDDEN,
  ROUTES.ADVANCED_SETTINGS,
])

export const isRouteEligible = (mode: SystemOperationMode, path: string) => mode === 'DEFAULT'
  ? path !== ROUTES.RECONCILIATION
  : reconciliationRouteSet.has(path)

export const isRouteVisibleToPermissions = (
  mode: SystemOperationMode,
  path: string,
  requiredPermissions: readonly string[] | undefined,
  permissions: readonly string[] = [],
  isAdmin = false,
) => isRouteEligible(mode, path)
  && (!requiredPermissions || isAdmin || requiredPermissions.some((permission) => permissions.includes(permission)))
export const isOperationEligible = (mode: SystemOperationMode, operationKey: string) => {
  if (mode === 'DEFAULT') return true
  return !['coordination.', 'approvals.', 'chef.', 'approval-rules.', 'purchasing.', 'reports.'].some(prefix => operationKey.startsWith(prefix))
}
export const retainedRoutes = (mode: SystemOperationMode) => mode === 'DEFAULT'
  ? Object.values(ROUTES).filter((path) => path !== ROUTES.RECONCILIATION)
  : [...reconciliationWorkflowRoutes]

export const eligibleCapabilityIds = (mode: SystemOperationMode, backendIds: readonly string[]) => mode === 'DEFAULT'
  ? backendIds.filter((id) => id !== 'reconciliation')
  : backendIds.filter((id) => ['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data'].includes(id))

export const getCapabilityConfigurationError = (snapshot: {
  mode: SystemOperationMode
  capabilities: { navigation: readonly string[]; pageTabs: Readonly<Record<string, readonly string[]>> }
}) => {
  if (snapshot.mode !== 'MATERIAL_RECONCILIATION') return undefined
  const expectedNavigation = ['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data']
  const expectedTabs: Record<string, readonly string[]> = {
    'weekly-menu': ['schedule', 'material-demand'],
    warehouse: ['demand', 'movement'],
    'admin-data': ['bom-import', 'audit'],
  }
  const same = (actual: readonly string[] | undefined, expected: readonly string[]) =>
    JSON.stringify(actual ?? []) === JSON.stringify(expected)
  if (!same(snapshot.capabilities.navigation, expectedNavigation)) {
    return 'Phiên bản máy chủ đang chạy không khớp cấu hình Đối chiếu nguyên liệu (danh mục chức năng).'
  }
  for (const [page, tabs] of Object.entries(expectedTabs)) {
    if (!same(snapshot.capabilities.pageTabs[page], tabs)) {
      return `Phiên bản máy chủ đang chạy không khớp cấu hình Đối chiếu nguyên liệu (${page}).`
    }
  }
  return undefined
}

export const eligiblePageTabs = (
  mode: SystemOperationMode,
  groupId: string,
  backendTabs: readonly string[],
  locallyVisibleTabs: readonly string[],
) => {
  const normalizedBackendTabs = backendTabs.map((tab) => groupId === 'weekly-menu' && tab === 'material-demand' ? 'demand' : tab)
  const allowed = mode === 'DEFAULT' ? normalizedBackendTabs : normalizedBackendTabs.filter((tab) => ({
    'weekly-menu': ['schedule', 'demand'],
    warehouse: ['demand', 'movement'],
    'admin-data': ['bom-import', 'audit'],
  }[groupId]?.includes(tab) ?? false))
  return allowed.filter((tab) => locallyVisibleTabs.includes(tab))
}
