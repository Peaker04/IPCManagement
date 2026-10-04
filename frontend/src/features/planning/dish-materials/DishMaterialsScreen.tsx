import type { CatalogDish } from '@/api/dishCatalogApi'
import { Download } from 'lucide-react'
import { useDishMaterials } from '@/features/projects/weekly-menu/dish-materials/useDishMaterials'
import type { WeeklyMenuScope } from '@/features/projects/weekly-menu/schedule/types'
import type { WeeklyPlanRow } from '@/features/projects/weekly-menu/model/types'
import { parseDisplayDateToIso } from '@/features/projects/weekly-menu/model/formatters'
import { formatCurrency, formatDateOnly, formatQuantity, formatUnit } from '@/lib/formatters'
import { ContextStrip, EmptyState, InlineAlert, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { downloadPlanningCsv } from '../downloadPlanningCsv'

export function DishMaterialsScreen({ scope, sourceLabel, catalogDishes, weeklyPlanRows, dishesById }: { scope: WeeklyMenuScope; sourceLabel: string; catalogDishes: CatalogDish[]; weeklyPlanRows: WeeklyPlanRow[]; dishesById: Map<string, CatalogDish> }) {
  const serviceDate = parseDisplayDateToIso((scope.displayDays.find(day => day.key === scope.activeDayKey) ?? scope.displayDays[0])?.date ?? '') ?? ''
  const workflow = useDishMaterials({ scopeKey: `${scope.customerId}:${scope.weekStartDate}:${scope.menuPrice}`, sourceLabel, menuPrice: scope.menuPrice, customerId: scope.customerId, serviceDate, catalogDishes, weeklyRowsWithBom: weeklyPlanRows.filter(row => row.hasCatalogBom), dishesById })
  const { analyzedDish, ingredients, totalTrayCost } = workflow.presentation
  const missingPrices = ingredients.filter(line => !Number.isFinite(line.supplierPrice) || line.supplierPrice <= 0)
  function exportDish() {
    if (!analyzedDish || ingredients.length === 0) return
    downloadPlanningCsv(`BOM_${analyzedDish.code.replace(/[^\p{L}\p{N}_-]/gu, '_')}_${serviceDate}.csv`, [
      ['Món', 'Ngày hiệu lực', 'Định mức', 'Nguyên liệu', 'Đơn vị', 'Gross / suất', 'Giá tham chiếu', 'Giá vốn / suất'],
      ...ingredients.map(line => [analyzedDish.name, serviceDate, scope.menuPrice, line.name, line.unit, line.actualQty, line.supplierPrice > 0 ? line.supplierPrice : 'Cần kiểm tra', line.supplierPrice > 0 ? line.cost : 'Chưa xác định']),
    ])
  }
  return <section aria-label="Phân tích định mức một khay" className="planning-ledger">
    <div className="planning-ledger-heading"><div><h2>Định mức theo món</h2><p>BOM một món / một suất, không phải tiêu hao thực tế.</p></div><label>Món phân tích<select value={analyzedDish?.id ?? ''} onChange={event => workflow.actions.selectDish(event.target.value)}>{catalogDishes.map(dish => <option key={dish.id} value={dish.id}>{dish.code} — {dish.name}</option>)}</select></label></div>
    {!analyzedDish ? <EmptyState title="Danh mục chưa có món" /> : <>
      <div className="planning-ledger-heading"><h3>{analyzedDish.name}</h3><Button type="button" variant="outline" size="sm" disabled={ingredients.length === 0} onClick={exportDish}><Download size={16} aria-hidden="true" />CSV món đang chọn</Button></div>
      <ContextStrip variant="inline" items={[{ label: 'BOM áp dụng', value: formatDateOnly(serviceDate) }, { label: missingPrices.length ? 'Giá vốn có giá tham chiếu (chưa đầy đủ)' : 'Giá vốn tham chiếu một khay', value: ingredients.length ? formatCurrency(totalTrayCost) : 'Chưa xác định' }]} />
      {ingredients.length === 0 ? <InlineAlert title="Chưa có BOM hiệu lực cho món" variant="warning">Kiểm tra khách hàng, định mức và ngày áp dụng tại nguồn BOM. Không diễn giải là chi phí bằng 0.</InlineAlert> : <>
        {missingPrices.length > 0 && <InlineAlert title="Giá tham chiếu cần kiểm tra" variant="warning">{missingPrices.length} dòng có giá không dương/chưa xác định. Lượng BOM vẫn được giữ nguyên; tổng chưa phải giá vốn đầy đủ.</InlineAlert>}
        <TableViewport ariaLabel="BOM một khay của món đang chọn" appearance="quiet-operational" density="compact"><table className="ipc-data-table"><caption className="sr-only">BOM một khay của {analyzedDish.name}</caption><thead><tr><th scope="col">Nguyên liệu</th><th scope="col">Đơn vị</th><th scope="col" data-cell-role="numeric">Lượng gross / suất</th><th scope="col" data-cell-role="numeric">Giá tham chiếu (₫)</th><th scope="col" data-cell-role="numeric">Giá vốn (₫)</th></tr></thead><tbody>{ingredients.map(line => <tr key={line.key}><th scope="row">{line.name}</th><td>{formatUnit(line.unit)}</td><td data-cell-role="numeric">{formatQuantity(line.actualQty, { maximumFractionDigits: 6 })}</td><td data-cell-role="numeric">{line.supplierPrice > 0 ? formatCurrency(line.supplierPrice) : 'Cần kiểm tra'}</td><td data-cell-role="numeric">{line.supplierPrice > 0 ? formatCurrency(line.cost) : '—'}</td></tr>)}</tbody></table></TableViewport>
      </>}
      <details className="planning-help"><summary>Cách đọc định mức</summary><p>{sourceLabel}. Lượng gross được giữ chính xác đến 6 chữ số thập phân; giá vốn nhân lượng chưa làm tròn với giá tham chiếu. API hiện không cung cấp lượng net riêng; không tự suy hao hụt để tạo số liệu.</p></details>
    </>}
  </section>
}
