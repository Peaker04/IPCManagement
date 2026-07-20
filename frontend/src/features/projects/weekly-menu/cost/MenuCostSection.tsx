import { Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, SectionPanel, TableViewport } from '@/components/common'
import { formatCurrency } from '@/lib/formatters'
import { formatMaterialDishSource } from '../model/formatters'
import type { MenuCostWorkflow } from './useMenuCost'

const tableHeadClass = 'text-center'
const tableCellClass = 'text-center'

const MenuCostSection = ({ workflow }: { workflow: MenuCostWorkflow }) => {
  const { scope, actions, presentation } = workflow
  const { activeDay, dayIndex, dayPages, rows, rowsWithBom, rowsMissingBom, materialSummary } = presentation

  return (
    <SectionPanel title="Giá vốn theo ngày từ kế hoạch tuần" icon={<Scale size={18} color="var(--ipc-slate-600)" />}>
      <div className="mb-6 mt-4">
        <ContextStrip items={[
          { label: 'Nguồn tính', value: presentation.sourceLabel, tone: 'neutral' },
          { label: 'Ngày đang tính', value: activeDay ? `${activeDay.label} ${activeDay.date}` : 'Chưa có ngày', tone: activeDay ? 'info' : 'neutral' },
          { label: 'Dòng trong ngày', value: rows.length.toString(), tone: 'neutral' },
          { label: 'Đã có BOM', value: rowsWithBom.length.toString(), tone: 'success' },
          { label: 'Chờ gắn BOM', value: rowsMissingBom.length.toString(), tone: rowsMissingBom.length > 0 ? 'warning' : 'success' },
          { label: 'Đơn giá bán/suất', value: formatCurrency(scope.menuPrice), tone: 'neutral' },
          { label: 'Tổng giá vốn ngày', value: formatCurrency(presentation.total), tone: presentation.total > 0 ? 'success' : 'neutral' },
        ]} />
      </div>

      <TableViewport caption="Món trong kế hoạch tuần và giá vốn liên kết" size="weekly" className="ipc-cost-table-shell" ariaLabel="Bảng món kế hoạch tuần liên kết giá vốn">
        <table className="ipc-data-table ipc-cost-table table-fixed w-full">
          <thead><tr>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Ngày</th>
            <th style={{ width: '8%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Ca</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Dòng</th>
            <th style={{ width: '24%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món trong kế hoạch</th>
            <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Suất</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Đơn giá vốn</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Thành tiền</th>
            <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Trạng thái giá vốn</th>
          </tr></thead>
          <tbody>
            {rows.map((row) => {
              const unitCost = presentation.getDishUnitCost(row.dishId, row.quantityFactor)
              return <tr key={`cost-${row.key}`} className="table-row">
                <td className={`${tableCellClass} text-left font-semibold`}>{row.dayLabel}<div className="text-xs font-normal text-slate-500">{row.date}</div></td>
                <td className={tableCellClass}>{row.shiftLabel}</td>
                <td className={`${tableCellClass} text-left`}>{row.slotLabel}</td>
                <td className={`${tableCellClass} text-left font-semibold`}>{row.dishName}</td>
                <td className={tableCellClass}>{row.portions.toLocaleString('vi-VN')}</td>
                <td className={tableCellClass}>{row.hasCatalogBom ? formatCurrency(unitCost) : '-'}</td>
                <td className={`${tableCellClass} font-semibold`}>{row.hasCatalogBom ? formatCurrency(unitCost * row.portions) : '-'}</td>
                <td className={cn(tableCellClass, row.hasCatalogBom ? 'text-green-700' : 'text-amber-700')}>{row.hasCatalogBom ? 'Đã có định lượng nguyên liệu' : 'Chờ gắn định lượng'}</td>
              </tr>
            })}
            {rows.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={8}>Chưa có kế hoạch ngày để liên kết giá vốn.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
      <div className="mb-5 mt-3 flex min-h-[38px] items-center justify-end gap-2">
        <span className="mr-2 text-sm font-medium text-slate-600">{activeDay ? `${activeDay.label} ${activeDay.date} (${dayIndex + 1}/${dayPages.length})` : 'Chưa có ngày'}</span>
        <button type="button" className="ipc-button ipc-button-ghost" disabled={dayIndex <= 0} onClick={() => actions.selectDay(dayPages[Math.max(0, dayIndex - 1)]?.key ?? null)}>Ngày trước</button>
        <button type="button" className="ipc-button ipc-button-primary" disabled={dayIndex >= dayPages.length - 1} onClick={() => actions.selectDay(dayPages[Math.min(dayPages.length - 1, dayIndex + 1)]?.key ?? null)}>Ngày sau</button>
      </div>

      <TableViewport caption="Nguyên liệu theo món đang hiển thị trong ngày" className="ipc-cost-table-shell h-[360px] max-h-[360px]" ariaLabel="Bảng nguyên liệu ngày theo món đang hiển thị">
        <table className="ipc-data-table ipc-cost-table">
          <thead><tr>
            {['Nguyên liệu', 'ĐV', 'LT ngày', 'TT ngày', 'Món trong kế hoạch', 'Đơn giá', 'Thành tiền ngày'].map((label) => <th key={label} className={cn(tableHeadClass, 'sticky top-0 z-10 bg-slate-100', (label === 'Nguyên liệu' || label === 'Món trong kế hoạch') && 'text-left')}>{label}</th>)}
          </tr></thead>
          <tbody>
            {Object.entries(materialSummary).map(([name, data]) => {
              if (data.theory === 0) return null
              return <tr key={`day-material-${name}`} className="table-row">
                <td className={`${tableCellClass} text-left font-bold`}>{name}</td><td className={tableCellClass}>{data.unit}</td>
                <td className={tableCellClass}>{data.theory.toFixed(2)}</td><td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>{data.actual.toFixed(2)}</td>
                <td className={`${tableCellClass} text-left font-medium text-slate-800`} title={data.dishNames.join(', ')}>{formatMaterialDishSource(data.dishNames)}</td>
                <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td><td className={`${tableCellClass} font-bold`}>{formatCurrency(data.actual * data.referencePrice)}</td>
              </tr>
            })}
            {Object.keys(materialSummary).length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={7}>Chưa có nguyên liệu cho ngày này. Kiểm tra định lượng nguyên liệu của các món.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
      <div className="mt-3 flex min-h-[32px] items-center justify-end text-sm font-medium text-slate-600">Tổng nguyên liệu ngày: <span className="ml-2 text-lg font-bold text-green-800">{formatCurrency(presentation.materialTotal)}</span></div>
    </SectionPanel>
  )
}

export default MenuCostSection
