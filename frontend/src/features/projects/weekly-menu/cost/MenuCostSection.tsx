import { useState } from 'react'
import { Calculator, CalendarDays, CheckCircle2, ChevronDown, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, InlineAlert, SectionPanel, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber, formatPercent, formatQuantity } from '@/lib/formatters'
import { formatMaterialDishSource } from '../model/formatters'
import type { MenuCostWorkflow } from './useMenuCost'

const MenuCostSection = ({ workflow }: { workflow: MenuCostWorkflow }) => {
  const { scope, actions, presentation } = workflow
  const { activeDay, dayIndex, dayPages, rows, rowsWithBom, rowsMissingBom, materialSummary } = presentation
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null)
  const activeRow = rows.find((r) => r.key === selectedRowKey) ?? rows[0] ?? null
  const foodCostPercent = activeRow && scope.menuPrice > 0 ? (activeRow.unitCost / scope.menuPrice) * 100 : 0
  const grossProfit = activeRow ? scope.menuPrice - activeRow.unitCost : 0
  const showBomStatus = rowsMissingBom.length > 0
  const materialCount = Object.values(materialSummary).filter((item) => item.theory > 0).length

  return (
    <SectionPanel
      title="Giá vốn theo ngày từ kế hoạch tuần"
      headingLevel={2}
      icon={<Calculator size={18} />}
      description="Tính toán giá vốn chi tiết dựa trên định mức BOM của từng món ăn và đơn giá nguyên liệu hiện hành."
    >
      <div className="flex flex-col gap-3">
        <section className="ipc-fiori-command" aria-label="Điều hướng ngày tính giá vốn">
          <div className="ipc-fiori-object">
            <CalendarDays size={18} aria-hidden="true" />
            <div>
              <span>Ngày đang tính</span>
              <strong>{activeDay ? `${activeDay.label} ${activeDay.date}` : 'Chưa có ngày'}</strong>
              <small>{dayPages.length > 0 ? `Ngày ${dayIndex + 1}/${dayPages.length} · ${rows.length} dòng món` : 'Chưa có kế hoạch để tính giá vốn'}</small>
            </div>
          </div>
          <nav className="ipc-fiori-segmented" aria-label="Chuyển ngày tính giá vốn">
            <Button type="button" variant="outline" size="sm" disabled={dayIndex <= 0} onClick={() => actions.selectDay(dayPages[Math.max(0, dayIndex - 1)]?.key ?? null)}>Ngày trước</Button>
            <Button type="button" variant="outline" size="sm" disabled={dayIndex >= dayPages.length - 1} onClick={() => actions.selectDay(dayPages[Math.min(dayPages.length - 1, dayIndex + 1)]?.key ?? null)}>Ngày sau</Button>
          </nav>
        </section>

        <ContextStrip variant="inline" items={[
          { label: 'Nguồn tính', value: presentation.sourceLabel, tone: 'neutral' },
          { label: 'BOM áp dụng', value: `${rowsWithBom.length}/${rows.length} dòng`, tone: rowsMissingBom.length > 0 ? 'warning' : 'neutral' },
          { label: 'Chưa có BOM', value: rowsMissingBom.length.toString(), tone: rowsMissingBom.length > 0 ? 'danger' : 'neutral' },
          { label: 'Đơn giá bán/suất', value: formatCurrency(scope.menuPrice), tone: 'neutral' },
          { label: 'Tổng giá vốn ngày', value: formatCurrency(presentation.total), tone: presentation.total > 0 ? 'info' : 'neutral' },
        ]} />

        {foodCostPercent > 85 && activeRow && (
          <InlineAlert title="Cảnh báo: Tỷ lệ giá vốn (Food Cost %) vượt ngưỡng quy định!" variant="danger">
            Món <strong>{activeRow.dishName}</strong> có tỷ lệ giá vốn đạt <strong>{formatPercent(foodCostPercent, 1)}</strong>, vượt ngưỡng an toàn tối đa (85%).
          </InlineAlert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          <div className={activeRow ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <TableViewport caption={`Giá vốn từng dòng món theo ngày, ca và số suất ${activeDay ? `${activeDay.label} ${activeDay.date}` : 'đang xem'}`} size="weekly" className="ipc-cost-table-shell" ariaLabel="Bảng món kế hoạch tuần liên kết giá vốn">
              <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
                <thead><tr>
                  <th scope="col" style={{ width: '12%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Ca</th>
                  <th scope="col" style={{ width: '14%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Dòng</th>
                  <th scope="col" style={{ width: showBomStatus ? '26%' : '32%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Món trong kế hoạch</th>
                  <th scope="col" style={{ width: '12%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Suất</th>
                  <th scope="col" style={{ width: '18%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Đơn giá vốn</th>
                  <th scope="col" style={{ width: '18%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Thành tiền</th>
                  {showBomStatus && <th scope="col" style={{ width: '12%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">BOM</th>}
                </tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`cost-${row.key}`}
                      onClick={() => setSelectedRowKey(row.key)}
                      className={cn('cursor-pointer transition-colors', row.key === activeRow?.key && 'bg-blue-50/80 font-medium')}
                      title="Bấm để xem bóc tách định mức BOM"
                    >
                      <td className="text-left text-slate-600">{row.shiftLabel}</td>
                      <td className="text-left text-slate-600">{row.slotLabel}</td>
                      <td className="text-left font-medium text-slate-900">{row.dishName}</td>
                      <td data-cell-role="numeric" className="text-right tabular-nums font-medium">{formatNumber(row.portions)}</td>
                      <td data-cell-role="numeric" className="text-right tabular-nums">{row.hasCatalogBom ? formatCurrency(row.unitCost) : '—'}</td>
                      <td data-cell-role="numeric" className="text-right tabular-nums font-semibold text-slate-900">{row.hasCatalogBom ? formatCurrency(row.unitCost * row.portions) : '—'}</td>
                      {showBomStatus && <td className="text-center">{row.hasCatalogBom
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 size={14} aria-hidden="true" />Đã có BOM</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><TriangleAlert size={14} aria-hidden="true" />Chưa có BOM</span>}
                      </td>}
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={showBomStatus ? 7 : 6}>Chưa có kế hoạch ngày để liên kết giá vốn.</td></tr>}
                </tbody>
              </table>
            </TableViewport>
          </div>

          {activeRow && (
            <aside className="lg:col-span-5 rounded border border-[var(--ipc-color-border-subtle,#e2eaf4)] bg-[var(--ipc-slate-50,#f8fafc)] p-3 flex flex-col gap-2.5" aria-label={`Bóc tách định mức BOM của ${activeRow.dishName}`}>
              <div className="flex items-center justify-between border-b border-[var(--ipc-color-border-subtle,#e2eaf4)] pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Định mức BOM: {activeRow.dishName}</h3>
                  <p className="text-xs text-slate-500">Ca: {activeRow.shiftLabel} · Dòng: {activeRow.slotLabel} · {activeRow.portions} suất</p>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', foodCostPercent > 85 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                  {scope.menuPrice > 0 ? `Food Cost: ${formatPercent(foodCostPercent, 1)}` : 'Đã duyệt BOM'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-2 rounded border border-[var(--ipc-color-border-subtle,#e2eaf4)]">
                <span>Đơn giá vốn: <strong className="text-slate-900">{formatCurrency(activeRow.unitCost)}</strong></span>
                {scope.menuPrice > 0 && <span>Giá bán: <strong className="text-slate-900">{formatCurrency(scope.menuPrice)}</strong></span>}
                {scope.menuPrice > 0 && <span>LN gộp: <strong className={grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}>{formatCurrency(grossProfit)}</strong></span>}
              </div>
              {activeRow.ingredients && activeRow.ingredients.length > 0 ? (
                <TableViewport caption={`Thành phần nguyên liệu định mức cho món ${activeRow.dishName}`} ariaLabel={`Bảng nguyên liệu định mức món ${activeRow.dishName}`} className="ipc-cost-table-shell max-h-64">
                  <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Nguyên liệu</th>
                        <th className="text-center w-14">ĐVT</th>
                        <th className="text-right w-20">Định lượng</th>
                        <th className="text-right w-20">Đơn giá</th>
                        <th className="text-right w-24">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRow.ingredients.map((ing) => (
                        <tr key={`ing-${ing.ingredientId}`}>
                          <td className="text-left font-medium text-slate-900">{ing.name}</td>
                          <td className="text-center text-slate-600">{ing.unit}</td>
                          <td className="text-right tabular-nums">{formatQuantity(ing.grossQtyPerServing, { maximumFractionDigits: 6 })}</td>
                          <td className="text-right tabular-nums">{formatCurrency(ing.referencePrice)}</td>
                          <td className="text-right tabular-nums font-semibold text-slate-900">{formatCurrency(Math.round(ing.grossQtyPerServing * ing.referencePrice))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableViewport>
              ) : (
                <p className="p-4 text-center text-xs text-slate-500">Món ăn này chưa có dữ liệu định mức BOM trong danh mục.</p>
              )}
            </aside>
          )}
        </div>

        <details className="ipc-fiori-disclosure">
          <summary>
            <span><strong>Nguyên liệu cấu thành trong ngày</strong><small>Chi tiết định lượng theo các món đang hiển thị</small></span>
            <span>{materialCount} nguyên liệu · {formatCurrency(presentation.materialTotal)} <ChevronDown size={16} aria-hidden="true" /></span>
          </summary>
          <TableViewport caption="Nguyên liệu theo ngày, đơn vị và các món trong kế hoạch" size="weekly" className="ipc-cost-table-shell" ariaLabel="Bảng nguyên liệu ngày theo món đang hiển thị">
            <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
              <thead><tr>
                <th scope="col" className="sticky top-0 z-10 text-left">Nguyên liệu</th>
                <th scope="col" className="sticky top-0 z-10 text-center">ĐVT</th>
                <th scope="col" className="sticky top-0 z-10 text-right">LT ngày</th>
                <th scope="col" className="sticky top-0 z-10 text-right">TT ngày</th>
                <th scope="col" className="sticky top-0 z-10 text-left">Món trong kế hoạch</th>
                <th scope="col" className="sticky top-0 z-10 text-right">Đơn giá</th>
                <th scope="col" className="sticky top-0 z-10 text-right">Thành tiền ngày</th>
              </tr></thead>
              <tbody>
                {Object.entries(materialSummary).map(([identityKey, data]) => {
                  if (data.theory === 0) return null
                  return <tr key={`day-material-${identityKey}`}>
                    <td className="text-left font-medium text-slate-900">{data.ingredientName}</td>
                    <td className="text-center text-slate-600">{data.unit}</td>
                    <td data-cell-role="numeric" className="text-right tabular-nums">{formatQuantity(data.theory, { maximumFractionDigits: 2 })}</td>
                    <td data-cell-role="numeric" className="text-right tabular-nums font-semibold text-blue-700">{formatQuantity(data.actual, { maximumFractionDigits: 2 })}</td>
                    <td className="text-left text-slate-700" title={data.dishNames.join(', ')}>{formatMaterialDishSource(data.dishNames)}</td>
                    <td data-cell-role="numeric" className="text-right tabular-nums">{formatCurrency(data.referencePrice)}</td>
                    <td data-cell-role="numeric" className="text-right tabular-nums font-semibold text-slate-900">{formatCurrency(data.actual * data.referencePrice)}</td>
                  </tr>
                })}
                {materialCount === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={7}>Chưa có nguyên liệu cho ngày này. Kiểm tra định lượng nguyên liệu của các món.</td></tr>}
              </tbody>
            </table>
          </TableViewport>
        </details>
      </div>
    </SectionPanel>
  )
}

export default MenuCostSection
