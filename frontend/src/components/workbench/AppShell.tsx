import { useState, useEffect, startTransition, type MouseEvent, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  CalendarDays,
  ChefHat,
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  Scale,
  Settings,
  ShoppingCart,
  TrendingUp,
  Utensils,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../store/useAuth';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useDirtyNavigation } from './dirty-navigation-context';
import { NetworkConnectivityBanner } from './NetworkConnectivityBanner';
import { useWorkspaceSessionScope, type WorkspaceSessionScope } from '../../store/workspaceSessionStore';
import { isWeekStartDate } from '../../utils/dates';
import { useWorkspaceUiState } from '../../store/workspaceUiState';

interface NavLeafItem {
  to: string;
  label: string;
  exact?: boolean;
}

type NavigationEntry =
  | { type: 'link'; to: string; label: string; icon: LucideIcon; exact?: boolean }
  | { type: 'parent'; id: string; label: string; icon: LucideIcon; children: NavLeafItem[] };

const ROUTE_ICONS: Record<string, LucideIcon> = {
  '/': LayoutDashboard,
  '/weekly-menu': CalendarDays,
  '/meal-orders': Utensils,
  '/approvals': ClipboardCheck,
  '/purchasing': ShoppingCart,
  '/warehouse': Warehouse,
  '/chef': ChefHat,
  '/reconciliation': Scale,
  '/reports': TrendingUp,
  '/admin-data': Settings,
  '/settings/approval-rules': Settings,
  '/settings/advanced': Settings,
};

interface AppShellNavigationRoute {
  path: string;
  title: string;
  navigationLabel?: string;
  leaves?: Array<{ to: string; label: string }>;
}

function toNavigationMenu(routes: AppShellNavigationRoute[], pathname: string, search: string, scope: WorkspaceSessionScope): NavigationEntry[] {
  const entries: NavigationEntry[] = [];
  const administration: NavLeafItem[] = [];
  for (const route of routes) {
    if (route.path === '/login' || route.path === '/forbidden') continue;
    const children = route.leaves?.map((leaf) => {
      const params = new URLSearchParams(leaf.to.split('?')[1] ?? '');
      if (route.path === '/weekly-menu' && params.get('view')?.startsWith('mrx-')) {
        const current = new URLSearchParams(search);
        const explicit = pathname === '/weekly-menu' && (current.has('customerId') || current.has('weekStartDate'));
        const customerId = current.get('customerId') ?? '';
        const weekStartDate = current.get('weekStartDate') ?? '';
        const saved = scope.weeklyMenuScope || (scope.customerId && isWeekStartDate(scope.weekStartDate) ? { customerId: scope.customerId, weekStartDate: scope.weekStartDate } : undefined);
        const matchingSaved = saved && (!customerId || customerId === saved.customerId) && (!weekStartDate || weekStartDate === saved.weekStartDate) ? saved : null;
        const pair = explicit ? customerId && isWeekStartDate(weekStartDate) ? { customerId, weekStartDate } : matchingSaved : saved;
        if (pair?.customerId && isWeekStartDate(pair.weekStartDate)) {
          params.set('customerId', pair.customerId);
          params.set('weekStartDate', pair.weekStartDate);
        }
        return { to: `/weekly-menu?${params}`, label: leaf.label, exact: false };
      }
      return { to: leaf.to, label: leaf.label, exact: leaf.to === route.path };
    });
    if (route.path === '/admin-data' || route.path.startsWith('/settings/')) {
      administration.push(...(children ?? [{ to: route.path, label: route.navigationLabel ?? route.title }]));
      continue;
    }
    const icon = ROUTE_ICONS[route.path] ?? Menu;
    entries.push(children
      ? { type: 'parent', id: route.path.slice(1) || 'root', label: route.navigationLabel ?? route.title, icon, children }
      : { type: 'link', to: route.path, label: route.navigationLabel ?? route.title, icon, exact: route.path === '/' });
  }
  if (administration.length > 0) {
    entries.push({ type: 'parent', id: 'administration', label: 'Quản trị hệ thống', icon: Settings, children: administration });
  }
  return entries;
}

export interface AppShellProps {
  children?: ReactNode;
  navigation: AppShellNavigationRoute[];
  homePath?: string;
}

function activeParentKeyForPath(pathname: string): string | null {
  if (pathname.startsWith('/weekly-menu')) return 'weekly-menu';
  if (pathname.startsWith('/warehouse')) return 'warehouse';
  if (pathname.startsWith('/chef')) return 'chef';
  if (pathname.startsWith('/reconciliation')) return 'reconciliation';
  if (pathname.startsWith('/reports')) return 'reports';
  if (pathname.startsWith('/admin-data') || pathname.startsWith('/settings')) return 'administration';
  return null;
}

/**
 * AppShell — Nested Sidebar (Rule N6) & 3-Zone Flat Workbench
 * Left Sidebar: w-60 (240px) with hamburger toggle, real Lucide icons, nested tree with vertical guide line
 * Right Frame: flex-1 min-w-0 h-dvh flex flex-col overflow-hidden bg-slate-50/40
 */
export function AppShell({ children, navigation, homePath = '/' }: AppShellProps) {
  const { user, logout, operationalMode, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { requestNavigation } = useDirtyNavigation();
  const { density, sidebarOpen, updateConfig } = useWorkspaceUiState({
    tableKey: 'global_app_shell',
    userId: user?.userId,
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 768 && process.env.NODE_ENV !== 'test') {
      return true;
    }
    return !sidebarOpen;
  });
  const toggleSidebar = () => {
    const collapsed = !isSidebarCollapsed;
    setIsSidebarCollapsed(collapsed);
    if (window.innerWidth >= 768) updateConfig({ sidebarOpen: !collapsed });
  };
  useEffect(() => {
    const collapseCompactSidebar = () => {
      if (window.innerWidth < 768) setIsSidebarCollapsed(true);
    };
    window.addEventListener('resize', collapseCompactSidebar);
    return () => window.removeEventListener('resize', collapseCompactSidebar);
  }, []);

  const activeParentKey = activeParentKeyForPath(location.pathname);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>(() => {
    const initialActiveKey = typeof window !== 'undefined' ? activeParentKeyForPath(location.pathname) : null;
    return initialActiveKey ? { [initialActiveKey]: true } : {};
  });

  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !(prev[parentId] ?? parentId === activeParentKey),
    }));
  };

  const [workspaceScope] = useWorkspaceSessionScope();
  const visibleNavigation = toNavigationMenu(navigation, location.pathname, location.search, workspaceScope);

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarCollapsed(true);
    if (!requestNavigation(() => startTransition(() => navigate(to)))) event.preventDefault();
  };

  const isCurrentSubview = (subviewUrl: string) => {
    const [targetPath, targetQueryString = ''] = subviewUrl.split('?');
    if (location.pathname !== targetPath) return false;

    const currentParams = new URLSearchParams(location.search);
    const targetParams = new URLSearchParams(targetQueryString);

    const targetView = targetParams.get('view');
    const currentView = currentParams.get('view');

    if (targetView) {
      return currentView === targetView;
    }

    return !currentView || currentView === 'lines' || currentView === 'schedule';
  };

  const modeLabel = operationalMode === 'MATERIAL_RECONCILIATION' ? 'Đối soát MRX' : 'Mặc định';
  const userLabel = `${user?.fullName || 'Người vận hành'} · ${user?.roleCode || 'GUEST'}`;

  return (
    <div
      data-density={density}
      className="flex h-dvh w-screen overflow-hidden bg-slate-50 text-slate-800"
    >
      {/* Mobile Drawer Backdrop */}
      {!isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-25 md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Floating Trigger when Collapsed */}
      {isSidebarCollapsed && (
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed(false)}
          aria-label="Mở menu điều hướng"
          className="fixed bottom-4 left-4 z-40 h-10 w-10 flex items-center justify-center rounded-full bg-slate-900 text-white shadow-lg md:hidden cursor-pointer hover:bg-slate-800 transition-colors"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Left Sidebar (w-60 / 240px shrink-0 or collapsed w-16) */}
      <aside
        className={clsx(
          'shrink-0 border-r border-slate-200 bg-white flex flex-col h-dvh select-none z-30 transition-all duration-150 ease-out',
          isSidebarCollapsed ? 'w-16 max-md:hidden' : 'w-60',
          !isSidebarCollapsed && 'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-2xl'
        )}
        aria-label="Thanh điều hướng chính"
      >
        {/* Brand / Logo + Hamburger Toggle */}
        <div className={clsx('h-14 border-b border-slate-200 flex items-center shrink-0 bg-white', isSidebarCollapsed ? 'justify-center' : 'px-3.5 justify-between')}>
          {!isSidebarCollapsed && <NavLink
            to={homePath}
            onClick={(event) => handleNavigation(event, homePath)}
            className="flex items-center gap-2.5 min-w-0 hover:opacity-85 transition-opacity"
            title="Về trang làm việc chính"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-2xs shrink-0">
              <ChefHat size={18} />
            </span>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold tracking-tight text-slate-900 leading-none truncate">
                IPC System
              </span>
              <span className="text-xs text-slate-600 font-medium leading-tight mt-1 truncate">
                Điều hành bếp ăn
              </span>
            </div>
          </NavLink>}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            aria-expanded={!isSidebarCollapsed}
            title={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            className={clsx('flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 transition-colors cursor-pointer shrink-0', isSidebarCollapsed ? 'h-10 w-10' : 'h-7 w-7')}
          >
            {isSidebarCollapsed ? <Menu size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
          </button>
        </div>

        {/* Navigation Items with Real Lucide Icons */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-0.5 no-scrollbar">
          {visibleNavigation.map((entry) => {
            const Icon = entry.icon;

            if (entry.type === 'link') {
              const isDirectActive =
                entry.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(entry.to);
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.exact}
                  onClick={(event) => handleNavigation(event, entry.to)}
                  aria-label={entry.label}
                  title={isSidebarCollapsed ? entry.label : undefined}
                  className={clsx(
                    'flex items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400',
                    isSidebarCollapsed ? 'mx-auto h-10 w-10 justify-center p-0' : 'gap-3 px-3 py-2',
                    isDirectActive
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">{entry.label}</span>}
                </NavLink>
              );
            }

            // Parent with Nested Tree (Rule N6)
            const isParentExpanded = expandedParents[entry.id] ?? entry.id === activeParentKey;
            const parentPath = entry.children[0]?.to.split('?')[0] || '';
            const isAnyChildActive = location.pathname === parentPath;

            if (isSidebarCollapsed) {
              return (
                <NavLink
                  key={entry.id}
                  to={entry.children[0]?.to || '/'}
                  onClick={(event) => handleNavigation(event, entry.children[0]?.to || '/')}
                  aria-label={entry.label}
                  title={entry.label}
                  className={clsx(
                    'mx-auto h-10 w-10 p-0 flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400',
                    isAnyChildActive
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                </NavLink>
              );
            }

            return (
              <div key={entry.id} className="space-y-1">
                <button
                  type="button"
                  aria-expanded={isParentExpanded}
                  onClick={() => toggleParent(entry.id)}
                  className={clsx(
                    'w-full flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                    isAnyChildActive && !isParentExpanded
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={18} className="shrink-0 text-slate-500" />
                    <span className="truncate">{entry.label}</span>
                  </div>
                  <ChevronDown
                    size={15}
                    className={clsx(
                      'text-slate-400 shrink-0 transition-transform duration-150',
                      isParentExpanded && 'rotate-180'
                    )}
                  />
                </button>

                {/* Vertical guide line for nested tree children (Rule N6) */}
                {isParentExpanded && (
                  <div className="border-l-2 border-slate-200 ml-5 pl-2.5 space-y-0.5 my-1">
                    {entry.children.map((child) => {
                      const isActive = isCurrentSubview(child.to);
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          aria-current={isActive ? 'page' : false}
                          onClick={(event) => handleNavigation(event, child.to)}
                          className={clsx(
                            'block rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                            isActive
                              ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          )}
                        >
                          <span className="truncate">{child.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer: User Profile + Mode Badge + Logout */}
        <div className={clsx('border-t border-slate-200 bg-slate-50/70 shrink-0', isSidebarCollapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'p-3 space-y-2.5')}>
          {/* Operational mode is changed only in the guarded settings workflow. */}
          {user && hasRole('Admin') && (
            <div className={isSidebarCollapsed ? 'flex justify-center' : 'flex items-center justify-between'}>
              {!isSidebarCollapsed && <span className="text-xs text-slate-500 font-medium">Chế độ:</span>}
              <NavLink
                to="/settings/advanced?view=mode"
                onClick={(event) => handleNavigation(event, '/settings/advanced?view=mode')}
                aria-label={`Chế độ vận hành hiện tại: ${modeLabel}`}
                title={`${modeLabel} · Mở thiết lập chế độ vận hành`}
                className={isSidebarCollapsed ? 'h-10 w-10 flex items-center justify-center rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400' : undefined}
              >
                <Badge
                  variant={operationalMode === 'MATERIAL_RECONCILIATION' ? 'warning' : 'neutral'}
                  size="sm"
                  className={isSidebarCollapsed ? 'px-1' : undefined}
                >
                  {isSidebarCollapsed ? (operationalMode === 'MATERIAL_RECONCILIATION' ? 'MRX' : 'STD') : modeLabel}
                </Badge>
              </NavLink>
            </div>
          )}

          <div className={clsx('flex items-center', isSidebarCollapsed ? 'flex-col gap-2' : 'justify-between pt-1 border-t border-slate-200/60')}>
            <div className={clsx('flex items-center min-w-0', !isSidebarCollapsed && 'gap-2 pr-1')}>
              <div
                role={isSidebarCollapsed ? 'img' : undefined}
                aria-label={isSidebarCollapsed ? userLabel : undefined}
                aria-hidden={isSidebarCollapsed ? undefined : true}
                title={isSidebarCollapsed ? userLabel : undefined}
                className={clsx('rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0 leading-none select-none', isSidebarCollapsed ? 'h-8 w-8' : 'h-7 w-7')}
              >
                <span className="pt-[1px]">{user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}</span>
              </div>
              {!isSidebarCollapsed && <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.fullName || 'Người vận hành'}
                </p>
                <p className="text-xs font-mono text-slate-600 uppercase truncate">
                  {user?.roleCode || 'GUEST'}
                </p>
              </div>}
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={logout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
              className={clsx('text-slate-500 hover:text-red-600 hover:bg-red-50', isSidebarCollapsed ? 'h-10 w-10 p-0' : 'h-7 px-2')}
            >
              <LogOut size={14} className={isSidebarCollapsed ? undefined : 'mr-1'} aria-hidden="true" />
              {!isSidebarCollapsed && <span>Thoát</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Right Workbench Frame */}
      <main className="flex-1 min-w-0 h-dvh flex flex-col overflow-hidden bg-slate-50/40">
        <NetworkConnectivityBanner />
        {children || <Outlet />}
      </main>
    </div>
  );
}
