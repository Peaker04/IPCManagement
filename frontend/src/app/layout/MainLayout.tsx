import { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { ROLE_LABELS, selectCurrentUser } from '@/features/auth';
import { IdleSessionGuard } from '@/features/auth/components/IdleSessionGuard';
import { store } from '@/app/store';
import { logoutSession } from '@/app/session/logoutSession';
import { ROUTES } from '@/lib/routeConfig';
import { preloadRoute, preloadRouteData } from '@/routes/routeLoaders';
import { getWorkflowContextForPath, toneFromStatus } from '@/lib/workflowConfig';
import { apiSlice } from '@/api/apiSlice';
import { workflowCacheTags } from '@/api/workflowCacheTags';
import { uiCopy } from '@/lib/uiCopy';
import { readNavigationPreferences, readPageTabPreferences, readReconciliationSelection } from '@/lib/navigationPreferences';
import { useSystemOperation } from '@/lib/systemOperationContext';
import { SystemOperationProvider } from '@/app/providers/SystemOperationProvider';
import { isRouteVisibleToPermissions } from '@/lib/systemOperationEligibility';
import { canAccessRole } from '@/lib/auth/roleUtils';
import { getDateTimeFormat } from '@/lib/formatters';
import { buildRouteLeafHref, getVisibleRouteChildren, navigationRoutes, resolveActiveRouteLeafId, routeMetadataForPath, routeRegistry, type NavChild, type RoutePath } from '@/routes/routeRegistry';
import { StatusBadge } from '@/components/common';
import {
  CalendarDays,
  ChefHat,
  ChevronDown,
  LogOut,
  Menu,
  SlidersHorizontal,
  X,
} from 'lucide-react';

const serviceDateFormatter = getDateTimeFormat('vi-VN');

const preloadNavigationTarget = (path: string, mode: 'DEFAULT' | 'MATERIAL_RECONCILIATION') => {
  void preloadRoute(path, mode);
  void preloadRouteData(path, mode);
};

const menuItems = navigationRoutes;

const MainLayoutContent = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppSelector(selectCurrentUser);
  const systemOperation = useSystemOperation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [navigationPreferences, setNavigationPreferences] = useState(readNavigationPreferences);
  const [pageTabPreferences, setPageTabPreferences] = useState(readPageTabPreferences);
  const [reconciliationSelection, setReconciliationSelection] = useState(readReconciliationSelection);
  const [toggledGroups, setToggledGroups] = useState<Record<string, { atPath: string; open: boolean }>>({});

  const handleLogout = async () => {
    await logoutSession(dispatch, store.getState);
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const isAdmin = currentUser?.isAdminFullAccess || currentUser?.role === 'admin' || currentUser?.permissions?.includes('*');
  const visibleMenuItems = useMemo(() => menuItems.filter((item) => {
    if (item.reconciliationOnly && systemOperation?.mode !== 'MATERIAL_RECONCILIATION') return false;
    if (systemOperation?.mode === 'MATERIAL_RECONCILIATION' && item.reconciliationRoles && !canAccessRole(currentUser, [...item.reconciliationRoles])) return false;
    if (!item.preferenceKey || !navigationPreferences[item.preferenceKey]) return false;
    return isRouteVisibleToPermissions(
      systemOperation?.mode ?? 'DEFAULT',
      item.path,
      item.requiredPermissions,
      currentUser?.permissions,
      isAdmin,
    );
  }), [currentUser, isAdmin, navigationPreferences, systemOperation]);

  useEffect(() => {
    const refresh = () => { setNavigationPreferences(readNavigationPreferences()); setPageTabPreferences(readPageTabPreferences()); };
    const refreshReconciliationSelection = () => setReconciliationSelection(readReconciliationSelection());
    window.addEventListener('storage', refresh);
    window.addEventListener('ipc:navigation-preferences-changed', refresh);
    window.addEventListener('ipc:page-tab-preferences-changed', refresh);
    window.addEventListener('ipc:navigation-preferences-v2-changed', refresh);
    window.addEventListener('storage', refreshReconciliationSelection);
    window.addEventListener('ipc:reconciliation-selection-changed', refreshReconciliationSelection);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('ipc:navigation-preferences-changed', refresh);
      window.removeEventListener('ipc:page-tab-preferences-changed', refresh);
      window.removeEventListener('ipc:navigation-preferences-v2-changed', refresh);
      window.removeEventListener('storage', refreshReconciliationSelection);
      window.removeEventListener('ipc:reconciliation-selection-changed', refreshReconciliationSelection);
    };
  }, []);

  const workflowContext = getWorkflowContextForPath(location.pathname);
  const routeMetadata = routeMetadataForPath(location.pathname) ?? routeRegistry[ROUTES.DASHBOARD];
  const pageContext = { title: routeMetadata.shellTitle, workflow: routeMetadata.workflow ?? workflowContext.lane.label, state: routeMetadata.headerState };

  const scopedServiceDate = location.pathname === ROUTES.WEEKLY_MENU
    ? new URLSearchParams(location.search).get('weekStartDate')
    : null;
  const selectedReconciliationWeek = systemOperation?.mode === 'MATERIAL_RECONCILIATION'
    ? reconciliationSelection.weekStartDate
    : undefined;
  const serviceDate = scopedServiceDate || selectedReconciliationWeek
    ? `Tuần ${serviceDateFormatter.format(new Date(`${scopedServiceDate || selectedReconciliationWeek}T00:00:00`))}`
    : serviceDateFormatter.format(new Date());
  const showHeaderState = location.pathname !== ROUTES.MEAL_ORDERS;
  const statusTone = toneFromStatus(pageContext.state);
  const refreshWeeklyMenu = () => {
    if (systemOperation?.mode === 'MATERIAL_RECONCILIATION') {
      dispatch(apiSlice.util.invalidateTags([
        'ReconciliationBatches' as unknown as (typeof workflowCacheTags)[keyof typeof workflowCacheTags],
        'ReconciliationIssueHistory' as unknown as (typeof workflowCacheTags)[keyof typeof workflowCacheTags],
      ]));
    } else {
      dispatch(apiSlice.util.invalidateTags([workflowCacheTags.ingredientDemand, workflowCacheTags.documents, workflowCacheTags.productionPlans]));
    }
  };

  const [searchParams] = useSearchParams();
  const currentView = searchParams.get('view');
  const currentMode = systemOperation?.mode ?? 'DEFAULT';
  const getVisibleChildren = (path: RoutePath): readonly NavChild[] => getVisibleRouteChildren(path, { mode: currentMode, isAdmin: Boolean(isAdmin), permissions: currentUser?.permissions, pageTabPreferences, backendPageTabs: systemOperation?.capabilities?.pageTabs });
  const resolveActiveLeafId = (path: RoutePath, children: readonly NavChild[]): string | undefined => location.pathname !== path ? undefined : resolveActiveRouteLeafId(path, currentView, children);
  const isGroupExpanded = (path: string): boolean => toggledGroups[path]?.atPath === location.pathname ? toggledGroups[path].open : location.pathname === path || location.pathname.startsWith(`${path}/`);
  const toggleGroup = (path: string) => setToggledGroups((prev) => ({ ...prev, [path]: { atPath: location.pathname, open: !isGroupExpanded(path) } }));
  const isAncestorOfCurrent = (item: typeof menuItems[number], children: readonly NavChild[]): boolean => children.length > 0 && (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`) || routeMetadata?.preferenceKey === item.preferenceKey);

  return (
    <div className="ipc-app-shell">
      <IdleSessionGuard onLogout={handleLogout} />
      <a href="#ipc-main-content" className="ipc-skip-link">{uiCopy.navigation.skipToContent}</a>
      <aside className={`ipc-sidebar${isMobileNavOpen ? ' is-mobile-open' : ''}`}>
        <div className="ipc-brand">
          <span className="ipc-brand-icon">
            <ChefHat size={21} />
          </span><div><h2 className="ipc-brand-title">IPC System</h2><div className="ipc-brand-subtitle">Điều hành bếp ăn</div></div>
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
        {currentMode === 'MATERIAL_RECONCILIATION' && <div className="ipc-sidebar-mode-banner" aria-label="Chế độ vận hành hiện tại"><span className="ipc-sidebar-mode-dot" aria-hidden="true" /><span className="ipc-sidebar-mode-label">Chế độ: Đối chiếu nguyên liệu</span></div>}
        <nav id="ipc-primary-navigation" aria-label={uiCopy.navigation.primary} className="ipc-nav">
          {visibleMenuItems.map((item, index) => {
            const isActive = location.pathname === item.path;
            const visibleChildren = getVisibleChildren(item.path);
            const hasChildren = visibleChildren.length > 1;
            const ancestor = isAncestorOfCurrent(item, visibleChildren);
            const isExpanded = hasChildren && isGroupExpanded(item.path);
            const activeLeafId = resolveActiveLeafId(item.path, visibleChildren);
            const Icon = item.icon!;
            const isGovernanceStart = currentMode === 'DEFAULT' && index > 0 && (item.path === ROUTES.REPORTS || item.path === ROUTES.ADMIN_DATA || item.path === ROUTES.APPROVAL_RULES) && !([ROUTES.REPORTS, ROUTES.ADMIN_DATA, ROUTES.APPROVAL_RULES] as string[]).includes(visibleMenuItems[index - 1]?.path ?? '');
            return (
              <div key={item.path} className={['ipc-nav-group', hasChildren ? 'has-children' : '', isExpanded ? 'is-expanded' : '', isGovernanceStart ? 'has-section-divider' : ''].filter(Boolean).join(' ')}><div className="ipc-nav-item-row">
                  <Link
                    to={item.path}
                    onPointerEnter={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}
                    onFocus={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}
                    onTouchStart={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}
                    onClick={() => { setIsMobileNavOpen(false); if (hasChildren) { if (isActive) toggleGroup(item.path); else setToggledGroups((prev) => ({ ...prev, [item.path]: { atPath: item.path, open: true } })); } }}
                    aria-current={isActive ? 'page' : undefined}
                    aria-expanded={hasChildren ? isExpanded : undefined}
                    data-active-ancestor={ancestor || undefined}
                    className={['ipc-nav-link', isActive ? 'is-active' : '', ancestor ? 'is-ancestor' : ''].filter(Boolean).join(' ')}
                  >
                    <span className="ipc-nav-icon"><Icon size={18} /></span>
                    <span className="ipc-nav-label">{item.navLabel}</span>
                    {hasChildren && (
                      <button
                        type="button"
                        aria-label={isExpanded ? `Thu gọn ${item.navLabel}` : `Mở rộng ${item.navLabel}`}
                        aria-expanded={isExpanded}
                        className={`ipc-nav-chevron${isExpanded ? ' is-expanded' : ''}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleGroup(item.path);
                        }}
                      >
                        <ChevronDown size={14} aria-hidden="true" />
                      </button>
                    )}
                  </Link>
                </div>{isExpanded && (
                  <nav aria-label={`${item.navLabel} sub-navigation`} className="ipc-nav-leaf-list">
                    {visibleChildren.map((child) => {
                      const leafPath = buildRouteLeafHref(item.path, child.id, location.pathname, location.search) || `${item.path}?view=${child.id}`;
                      const leafActive = activeLeafId === child.id;
                      return <Link key={child.id} to={leafPath} onPointerEnter={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')} onFocus={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')} onClick={() => setIsMobileNavOpen(false)} aria-current={leafActive ? 'page' : undefined} className={['ipc-nav-leaf-link', leafActive ? 'is-active' : ''].filter(Boolean).join(' ')}><span className="ipc-nav-leaf-label">{child.label}</span></Link>;
                    })}
                  </nav>
                )}</div>
            );
          })}
        </nav>
        <div className="ipc-sidebar-footer">
          {isAdmin && (() => {
            const isAdvActive = location.pathname === ROUTES.ADVANCED_SETTINGS;
            const advChildren = getVisibleChildren(ROUTES.ADVANCED_SETTINGS);
            const isAdvExpanded = isGroupExpanded(ROUTES.ADVANCED_SETTINGS);
            const activeAdvLeaf = resolveActiveLeafId(ROUTES.ADVANCED_SETTINGS, advChildren);
            return (
              <div className={`ipc-nav-group has-children${isAdvExpanded ? ' is-expanded' : ''}`}><div className="ipc-nav-item-row">
                  <Link to={ROUTES.ADVANCED_SETTINGS} onPointerEnter={() => preloadNavigationTarget(ROUTES.ADVANCED_SETTINGS, systemOperation?.mode ?? 'DEFAULT')} onFocus={() => preloadNavigationTarget(ROUTES.ADVANCED_SETTINGS, systemOperation?.mode ?? 'DEFAULT')} onClick={() => { setIsMobileNavOpen(false); if (isAdvActive) toggleGroup(ROUTES.ADVANCED_SETTINGS); else setToggledGroups((prev) => ({ ...prev, [ROUTES.ADVANCED_SETTINGS]: { atPath: ROUTES.ADVANCED_SETTINGS, open: true } })); }} aria-current={isAdvActive ? 'page' : undefined} aria-expanded={isAdvExpanded} data-active-ancestor={isAdvActive || undefined} className={`ipc-advanced-settings-link${isAdvActive ? ' is-active is-ancestor' : ''}`}>
                    <span className="ipc-nav-icon"><SlidersHorizontal size={16} /></span>
                    <span className="ipc-nav-label">Thiết lập nâng cao</span>
                    <button
                      type="button"
                      aria-label={isAdvExpanded ? 'Thu gọn Thiết lập nâng cao' : 'Mở rộng Thiết lập nâng cao'}
                      aria-expanded={isAdvExpanded}
                      className={`ipc-nav-chevron${isAdvExpanded ? ' is-expanded' : ''}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleGroup(ROUTES.ADVANCED_SETTINGS);
                      }}
                    >
                      <ChevronDown size={14} aria-hidden="true" />
                    </button>
                  </Link>
                </div>
                {isAdvExpanded && <nav aria-label="Thiết lập nâng cao sub-navigation" className="ipc-nav-leaf-list">{advChildren.map((child) => { const leafActive = activeAdvLeaf === child.id; return <Link key={child.id} to={`${ROUTES.ADVANCED_SETTINGS}?view=${child.id}`} onClick={() => setIsMobileNavOpen(false)} aria-current={leafActive ? 'page' : undefined} className={['ipc-nav-leaf-link', leafActive ? 'is-active' : ''].filter(Boolean).join(' ')}><span className="ipc-nav-leaf-label">{child.label}</span></Link>; })}</nav>}
              </div>
            );
          })()}
          {currentUser && <div className="ipc-user-card" aria-label={uiCopy.navigation.account}><div className="ipc-avatar">{currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}</div><div className="min-w-0"><div className="ipc-user-name">{currentUser.fullName}</div><div className="ipc-user-role">{ROLE_LABELS[currentUser.role] ?? 'Nhân viên'}</div></div></div>}
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
                  {location.pathname === ROUTES.WEEKLY_MENU ? (
                    <>
                      <Link to={ROUTES.WEEKLY_MENU} className="hover:underline" style={{ color: 'inherit', textDecoration: 'none' }}>
                        Thực đơn tuần
                      </Link>
                      <span className="mx-1 text-slate-300">/</span>
                      <span>
                        {currentView === 'demand'
                          ? 'Bàn giao nguyên liệu'
                          : currentView === 'production-plan'
                            ? 'Kế hoạch sản xuất'
                            : currentView === 'cost'
                              ? 'Giá vốn & Định mức BOM'
                              : 'Kế hoạch tuần'}
                      </span>
                    </>
                  ) : (
                    <span>{pageContext.workflow}</span>
                  )}
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
            {showHeaderState && (
              location.pathname === ROUTES.WEEKLY_MENU ? (
                <button type="button" onClick={refreshWeeklyMenu} title="Làm mới dữ liệu kế hoạch tuần" className="cursor-pointer transition-opacity hover:opacity-80">
                  <StatusBadge variant={statusTone}>{pageContext.state}</StatusBadge>
                </button>
              ) : (
                <StatusBadge variant={statusTone}>{pageContext.state}</StatusBadge>
              )
            )}
          </div>
        </header>

        {/* Content Outlet */}
        <main
          id="ipc-main-content"
          className="ipc-main"
          tabIndex={-1}
          data-ui-owner={routeMetadata.ownership?.ownerId ?? routeRegistry[ROUTES.DASHBOARD].ownership!.ownerId}
          data-ui-floorplan={routeMetadata.ownership?.floorplanId ?? routeRegistry[ROUTES.DASHBOARD].ownership!.floorplanId}
          data-ui-region={routeMetadata.ownership?.regionId ?? routeRegistry[ROUTES.DASHBOARD].ownership!.regionId}
        >
          <UiOwnershipContext.Provider value={routeMetadata.ownership ?? routeRegistry[ROUTES.DASHBOARD].ownership!}>
            <Outlet />
          </UiOwnershipContext.Provider>
        </main>
      </div>
    </div>
  );
};

export const MainLayout = () => <SystemOperationProvider><MainLayoutContent /></SystemOperationProvider>;

import { UiOwnershipContext } from '@/components/common/OperationalFrame';
