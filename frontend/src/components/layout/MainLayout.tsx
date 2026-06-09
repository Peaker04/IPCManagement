import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { logOut, selectCurrentUser } from '../../features/auth';
import { ROUTES } from '../../routes/routeConfig';
import { ChefHat, LayoutDashboard, CalendarDays, TrendingUp, LogOut } from 'lucide-react';

export const MainLayout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppSelector(selectCurrentUser);

  const handleLogout = () => {
    dispatch(logOut());
    navigate(ROUTES.LOGIN);
  };

  const menuItems = [
    { path: ROUTES.DASHBOARD, label: 'Tổng quan (Dashboard)', icon: <LayoutDashboard size={18} /> },
    { path: ROUTES.WEEKLY_MENU, label: 'Thực đơn tuần & Định lượng', icon: <CalendarDays size={18} /> },
    { path: ROUTES.REPORTS, label: 'Thống kê biến động giá', icon: <TrendingUp size={18} /> },
  ];

  const getPageTitle = () => {
    switch (location.pathname) {
      case ROUTES.DASHBOARD:
        return 'Bảng điều khiển tổng quan';
      case ROUTES.WEEKLY_MENU:
        return 'Lên thực đơn tuần & Tính toán định lượng';
      case ROUTES.REPORTS:
        return 'Báo cáo biến động giá nguyên liệu';
      default:
        return 'Hệ thống Quản lý Bếp ăn';
    }
  };

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <ChefHat size={24} color="#1e3b8a" />
          <h2 style={styles.logoText}>IPC System</h2>
        </div>
        <nav style={styles.nav}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : {}),
                }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div style={styles.sidebarFooter}>
          {currentUser && (
            <div style={styles.userInfo}>
              <div style={styles.userAvatar}>
                {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div style={styles.userDetails}>
                <div style={styles.userName}>{currentUser.fullName}</div>
                <div style={styles.userRole}>{currentUser.role === 'admin' ? 'Giám đốc / Admin' : 'Nhân viên'}</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} style={styles.logoutButton}>
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={styles.mainContainer}>
        {/* Header */}
        <header style={styles.header}>
          <h1 style={styles.headerTitle}>{getPageTitle()}</h1>
          <div style={styles.headerRight}>
            <span style={styles.statusDot}></span>
            <span style={styles.statusText}>Bếp ăn hoạt động tốt</span>
          </div>
        </header>

        {/* Content Outlet */}
        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  sidebar: {
    width: '260px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'fixed' as const,
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 10,
  },
  logoArea: {
    padding: '24px 20px',
    borderBottom: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#1e3b8a', // Deep corporate navy blue
    margin: 0,
  },
  nav: {
    flexGrow: 1,
    padding: '20px 12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '6px',
    color: '#475569',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  navLinkActive: {
    backgroundColor: '#eff6ff',
    color: '#1e3b8a',
    fontWeight: 'bold',
  },
  navIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  sidebarFooter: {
    padding: '20px 16px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  userDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  userName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1e293b',
  },
  userRole: {
    fontSize: '11px',
    color: '#64748b',
  },
  logoutButton: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  },
  mainContainer: {
    flexGrow: 1,
    marginLeft: '260px',
    display: 'flex',
    flexDirection: 'column' as const,
    minWidth: 0,
  },
  header: {
    height: '70px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
  },
  statusText: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 500,
  },
  content: {
    padding: '24px',
    flexGrow: 1,
    overflowY: 'auto' as const,
  },
};
