import { ROUTES } from '@/lib/routeConfig'

export type SystemOperationMode = 'DEFAULT' | 'MATERIAL_RECONCILIATION'
export const modeLabels: Record<SystemOperationMode, string> = { DEFAULT: 'Mặc định', MATERIAL_RECONCILIATION: 'Đối chiếu nguyên liệu' }

const excludedRoutes = new Set<string>([ROUTES.MEAL_ORDERS, ROUTES.APPROVALS, ROUTES.CHEF_DASHBOARD, ROUTES.APPROVAL_RULES])
export const isRouteEligible = (mode: SystemOperationMode, path: string) => mode === 'DEFAULT' || !excludedRoutes.has(path)
export const isOperationEligible = (mode: SystemOperationMode, operationKey: string) => {
  if (mode === 'DEFAULT') return true
  return !['coordination.', 'approvals.', 'chef.', 'approval-rules.'].some(prefix => operationKey.startsWith(prefix))
}
export const retainedRoutes = (mode: SystemOperationMode) => Object.values(ROUTES).filter(path => isRouteEligible(mode, path))
