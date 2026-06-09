import { Link } from 'react-router-dom';
import { ROUTES } from '../../../routes/routeConfig';
import { AlertTriangle, Soup, Coins, Package, Utensils, BarChart3 } from 'lucide-react';

const DashboardPage = () => {
  // Dữ liệu giả định
  const stats = [
    { 
      label: 'Số suất ăn đăng ký (Hôm nay)', 
      value: '1,050 suất', 
      icon: <Soup size={22} color="#1e40af" />, 
      color: '#eff6ff', 
      textColor: '#1e40af' 
    },
    { 
      label: 'Dự toán chi phí nguyên liệu', 
      value: '36,750,000 đ', 
      icon: <Coins size={22} color="#166534" />, 
      color: '#f0fdf4', 
      textColor: '#166534' 
    },
    { 
      label: 'Xuất kho nấu tiếp theo', 
      value: 'Trong 2 ngày tới', 
      icon: <Package size={22} color="#9a3412" />, 
      color: '#fff7ed', 
      textColor: '#9a3412' 
    },
  ];

  const chartData = [
    { week: 'Tuần 20', cost: '31.2M', height: '65%' },
    { week: 'Tuần 21', cost: '32.5M', height: '70%' },
    { week: 'Tuần 22', cost: '31.8M', height: '68%' },
    { week: 'Tuần 23 (Hiện tại)', cost: '36.7M', height: '90%', active: true },
  ];

  return (
    <div style={styles.container}>
      {/* Cảnh báo biến động giá */}
      <div style={styles.alertBanner}>
        <div style={styles.alertLeft}>
          <div style={styles.alertIconWrapper}>
            <AlertTriangle size={22} color="#ea580c" />
          </div>
          <div>
            <h4 style={styles.alertTitle}>Cảnh báo biến động giá ({'>'} 15%)</h4>
            <p style={styles.alertMsg}>
              Giá <b>thịt heo đùi</b> đã tăng <b>16.5%</b> (từ 115,000đ lên 134,000đ/kg) tại Nhà cung cấp A. 
              Hệ thống đã tự động ghi nhận và gửi báo cáo về tài khoản Giám đốc.
            </p>
          </div>
        </div>
        <Link to={ROUTES.REPORTS} style={styles.alertBtn}>
          Xem chi tiết
        </Link>
      </div>

      {/* KPI Cards */}
      <div style={styles.gridStats}>
        {stats.map((stat, i) => (
          <div key={i} style={{ ...styles.statCard, backgroundColor: stat.color }}>
            <div style={styles.statIconArea}>
              {stat.icon}
            </div>
            <div style={styles.statInfo}>
              <span style={styles.statLabel}>{stat.label}</span>
              <span style={{ ...styles.statValue, color: stat.textColor }}>{stat.value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div style={styles.mainGrid}>
        {/* Lịch thực đơn hôm nay */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={{ ...styles.panelTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Utensils size={18} color="#475569" />
              <span>Thực đơn Hôm nay (Thứ Ba)</span>
            </h3>
            <span style={styles.badge}>Ca sáng & ca chiều</span>
          </div>
          <div style={styles.menuTimeline}>
            <div style={styles.menuItem}>
              <div style={styles.timeBadge}>SÁNG (06:00 - 08:30)</div>
              <div style={styles.menuDetails}>
                <h4 style={styles.dishName}>Bún mọc sườn non</h4>
                <p style={styles.dishMeta}>Định mức tiêu chuẩn: 35,000đ/suất | Tổng: 1,050 suất</p>
              </div>
            </div>
            <div style={styles.menuItem}>
              <div style={styles.timeBadge}>CHIỀU (11:30 - 13:30)</div>
              <div style={styles.menuDetails}>
                <h4 style={styles.dishName}>Cơm sườn rim tiêu + Canh cải ngọt</h4>
                <p style={styles.dishMeta}>Định mức tiêu chuẩn: 35,000đ/suất | Tổng: 1,050 suất</p>
              </div>
            </div>
          </div>
          <div style={styles.panelFooter}>
            <Link to={ROUTES.WEEKLY_MENU} style={styles.panelLink}>
              Chỉnh sửa thực đơn tuần &rarr;
            </Link>
          </div>
        </div>

        {/* Biểu đồ chi phí */}
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={{ ...styles.panelTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} color="#475569" />
              <span>Biểu đồ chi phí nguyên liệu tuần</span>
            </h3>
            <span style={styles.badge}>4 tuần gần nhất</span>
          </div>
          <div style={styles.chartContainer}>
            <div style={styles.barChart}>
              {chartData.map((data, i) => (
                <div key={i} style={styles.chartCol}>
                  <div style={styles.barWrapper}>
                    <div 
                      style={{ 
                        ...styles.bar, 
                        height: data.height,
                        backgroundColor: data.active ? '#ea580c' : '#1e3b8a' 
                      }}
                    >
                      <span style={styles.barTooltip}>{data.cost}</span>
                    </div>
                  </div>
                  <span style={styles.chartLabel}>{data.week}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={styles.chartLegend}>
            <span style={styles.legendDotBlue}></span> <span style={styles.legendText}>Bình thường</span>
            <span style={styles.legendDotOrange}></span> <span style={styles.legendText}>Biến động {'>'}15%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    textAlign: 'left' as const,
  },
  alertBanner: {
    backgroundColor: '#fff7ed',
    border: '1px solid #ffedd5',
    borderRadius: '8px',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '16px',
  },
  alertLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  alertIconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#ea580c',
    margin: '0 0 4px 0',
  },
  alertMsg: {
    fontSize: '13px',
    color: '#9a3412',
    margin: 0,
    lineHeight: '1.4',
  },
  alertBtn: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#ea580c',
    padding: '8px 16px',
    borderRadius: '6px',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    '&:hover': {
      backgroundColor: '#c2410c',
    },
  },
  gridStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  statCard: {
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  statIconArea: {
    width: '48px',
    height: '48px',
    borderRadius: '8px',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 500,
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
    gap: '24px',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '16px',
    marginBottom: '20px',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: 0,
  },
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  menuTimeline: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
    flexGrow: 1,
  },
  menuItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
    borderLeft: '3px solid #3b82f6',
    paddingLeft: '14px',
  },
  timeBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  menuDetails: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  dishName: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: '0 0 2px 0',
  },
  dishMeta: {
    fontSize: '12px',
    color: '#64748b',
    margin: 0,
  },
  panelFooter: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9',
    textAlign: 'right' as const,
  },
  panelLink: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#1e3b8a',
    textDecoration: 'none',
  },
  chartContainer: {
    height: '180px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: '16px',
    paddingBottom: '8px',
    borderBottom: '1px solid #f1f5f9',
    flexGrow: 1,
  },
  barChart: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    height: '100%',
  },
  chartCol: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    width: '60px',
    gap: '8px',
  },
  barWrapper: {
    height: '140px',
    width: '32px',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: '4px',
    position: 'relative' as const,
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  barTooltip: {
    position: 'absolute' as const,
    top: '-24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1e293b',
    color: '#ffffff',
    fontSize: '10px',
    padding: '2px 4px',
    borderRadius: '3px',
    whiteSpace: 'nowrap' as const,
  },
  chartLabel: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 500,
  },
  chartLegend: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  legendDotBlue: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#1e3b8a',
  },
  legendDotOrange: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: '#ea580c',
  },
  legendText: {
    fontSize: '12px',
    color: '#64748b',
    marginRight: '16px',
  },
};

export default DashboardPage;
