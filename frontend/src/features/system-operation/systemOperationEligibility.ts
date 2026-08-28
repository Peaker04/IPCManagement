import { ROUTES } from '@/lib/routeConfig'

export type SystemOperationMode = 'DEFAULT' | 'MATERIAL_RECONCILIATION'
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

export const isRouteEligible = (mode: SystemOperationMode, path: string) => mode === 'DEFAULT' || reconciliationRouteSet.has(path)
export const isOperationEligible = (mode: SystemOperationMode, operationKey: string) => {
  if (mode === 'DEFAULT') return true
  return !['coordination.', 'approvals.', 'chef.', 'approval-rules.', 'purchasing.', 'reports.'].some(prefix => operationKey.startsWith(prefix))
}
export const retainedRoutes = (mode: SystemOperationMode) => mode === 'DEFAULT'
  ? Object.values(ROUTES)
  : [...reconciliationWorkflowRoutes]

export const eligibleCapabilityIds = (mode: SystemOperationMode, backendIds: readonly string[]) => mode === 'DEFAULT'
  ? backendIds
  : backendIds.filter((id) => ['dashboard', 'weekly-menu', 'warehouse', 'reconciliation', 'admin-data'].includes(id))

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
