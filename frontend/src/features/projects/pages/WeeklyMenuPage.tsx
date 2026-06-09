import { useState, useMemo } from 'react';
import { Settings, Calendar, Sun, Moon, Scale } from 'lucide-react';

// Danh sách món ăn có sẵn và định lượng trên 1 suất ăn (đơn vị: gram)
interface RecipeIngredient {
  name: string;
  amount: number; // gram per portion
}

interface Dish {
  id: string;
  name: string;
  type: 'morning' | 'afternoon';
  ingredients: RecipeIngredient[];
}

const DISHES: Dish[] = [
  {
    id: 'm1',
    name: 'Bún mọc sườn non',
    type: 'morning',
    ingredients: [
      { name: 'Sườn heo', amount: 80 },
      { name: 'Bún tươi', amount: 150 },
      { name: 'Giò sống (mọc)', amount: 40 },
      { name: 'Hành lá & rau thơm', amount: 10 },
    ],
  },
  {
    id: 'm2',
    name: 'Phở gà ta',
    type: 'morning',
    ingredients: [
      { name: 'Thịt gà', amount: 80 },
      { name: 'Bánh phở', amount: 150 },
      { name: 'Hành lá & rau thơm', amount: 10 },
    ],
  },
  {
    id: 'm3',
    name: 'Hủ tiếu Nam Vang',
    type: 'morning',
    ingredients: [
      { name: 'Thịt heo nạc', amount: 50 },
      { name: 'Tôm tươi', amount: 30 },
      { name: 'Hủ tiếu khô', amount: 80 },
      { name: 'Giá đỗ & Hẹ', amount: 40 },
    ],
  },
  {
    id: 'a1',
    name: 'Cơm sườn rim tiêu',
    type: 'afternoon',
    ingredients: [
      { name: 'Sườn heo', amount: 100 },
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Rau cải xanh', amount: 80 },
    ],
  },
  {
    id: 'a2',
    name: 'Cơm cá lóc kho tộ',
    type: 'afternoon',
    ingredients: [
      { name: 'Cá lóc phi lê', amount: 120 },
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Rau muống', amount: 80 },
      { name: 'Thịt ba chỉ', amount: 20 },
    ],
  },
  {
    id: 'a3',
    name: 'Cơm gà xối mỡ',
    type: 'afternoon',
    ingredients: [
      { name: 'Thịt gà', amount: 150 },
      { name: 'Gạo tẻ', amount: 120 },
      { name: 'Dưa leo & Cà chua', amount: 50 },
    ],
  },
];

// Danh mục nguyên liệu thô và giá của các nhà cung cấp (đơn vị: kg / đ)
interface RawMaterial {
  name: string;
  unit: string;
  supplierA: number;
  supplierB: number;
}

const RAW_MATERIALS: Record<string, RawMaterial> = {
  'Sườn heo': { name: 'Sườn heo', unit: 'kg', supplierA: 134000, supplierB: 128000 },
  'Bún tươi': { name: 'Bún tươi', unit: 'kg', supplierA: 12000, supplierB: 13000 },
  'Giò sống (mọc)': { name: 'Giò sống (mọc)', unit: 'kg', supplierA: 110000, supplierB: 115000 },
  'Hành lá & rau thơm': { name: 'Hành lá & rau thơm', unit: 'kg', supplierA: 25000, supplierB: 28000 },
  'Thịt gà': { name: 'Thịt gà', unit: 'kg', supplierA: 85000, supplierB: 82000 },
  'Bánh phở': { name: 'Bánh phở', unit: 'kg', supplierA: 15000, supplierB: 14000 },
  'Thịt heo nạc': { name: 'Thịt heo nạc', unit: 'kg', supplierA: 95000, supplierB: 98000 },
  'Tôm tươi': { name: 'Tôm tươi', unit: 'kg', supplierA: 180000, supplierB: 175000 },
  'Hủ tiếu khô': { name: 'Hủ tiếu khô', unit: 'kg', supplierA: 30000, supplierB: 32000 },
  'Giá đỗ & Hẹ': { name: 'Giá đỗ & Hẹ', unit: 'kg', supplierA: 18000, supplierB: 16000 },
  'Gạo tẻ': { name: 'Gạo tẻ', unit: 'kg', supplierA: 18000, supplierB: 17500 },
  'Rau cải xanh': { name: 'Rau cải xanh', unit: 'kg', supplierA: 15000, supplierB: 14000 },
  'Cá lóc phi lê': { name: 'Cá lóc phi lê', unit: 'kg', supplierA: 110000, supplierB: 115000 },
  'Rau muống': { name: 'Rau muống', unit: 'kg', supplierA: 12000, supplierB: 10000 },
  'Thịt ba chỉ': { name: 'Thịt ba chỉ', unit: 'kg', supplierA: 125000, supplierB: 120000 },
  'Dưa leo & Cà chua': { name: 'Dưa leo & Cà chua', unit: 'kg', supplierA: 16000, supplierB: 18000 },
};

interface MenuSlot {
  dishId: string;
  portions: number;
}

interface WeeklyMenuState {
  [day: string]: {
    morning: MenuSlot;
    afternoon: MenuSlot;
  };
}

const DAYS_OF_WEEK = [
  { key: 't2', label: 'Thứ Hai' },
  { key: 't3', label: 'Thứ Ba' },
  { key: 't4', label: 'Thứ Tư' },
  { key: 't5', label: 'Thứ Năm' },
  { key: 't6', label: 'Thứ Sáu' },
  { key: 't7', label: 'Thứ Bảy' },
  { key: 'cn', label: 'Chủ Nhật' },
];

const WeeklyMenuPage = () => {
  // Đơn giá chuẩn là 35,000 đ
  const standardPrice = 35000;
  const [menuPrice, setMenuPrice] = useState<number>(35000);
  const [lossRate, setLossRate] = useState<number>(5); // Hao hụt mặc định 5%

  // Khởi tạo menu mặc định cho tuần
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenuState>({
    t2: { morning: { dishId: 'm1', portions: 900 }, afternoon: { dishId: 'a1', portions: 950 } },
    t3: { morning: { dishId: 'm2', portions: 1000 }, afternoon: { dishId: 'a2', portions: 1050 } },
    t4: { morning: { dishId: 'm3', portions: 850 }, afternoon: { dishId: 'a3', portions: 900 } },
    t5: { morning: { dishId: 'm1', portions: 920 }, afternoon: { dishId: 'a1', portions: 920 } },
    t6: { morning: { dishId: 'm2', portions: 980 }, afternoon: { dishId: 'a2', portions: 980 } },
    t7: { morning: { dishId: 'm3', portions: 750 }, afternoon: { dishId: 'a3', portions: 750 } },
    cn: { morning: { dishId: 'm1', portions: 700 }, afternoon: { dishId: 'a1', portions: 700 } },
  });



  // Thay đổi món ăn hoặc số lượng suất ăn
  const handleSlotChange = (day: string, type: 'morning' | 'afternoon', field: 'dishId' | 'portions', value: string | number) => {
    setWeeklyMenu((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [type]: {
          ...prev[day][type],
          [field]: value,
        },
      },
    }));
  };

  // Tính hệ số đơn giá suất ăn (Giảm giá giảm định lượng theo tỉ lệ: 35k = 100%)
  const priceRatio = useMemo(() => {
    return Math.max(0.1, Math.min(1.5, menuPrice / standardPrice));
  }, [menuPrice]);

  // Tính toán tổng hợp định lượng nguyên liệu thô cần mua cho cả tuần
  const materialSummary = useMemo(() => {
    const summary: Record<string, { theory: number; actual: number }> = {};

    // Khởi tạo tất cả nguyên liệu
    Object.keys(RAW_MATERIALS).forEach((name) => {
      summary[name] = { theory: 0, actual: 0 };
    });

    // Cộng dồn nguyên liệu từ các món trong tuần
    Object.values(weeklyMenu).forEach((slots) => {
      // 1. Ca sáng
      const morningDish = DISHES.find((d) => d.id === slots.morning.dishId);
      if (morningDish) {
        morningDish.ingredients.forEach((ing) => {
          if (summary[ing.name] !== undefined) {
            // Tổng gram = gram/suất * số suất
            const totalGram = ing.amount * slots.morning.portions;
            summary[ing.name].theory += totalGram / 1000; // chuyển sang kg
          }
        });
      }

      // 2. Ca chiều
      const afternoonDish = DISHES.find((d) => d.id === slots.afternoon.dishId);
      if (afternoonDish) {
        afternoonDish.ingredients.forEach((ing) => {
          if (summary[ing.name] !== undefined) {
            const totalGram = ing.amount * slots.afternoon.portions;
            summary[ing.name].theory += totalGram / 1000;
          }
        });
      }
    });

    // Tính định lượng thực tế có áp dụng:
    // 1. Hệ số giảm giá suất ăn (priceRatio)
    // 2. Hệ số hao hụt sơ chế (lossRate) -> Actual = Theory * PriceRatio * (1 + lossRate/100)
    Object.keys(summary).forEach((name) => {
      const theory = summary[name].theory;
      const actual = theory * priceRatio * (1 + lossRate / 100);
      summary[name].actual = actual;
    });

    return summary;
  }, [weeklyMenu, priceRatio, lossRate]);

  // Tính tổng chi phí dự kiến nếu chọn Nhà cung cấp tối ưu nhất
  const totalCostInfo = useMemo(() => {
    let totalMinCost = 0;
    Object.entries(materialSummary).forEach(([name, data]) => {
      const material = RAW_MATERIALS[name];
      if (material) {
        const bestPrice = Math.min(material.supplierA, material.supplierB);
        totalMinCost += data.actual * bestPrice;
      }
    });
    return totalMinCost;
  }, [materialSummary]);

  return (
    <div style={styles.container}>
      {/* Panel Cấu hình định lượng */}
      <div style={styles.configPanel}>
        <h3 style={{ ...styles.panelTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} color="#475569" />
          <span>Cấu hình định lượng & Hao hụt</span>
        </h3>
        <div style={styles.configGrid}>
          <div style={styles.configGroup}>
            <label style={styles.configLabel}>
              Đơn giá suất ăn bình quân (đ)
              <span style={styles.configSub}>Định mức 35K = 100% định lượng</span>
            </label>
            <input
              type="number"
              value={menuPrice}
              onChange={(e) => setMenuPrice(Math.max(5000, Number(e.target.value)))}
              style={styles.configInput}
              step="1000"
            />
          </div>

          <div style={styles.configGroup}>
            <label style={styles.configLabel}>
              Tỷ lệ hao hụt sơ chế thực tế (%)
              <span style={styles.configSub}>Bù đắp lượng hao hụt khi làm sạch</span>
            </label>
            <input
              type="number"
              value={lossRate}
              onChange={(e) => setLossRate(Math.max(0, Number(e.target.value)))}
              style={styles.configInput}
              min="0"
              max="50"
            />
          </div>

          <div style={styles.configGroup}>
            <label style={styles.configLabel}>Hệ số điều chỉnh định lượng</label>
            <div style={styles.ratioDisplay}>
              Tỉ lệ đơn giá: <b>{(priceRatio * 100).toFixed(1)}%</b> | Thực tế (bù hao hụt):{' '}
              <b>{(priceRatio * (1 + lossRate / 100) * 100).toFixed(1)}%</b>
            </div>
          </div>
        </div>
      </div>

      {/* Lưới lên thực đơn */}
      <div style={styles.panel}>
        <h3 style={{ ...styles.panelTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="#475569" />
          <span>Bảng Lên Thực Đơn & Nhập Suất Ăn Tuần</span>
        </h3>
        <div style={styles.tableScroll}>
          <table style={styles.menuTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{ ...styles.th, width: '120px' }}>Buổi / Ca</th>
                {DAYS_OF_WEEK.map((day) => (
                  <th key={day.key} style={styles.th}>
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Ca Sáng */}
              <tr>
                <td style={styles.tdLeftHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Sun size={16} color="#eab308" />
                    <b>Sáng</b>
                  </div>
                  <div style={styles.sessionSub}>Breakfast</div>
                </td>
                {DAYS_OF_WEEK.map((day) => (
                  <td key={day.key} style={styles.tdMenuSlot}>
                    <select
                      value={weeklyMenu[day.key]?.morning.dishId || 'm1'}
                      onChange={(e) => handleSlotChange(day.key, 'morning', 'dishId', e.target.value)}
                      style={styles.selectDish}
                    >
                      {DISHES.filter((d) => d.type === 'morning').map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <div style={styles.portionInputGroup}>
                      <span style={styles.portionLabel}>Suất:</span>
                      <input
                        type="number"
                        value={weeklyMenu[day.key]?.morning.portions || 0}
                        onChange={(e) =>
                          handleSlotChange(day.key, 'morning', 'portions', Math.max(0, Number(e.target.value)))
                        }
                        style={styles.inputPortions}
                        min="0"
                        max="3000"
                      />
                    </div>
                  </td>
                ))}
              </tr>

              {/* Ca Chiều */}
              <tr>
                <td style={styles.tdLeftHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <Moon size={16} color="#3b82f6" />
                    <b>Chiều</b>
                  </div>
                  <div style={styles.sessionSub}>Lunch / Dinner</div>
                </td>
                {DAYS_OF_WEEK.map((day) => (
                  <td key={day.key} style={styles.tdMenuSlot}>
                    <select
                      value={weeklyMenu[day.key]?.afternoon.dishId || 'a1'}
                      onChange={(e) => handleSlotChange(day.key, 'afternoon', 'dishId', e.target.value)}
                      style={styles.selectDish}
                    >
                      {DISHES.filter((d) => d.type === 'afternoon').map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <div style={styles.portionInputGroup}>
                      <span style={styles.portionLabel}>Suất:</span>
                      <input
                        type="number"
                        value={weeklyMenu[day.key]?.afternoon.portions || 0}
                        onChange={(e) =>
                          handleSlotChange(day.key, 'afternoon', 'portions', Math.max(0, Number(e.target.value)))
                        }
                        style={styles.inputPortions}
                        min="0"
                        max="3000"
                      />
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bảng tính định lượng tổng hợp nguyên liệu */}
      <div style={styles.panel}>
        <div style={styles.summaryHeader}>
          <h3 style={{ ...styles.panelTitle, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={18} color="#475569" />
            <span>Bảng Tính Định Lượng Tổng Hợp & Đề Xuất Mua Hàng</span>
          </h3>
          <div style={styles.costSummary}>
            Tổng chi phí mua hàng tối ưu dự kiến:{' '}
            <span style={styles.costTotalText}>{totalCostInfo.toLocaleString()} đ</span>
          </div>
        </div>

        <div style={styles.tableScroll}>
          <table style={styles.summaryTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={{ ...styles.th, textAlign: 'left' }}>Tên nguyên liệu</th>
                <th style={styles.th}>Đơn vị</th>
                <th style={styles.th}>Định lượng lý thuyết (kg)</th>
                <th style={styles.th}>Định lượng thực tế (kg)</th>
                <th style={styles.th}>NCC đề xuất</th>
                <th style={styles.th}>Đơn giá tốt nhất</th>
                <th style={styles.th}>Thành tiền tạm tính</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(materialSummary).map(([name, data]) => {
                const material = RAW_MATERIALS[name];
                if (!material || data.theory === 0) return null;

                const isSupplierABetter = material.supplierA < material.supplierB;
                const bestSupplier = isSupplierABetter ? 'Nhà cung cấp A' : 'Nhà cung cấp B';
                const bestPrice = isSupplierABetter ? material.supplierA : material.supplierB;
                const rowCost = data.actual * bestPrice;

                return (
                  <tr key={name} className="table-row">
                    <td style={{ ...styles.td, textAlign: 'left', fontWeight: 'bold' }}>{name}</td>
                    <td style={styles.td}>{material.unit}</td>
                    <td style={styles.td}>{data.theory.toFixed(2)}</td>
                    <td style={{ ...styles.td, color: '#1e3b8a', fontWeight: 'bold' }}>
                      {data.actual.toFixed(2)}
                    </td>
                    <td style={{ ...styles.td, color: '#166534', fontWeight: 500 }}>{bestSupplier}</td>
                    <td style={styles.td}>{bestPrice.toLocaleString()} đ</td>
                    <td style={{ ...styles.td, fontWeight: 'bold' }}>{rowCost.toLocaleString()} đ</td>
                  </tr>
                );
              })}
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
  configPanel: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '20px',
  },
  panelTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1e293b',
    margin: '0 0 16px 0',
  },
  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px',
  },
  configGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  configLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#475569',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  configSub: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: 'normal',
    marginTop: '2px',
  },
  configInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '14px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  ratioDisplay: {
    padding: '10px 12px',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    fontSize: '13px',
    color: '#334155',
    lineHeight: '1.4',
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
  menuTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: '900px',
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
  tdLeftHeader: {
    padding: '16px',
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    textAlign: 'center' as const,
  },
  sessionSub: {
    fontSize: '10px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  tdMenuSlot: {
    padding: '12px 8px',
    borderBottom: '1px solid #e2e8f0',
    borderRight: '1px solid #f1f5f9',
    textAlign: 'center' as const,
    verticalAlign: 'top',
  },
  selectDish: {
    width: '100%',
    padding: '6px 8px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '12.5px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    marginBottom: '8px',
    outline: 'none',
  },
  portionInputGroup: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  portionLabel: {
    fontSize: '11px',
    color: '#64748b',
    fontWeight: 500,
  },
  inputPortions: {
    width: '70px',
    padding: '4px 6px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '12px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    textAlign: 'center' as const,
  },
  summaryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: '16px',
    marginBottom: '20px',
  },
  costSummary: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#475569',
  },
  costTotalText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#166534',
  },
  summaryTable: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    minWidth: '850px',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#334155',
    borderBottom: '1px solid #e2e8f0',
    textAlign: 'center' as const,
  },
  // Handled by .table-row class in index.css
};

export default WeeklyMenuPage;
