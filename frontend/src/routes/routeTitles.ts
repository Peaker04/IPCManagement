import { ROUTES } from '@/lib/routeConfig'

const routeTitles: Record<(typeof ROUTES)[keyof typeof ROUTES], string> = {
  [ROUTES.LOGIN]: 'Đăng nhập',
  [ROUTES.FORBIDDEN]: 'Không đủ quyền truy cập',
  [ROUTES.DASHBOARD]: 'Bàn điều hành hôm nay',
  [ROUTES.WEEKLY_MENU]: 'Thực đơn tuần',
  [ROUTES.REPORTS]: 'Báo cáo vận hành',
  [ROUTES.MEAL_ORDERS]: 'Điều phối suất ăn',
  [ROUTES.CHEF_DASHBOARD]: 'Bếp sản xuất',
  [ROUTES.APPROVALS]: 'Duyệt vận hành',
  [ROUTES.PURCHASING]: 'Thu mua',
  [ROUTES.WAREHOUSE]: 'Kho nguyên liệu',
  [ROUTES.RECONCILIATION]: 'Đối chiếu nguyên liệu',
  [ROUTES.ADMIN_DATA]: 'Quản trị dữ liệu',
  [ROUTES.APPROVAL_RULES]: 'Thiết lập quy trình duyệt',
  [ROUTES.ADVANCED_SETTINGS]: 'Thiết lập nâng cao',
}

export const documentTitleForPath = (pathname: string) => {
  const canonicalPath = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname
  const title = routeTitles[canonicalPath as keyof typeof routeTitles]
  return title ? `${title} · IPC Management` : 'IPC Management'
}
