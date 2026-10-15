import { useState } from 'react'
import { Calculator, CalendarDays, CheckCircle2, ChevronDown, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, InlineAlert, Num, SectionPanel, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatPercent } from '@/lib/formatters'
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
        <section className="ipc-fiori-command flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 sm:flex-row sm:items-center sm:justify-between" aria-label="Điều hướng ngày tính giá vốn">
          <div className="ipc-fiori-object flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-2xs">
              <CalendarDays size={18} aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-slate-500 leading-tight">Ngày đang tính</span>
              <strong className="text-sm font-semibold text-slate-900 leading-tight">{activeDay ? `${activeDay.label} ${activeDay.date}` : 'Chưa có ngày'}</strong>
              <small className="text-xs text-slate-500 leading-tight">{dayPages.length > 0 ? `Ngày ${dayIndex + 1}/${dayPages.length} · ${rows.length} dòng món` : 'Chưa có kế hoạch để tính giá vốn'}</small>
            </div>
          </div>
          <nav className="ipc-fiori-segmented flex items-center gap-1.5" aria-label="Chuyển ngày tính giá vốn">
            <Button type="button" variant="outline" size="sm" disabled={dayIndex <= 0} onClick={() => actions.selectDay(dayPages[Math.max(0, dayIndex - 1)]?.key ?? null)}>Ngày trước</Button>
            <Button type="button" variant="outline" size="sm" disabled={dayIndex >= dayPages.length - 1} onClick={() => actions.selectDay(dayPages[Math.min(dayPages.length - 1, dayIndex + 1)]?.key ?? null)}>Ngày sau</Button>
          </nav>
        </section>

        <ContextStrip variant="inline" items={[
          { label: 'Nguồn tính', value: presentation.sourceLabel, tone: 'neutral' },
          { label: 'BOM áp dụng', value: `${rowsWithBom.length}/${rows.length} dòng`, tone: rowsMissingBom.length > 0 ? 'warning' : 'neutral' },
          { label: 'Chưa có BOM', value: rowsMissingBom.length.toString(), tone: rowsMissingBom.length > 0 ? 'danger' : 'neutral' },
          { label: 'Đơn giá bán/suất', value: <Num value={scope.menuPrice} type="currency" />, tone: 'neutral' },
          { label: 'Tổng giá vốn ngày', value: <Num value={presentation.total} type="currency" />, tone: presentation.total > 0 ? 'info' : 'neutral' },
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
                      <td data-cell-role="numeric" className="text-right font-medium">
                        <Num value={row.portions} type="number" />
                      </td>
                      <td data-cell-role="numeric" className="text-right">
                        {row.hasCatalogBom ? <Num value={row.unitCost} type="currency" /> : '—'}
                      </td>
                      <td data-cell-role="numeric" className="text-right font-semibold text-slate-900">
                        {row.hasCatalogBom ? <Num value={row.unitCost * row.portions} type="currency" /> : '—'}
                      </td>
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
            <aside className="lg:col-span-5 rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col gap-3 shadow-2xs" aria-label={`Bóc tách định mức BOM của ${activeRow.dishName}`}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Định mức BOM: {activeRow.dishName}</h3>
                  <p className="text-xs text-slate-500">Ca: {activeRow.shiftLabel} · Dòng: {activeRow.slotLabel} · <Num value={activeRow.portions} type="number" /> suất</p>
                </div>
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded', foodCostPercent > 85 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                  {scope.menuPrice > 0 ? `Food Cost: ${formatPercent(foodCostPercent, 1)}` : 'Đã duyệt BOM'}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-2.5 rounded-md border border-slate-200 shadow-2xs">
                <span>Đơn giá vốn: <strong className="text-slate-900"><Num value={activeRow.unitCost} type="currency" /></strong></span>
                {scope.menuPrice > 0 && <span>Giá bán: <strong className="text-slate-900"><Num value={scope.menuPrice} type="currency" /></strong></span>}
                {scope.menuPrice > 0 && <span>LN gộp: <strong className={grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}><Num value={grossProfit} type="currency" /></strong></span>}
              </div>
              {activeRow.ingredients && activeRow.ingredients.length > 0 ? (
                <TableViewport caption={`Thành phần nguyên liệu định mức cho món ${activeRow.dishName}`} ariaLabel={`Bảng nguyên liệu định mức món ${activeRow.dishName}`} className="ipc-cost-table-shell max-h-72">
                  <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
                    <thead>
                      <tr>
                        <th scope="col" className="text-left whitespace-nowrap min-w-[120px]">Nguyên liệu</th>
                        <th scope="col" className="text-center w-16 whitespace-nowrap">ĐVT</th>
                        <th scope="col" className="text-right w-24 whitespace-nowrap">Định lượng</th>
                        <th scope="col" className="text-right w-24 whitespace-nowrap">Đơn giá</th>
                        <th scope="col" className="text-right w-28 whitespace-nowrap">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRow.ingredients.map((ing) => (
                        <tr key={`ing-${ing.ingredientId}`}>
                          <td className="text-left font-medium text-slate-900">{ing.name}</td>
                          <td className="text-center text-slate-600 whitespace-nowrap">{ing.unit}</td>
                          <td data-cell-role="numeric" className="text-right whitespace-nowrap">
                            <Num value={ing.grossQtyPerServing} type="quantity" maximumFractionDigits={6} />
                          </td>
                          <td data-cell-role="numeric" className="text-right whitespace-nowrap">
                            <Num value={ing.referencePrice ?? 0} type="currency" />
                          </td>
                          <td data-cell-role="numeric" className="text-right font-semibold text-slate-900 whitespace-nowrap">
                            <Num value={Math.round(ing.grossQtyPerServing * (ing.referencePrice ?? 0))} type="currency" />
                          </td>
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

        <details className="ipc-fiori-disclosure group rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between border-b border-transparent bg-slate-50/80 px-4 py-3 text-sm font-medium transition hover:bg-slate-100/70 group-open:border-slate-200 [&::-webkit-details-marker]:hidden">
            <span className="flex flex-col gap-0.5">
              <strong className="text-sm font-semibold text-slate-900 leading-tight">Nguyên liệu cấu thành trong ngày</strong>
              <small className="text-xs text-slate-500 leading-tight">Chi tiết định lượng theo các món đang hiển thị</small>
            </span>
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span>{materialCount} nguyên liệu · <Num value={presentation.materialTotal} type="currency" /></span>
              <ChevronDown size={16} className="text-slate-400 transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <div className="p-3">
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
                      <td data-cell-role="numeric" className="text-right">
                        <Num value={data.theory} type="quantity" maximumFractionDigits={2} />
                      </td>
                      <td data-cell-role="numeric" className="text-right font-semibold text-blue-700">
                        <Num value={data.actual} type="quantity" maximumFractionDigits={2} />
                      </td>
                      <td className="text-left text-slate-700" title={data.dishNames.join(', ')}>{formatMaterialDishSource(data.dishNames)}</td>
                      <td data-cell-role="numeric" className="text-right">
                        <Num value={data.referencePrice} type="currency" />
                      </td>
                      <td data-cell-role="numeric" className="text-right font-semibold text-slate-900">
                        <Num value={data.actual * data.referencePrice} type="currency" />
                      </td>
                    </tr>
                  })}
                  {materialCount === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={7}>Chưa có nguyên liệu cho ngày này. Kiểm tra định lượng nguyên liệu của các món.</td></tr>}
                </tbody>
              </table>
            </TableViewport>
          </div>
        </details>
      </div>
    </SectionPanel>
  )
}

export default MenuCostSection
