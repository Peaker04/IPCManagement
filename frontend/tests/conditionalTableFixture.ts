import fs from 'node:fs'
import path from 'node:path'

export type ConditionalTableFixture = {
  id: string
  route: '/admin-data' | '/reports'
  view: string
  sourceFile: string
  sourceSymbol: string
  tableIndex: number
  regionLabel: string
  condition: RegExp
  headerSignature: readonly string[]
  states: readonly ['loading', 'empty', 'ready']
}

const sourceRoot = path.resolve(import.meta.dirname, '../src')

export const conditionalTableFixtures: readonly ConditionalTableFixture[] = [
  {
    id: 'admin-bom-current', route: '/admin-data', view: 'bom', sourceFile: 'app/pages/admin-data/AdminBomPanel.tsx', sourceSymbol: 'AdminBomPanel', tableIndex: 0,
    regionLabel: 'BOM hiện tại theo đơn giá', condition: /bomPanelMode\s*===\s*['"]current['"]/, headerSignature: ['Món', 'Nguyên liệu', 'Đơn vị', 'Định lượng/suất'], states: ['loading', 'empty', 'ready'],
  },
  {
    id: 'admin-bom-preview', route: '/admin-data', view: 'bom-import', sourceFile: 'app/pages/admin-data/AdminBomPanel.tsx', sourceSymbol: 'AdminBomPanel', tableIndex: 1,
    regionLabel: 'Bản xem trước dữ liệu định lượng theo đơn giá', condition: /bomPanelMode/, headerSignature: ['Dòng', 'Món', 'Nguyên liệu', 'Định lượng'], states: ['loading', 'empty', 'ready'],
  },
  {
    id: 'admin-statistics-kpi', route: '/admin-data', view: 'statistics', sourceFile: 'app/pages/admin-data/AdminStatisticsPanel.tsx', sourceSymbol: 'AdminStatisticsPanel', tableIndex: 0,
    regionLabel: 'Bảng chỉ số thống kê vận hành', condition: /effectiveActiveView\s*===\s*['"]statistics['"]/, headerSignature: ['Chỉ số', 'Giá trị', 'Thao tác'], states: ['loading', 'empty', 'ready'],
  },
  {
    id: 'admin-statistics-stock', route: '/admin-data', view: 'statistics', sourceFile: 'app/pages/admin-data/AdminStatisticsPanel.tsx', sourceSymbol: 'AdminStatisticsPanel', tableIndex: 1,
    regionLabel: 'Bảng tồn kho ưu tiên', condition: /currentStockRows/, headerSignature: ['Nguyên liệu', 'Tồn hiện tại', 'Đơn vị'], states: ['loading', 'empty', 'ready'],
  },
  {
    id: 'admin-statistics-price', route: '/admin-data', view: 'statistics', sourceFile: 'app/pages/admin-data/AdminStatisticsPanel.tsx', sourceSymbol: 'AdminStatisticsPanel', tableIndex: 2,
    regionLabel: 'Bảng cảnh báo biến động giá', condition: /priceWarnings/, headerSignature: ['Nguyên liệu', 'Mức biến động', 'Xử lý'], states: ['loading', 'empty', 'ready'],
  },
  ...([
    ['demand', 'Bảng nhu cầu nguyên liệu', ['Ngày', 'Nguyên liệu', 'Số lượng']] as const,
    ['purchase', 'Bảng kế hoạch thu mua dự kiến', ['Ngày', 'Nguyên liệu', 'Số lượng']] as const,
    ['stock', 'Bảng tồn kho hiện tại', ['Nguyên liệu', 'Tồn hiện tại', 'Đơn vị']] as const,
    ['kitchen', 'Bảng xuất kho cho bếp', ['Ca phục vụ', 'Nguyên liệu', 'Số lượng']] as const,
    ['usage', 'Bảng sử dụng thực tế sau hoàn kho', ['Ca phục vụ', 'Nguyên liệu', 'Đã sử dụng']] as const,
    ['reconciliation', 'Bảng đối soát nguồn cung theo dòng nhu cầu', ['Dòng nhu cầu', 'Nguồn cung', 'Trạng thái']] as const,
    ['audit', 'Bảng audit thay đổi hệ thống', ['Thời gian', 'Đối tượng', 'Thao tác']] as const,
  ] as const).map(([view, regionLabel, headerSignature], index) => ({
    id: `reports-${view}`,
    route: '/reports' as const,
    view,
    sourceFile: 'features/reports/pages/ReportsPage.tsx',
    sourceSymbol: 'ReportsPage',
    tableIndex: index,
    regionLabel,
    condition: view === 'reconciliation' ? /reconciliationResult|Đối soát lifecycle/ : new RegExp(`activeView\\s*===\\s*['"]${view}['"]`),
    headerSignature,
    states: ['loading', 'empty', 'ready'] as const,
  })),
  ...([
    ['supplier', 'Bảng biến động giá theo nhà cung cấp', ['Nhà cung cấp', 'Nguyên liệu', 'Mức biến động']] as const,
    ['period', 'Bảng biến động giá theo thời gian', ['Thời gian', 'Nguyên liệu', 'Giá']] as const,
    ['dishGroup', 'Bảng biến động giá theo nhóm món', ['Nhóm món', 'Nguyên liệu', 'Giá']] as const,
    ['lines', 'Bảng biến động giá nguyên liệu', ['Nguyên liệu', 'Giá cũ', 'Giá mới']] as const,
  ] as const).map(([view, regionLabel, headerSignature], index) => ({
    id: `reports-price-${view}`,
    route: '/reports' as const,
    view: 'price',
    sourceFile: 'features/reports/pages/ReportsPricePanel.tsx',
    sourceSymbol: 'ReportsPricePanel',
    tableIndex: index,
    regionLabel,
    condition: new RegExp(`priceSubView\\s*===\\s*['"]${view}['"]`),
    headerSignature,
    states: ['loading', 'empty', 'ready'] as const,
  })),
]

export const readConditionalTableSource = (fixture: ConditionalTableFixture) =>
  fs.readFileSync(path.join(sourceRoot, fixture.sourceFile), 'utf8')
