import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logOut, selectCurrentUser, useRevokeTokenMutation } from '../../features/auth';
import { ROUTES } from '../../routes/routeConfig';
import { getWorkflowContextForPath } from '../../features/workflow';
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
  const refreshToken = useAppSelector((state) => state.auth.refreshToken);
  const [revokeToken] = useRevokeTokenMutation();

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await revokeToken({ refreshToken }).unwrap();
      } catch {
        // Ignore errors on logout
      }
    }
    dispatch(logOut());
    navigate(ROUTES.LOGIN);
  };

  const menuItems = [
    { path: ROUTES.DASHBOARD, label: 'Tổng quan', icon: <LayoutDashboard size={18} /> },
    { path: ROUTES.WEEKLY_MENU, label: 'Thực đơn tuần', icon: <CalendarDays size={18} /> },
    { path: ROUTES.MEAL_ORDERS, label: 'Điều phối đơn', icon: <Utensils size={18} /> },
    { path: ROUTES.APPROVALS, label: 'Duyệt vận hành', icon: <ClipboardCheck size={18} /> },
    { path: ROUTES.PURCHASING, label: 'Thu mua', icon: <ShoppingCart size={18} /> },
    { path: ROUTES.WAREHOUSE, label: 'Kho nguyên liệu', icon: <Warehouse size={18} /> },
    { path: ROUTES.CHEF_DASHBOARD, label: 'Bếp trưởng', icon: <ChefHat size={18} /> },
    { path: ROUTES.REPORTS, label: 'Biến động giá', icon: <TrendingUp size={18} /> },
    { path: ROUTES.ADMIN_DATA, label: 'Quản trị dữ liệu', icon: <Database size={18} /> },
  ];

  const workflowContext = getWorkflowContextForPath(location.pathname);

  const pageContext = (() => {
    switch (location.pathname) {
      case ROUTES.DASHBOARD:
        return { title: 'Bàn điều hành hôm nay', workflow: 'Tổng quan workflow', state: 'Theo dõi điểm tắc' };
      case ROUTES.WEEKLY_MENU:
        return { title: 'KHSX và định lượng', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.MEAL_ORDERS:
        return { title: 'Điều phối suất ăn', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.CHEF_DASHBOARD:
        return { title: 'Bếp sản xuất', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.REPORTS:
        return { title: 'Phân tích biến động giá', workflow: 'Biến động giá', state: 'Cảnh báo ngưỡng' };
      case ROUTES.APPROVALS:
        return { title: 'Duyệt vận hành', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.PURCHASING:
        return { title: 'Thu mua', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.WAREHOUSE:
        return { title: 'Kho nguyên liệu', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
      case ROUTES.ADMIN_DATA:
        return { title: 'Quản trị dữ liệu', workflow: workflowContext.lane.label, state: workflowContext.lane.status };
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
          {menuItems.map((item) => {
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
                  {currentUser.role === 'admin' ? 'Giám đốc / Admin' : 'Nhân viên'}
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
              <span>{activeShift} · {workflowContext.lane.owner}</span>
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
