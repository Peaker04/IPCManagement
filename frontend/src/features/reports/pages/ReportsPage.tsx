import { AlertCircle, AlertTriangle, ClipboardList } from 'lucide-react';

const ReportsPage = () => {
  // Dữ liệu giả định về giá cả của các nguyên liệu thô
  const materialsPriceData = [
    { name: 'Sườn heo', unit: 'kg', pricePrev: 115000, priceCurrent: 134000, supplier: 'Nhà cung cấp A', change: 16.5, warning: true },
    { name: 'Thịt gà', unit: 'kg', pricePrev: 83000, priceCurrent: 85000, supplier: 'Nhà cung cấp A', change: 2.4, warning: false },
    { name: 'Cá lóc phi lê', unit: 'kg', pricePrev: 110000, priceCurrent: 110000, supplier: 'Nhà cung cấp A', change: 0, warning: false },
    { name: 'Gạo tẻ', unit: 'kg', pricePrev: 17000, priceCurrent: 18000, supplier: 'Nhà cung cấp A', change: 5.8, warning: false },
    { name: 'Rau cải xanh', unit: 'kg', pricePrev: 12500, priceCurrent: 15000, supplier: 'Nhà cung cấp A', change: 20.0, warning: true },
    { name: 'Tôm tươi', unit: 'kg', pricePrev: 180000, priceCurrent: 180000, supplier: 'Nhà cung cấp B', change: 0, warning: false },
    { name: 'Thịt ba chỉ', unit: 'kg', pricePrev: 120000, priceCurrent: 125000, supplier: 'Nhà cung cấp A', change: 4.1, warning: false },
  ];

  return (
    <div style={styles.container}>
      {/* Alert Panel */}
      <div style={styles.alertPanel}>
        <h3 style={{ ...styles.panelTitle, display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b' }}>
          <AlertCircle size={18} color="#991b1b" />
          <span>Báo Cáo Nguyên Liệu Biến Động Giá {'>'} 15%</span>
        </h3>
        <p style={styles.subtext}>
          Hệ thống giám sát giá cả thu mua tự động đối chiếu giá từ các nhà cung cấp. Các mặt hàng vượt quá 15% sẽ được tự động báo cáo lên Giám đốc để phê duyệt đơn hàng.
        </p>

        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{ ...styles.th, textAlign: 'left' }}>Tên nguyên liệu</th>
                <th style={styles.th}>Đơn vị</th>
                <th style={styles.th}>Nhà cung cấp</th>
                <th style={styles.th}>Giá tuần trước</th>
                <th style={styles.th}>Giá hiện tại</th>
                <th style={styles.th}>Tỷ lệ biến động</th>
                <th style={styles.th}>Trạng thái xử lý</th>
              </tr>
            </thead>
            <tbody>
              {materialsPriceData
                .filter((item) => item.warning)
                .map((item) => (
                  <tr key={item.name} className="warning-row">
                    <td style={{ ...styles.td, textAlign: 'left', fontWeight: 'bold', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} color="#991b1b" />
                      <span>{item.name}</span>
                    </td>
                    <td style={styles.td}>{item.unit}</td>
                    <td style={styles.td}>{item.supplier}</td>
                    <td style={styles.td}>{item.pricePrev.toLocaleString()} đ</td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{item.priceCurrent.toLocaleString()} đ</td>
                    <td style={{ ...styles.td, color: '#b91c1c', fontWeight: 'bold' }}>
                      +{item.change.toFixed(1)}%
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusBadgeWarning}>Đã báo cáo GĐ (Chờ duyệt)</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Price List */}
      <div style={styles.panel}>
        <h3 style={{ ...styles.panelTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ClipboardList size={18} color="#475569" />
          <span>Toàn bộ bảng theo dõi giá nguyên liệu đầu vào</span>
        </h3>
        <div style={styles.tableScroll}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{ ...styles.th, textAlign: 'left' }}>Tên nguyên liệu</th>
                <th style={styles.th}>Đơn vị</th>
                <th style={styles.th}>Nhà cung cấp</th>
                <th style={styles.th}>Giá tuần trước</th>
                <th style={styles.th}>Giá tuần này</th>
                <th style={styles.th}>Thay đổi</th>
                <th style={styles.th}>Đánh giá</th>
              </tr>
            </thead>
            <tbody>
              {materialsPriceData.map((item) => (
                <tr key={item.name} className="table-row">
                  <td style={{ ...styles.td, textAlign: 'left', fontWeight: 'bold' }}>{item.name}</td>
                  <td style={styles.td}>{item.unit}</td>
                  <td style={styles.td}>{item.supplier}</td>
                  <td style={styles.td}>{item.pricePrev.toLocaleString()} đ</td>
                  <td style={styles.td}>{item.priceCurrent.toLocaleString()} đ</td>
                  <td
                    style={{
                      ...styles.td,
                      color: item.change > 0 ? '#b91c1c' : '#475569',
                      fontWeight: item.change > 0 ? 'bold' : 'normal',
                    }}
                  >
                    {item.change > 0 ? `+${item.change.toFixed(1)}%` : '0%'}
                  </td>
                  <td style={styles.td}>
                    {item.warning ? (
                      <span style={styles.badgeDanger}>Biến động mạnh ({'>'}15%)</span>
                    ) : item.change > 0 ? (
                      <span style={styles.badgeWarning}>Tăng nhẹ</span>
                    ) : (
                      <span style={styles.badgeSuccess}>Ổn định</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  alertPanel: {
    backgroundColor: '#fff5f5',
    border: '1px solid #fee2e2',
    borderRadius: '8px',
    padding: '20px',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: '0 0 10px 0',
  },
  subtext: {
    fontSize: '13px',
    color: '#64748b',
    margin: '0 0 20px 0',
    lineHeight: '1.5',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '24px',
  },
  tableScroll: {
    overflowX: 'auto' as const,
    width: '100%',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: '800px',
  },
  tableHeaderRow: {
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
  },
  th: {
    padding: '12px 16px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#475569',
    textAlign: 'center' as const,
    borderBottom: '1px solid #e2e8f0',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#334155',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'center' as const,
  },
  // Warning row and regular row styling is handled by warning-row and table-row CSS classes in index.css.
  statusBadgeWarning: {
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#ffedd5',
    color: '#ea580c',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #fed7aa',
  },
  badgeDanger: {
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  badgeWarning: {
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#fff7ed',
    color: '#c2410c',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  badgeSuccess: {
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: '#f0fdf4',
    color: '#166534',
    padding: '4px 8px',
    borderRadius: '4px',
  },
};

export default ReportsPage;
