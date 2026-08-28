import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { ROLE_LABELS, selectCurrentUser } from '@/features/auth';
import { store } from '@/app/store';
import { logoutSession } from '@/app/session/logoutSession';
import { ROUTES } from '@/lib/routeConfig';
import { preloadRoute, preloadRouteData } from '@/routes/routeLoaders';
import { getWorkflowContextForPath, toneFromStatus } from '@/lib/workflowConfig';
import { apiSlice } from '@/api/apiSlice';
import { workflowCacheTags } from '@/api/workflowCacheTags';
import { uiCopy } from '@/lib/uiCopy';
import { readNavigationPreferences, type NavigationPreferenceKey } from '@/lib/navigationPreferences';
import { useSystemOperation } from '@/features/system-operation/systemOperationContext';
import { SystemOperationProvider } from '@/features/system-operation/SystemOperationProvider';
import { isRouteEligible } from '@/features/system-operation/systemOperationEligibility';
import {
  ChefHat,
  LayoutDashboard,
  CalendarDays,
  TrendingUp,
  LogOut,
  Utensils,
  Clock3,
  ClipboardCheck,
  ShoppingCart,
  Warehouse,
  Database,
  Menu,
  Settings,
  SlidersHorizontal,
  X,
} from 'lucide-react';

const serviceDateFormatter = new Intl.DateTimeFormat('vi-VN');

const preloadNavigationTarget = (path: string) => {
  void preloadRoute(path);
  void preloadRouteData(path);
};

function HeaderShiftContext({ isCoordination, owner }: { isCoordination: boolean; owner: string }) {
  const coordinationShift = useAppSelector((state) => state.coordination.currentShift);
  const activeShift = isCoordination ? coordinationShift : 'Ca trưa';

  return (
    <div className="ipc-header-chip">
      <Clock3 size={16} />
      <span>{activeShift} · {owner}</span>
    </div>
  );
}

const menuItems: Array<{ path: string; label: string; icon: ReactNode; preferenceKey: NavigationPreferenceKey; requiredPermissions?: string[] }> = [
  { path: ROUTES.DASHBOARD, label: 'Tổng quan', icon: <LayoutDashboard size={18} />, preferenceKey: 'dashboard' },
  { path: ROUTES.WEEKLY_MENU, label: 'Thực đơn tuần', icon: <CalendarDays size={18} />, preferenceKey: 'weekly-menu', requiredPermissions: ['coordination.read'] },
  { path: ROUTES.MEAL_ORDERS, label: 'Điều phối đơn', icon: <Utensils size={18} />, preferenceKey: 'meal-orders', requiredPermissions: ['coordination.read'] },
  { path: ROUTES.APPROVALS, label: 'Duyệt vận hành', icon: <ClipboardCheck size={18} />, preferenceKey: 'approvals', requiredPermissions: ['purchase.request.approve'] },
  { path: ROUTES.PURCHASING, label: 'Thu mua', icon: <ShoppingCart size={18} />, preferenceKey: 'purchasing', requiredPermissions: ['purchase.read'] },
  { path: ROUTES.WAREHOUSE, label: 'Kho nguyên liệu', icon: <Warehouse size={18} />, preferenceKey: 'warehouse', requiredPermissions: ['warehouse.read'] },
  { path: ROUTES.CHEF_DASHBOARD, label: 'Bếp trưởng', icon: <ChefHat size={18} />, preferenceKey: 'chef-dashboard', requiredPermissions: ['production.read'] },
  { path: ROUTES.REPORTS, label: 'Báo cáo vận hành', icon: <TrendingUp size={18} />, preferenceKey: 'reports', requiredPermissions: ['report.read'] },
  { path: ROUTES.ADMIN_DATA, label: 'Quản trị dữ liệu', icon: <Database size={18} />, preferenceKey: 'admin-data', requiredPermissions: ['*'] },
  { path: ROUTES.APPROVAL_RULES, label: 'Thiết lập quy trình duyệt', icon: <Settings size={18} />, preferenceKey: 'approval-rules', requiredPermissions: ['*'] },
];

const MainLayoutContent = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppSelector(selectCurrentUser);
  const systemOperation = useSystemOperation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [navigationPreferences, setNavigationPreferences] = useState(readNavigationPreferences);

  const handleLogout = async () => {
    await logoutSession(dispatch, store.getState);
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const isAdmin = currentUser?.isAdminFullAccess || currentUser?.role === 'admin' || currentUser?.permissions?.includes('*');
  const visibleMenuItems = useMemo(() => menuItems.filter((item) => {
    if (systemOperation && !isRouteEligible(systemOperation.mode, item.path)) return false;
    if (!navigationPreferences[item.preferenceKey]) return false;
    if (!item.requiredPermissions) return true;
    if (isAdmin) return true;
    return item.requiredPermissions.some((perm) => currentUser?.permissions?.includes(perm));
  }), [currentUser?.permissions, isAdmin, navigationPreferences, systemOperation]);

  useEffect(() => {
    const refresh = () => setNavigationPreferences(readNavigationPreferences());
    window.addEventListener('storage', refresh);
    window.addEventListener('ipc:navigation-preferences-changed', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('ipc:navigation-preferences-changed', refresh);
    };
  }, []);

  const workflowContext = getWorkflowContextForPath(location.pathname);

  const pageContext = (() => {
    switch (location.pathname) {
      case ROUTES.DASHBOARD:
        return { title: 'Bàn điều hành hôm nay', workflow: 'Tổng quan vận hành', state: 'Theo dõi điểm tắc' };
      case ROUTES.WEEKLY_MENU:
        return { title: 'KHSX và định lượng', workflow: workflowContext.lane.label, state: 'Theo dõi kế hoạch tuần' };
      case ROUTES.MEAL_ORDERS:
        return { title: 'Điều phối suất ăn', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.CHEF_DASHBOARD:
        return { title: 'Bếp sản xuất', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.REPORTS:
        return { title: 'Báo cáo vận hành', workflow: 'Báo cáo vận hành', state: 'Theo dõi vận hành' };
      case ROUTES.APPROVALS:
        return { title: 'Duyệt vận hành', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.PURCHASING:
        return { title: 'Thu mua', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.WAREHOUSE:
        return { title: 'Kho nguyên liệu', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.ADMIN_DATA:
        return { title: 'Quản trị dữ liệu', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.APPROVAL_RULES:
        return { title: 'Thiết lập quy trình duyệt', workflow: 'Phê duyệt', state: 'Cấu hình hệ thống' };
      case ROUTES.ADVANCED_SETTINGS:
        return { title: 'Thiết lập nâng cao', workflow: 'Quản trị hệ thống', state: 'Cấu hình hiển thị' };
      default:
        return { title: 'Hệ thống Quản lý Bếp ăn', workflow: 'Vận hành', state: 'Đang hoạt động' };
    }
  })();

  const serviceDate = serviceDateFormatter.format(new Date());
  const showHeaderState = location.pathname !== ROUTES.MEAL_ORDERS;
  const statusTone = toneFromStatus(pageContext.state);
  const refreshWeeklyMenu = () => dispatch(apiSlice.util.invalidateTags([
    workflowCacheTags.ingredientDemand,
    workflowCacheTags.documents,
    workflowCacheTags.productionPlans,
  ]));

  return (
    <div className="ipc-app-shell ipc-redesign-shell">
      <a href="#ipc-main-content" className="ipc-skip-link">
        {uiCopy.navigation.skipToContent}
      </a>
      {/* Sidebar */}
      <aside className={`ipc-sidebar${isMobileNavOpen ? ' is-mobile-open' : ''}`}>
        <div className="ipc-brand">
          <span className="ipc-brand-icon">
            <ChefHat size={21} />
          </span>
          <div>
            <h2 className="ipc-brand-title">IPC System</h2>
            <div className="ipc-brand-subtitle">Điều hành bếp ăn</div>
          </div>
          <button
            type="button"
            className="ipc-mobile-nav-toggle"
            aria-label={isMobileNavOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            aria-controls="ipc-primary-navigation"
            aria-expanded={isMobileNavOpen}
            onClick={() => setIsMobileNavOpen((current) => !current)}
          >
            {isMobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav
          id="ipc-primary-navigation"
          aria-label={uiCopy.navigation.primary}
          className="ipc-nav"
        >
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onPointerEnter={() => preloadNavigationTarget(item.path)}
                onFocus={() => preloadNavigationTarget(item.path)}
                onTouchStart={() => preloadNavigationTarget(item.path)}
                onClick={() => setIsMobileNavOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'ipc-nav-link',
                  isActive ? 'is-active' : '',
                ].join(' ')}
              >
                <span className="ipc-nav-icon">{item.icon}</span>
                <span className="ipc-nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ipc-sidebar-footer">
          {isAdmin && (
            <Link
              to={ROUTES.ADVANCED_SETTINGS}
              onClick={() => setIsMobileNavOpen(false)}
              aria-current={location.pathname === ROUTES.ADVANCED_SETTINGS ? 'page' : undefined}
              className={`ipc-advanced-settings-link${location.pathname === ROUTES.ADVANCED_SETTINGS ? ' is-active' : ''}`}
            >
              <SlidersHorizontal size={16} />
              <span>Thiết lập nâng cao</span>
            </Link>
          )}
          {currentUser && (
            <div className="ipc-user-card" aria-label={uiCopy.navigation.account}>
              <div className="ipc-avatar">
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <div className="ipc-user-name">{currentUser.fullName}</div>
                <div className="ipc-user-role">
                  {ROLE_LABELS[currentUser.role] ?? 'Nhân viên'}
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="ipc-logout-button"
          >
            <LogOut size={16} className="shrink-0" />
            <span>{uiCopy.actions.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="ipc-content-shell">
        {/* Header */}
        <header className="ipc-header">
          <div className="ipc-header-title-block">
            <span className="ipc-header-workflow">
              <Link to={ROUTES.DASHBOARD} className="hover:underline" style={{ color: 'inherit', textDecoration: 'none' }}>
                Tổng quan
              </Link>
              {location.pathname !== ROUTES.DASHBOARD && (
                <>
                  <span className="mx-1 text-slate-300">/</span>
                  <span>{pageContext.workflow}</span>
                </>
              )}
            </span>
            <h1 className="ipc-page-title">{pageContext.title}</h1>
          </div>
          <div className="ipc-header-context" aria-label="Ngữ cảnh vận hành">
            <div className="ipc-header-chip">
              <CalendarDays size={16} />
              <span>{serviceDate}</span>
            </div>
            {systemOperation && <div className="ipc-header-chip" aria-label="Chế độ vận hành"><SlidersHorizontal size={16} /><span>{systemOperation.label}</span></div>}
            <HeaderShiftContext
              isCoordination={location.pathname === ROUTES.MEAL_ORDERS}
              owner={workflowContext.lane.owner}
            />
            {showHeaderState && (
              location.pathname === ROUTES.WEEKLY_MENU ? (
                <button type="button" className={`ipc-status-pill is-${statusTone}`} onClick={refreshWeeklyMenu} title="Làm mới dữ liệu kế hoạch tuần">
                  <span className="ipc-status-dot" />
                  <span>{pageContext.state}</span>
                </button>
              ) : (
                <div className={`ipc-status-pill is-${statusTone}`}>
                  <span className="ipc-status-dot" />
                  <span>{pageContext.state}</span>
                </div>
              )
            )}
          </div>
        </header>

        {/* Content Outlet */}
        <main
          id="ipc-main-content"
          className="ipc-main"
          tabIndex={-1}
          data-ui-owner={ownershipForRoute(location.pathname).ownerId}
          data-ui-floorplan={ownershipForRoute(location.pathname).floorplanId}
          data-ui-region={ownershipForRoute(location.pathname).regionId}
        >
          <UiOwnershipContext.Provider value={ownershipForRoute(location.pathname)}>
            <Outlet />
          </UiOwnershipContext.Provider>
        </main>
      </div>
    </div>
  );
};

export const MainLayout = () => <SystemOperationProvider><MainLayoutContent /></SystemOperationProvider>;

const routeOwnership = {
   [ROUTES.ADMIN_DATA]: { ownerId: 'uio-0', floorplanId: 'uif-0', regionId: 'uir-0' },
   [ROUTES.ADVANCED_SETTINGS]: { ownerId: 'uio-8', floorplanId: 'uif-8', regionId: 'uir-8' },
   [ROUTES.APPROVAL_RULES]: { ownerId: 'uio-9', floorplanId: 'uif-9', regionId: 'uir-9' },
   [ROUTES.APPROVALS]: { ownerId: 'uio-a', floorplanId: 'uif-a', regionId: 'uir-a' },
   [ROUTES.CHEF_DASHBOARD]: { ownerId: 'uio-d', floorplanId: 'uif-d', regionId: 'uir-d' },
   [ROUTES.DASHBOARD]: { ownerId: 'uio-g', floorplanId: 'uif-g', regionId: 'uir-g' },
   [ROUTES.FORBIDDEN]: { ownerId: 'uio-h', floorplanId: 'uif-h', regionId: 'uir-h' },
   [ROUTES.MEAL_ORDERS]: { ownerId: 'uio-j', floorplanId: 'uif-j', regionId: 'uir-j' },
   [ROUTES.PURCHASING]: { ownerId: 'uio-k', floorplanId: 'uif-k', regionId: 'uir-k' },
   [ROUTES.REPORTS]: { ownerId: 'uio-s', floorplanId: 'uif-s', regionId: 'uir-s' },
   [ROUTES.WAREHOUSE]: { ownerId: 'uio-12', floorplanId: 'uif-12', regionId: 'uir-12' },
   [ROUTES.WEEKLY_MENU]: { ownerId: 'uio-16', floorplanId: 'uif-16', regionId: 'uir-16' },
} as const;

const ownershipForRoute = (pathname: string) => routeOwnership[pathname as keyof typeof routeOwnership] ?? routeOwnership[ROUTES.DASHBOARD];

import { UiOwnershipContext } from '@/components/common/OperationalFrame';
