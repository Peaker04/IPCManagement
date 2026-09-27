import type { LucideIcon } from 'lucide-react'
import {
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  Database,
  LayoutDashboard,
  Scale,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Utensils,
  Warehouse,
} from 'lucide-react'
import type { UiOwnershipMarker } from '@/components/common/OperationalFrame'
import type { AppRole } from '@/lib/auth/roleUtils'
import type { NavigationPreferenceKey } from '@/lib/navigationPreferences'
import { ROUTES } from '@/lib/routeConfig'

type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

type RouteMetadata = {
  path: RoutePath
  documentTitle: string
  shellTitle: string
  workflow?: string
  headerState: string
  navLabel?: string
  icon?: LucideIcon
  preferenceKey?: NavigationPreferenceKey
  requiredPermissions?: readonly string[]
  reconciliationOnly?: boolean
  reconciliationRoles?: readonly AppRole[]
  primaryNavigation?: boolean
  ownership?: UiOwnershipMarker
}

export const routeRegistry: Record<RoutePath, RouteMetadata> = {
  [ROUTES.LOGIN]: { path: ROUTES.LOGIN, documentTitle: 'Đăng nhập', shellTitle: 'Đăng nhập', workflow: 'Xác thực', headerState: 'Đăng nhập' },
  [ROUTES.FORBIDDEN]: { path: ROUTES.FORBIDDEN, documentTitle: 'Không đủ quyền truy cập', shellTitle: 'Không đủ quyền truy cập', workflow: 'Phân quyền', headerState: 'Bị từ chối', ownership: { ownerId: 'uio-h', floorplanId: 'uif-h', regionId: 'uir-h' } },
  [ROUTES.DASHBOARD]: { path: ROUTES.DASHBOARD, documentTitle: 'Bàn điều hành hôm nay', shellTitle: 'Bàn điều hành hôm nay', workflow: 'Tổng quan vận hành', headerState: 'Theo dõi điểm tắc', navLabel: 'Tổng quan', icon: LayoutDashboard, preferenceKey: 'dashboard', primaryNavigation: true, ownership: { ownerId: 'uio-g', floorplanId: 'uif-g', regionId: 'uir-g' } },
  [ROUTES.WEEKLY_MENU]: { path: ROUTES.WEEKLY_MENU, documentTitle: 'Thực đơn tuần', shellTitle: 'Thực đơn tuần', headerState: 'Theo dõi kế hoạch tuần', navLabel: 'Thực đơn tuần', icon: CalendarDays, preferenceKey: 'weekly-menu', requiredPermissions: ['coordination.read'], reconciliationRoles: ['admin', 'dieuphoi'], primaryNavigation: true, ownership: { ownerId: 'uio-17', floorplanId: 'uif-17', regionId: 'uir-17' } },
  [ROUTES.REPORTS]: { path: ROUTES.REPORTS, documentTitle: 'Báo cáo vận hành', shellTitle: 'Báo cáo vận hành', workflow: 'Báo cáo vận hành', headerState: 'Theo dõi vận hành', navLabel: 'Báo cáo vận hành', icon: TrendingUp, preferenceKey: 'reports', requiredPermissions: ['report.read'], primaryNavigation: true, ownership: { ownerId: 'uio-t', floorplanId: 'uif-t', regionId: 'uir-t' } },
  [ROUTES.MEAL_ORDERS]: { path: ROUTES.MEAL_ORDERS, documentTitle: 'Điều phối suất ăn', shellTitle: 'Điều phối suất ăn', headerState: 'Theo dõi chốt suất', navLabel: 'Điều phối đơn', icon: Utensils, preferenceKey: 'meal-orders', requiredPermissions: ['coordination.read'], primaryNavigation: true, ownership: { ownerId: 'uio-j', floorplanId: 'uif-j', regionId: 'uir-j' } },
  [ROUTES.CHEF_DASHBOARD]: { path: ROUTES.CHEF_DASHBOARD, documentTitle: 'Bếp sản xuất', shellTitle: 'Bếp sản xuất', headerState: 'Theo dõi chế biến', navLabel: 'Bếp trưởng', icon: ChefHat, preferenceKey: 'chef-dashboard', requiredPermissions: ['production.read'], primaryNavigation: true, ownership: { ownerId: 'uio-d', floorplanId: 'uif-d', regionId: 'uir-d' } },
  [ROUTES.APPROVALS]: { path: ROUTES.APPROVALS, documentTitle: 'Duyệt vận hành', shellTitle: 'Duyệt vận hành', headerState: 'Theo dõi phê duyệt', navLabel: 'Duyệt vận hành', icon: ClipboardCheck, preferenceKey: 'approvals', requiredPermissions: ['purchase.request.approve'], primaryNavigation: true, ownership: { ownerId: 'uio-a', floorplanId: 'uif-a', regionId: 'uir-a' } },
  [ROUTES.PURCHASING]: { path: ROUTES.PURCHASING, documentTitle: 'Thu mua', shellTitle: 'Thu mua', headerState: 'Theo dõi tiến độ mua', navLabel: 'Thu mua', icon: ShoppingCart, preferenceKey: 'purchasing', requiredPermissions: ['purchase.read'], primaryNavigation: true, ownership: { ownerId: 'uio-k', floorplanId: 'uif-k', regionId: 'uir-k' } },
  [ROUTES.WAREHOUSE]: { path: ROUTES.WAREHOUSE, documentTitle: 'Kho nguyên liệu', shellTitle: 'Kho nguyên liệu', headerState: 'Theo dõi xuất nhập kho', navLabel: 'Kho nguyên liệu', icon: Warehouse, preferenceKey: 'warehouse', requiredPermissions: ['warehouse.read'], reconciliationRoles: ['admin', 'thukho'], primaryNavigation: true, ownership: { ownerId: 'uio-13', floorplanId: 'uif-13', regionId: 'uir-13' } },
  [ROUTES.RECONCILIATION]: { path: ROUTES.RECONCILIATION, documentTitle: 'Đối chiếu nguyên liệu', shellTitle: 'Đối chiếu nguyên liệu', workflow: 'Đối chiếu', headerState: 'Theo dõi sai lệch', navLabel: 'Đối chiếu', icon: Scale, preferenceKey: 'reconciliation', requiredPermissions: ['report.read'], reconciliationOnly: true, reconciliationRoles: ['admin', 'quanly', 'beptruong'], primaryNavigation: true, ownership: { ownerId: 'uio-o', floorplanId: 'uif-o', regionId: 'uir-o' } },
  [ROUTES.ADMIN_DATA]: { path: ROUTES.ADMIN_DATA, documentTitle: 'Quản trị dữ liệu', shellTitle: 'Quản trị dữ liệu', headerState: 'Theo dõi dữ liệu nguồn', navLabel: 'Quản trị dữ liệu', icon: Database, preferenceKey: 'admin-data', requiredPermissions: ['*'], primaryNavigation: true, ownership: { ownerId: 'uio-0', floorplanId: 'uif-0', regionId: 'uir-0' } },
  [ROUTES.APPROVAL_RULES]: { path: ROUTES.APPROVAL_RULES, documentTitle: 'Thiết lập quy trình duyệt', shellTitle: 'Thiết lập quy trình duyệt', workflow: 'Phê duyệt', headerState: 'Cấu hình hệ thống', navLabel: 'Thiết lập quy trình duyệt', icon: Settings, preferenceKey: 'approval-rules', requiredPermissions: ['*'], primaryNavigation: true, ownership: { ownerId: 'uio-9', floorplanId: 'uif-9', regionId: 'uir-9' } },
  [ROUTES.ADVANCED_SETTINGS]: { path: ROUTES.ADVANCED_SETTINGS, documentTitle: 'Thiết lập nâng cao', shellTitle: 'Thiết lập nâng cao', workflow: 'Quản trị hệ thống', headerState: 'Cấu hình hiển thị', navLabel: 'Thiết lập nâng cao', icon: SlidersHorizontal, requiredPermissions: ['*'], ownership: { ownerId: 'uio-8', floorplanId: 'uif-8', regionId: 'uir-8' } },
}

export const navigationRoutes = [
  ROUTES.DASHBOARD,
  ROUTES.WEEKLY_MENU,
  ROUTES.MEAL_ORDERS,
  ROUTES.APPROVALS,
  ROUTES.PURCHASING,
  ROUTES.WAREHOUSE,
  ROUTES.RECONCILIATION,
  ROUTES.CHEF_DASHBOARD,
  ROUTES.REPORTS,
  ROUTES.ADMIN_DATA,
  ROUTES.APPROVAL_RULES,
].map((path) => routeRegistry[path])

export const routeMetadataForPath = (pathname: string) => {
  const canonicalPath = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname
  return routeRegistry[canonicalPath as RoutePath]
}
