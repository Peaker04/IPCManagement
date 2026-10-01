import type { CatalogDish } from '@/api/dishCatalogApi'
import { useDishMaterials } from '@/features/projects/weekly-menu/dish-materials/useDishMaterials'
import type { WeeklyMenuScope } from '@/features/projects/weekly-menu/schedule/types'
import type { WeeklyPlanRow } from '@/features/projects/weekly-menu/model/types'
import { parseDisplayDateToIso } from '@/features/projects/weekly-menu/model/formatters'
import { formatCurrency, formatQuantity } from '@/lib/formatters'
import { EmptyState, InlineAlert } from '@/components/common'
export function DishMaterialsScreen({ scope, sourceLabel, catalogDishes, weeklyPlanRows, dishesById }: { scope: WeeklyMenuScope; sourceLabel: string; catalogDishes: CatalogDish[]; weeklyPlanRows: WeeklyPlanRow[]; dishesById: Map<string, CatalogDish> }) {
  const serviceDate = parseDisplayDateToIso((scope.displayDays.find(day => day.key === scope.activeDayKey) ?? scope.displayDays[0])?.date ?? '') ?? ''
  const workflow = useDishMaterials({ scopeKey: `${scope.customerId}:${scope.weekStartDate}:${scope.menuPrice}`, sourceLabel, menuPrice: scope.menuPrice, customerId: scope.customerId, serviceDate, catalogDishes, weeklyRowsWithBom: weeklyPlanRows.filter(row => row.hasCatalogBom), dishesById })
  const { analyzedDish, ingredients, totalTrayCost } = workflow.presentation
  return <section aria-label="Phân tích định mức một khay"><label>Món phân tích<select value={analyzedDish?.id ?? ''} onChange={event => workflow.actions.selectDish(event.target.value)}>{catalogDishes.map(dish => <option key={dish.id} value={dish.id}>{dish.code} — {dish.name}</option>)}</select></label>
    <div className="planning-read-summary"><span>BOM áp dụng: <strong>{serviceDate}</strong></span><span>Định mức: <strong>{formatCurrency(scope.menuPrice)}</strong></span><span>Giá vốn tham chiếu một khay: <strong>{ingredients.length ? formatCurrency(totalTrayCost) : 'Chưa xác định'}</strong></span></div>
    <p className="mb-3 text-xs text-slate-500">{sourceLabel}. Lượng gross theo BOM cho một suất, không phải tiêu hao thực tế.</p>
    {!analyzedDish ? <EmptyState title="Danh mục chưa có món" /> : ingredients.length === 0 ? <InlineAlert title="Chưa có BOM hiệu lực cho món" variant="warning">Kiểm tra khách hàng, định mức và ngày áp dụng tại nguồn BOM. Không diễn giải giá vốn 0 là chi phí thực tế.</InlineAlert> : <div className="planning-read-table"><table><caption className="sr-only">BOM một khay của {analyzedDish.name}</caption><colgroup><col style={{width:'40%'}}/><col style={{width:'10%'}}/><col style={{width:'18%'}}/><col style={{width:'16%'}}/><col style={{width:'16%'}}/></colgroup><thead><tr><th scope="col">Nguyên liệu</th><th scope="col">Đơn vị</th><th scope="col" data-cell-role="numeric">Lượng gross / suất</th><th scope="col" data-cell-role="numeric">Giá tham chiếu</th><th scope="col" data-cell-role="numeric">Giá vốn</th></tr></thead><tbody>{ingredients.map(line => <tr key={line.key}><td>{line.name}</td><td>{line.unit}</td><td data-cell-role="numeric">{formatQuantity(line.theoryQty, { maximumFractionDigits: 6 })}</td><td data-cell-role="numeric">{formatCurrency(line.supplierPrice)}</td><td data-cell-role="numeric">{formatCurrency(line.cost)}</td></tr>)}</tbody></table></div>}
  </section>
}
