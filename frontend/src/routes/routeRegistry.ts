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
import {
  pageTabGroups,
  visibleTabIds,
  type NavigationPreferenceKey,
  type PageTabGroupId,
  type PageTabPreferences,
} from '@/lib/navigationPreferences'
import { ROUTES } from '@/lib/routeConfig'
import { eligiblePageTabs, type SystemOperationMode } from '@/lib/systemOperationEligibility'

type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

export type { RoutePath }

/** Flat leaf for nested sidebar. `id` is the canonical leaf id (matches
 *  `pageTabGroups.tabs[*][0]` and the v2 leaf key suffix). `label` is the
 *  localized leaf title shown in the sidebar disclosure body. */
export type NavChild = {
  readonly id: string
  readonly label: string
}

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
  children?: readonly NavChild[]
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

const ROUTE_TO_PAGE_TAB_GROUP: Partial<Record<RoutePath, PageTabGroupId>> = {
  [ROUTES.WEEKLY_MENU]: 'weekly-menu',
  [ROUTES.WAREHOUSE]: 'warehouse',
  [ROUTES.APPROVALS]: 'approvals',
  [ROUTES.PURCHASING]: 'purchasing',
  [ROUTES.CHEF_DASHBOARD]: 'chef',
  [ROUTES.REPORTS]: 'reports',
  [ROUTES.ADMIN_DATA]: 'admin-data',
}

export const ADVANCED_SETTINGS_CHILDREN: readonly NavChild[] = [
  { id: 'operation', label: 'Chế độ vận hành' },
  { id: 'display', label: 'Hiển thị & điều hướng' },
]

const WEEKLY_MENU_EXTRA_DEFAULT_CHILDREN: readonly NavChild[] = [
  { id: 'purchase-summary', label: 'Bàn giao tuần' },
  { id: 'cost', label: 'Giá vốn tuần' },
  { id: 'dish-materials', label: 'Định mức theo món' },
]

const MRX_LEAF_LABELS: Partial<Record<RoutePath, Readonly<Record<string, string>>>> = {
  [ROUTES.WEEKLY_MENU]: {
    schedule: 'Kế hoạch tuần',
    demand: 'Định lượng xuất kho',
  },
  [ROUTES.WAREHOUSE]: {
    demand: 'Danh sách cần xuất',
    movement: 'Lịch sử xuất kho',
  },
}

/** Project `pageTabGroups` into a flat NavChild[] for a single route. */
const buildChildrenForGroup = (groupId: PageTabGroupId): readonly NavChild[] => {
  const group = pageTabGroups.find((candidate) => candidate.id === groupId)
  if (!group) return []
  return group.tabs.map(([id, label]) => ({ id, label }))
}

for (const [path, groupId] of Object.entries(ROUTE_TO_PAGE_TAB_GROUP) as [RoutePath, PageTabGroupId][]) {
  routeRegistry[path] = { ...routeRegistry[path], children: buildChildrenForGroup(groupId) }
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

/** Returns the flat leaf ids for a route, or `undefined` when the route
 *  has no children (e.g. primary routes with a single tab). */
export const getRouteLeafIds = (path: RoutePath): readonly string[] | undefined => {
  const children = routeRegistry[path]?.children
  return children ? children.map((child) => child.id) : undefined
}

export const getVisibleRouteChildren = (
  path: RoutePath,
  options: {
    mode: SystemOperationMode
    isAdmin?: boolean
    permissions?: readonly string[]
    pageTabPreferences?: PageTabPreferences
    backendPageTabs?: Readonly<Record<string, readonly string[]>>
  },
): readonly NavChild[] => {
  if (path === ROUTES.ADVANCED_SETTINGS) return ADVANCED_SETTINGS_CHILDREN
  const children = routeRegistry[path]?.children
  if (!children?.length) return []

  const groupId = ROUTE_TO_PAGE_TAB_GROUP[path]
  const localVisible = groupId
    ? visibleTabIds(groupId, options.pageTabPreferences)
    : children.map((child) => child.id)
  const backendTabs = (groupId && options.backendPageTabs?.[groupId]) ?? children.map((child) => child.id)
  const allowedIds = groupId
    ? eligiblePageTabs(options.mode, groupId, backendTabs, localVisible)
    : localVisible
  const mrxLabels = options.mode === 'MATERIAL_RECONCILIATION' ? MRX_LEAF_LABELS[path] : undefined
  const perms = options.permissions
  const hasPerm = (perm: string) => Boolean(options.isAdmin) || !perms || perms.includes('*') || perms.includes(perm)

  const filtered = children
    .filter((child) => {
      if (!allowedIds.includes(child.id)) return false
      if (path === ROUTES.ADMIN_DATA && child.id === 'employees') return Boolean(options.isAdmin)
      if (path === ROUTES.REPORTS) {
        if (child.id === 'price') return hasPerm('purchase.read') || hasPerm('warehouse.read')
        if (child.id === 'purchase') return hasPerm('purchase.read')
        if (child.id === 'audit') return Boolean(options.isAdmin)
      }
      return true
    })
    .map((child) => (mrxLabels?.[child.id] ? { id: child.id, label: mrxLabels[child.id] } : child))

  if (path === ROUTES.APPROVALS && options.mode === 'DEFAULT') {
    return [{ id: 'amendments', label: 'Điều chỉnh thực đơn' }, ...filtered]
  }
  if (path === ROUTES.WEEKLY_MENU && options.mode === 'DEFAULT') {
    const extraBackend = options.backendPageTabs?.['weekly-menu']
    const extra = WEEKLY_MENU_EXTRA_DEFAULT_CHILDREN.filter(
      (child) => !extraBackend || extraBackend.includes(child.id),
    )
    return [...filtered, ...extra]
  }
  if (path === ROUTES.ADMIN_DATA && options.mode === 'MATERIAL_RECONCILIATION' && filtered.some((c) => c.id === 'audit')) {
    return [...filtered, { id: 'source-changes', label: 'Lịch sử thay đổi nguồn' }]
  }
  return filtered
}

export const resolveActiveRouteLeafId = (
  path: RoutePath,
  currentView: string | null,
  visibleChildren: readonly NavChild[],
): string | undefined => {
  if (visibleChildren.length === 0) return undefined
  if (currentView && visibleChildren.some((child) => child.id === currentView)) return currentView
  if (path === ROUTES.APPROVALS) {
    return visibleChildren.find((child) => child.id === 'queue')?.id
      ?? visibleChildren.find((child) => child.id === 'history')?.id
      ?? visibleChildren[0]?.id
  }
  return visibleChildren[0]?.id
}

const ROUTE_PRESERVED_QUERY_KEYS: Partial<Record<RoutePath, readonly string[]>> = {
  [ROUTES.WEEKLY_MENU]: ['customerId', 'weekStartDate'],
  [ROUTES.WAREHOUSE]: ['batchId', 'day'],
  [ROUTES.PURCHASING]: ['week', 'date', 'stage'],
  [ROUTES.REPORTS]: ['dateFrom', 'dateTo', 'shift', 'sort'],
}

export const buildRouteLeafHref = (
  path: RoutePath,
  leafId: string,
  currentPathname?: string,
  currentSearch?: string,
): string => {
  const preservedKeys = currentPathname === path ? ROUTE_PRESERVED_QUERY_KEYS[path] : undefined
  if (!preservedKeys?.length || !currentSearch) return `${path}?view=${leafId}`
  const source = new URLSearchParams(currentSearch)
  const next = new URLSearchParams()
  next.set('view', leafId)
  for (const key of preservedKeys) {
    const val = source.get(key)
    if (val) next.set(key, val)
  }
  return `${path}?${next.toString()}`
}
