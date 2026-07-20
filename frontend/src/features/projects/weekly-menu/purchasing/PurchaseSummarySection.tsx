import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, InlineAlert, PaginationBar, SectionPanel, StatusBadge, TableViewport, Toolbar } from '@/components/common'
import { formatCurrency, formatQuantityWithUnit } from '@/lib/formatters'
import { formatMaterialDishSource, formatQuantityVariance } from '../model/formatters'
import { PURCHASE_SUMMARY_PAGE_SIZE } from './purchaseSummaryModel'
import type { PurchaseSummaryWorkflow } from './usePurchaseSummary'

const tableHeadClass = 'text-center'
const tableCellClass = 'text-center'

const PurchaseSummarySection = ({ workflow }: { workflow: PurchaseSummaryWorkflow }) => {
  const { actions, presentation } = workflow
  return (
    <SectionPanel
      title="Bảng Tính Định Lượng Tổng Hợp & Đề Xuất Mua Hàng"
      icon={<ShoppingCart size={18} color="var(--ipc-slate-600)" />}
      badge={<Toolbar>
        <div className="text-sm font-medium text-slate-600">Tổng chi phí tối ưu: <span className="text-lg font-bold text-green-800">{formatCurrency(presentation.totalCost)}</span></div>
        <button type="button" onClick={actions.exportWarehouseReport} className="ipc-button ipc-button-success ipc-button-bounded">Xuất Báo Cáo Gửi Kho</button>
      </Toolbar>}
    >
      <div className="mb-4">
        <ContextStrip items={[
          { label: 'Khách hàng', value: presentation.customerLabel, tone: 'neutral' },
          { label: 'Tuần', value: presentation.weekLabel, tone: presentation.weekLabel === 'Chưa có menu' ? 'neutral' : 'info' },
          { label: 'Nguyên liệu', value: (presentation.usesDemand ? presentation.totalItems : presentation.materialCount).toString(), tone: 'info' },
          { label: 'Thiếu sau kiểm tồn', value: presentation.usesDemand ? presentation.shortageCount.toString() : '-', tone: presentation.shortageCount > 0 ? 'danger' : presentation.usesDemand ? 'success' : 'neutral' },
        ]} />
      </div>
      {!presentation.usesDemand && <InlineAlert title="Chưa có số thiếu/đủ sau kiểm tồn" variant="warning" className="mb-3">Bảng dưới đây mới là định lượng theo BOM. Bấm Tạo demand từ KHSX ở tab KHSX và nhu cầu để backend kiểm tồn kho và trả ra Cần, Tồn khả dụng, Thiếu/Đủ.</InlineAlert>}
      <TableViewport caption="Định lượng tổng hợp và đề xuất mua hàng" className="ipc-cost-table-shell h-[560px] max-h-[560px]" ariaLabel="Bảng định lượng tổng hợp và đề xuất mua hàng">
        <table className={cn('ipc-data-table ipc-cost-table table-fixed w-full', presentation.usesDemand && 'ipc-status-action-table')}>
          <thead>{presentation.usesDemand ? <tr>
            <th style={{ width: '15%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguyên liệu</th>
            <th style={{ width: '25%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguồn</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Cần</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Tồn khả dụng</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Chênh lệch</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Trạng thái</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-center whitespace-nowrap`}>Tiếp theo</th>
          </tr> : <tr>
            <th style={{ width: '20%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguyên liệu</th>
            <th style={{ width: '8%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>ĐV</th>
            <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>LT</th>
            <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>TT</th>
            <th style={{ width: '30%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món trong kế hoạch</th>
            <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Đơn giá</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Thành tiền</th>
          </tr>}</thead>
          <tbody>
            {presentation.demandRows.map((line, index) => {
              const available = line.available - line.reserved
              const variance = available - line.required
              return <tr key={`${line.id}-${presentation.pageIndex}-${index}`} className="table-row">
                <td className={`${tableCellClass} text-left font-bold`}>{line.material}</td><td className={`${tableCellClass} text-left font-medium text-slate-800`}>{line.source}</td>
                <td className={tableCellClass}>{formatQuantityWithUnit(line.required, line.unit)}</td><td className={tableCellClass}>{formatQuantityWithUnit(available, line.unit)}</td>
                <td className={`${tableCellClass} font-bold ${variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{formatQuantityVariance(variance, line.unit)}</td>
                <td className="ipc-badge-cell"><StatusBadge variant={line.tone} className="ipc-table-badge ipc-table-badge--status">{line.status}</StatusBadge></td><td className={`${tableCellClass} text-left`}>{line.nextAction}</td>
              </tr>
            })}
            {presentation.materialRows.map(([name, data]) => <tr key={name} className="table-row">
              <td className={`${tableCellClass} text-left font-bold`}>{name}</td><td className={tableCellClass}>{data.unit}</td><td className={tableCellClass}>{data.theory.toFixed(2)}</td>
              <td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>{data.actual.toFixed(2)}</td><td className={`${tableCellClass} text-left font-medium text-slate-800`} title={data.dishNames.join(', ')}>{formatMaterialDishSource(data.dishNames)}</td>
              <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td><td className={`${tableCellClass} font-bold`}>{formatCurrency(data.actual * data.referencePrice)}</td>
            </tr>)}
            {presentation.totalItems === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={7}>Chưa có nguyên liệu tổng hợp. Kiểm tra menu tuần và BOM catalog.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
      <PaginationBar className="mt-3" page={presentation.pageIndex + 1} pageSize={PURCHASE_SUMMARY_PAGE_SIZE} totalItems={presentation.totalItems} onPageChange={actions.setPage} />
    </SectionPanel>
  )
}

export default PurchaseSummarySection
