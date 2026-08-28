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
