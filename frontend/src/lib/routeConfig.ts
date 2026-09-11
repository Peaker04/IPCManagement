export const ROUTES = {
  LOGIN: '/login',
  FORBIDDEN: '/403',
  DASHBOARD: '/',
  WEEKLY_MENU: '/weekly-menu',
  REPORTS: '/reports',
  MEAL_ORDERS: '/meal-orders',
  CHEF_DASHBOARD: '/chef-dashboard',
  APPROVALS: '/approvals',
  PURCHASING: '/purchasing',
  WAREHOUSE: '/warehouse',
  RECONCILIATION: '/reconciliation',
  ADMIN_DATA: '/admin-data',
  APPROVAL_RULES: '/admin/rules',
  ADVANCED_SETTINGS: '/admin/advanced-settings',
} as const;

export type ReconciliationWeeklyMenuView = 'schedule' | 'demand'

const validDateOnly = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value
}

export const readReconciliationWeeklyMenuRoute = (params: URLSearchParams): {
  view: ReconciliationWeeklyMenuView
  customerId: string
  weekStartDate: string
} => ({
  view: params.get('view') === 'demand' ? 'demand' : 'schedule',
  customerId: params.get('customerId')?.trim() ?? '',
  weekStartDate: validDateOnly(params.get('weekStartDate')?.trim() ?? '') ? params.get('weekStartDate')!.trim() : '',
})

export const buildWeeklyMenuRoute = ({
  view = 'schedule',
  customerId,
  weekStartDate,
}: {
  view?: 'schedule' | 'demand'
  customerId?: string
  weekStartDate?: string
} = {}) => {
  const params = new URLSearchParams({ view })
  if (customerId) params.set('customerId', customerId)
  if (weekStartDate) params.set('weekStartDate', weekStartDate)
  return `${ROUTES.WEEKLY_MENU}?${params.toString()}`
}
