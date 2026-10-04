import { Fragment, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { CatalogDish } from '@/api/dishCatalogApi'
import { useMenuCost } from '@/features/projects/weekly-menu/cost/useMenuCost'
import { normalizeDishMatchKey } from '@/features/projects/weekly-menu/model/formatters'
import { resolveDishIngredients } from '@/features/projects/weekly-menu/model/scope'
import type { WeeklyMenuScope } from '@/features/projects/weekly-menu/schedule/types'
import type { WeeklyPlanRow } from '@/features/projects/weekly-menu/model/types'
import { formatCurrency, formatNumber, formatQuantity, formatUnit } from '@/lib/formatters'
import { ContextStrip, EmptyState, InlineAlert, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'

export function CostScreen(props: { scope: WeeklyMenuScope; sourceLabel: string; weeklyPlanRows: WeeklyPlanRow[]; dishesById: Map<string, CatalogDish>; dishesByName: Map<string, CatalogDish> }) {
  const { presentation: p, actions } = useMenuCost(props)
  const [expanded, setExpanded] = useState<string | null>(null)
  const ingredientsFor = (row: typeof p.rows[number]) => resolveDishIngredients(props.dishesById.get(row.dishId) ?? props.dishesByName.get(normalizeDishMatchKey(row.dishName)), { customerId: props.scope.customerId, priceTier: props.scope.menuPrice, serviceDate: row.serviceDate })
  const missingPrice = p.rows.filter(row => ingredientsFor(row).some(line => !Number.isFinite(line.referencePrice) || line.referencePrice <= 0))
  const partial = p.rowsMissingBom.length > 0 || missingPrice.length > 0
  const close = (trigger: Element | null | undefined) => { setExpanded(null); (trigger as HTMLElement | null)?.focus() }
  return <section aria-label="Giá vốn dự kiến theo ngày" className="planning-ledger">
    <div className="planning-ledger-heading"><div><h2>Giá vốn theo ngày</h2><p>So sánh món, số suất và giá vốn tham chiếu; không phải chi phí thực hiện.</p></div><label>Ngày tính giá vốn<select value={p.activeDay?.key ?? ''} onChange={event => { setExpanded(null); actions.selectDay(event.target.value) }}>{p.dayPages.map(day => <option key={day.key} value={day.key}>{day.label} · {day.date}</option>)}</select></label></div>
    <ContextStrip variant="inline" items={[{ label: partial ? 'Tổng có giá tham chiếu (chưa đầy đủ)' : 'Giá vốn dự kiến ngày', value: p.rows.length > 0 && p.rowsWithBom.length === 0 ? 'Chưa xác định' : formatCurrency(p.total) }, { label: 'Thiếu BOM', value: `${p.rowsMissingBom.length} dòng` }, { label: 'Giá cần kiểm tra', value: `${missingPrice.length} dòng` }]} />
    {partial && <InlineAlert title="Giá vốn chưa đầy đủ" variant="warning">Thiếu BOM không phải giá vốn bằng 0. Đơn giá không dương/chưa xác định cần kiểm tra tại nguồn; lượng BOM vẫn được giữ nguyên.</InlineAlert>}
    {p.rows.length === 0 ? <EmptyState title="Chưa có dòng món trong thực đơn tuần" /> : <TableViewport ariaLabel="Giá vốn món trong ngày" appearance="quiet-operational" density="compact"><table className="ipc-data-table"><caption className="sr-only">Dòng món theo ngày, ca, vị trí và số suất</caption><thead><tr><th scope="col">Món / vị trí</th><th scope="col">Ca</th><th scope="col">Ngoại lệ</th><th scope="col" data-cell-role="numeric">Suất</th><th scope="col" data-cell-role="numeric">Giá vốn / suất (₫)</th><th scope="col" data-cell-role="numeric">Thành tiền (₫)</th></tr></thead><tbody>{p.rows.map(row => {
      const ingredients = ingredientsFor(row)
      const priceIssue = ingredients.some(line => !Number.isFinite(line.referencePrice) || line.referencePrice <= 0)
      const id = `cost-source-${row.key}`
      return <Fragment key={row.key}><tr data-selected={expanded === row.key || undefined}><th scope="row"><button type="button" className="planning-row-trigger" aria-expanded={expanded === row.key} aria-controls={id} onClick={() => setExpanded(expanded === row.key ? null : row.key)}><ChevronDown size={14} aria-hidden="true" />{row.dishName}</button><small>{row.slotLabel} · {row.menuTypeLabel}</small></th><td>{row.shiftLabel}</td><td>{!row.hasCatalogBom ? 'Thiếu BOM' : priceIssue ? 'Giá cần kiểm tra' : '—'}</td><td data-cell-role="numeric">{formatNumber(row.portions)}</td><td data-cell-role="numeric">{row.hasCatalogBom ? formatCurrency(row.unitCost) : '—'}</td><td data-cell-role="numeric">{row.hasCatalogBom ? formatCurrency(row.unitCost * row.portions) : '—'}</td></tr>
        {expanded === row.key && <tr id={id} className="planning-row-detail" onKeyDown={event => { if (event.key === 'Escape') close(event.currentTarget.previousElementSibling?.querySelector('button')) }}><td colSpan={6}><h3>Bóc tách giá vốn · {row.dishName}</h3><p>{props.sourceLabel}. Nhân lượng BOM chính xác với giá tham chiếu, làm tròn tổng một món rồi nhân số suất.</p>{ingredients.length === 0 ? <p>Chưa có BOM hiệu lực, không thể xác định giá vốn.</p> : <table><thead><tr><th scope="col">Nguyên liệu</th><th scope="col">Đơn vị</th><th scope="col" data-cell-role="numeric">BOM / suất</th><th scope="col" data-cell-role="numeric">Giá tham chiếu (₫)</th><th scope="col" data-cell-role="numeric">Giá vốn / suất (₫)</th></tr></thead><tbody>{ingredients.map(line => <tr key={`${line.bomId}:${line.ingredientId}:${line.unitId}`}><th scope="row">{line.name}</th><td>{formatUnit(line.unit)}</td><td data-cell-role="numeric">{formatQuantity(line.grossQtyPerServing * row.quantityFactor, { maximumFractionDigits: 6 })}</td><td data-cell-role="numeric">{line.referencePrice > 0 ? formatCurrency(line.referencePrice) : 'Cần kiểm tra'}</td><td data-cell-role="numeric">{line.referencePrice > 0 ? formatCurrency(line.grossQtyPerServing * row.quantityFactor * line.referencePrice) : '—'}</td></tr>)}</tbody></table>}<Button type="button" variant="ghost" size="sm" onClick={event => close(event.currentTarget.closest('tr')?.previousElementSibling?.querySelector('button'))}>Đóng chi tiết</Button></td></tr>}
      </Fragment>
    })}</tbody></table></TableViewport>}
  </section>
}
