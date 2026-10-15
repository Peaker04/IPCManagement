import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, Outlet } from 'react-router-dom';
import { clsx } from 'clsx';
import { useAuth } from '../../store/useAuth';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

interface NavLeafItem {
  to: string;
  label: string;
  exact?: boolean;
}

type NavigationEntry =
  | { type: 'link'; to: string; label: string; exact?: boolean }
  | { type: 'parent'; id: string; label: string; children: NavLeafItem[] };

const NAVIGATION_MENU: NavigationEntry[] = [
  { type: 'link', to: '/', label: 'Tổng quan', exact: true },
  {
    type: 'parent',
    id: 'weekly-menu',
    label: 'Thực đơn tuần',
    children: [
      { to: '/weekly-menu', label: 'Kế hoạch tuần', exact: true },
      { to: '/weekly-menu?view=demand', label: 'Bàn giao nguyên liệu' },
      { to: '/weekly-menu?view=production-plan', label: 'Kế hoạch sản xuất' },
      { to: '/weekly-menu?view=cost', label: 'Giá vốn & Định mức BOM' },
    ],
  },
  { type: 'link', to: '/meal-orders', label: 'Điều phối đơn' },
  { type: 'link', to: '/approvals', label: 'Duyệt vận hành' },
  { type: 'link', to: '/purchasing', label: 'Thu mua' },
  { type: 'link', to: '/warehouse', label: 'Kho nguyên liệu' },
  { type: 'link', to: '/chef', label: 'Bếp trưởng' },
  { type: 'link', to: '/reconciliation', label: 'Đối soát nguyên liệu' },
  { type: 'link', to: '/reports', label: 'Báo cáo vận hành' },
  { type: 'link', to: '/admin-data', label: 'Quản trị dữ liệu' },
  { type: 'link', to: '/settings/approval-rules', label: 'Thiết lập quy trình duyệt' },
  { type: 'link', to: '/settings/advanced', label: 'Thiết lập nâng cao' },
];

export interface AppShellProps {
  children?: ReactNode;
}

/**
 * AppShell — Nested Sidebar (Rule N6) & 3-Zone Flat Workbench
 * Left Sidebar: w-60 (240px) with hamburger toggle, nested tree with vertical guide line
 * Right Frame: flex-1 min-w-0 h-dvh flex flex-col overflow-hidden bg-slate-50/40
 */
export function AppShell({ children }: AppShellProps) {
  const { user, logout, operationalMode, setOperationalMode } = useAuth();
  const location = useLocation();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({
    'weekly-menu': true, // Default expanded per Rule N6
  });

  const toggleParent = (parentId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }));
  };

  const toggleMode = () => {
    const nextMode = operationalMode === 'DEFAULT' ? 'MATERIAL_RECONCILIATION' : 'DEFAULT';
    setOperationalMode(nextMode);
  };

  const isCurrentWeeklySubview = (subviewUrl: string) => {
    const currentUrl = `${location.pathname}${location.search}`;
    if (subviewUrl === '/weekly-menu') {
      return location.pathname === '/weekly-menu' && (!location.search || location.search === '?view=schedule');
    }
    return currentUrl === subviewUrl;
  };

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* Left Sidebar (w-60 / 240px shrink-0 or collapsed w-14) */}
      <aside
        className={clsx(
          'shrink-0 border-r border-slate-200 bg-white flex flex-col h-dvh select-none z-30 transition-all duration-200',
          isSidebarCollapsed ? 'w-14' : 'w-60'
        )}
        aria-label="Thanh điều hướng chính"
      >
        {/* Brand / Logo + Hamburger Toggle */}
        <div className="h-14 border-b border-slate-200 px-3.5 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-slate-900 text-white font-black text-xs shrink-0">
              IPC
            </span>
            {!isSidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-tight text-slate-900 leading-none truncate">
                  IPC MANAGEMENT
                </span>
                <span className="text-[11px] text-slate-400 font-mono leading-tight mt-0.5 truncate">
                  v3.0 · Workbench
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
            {isSidebarCollapsed ? '☰' : '⇤'}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {NAVIGATION_MENU.map((entry) => {
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
                  title={isSidebarCollapsed ? entry.label : undefined}
                  className={clsx(
                    'flex items-center gap-2.5 rounded px-3 py-2 text-sm font-medium transition-colors',
                    isDirectActive
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <span className="truncate">{entry.label}</span>
                </NavLink>
              );
            }

            // Parent with Nested Tree (Rule N6)
            const isParentExpanded = expandedParents[entry.id];
            const isAnyChildActive = location.pathname.startsWith('/weekly-menu');

            if (isSidebarCollapsed) {
              return (
                <NavLink
                  key={entry.id}
                  to="/weekly-menu"
                  title={entry.label}
                  className={clsx(
                    'flex items-center justify-center rounded py-2 text-sm font-medium transition-colors',
                    isAnyChildActive
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <span>M</span>
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
                    'w-full flex items-center justify-between rounded px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
                    isAnyChildActive && !isParentExpanded
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <span className="truncate">{entry.label}</span>
                  <span className="text-xs text-slate-400 font-mono transition-transform">
                    {isParentExpanded ? '▾' : '▸'}
                  </span>
                </button>

                {/* Vertical guide line for nested tree children (Rule N6) */}
                {isParentExpanded && (
                  <div className="border-l-2 border-slate-200 ml-4 pl-2 space-y-0.5 my-1">
                    {entry.children.map((child) => {
                      const isActive = isCurrentWeeklySubview(child.to);
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
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
          <div className="border-t border-slate-200 p-3 bg-slate-50/70 shrink-0 space-y-2">
            {/* Operational Mode Toggle (DOM-MODE-1) */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Chế độ:</span>
              <button
                type="button"
                onClick={toggleMode}
                title="Chuyển đổi chế độ vận hành (DOM-MODE-1)"
                className="cursor-pointer"
              >
                <Badge
                  variant={operationalMode === 'MATERIAL_RECONCILIATION' ? 'warning' : 'neutral'}
                  size="sm"
                >
                  {operationalMode === 'MATERIAL_RECONCILIATION' ? 'Đối soát MRX' : 'Mặc định'}
                </Badge>
              </button>
            </div>

            {/* User info */}
            <div className="flex items-center justify-between pt-1">
              <div className="min-w-0 pr-1">
                <p className="text-xs font-medium text-slate-900 truncate">
                  {user?.fullName || 'Người vận hành'}
                </p>
                <p className="text-[11px] font-mono text-slate-400 uppercase truncate">
                  {user?.roleCode || 'GUEST'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={logout}
                title="Đăng xuất"
                className="h-7 px-2 text-slate-500 hover:text-red-600"
              >
                Thoát
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Right Workbench Frame */}
      <main className="flex-1 min-w-0 h-dvh flex flex-col overflow-hidden bg-slate-50/40">
        {children || <Outlet />}
      </main>
    </div>
  );
}
