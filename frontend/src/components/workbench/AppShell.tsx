import { useState, type MouseEvent, type ReactNode } from 'react';
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

function toNavigationMenu(routes: AppShellNavigationRoute[]): NavigationEntry[] {
  const entries: NavigationEntry[] = [];
  const administration: NavLeafItem[] = [];
  for (const route of routes) {
    if (route.path === '/login' || route.path === '/forbidden') continue;
    const children = route.leaves?.map((leaf) => ({ to: leaf.to, label: leaf.label, exact: leaf.to === route.path }));
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
}

/**
 * AppShell — Nested Sidebar (Rule N6) & 3-Zone Flat Workbench
 * Left Sidebar: w-60 (240px) with hamburger toggle, real Lucide icons, nested tree with vertical guide line
 * Right Frame: flex-1 min-w-0 h-dvh flex flex-col overflow-hidden bg-slate-50/40
 */
export function AppShell({ children, navigation }: AppShellProps) {
  const { user, logout, operationalMode, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { requestNavigation } = useDirtyNavigation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({
    'weekly-menu': true,
    warehouse: true,
    chef: true,
    reconciliation: true,
    reports: true,
    administration: true,
  });

  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }));
  };

  const visibleNavigation = toNavigationMenu(navigation);

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>, to: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof window !== 'undefined' && window.innerWidth < 768) setIsSidebarCollapsed(true);
    if (!requestNavigation(() => navigate(to))) event.preventDefault();
  };

  const isCurrentSubview = (subviewUrl: string) => {
    const [path, query = ''] = subviewUrl.split('?');
    if (location.pathname !== path) return false;
    if (!query) return !location.search;
    return location.search === `?${query}`;
  };

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* Left Sidebar (w-60 / 240px shrink-0 or collapsed w-16) */}
      <aside
        className={clsx(
          'shrink-0 border-r border-slate-200 bg-white flex flex-col h-dvh select-none z-30 transition-all duration-150 ease-out',
          isSidebarCollapsed ? 'w-16' : 'w-60',
          !isSidebarCollapsed && 'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:shadow-2xl'
        )}
        aria-label="Thanh điều hướng chính"
      >
        {/* Brand / Logo + Hamburger Toggle */}
        <div className="h-14 border-b border-slate-200 px-3.5 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white shadow-2xs shrink-0">
              <ChefHat size={18} />
            </span>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold tracking-tight text-slate-900 leading-none truncate">
                  IPC System
                </span>
                <span className="text-xs text-slate-600 font-medium leading-tight mt-1 truncate">
                  Điều hành bếp ăn
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={isSidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            className="h-7 w-7 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
          >
            {isSidebarCollapsed ? <Menu size={18} /> : <X size={18} />}
          </button>
        </div>

        {/* Navigation Items with Real Lucide Icons */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
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
                  title={isSidebarCollapsed ? entry.label : undefined}
                  className={clsx(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
            const isParentExpanded = expandedParents[entry.id];
            const parentPath = entry.children[0]?.to.split('?')[0] || '';
            const isAnyChildActive = location.pathname === parentPath;

            if (isSidebarCollapsed) {
              return (
                <NavLink
                  key={entry.id}
                  to={entry.children[0]?.to || '/'}
                  onClick={(event) => handleNavigation(event, entry.children[0]?.to || '/')}
                  title={entry.label}
                  className={clsx(
                    'flex items-center justify-center rounded-md py-2.5 text-sm font-medium transition-colors',
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
        {!isSidebarCollapsed && (
          <div className="border-t border-slate-200 p-3 bg-slate-50/70 shrink-0 space-y-2.5">
            {/* Operational mode is changed only in the guarded settings workflow. */}
            {user && hasRole('Admin') && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Chế độ:</span>
                <NavLink
                  to="/settings/advanced?view=mode"
                  onClick={(event) => handleNavigation(event, '/settings/advanced?view=mode')}
                  aria-label={`Chế độ vận hành hiện tại: ${operationalMode === 'MATERIAL_RECONCILIATION' ? 'Đối soát MRX' : 'Mặc định'}`}
                  title="Mở thiết lập chế độ vận hành"
                >
                  <Badge
                    variant={operationalMode === 'MATERIAL_RECONCILIATION' ? 'warning' : 'neutral'}
                    size="sm"
                  >
                    {operationalMode === 'MATERIAL_RECONCILIATION' ? 'Đối soát MRX' : 'Mặc định'}
                  </Badge>
                </NavLink>
              </div>
            )}

            {/* User info card */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs shrink-0">
                  {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {user?.fullName || 'Người vận hành'}
                  </p>
                  <p className="text-xs font-mono text-slate-600 uppercase truncate">
                    {user?.roleCode || 'GUEST'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={logout}
                title="Đăng xuất"
                className="h-7 px-2 text-slate-500 hover:text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} className="mr-1" />
                <span>Thoát</span>
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Backdrop when sidebar is expanded on small screens */}
      {!isSidebarCollapsed && (
        <div
          role="presentation"
          onClick={() => setIsSidebarCollapsed(true)}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-20 md:hidden"
        />
      )}

      {/* Right Workbench Frame */}
      <main className="flex-1 min-w-0 h-dvh flex flex-col overflow-hidden bg-slate-50/40">
        {children || <Outlet />}
      </main>
    </div>
  );
}
