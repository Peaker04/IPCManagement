import { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
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
import { readNavigationPreferences, readReconciliationSelection } from '@/lib/navigationPreferences';
import { useSystemOperation } from '@/lib/systemOperationContext';
import { SystemOperationProvider } from '@/app/providers/SystemOperationProvider';
import { isRouteVisibleToPermissions } from '@/lib/systemOperationEligibility';
import { canAccessRole } from '@/lib/auth/roleUtils';
import { getDateTimeFormat } from '@/lib/formatters';
import { navigationRoutes, routeMetadataForPath, routeRegistry } from '@/routes/routeRegistry';
import {
  CalendarDays,
  ChefHat,
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
  const [reconciliationSelection, setReconciliationSelection] = useState(readReconciliationSelection);

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
    const refresh = () => setNavigationPreferences(readNavigationPreferences());
    const refreshReconciliationSelection = () => setReconciliationSelection(readReconciliationSelection());
    window.addEventListener('storage', refresh);
    window.addEventListener('ipc:navigation-preferences-changed', refresh);
    window.addEventListener('storage', refreshReconciliationSelection);
    window.addEventListener('ipc:reconciliation-selection-changed', refreshReconciliationSelection);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('ipc:navigation-preferences-changed', refresh);
      window.removeEventListener('storage', refreshReconciliationSelection);
      window.removeEventListener('ipc:reconciliation-selection-changed', refreshReconciliationSelection);
    };
  }, []);

  const workflowContext = getWorkflowContextForPath(location.pathname);

  const routeMetadata = routeMetadataForPath(location.pathname) ?? routeRegistry[ROUTES.DASHBOARD];
  const pageContext = {
    title: routeMetadata.shellTitle,
    workflow: routeMetadata.workflow ?? workflowContext.lane.label,
    state: routeMetadata.headerState,
  };

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
      dispatch(apiSlice.util.invalidateTags([
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.documents,
        workflowCacheTags.productionPlans,
      ]));
    }
  };

  return (
    <div className="ipc-app-shell ipc-redesign-shell">
      <IdleSessionGuard onLogout={handleLogout} />
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
            const Icon = item.icon!;
            return (
              <Link
                key={item.path}
                to={item.path}
                onPointerEnter={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}
                onFocus={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}
                onTouchStart={() => preloadNavigationTarget(item.path, systemOperation?.mode ?? 'DEFAULT')}
                onClick={() => setIsMobileNavOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'ipc-nav-link',
                  isActive ? 'is-active' : '',
                ].join(' ')}
              >
                <span className="ipc-nav-icon"><Icon size={18} /></span>
                <span className="ipc-nav-label">{item.navLabel}</span>
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
