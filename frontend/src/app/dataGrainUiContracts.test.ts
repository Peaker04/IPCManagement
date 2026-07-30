import { describe, expect, it } from 'vitest'
import reportsSource from '../features/reports/pages/ReportsPage.tsx?raw'
import weeklyPurchaseSource from '../features/projects/weekly-menu/purchasing/PurchaseSummarySection.tsx?raw'
import weeklyDemandSource from '../features/projects/weekly-menu/demand/MaterialDemandSection.tsx?raw'
import demandSummarySource from '../components/common/DemandSummary.tsx?raw'
import dishMaterialsSource from '../features/projects/weekly-menu/dish-materials/DishMaterialsSection.tsx?raw'
import purchasingDaySource from '../features/purchasing/PurchaseServiceDateWorkbench.tsx?raw'
import purchaseLinesSource from '../features/purchasing/PurchaseLineGroups.tsx?raw'
import orderLinesSource from '../features/warehouse/PurchaseOrderLineGroups.tsx?raw'
import chefChecklistSource from '../features/chef/components/material-checklist.tsx?raw'
import lifecycleSource from '../features/projects/weekly-menu/lifecycle/WeeklyMenuLifecyclePanel.tsx?raw'

describe('whole-project ingredient data-grain UI contracts', () => {
  it('makes every multi-day demand view expose its service date', () => {
    expect(reportsSource).toContain('Tổng hợp nhu cầu theo từng ngày trong khoảng đã chọn')
    expect(reportsSource).toContain('<th>Ngày</th>')
    expect(weeklyPurchaseSource).toContain('Mỗi dòng thuộc một ngày, khách hàng, đơn giá, nguyên liệu và đơn vị')
    expect(weeklyPurchaseSource).toContain('>Ngày</th>')
  })

  it('labels daily views as daily and weekly fallbacks as whole-week totals', () => {
    expect(weeklyDemandSource).toContain('Kế hoạch sản xuất ngày')
    expect(demandSummarySource).toContain("'Tổng hợp trong ngày đang xem'")
    expect(weeklyPurchaseSource).toContain('tổng BOM dự kiến của cả tuần')
    expect(weeklyPurchaseSource).toContain('LT cả tuần')
    expect(weeklyPurchaseSource).toContain('TT cả tuần')
  })

  it('keeps current stock, movement audit, kitchen issues and usage semantically separate', () => {
    expect(reportsSource).toContain('Tồn kho hiện tại theo kho')
    expect(reportsSource).toContain('Lịch sử nhập, xuất, trả và điều chỉnh theo khoảng ngày')
    expect(reportsSource).toContain('Xuất kho cho bếp theo ca')
    expect(reportsSource).toContain('Sử dụng thực tế của bếp: đã xuất - hoàn kho')
  })

  it('keeps purchasing actions inside one selected service date and on source-line IDs', () => {
    expect(purchasingDaySource).toContain('Chọn đúng một ngày trong tuần')
    expect(purchasingDaySource).toContain('Dòng nguyên liệu của ngày phục vụ đang chọn')
    expect(purchaseLinesSource).toContain('`${line.ingredientId}__${line.unitId}`')
    expect(purchaseLinesSource).toContain('onLineChange(line.purchaseRequestLineId)')
  })

  it('allows grouped document rows to drill down to their immutable source lines', () => {
    expect(orderLinesSource).toContain('`${line.ingredientId}__${line.unitId}`')
    expect(orderLinesSource).toContain('line.purchaseOrderLineId')
    expect(chefChecklistSource).toContain('trong ngày/ca')
    expect(chefChecklistSource).toContain('group.lines.map((material)')
    expect(chefChecklistSource).toContain('pendingMaterialId')
  })

  it('labels dish BOM analysis as one-tray data at an effective date', () => {
    expect(dishMaterialsSource).toContain('Áp dụng BOM ngày')
    expect(dishMaterialsSource).toContain('Giá vốn nguyên liệu cho một khay')
  })

  it('shows the daily-demand stage in the weekly lifecycle instead of stopping at servings', () => {
    expect(lifecycleSource).toContain('4. Nhu cầu theo ngày')
    expect(lifecycleSource).toContain('dòng ngày–nguyên liệu')
    expect(lifecycleSource).toContain('dòng thiếu cần Thu mua xử lý')
  })
})
