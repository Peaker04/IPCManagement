import { type ReactNode, useState, useMemo } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { canAccessRole, ROLE_LABELS, selectCurrentUser, type AppRole } from '../../features/auth';
import { store } from '../../app/store';
import { logoutSession } from '../../features/auth/logoutSession';
import { ROUTES } from '../../routes/routeConfig';
import {
  useWorkflowOverview,
  workflowLaneDefinitions,
  useGetWorkflowDocumentsQuery,
  useGetIngredientDemandQuery,
} from '../../features/workflow';


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
  Bell,
} from 'lucide-react';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const getStatusTone = (state: string): StatusTone => {
  const normalized = state.toLocaleLowerCase('vi-VN');

  if (normalized.includes('cảnh báo') || normalized.includes('tắc') || normalized.includes('lỗi')) {
    return 'danger';
  }

  if (normalized.includes('chờ') || normalized.includes('thiếu') || normalized.includes('dự thảo')) {
    return 'warning';
  }

  if (normalized.includes('đã') || normalized.includes('hoạt động')) {
    return 'success';
  }

  if (normalized.includes('theo dõi')) {
    return 'info';
  }

  return 'neutral';
};

const serviceDateFormatter = new Intl.DateTimeFormat('vi-VN');

export const MainLayout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppSelector(selectCurrentUser);

  const [showNotifications, setShowNotifications] = useState(false);
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: demandLines = [] } = useGetIngredientDemandQuery({ limit: 100 });

  const shortages = useMemo(() => {
    return demandLines.filter((line: any) => line.tone === 'danger' || line.required > line.available);
  }, [demandLines]);

  const pendingApprovals = useMemo(() => {
    return workflowDocuments.filter((doc: any) => doc.status?.toLowerCase().includes('chờ duyệt') || doc.status?.toLowerCase().includes('yêu cầu'));
  }, [workflowDocuments]);

  const pendingReceipts = useMemo(() => {
    return workflowDocuments.filter((doc: any) => doc.type === 'Phiếu nhập' && doc.status?.toLowerCase().includes('nháp'));
  }, [workflowDocuments]);

  const notifications = useMemo(() => {
    const list: Array<{ id: string; title: string; desc: string; route: string; type: 'danger' | 'warning' | 'info' }> = [];

    shortages.forEach((sh: any) => {
      list.push({
        id: `shortage-${sh.id || sh.material}`,
        title: 'Cảnh báo thiếu hụt nguyên liệu',
        desc: `${sh.material} thiếu ${sh.required - sh.available} ${sh.unit}`,
        route: ROUTES.WAREHOUSE,
        type: 'danger',
      });
    });

    pendingApprovals.forEach((doc: any) => {
      list.push({
        id: `approval-${doc.documentId || doc.id}`,
        title: 'Yêu cầu chờ phê duyệt',
        desc: `${doc.type} ${doc.id} đang chờ xử lý`,
        route: ROUTES.APPROVALS,
        type: 'warning',
      });
    });

    pendingReceipts.forEach((doc: any) => {
      list.push({
        id: `receipt-${doc.documentId || doc.id}`,
        title: 'Phiếu nhập kho chờ xác nhận',
        desc: `Phiếu nhập ${doc.id} chưa hoàn tất`,
        route: ROUTES.WAREHOUSE,
        type: 'info',
      });
    });

    return list;
  }, [shortages, pendingApprovals, pendingReceipts]);

  const handleLogout = async () => {
    await logoutSession(dispatch, store.getState);
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const menuItems: Array<{ path: string; label: string; icon: ReactNode; allowedRoles?: AppRole[] }> = [
    { path: ROUTES.DASHBOARD, label: 'Tổng quan', icon: <LayoutDashboard size={18} /> },
    { path: ROUTES.WEEKLY_MENU, label: 'Thực đơn tuần', icon: <CalendarDays size={18} />, allowedRoles: ['quanly', 'dieuphoi'] },
    { path: ROUTES.MEAL_ORDERS, label: 'Điều phối đơn', icon: <Utensils size={18} />, allowedRoles: ['quanly', 'dieuphoi'] },
    { path: ROUTES.APPROVALS, label: 'Duyệt vận hành', icon: <ClipboardCheck size={18} />, allowedRoles: ['quanly'] },
    { path: ROUTES.PURCHASING, label: 'Thu mua', icon: <ShoppingCart size={18} />, allowedRoles: ['quanly', 'thumua'] },
    { path: ROUTES.WAREHOUSE, label: 'Kho nguyên liệu', icon: <Warehouse size={18} />, allowedRoles: ['quanly', 'thukho'] },
    { path: ROUTES.CHEF_DASHBOARD, label: 'Bếp trưởng', icon: <ChefHat size={18} />, allowedRoles: ['quanly', 'beptruong'] },
    { path: ROUTES.REPORTS, label: 'Biến động giá', icon: <TrendingUp size={18} />, allowedRoles: ['quanly'] },
    { path: ROUTES.ADMIN_DATA, label: 'Quản trị dữ liệu', icon: <Database size={18} />, allowedRoles: ['admin'] },
  ];

  const visibleMenuItems = menuItems.filter((item) =>
    !item.allowedRoles || canAccessRole(currentUser, item.allowedRoles)
  );

  const { workflowLanes } = useWorkflowOverview();

  const activeLane = workflowLanes.find((item) => item.route === location.pathname)
    || workflowLaneDefinitions.find((item) => item.route === location.pathname)
    || workflowLaneDefinitions[0];

  const pageContext = (() => {
    switch (location.pathname) {
      case ROUTES.DASHBOARD:
        return { title: 'Bàn điều hành hôm nay', workflow: 'Tổng quan workflow', state: 'Theo dõi điểm tắc' };
      case ROUTES.WEEKLY_MENU:
        return { title: 'KHSX và định lượng', workflow: activeLane.label, state: activeLane.status };
      case ROUTES.MEAL_ORDERS:
        return { title: 'Điều phối suất ăn', workflow: activeLane.label, state: activeLane.status };
      case ROUTES.CHEF_DASHBOARD:
        return { title: 'Bếp sản xuất', workflow: activeLane.label, state: activeLane.status };
      case ROUTES.REPORTS:
        return { title: 'Phân tích biến động giá', workflow: 'Biến động giá', state: 'Cảnh báo ngưỡng' };
      case ROUTES.APPROVALS:
        return { title: 'Duyệt vận hành', workflow: activeLane.label, state: activeLane.status };
      case ROUTES.PURCHASING:
        return { title: 'Thu mua', workflow: activeLane.label, state: activeLane.status };
      case ROUTES.WAREHOUSE:
        return { title: 'Kho nguyên liệu', workflow: activeLane.label, state: activeLane.status };
      case ROUTES.ADMIN_DATA:
        return { title: 'Quản trị dữ liệu', workflow: activeLane.label, state: activeLane.status };
      default:
        return { title: 'Hệ thống Quản lý Bếp ăn', workflow: 'Vận hành', state: 'Đang hoạt động' };
    }
  })();


  const serviceDate = serviceDateFormatter.format(new Date());
  const activeShift = 'Ca trưa';
  const statusTone = getStatusTone(pageContext.state);

  return (
    <div className="ipc-app-shell">
      <a href="#ipc-main-content" className="ipc-skip-link">
        Bỏ qua điều hướng
      </a>
      {/* Sidebar */}
      <aside className="ipc-sidebar">
        <div className="ipc-brand">
          <span className="ipc-brand-icon">
            <ChefHat size={21} />
          </span>
          <div>
            <h2 className="ipc-brand-title">IPC System</h2>
            <div className="ipc-brand-subtitle">Industrial Kitchen</div>
          </div>
        </div>

        <nav
          aria-label="Điều hướng chính"
          className="ipc-nav"
        >
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
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
          {currentUser && (
            <div className="ipc-user-card">
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
            onClick={handleLogout}
            className="ipc-logout-button"
          >
            <LogOut size={16} className="shrink-0" />
            <span>Đăng xuất</span>
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
            <div className="ipc-header-chip">
              <Clock3 size={16} />
              <span>{activeShift} · {activeLane.owner}</span>
            </div>

            {/* Notification Center Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="ipc-header-chip cursor-pointer relative hover:bg-slate-800 transition-colors flex items-center gap-1 w-full"
                aria-label="Thông báo"
              >
                <Bell size={16} />
                <span>Thông báo</span>
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 text-slate-100 overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-700 bg-slate-950 font-semibold text-sm flex justify-between items-center">
                    <span className="text-white">Trung tâm thông báo</span>
                    <span className="text-xs font-normal text-slate-400">{notifications.length} tin mới</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-850">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-slate-400">
                        Không có thông báo mới nào
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => {
                            setShowNotifications(false);
                            navigate(notif.route);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-855/50 hover:bg-slate-800 transition-colors flex flex-col gap-0.5 border-b border-slate-800/50"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${
                              notif.type === 'danger' ? 'bg-red-500' :
                              notif.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                            }`} />
                            <span className="text-xs font-bold text-slate-200">{notif.title}</span>
                          </div>
                          <span className="text-xs text-slate-400 pl-3.5">{notif.desc}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={`ipc-status-pill is-${statusTone}`}>
              <span className="ipc-status-dot" />
              <span>{pageContext.state}</span>
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main id="ipc-main-content" className="ipc-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
