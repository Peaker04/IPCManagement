import { CalendarDays, CheckCircle2, ChevronDown, Scale, TriangleAlert } from 'lucide-react'
import { ContextStrip, SectionPanel, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatNumber, formatQuantity } from '@/lib/formatters'
import { formatMaterialDishSource } from '../model/formatters'
import type { MenuCostWorkflow } from './useMenuCost'

const MenuCostSection = ({ workflow }: { workflow: MenuCostWorkflow }) => {
  const { scope, actions, presentation } = workflow
  const { activeDay, dayIndex, dayPages, rows, rowsWithBom, rowsMissingBom, materialSummary } = presentation
  const showBomStatus = rowsMissingBom.length > 0
  const materialCount = Object.values(materialSummary).filter((item) => item.theory > 0).length

  return (
    <SectionPanel title="Giá vốn theo ngày từ kế hoạch tuần" headingLevel={2} icon={<Scale size={18} color="var(--ipc-slate-600)" />}>
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

        <ContextStrip items={[
          { label: 'Nguồn tính', value: presentation.sourceLabel, tone: 'neutral' },
          { label: 'BOM áp dụng', value: `${rowsWithBom.length}/${rows.length} dòng`, tone: rowsMissingBom.length > 0 ? 'warning' : 'neutral' },
          { label: 'Chưa có BOM', value: rowsMissingBom.length.toString(), tone: rowsMissingBom.length > 0 ? 'danger' : 'neutral' },
          { label: 'Đơn giá bán/suất', value: formatCurrency(scope.menuPrice), tone: 'neutral' },
          { label: 'Tổng giá vốn ngày', value: formatCurrency(presentation.total), tone: presentation.total > 0 ? 'info' : 'neutral' },
        ]} />

        <TableViewport caption={`Giá vốn món ngày ${activeDay ? `${activeDay.label} ${activeDay.date}` : 'đang xem'}`} size="weekly" className="ipc-cost-table-shell" ariaLabel="Bảng món kế hoạch tuần liên kết giá vốn">
          <table className="ipc-data-table ipc-cost-table table-fixed w-full">
            <thead><tr>
              <th style={{ width: '10%' }} className="sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap">Ca</th>
              <th style={{ width: '14%' }} className="sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap">Dòng</th>
              <th style={{ width: showBomStatus ? '27%' : '35%' }} className="sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap">Món trong kế hoạch</th>
              <th style={{ width: '12%' }} className="sticky top-0 z-10 bg-slate-100 text-right whitespace-nowrap">Suất</th>
              <th style={{ width: '16%' }} className="sticky top-0 z-10 bg-slate-100 text-right whitespace-nowrap">Đơn giá vốn</th>
              <th style={{ width: '18%' }} className="sticky top-0 z-10 bg-slate-100 text-right whitespace-nowrap">Thành tiền</th>
              {showBomStatus && <th style={{ width: '13%' }} className="sticky top-0 z-10 bg-slate-100 text-center whitespace-nowrap">BOM</th>}
            </tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`cost-${row.key}`} className="table-row">
                  <td className="text-left">{row.shiftLabel}</td>
                  <td className="text-left">{row.slotLabel}</td>
                  <td className="text-left font-semibold text-slate-900">{row.dishName}</td>
                  <td className="text-right tabular-nums">{formatNumber(row.portions)}</td>
                  <td className="text-right tabular-nums">{row.hasCatalogBom ? formatCurrency(row.unitCost) : '—'}</td>
                  <td className="text-right tabular-nums font-semibold text-slate-900">{row.hasCatalogBom ? formatCurrency(row.unitCost * row.portions) : '—'}</td>
                  {showBomStatus && <td className="text-center">{row.hasCatalogBom
                    ? <span className="ipc-inline-status"><CheckCircle2 size={15} aria-hidden="true" />Đã có BOM</span>
                    : <span className="ipc-inline-status is-warning"><TriangleAlert size={15} aria-hidden="true" />Chưa có BOM</span>}
                  </td>}
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={showBomStatus ? 7 : 6}>Chưa có kế hoạch ngày để liên kết giá vốn.</td></tr>}
            </tbody>
          </table>
        </TableViewport>

        <details className="ipc-fiori-disclosure">
          <summary>
            <span><strong>Nguyên liệu cấu thành trong ngày</strong><small>Chi tiết định lượng theo các món đang hiển thị</small></span>
            <span>{materialCount} nguyên liệu · {formatCurrency(presentation.materialTotal)} <ChevronDown size={16} aria-hidden="true" /></span>
          </summary>
          <TableViewport caption="Nguyên liệu theo món đang hiển thị trong ngày" size="weekly" className="ipc-cost-table-shell" ariaLabel="Bảng nguyên liệu ngày theo món đang hiển thị">
            <table className="ipc-data-table ipc-cost-table">
              <thead><tr>
                <th className="sticky top-0 z-10 bg-slate-100 text-left">Nguyên liệu</th>
                <th className="sticky top-0 z-10 bg-slate-100 text-center">ĐVT</th>
                <th className="sticky top-0 z-10 bg-slate-100 text-right">LT ngày</th>
                <th className="sticky top-0 z-10 bg-slate-100 text-right">TT ngày</th>
                <th className="sticky top-0 z-10 bg-slate-100 text-left">Món trong kế hoạch</th>
                <th className="sticky top-0 z-10 bg-slate-100 text-right">Đơn giá</th>
                <th className="sticky top-0 z-10 bg-slate-100 text-right">Thành tiền ngày</th>
              </tr></thead>
              <tbody>
                {Object.entries(materialSummary).map(([identityKey, data]) => {
                  if (data.theory === 0) return null
                  return <tr key={`day-material-${identityKey}`} className="table-row">
                    <td className="text-left font-bold text-slate-900">{data.ingredientName}</td>
                    <td className="text-center">{data.unit}</td>
                    <td className="text-right tabular-nums">{formatQuantity(data.theory, { maximumFractionDigits: 2 })}</td>
                    <td className="text-right tabular-nums font-bold text-[var(--ipc-primary-600)]">{formatQuantity(data.actual, { maximumFractionDigits: 2 })}</td>
                    <td className="text-left font-medium text-slate-800" title={data.dishNames.join(', ')}>{formatMaterialDishSource(data.dishNames)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(data.referencePrice)}</td>
                    <td className="text-right tabular-nums font-bold text-slate-900">{formatCurrency(data.actual * data.referencePrice)}</td>
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
