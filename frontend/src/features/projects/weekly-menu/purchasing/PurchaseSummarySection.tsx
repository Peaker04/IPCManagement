import { CheckCircle2, Search, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, InlineAlert, PaginationBar, QueryErrorAlert, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { formatCurrency, formatQuantityWithUnit } from '@/lib/formatters'
import { formatMaterialDishSource, formatQuantityVariance } from '../model/formatters'
import { PURCHASE_SUMMARY_PAGE_SIZE } from './purchaseSummaryModel'
import type { PurchaseSummaryWorkflow } from './usePurchaseSummary'
import { Input } from '@/components/ui/input'

const tableHeadClass = 'text-center'
const tableCellClass = 'text-center'

const PurchaseSummarySection = ({ workflow }: { workflow: PurchaseSummaryWorkflow }) => {
  const { actions, presentation, state, status } = workflow
  return (
    <SectionPanel
      title="Tổng hợp nhu cầu mua"
      headingLevel={2}
      icon={<ShoppingCart size={18} color="var(--ipc-slate-600)" />}
    >
      <div className="mb-3">
        <ContextStrip items={[
          { label: 'Khách hàng', value: presentation.customerLabel, tone: 'neutral' },
          { label: 'Tuần', value: presentation.weekLabel, tone: 'neutral' },
          { label: presentation.usesDemand ? 'Dòng ngày - nguyên liệu' : 'Nguyên liệu tổng tuần', value: (presentation.usesDemand ? presentation.totalItems : presentation.materialCount).toString(), tone: 'neutral' },
          { label: 'Cần xử lý', value: presentation.usesDemand ? `${presentation.shortageCount} thiếu` : 'Chưa kiểm tồn', tone: presentation.shortageCount > 0 ? 'danger' : 'neutral' },
          { label: 'Giá trị định lượng', value: formatCurrency(presentation.totalCost), tone: 'info' },
        ]} />
      </div>
      <label htmlFor="weekly-purchase-search" className="mb-3 grid max-w-xl gap-1 text-xs font-semibold text-slate-700">
        Tìm nguyên liệu trong tuần của khách hàng đang chọn
        <span className="relative block">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input id="weekly-purchase-search" type="search" value={state.search} onChange={(event) => actions.setSearch(event.target.value)} placeholder="Tên hoặc mã nguyên liệu" className="h-9 pl-9" />
        </span>
      </label>
      {status.isError && (
        <QueryErrorAlert title="Không tải được tổng hợp mua của tuần" onRetry={actions.retry} isRetrying={status.isFetching} className="mb-3">
          Thử tải lại để tiếp tục đối chiếu dữ liệu mua của tuần.
        </QueryErrorAlert>
      )}
      {status.isLoading && <InlineAlert title="Đang tải tổng hợp mua của tuần" variant="info" className="mb-3">Đang đối chiếu từng ngày, khách hàng và đơn giá trước khi hiển thị.</InlineAlert>}
      {status.isFetching && !status.isLoading && <InlineAlert title="Đang cập nhật tổng hợp tuần" variant="info" className="mb-3">Giữ nguyên trang hiện tại cho tới khi dữ liệu mới tải xong.</InlineAlert>}
      {!status.isLoading && !status.isError && !presentation.usesDemand && <InlineAlert title="Chưa có số thiếu/đủ sau kiểm tồn" variant="warning" className="mb-3">Bảng dưới đây mới là định lượng nguyên liệu theo món. Bấm Tạo nhu cầu từ KHSX ở tab KHSX và nhu cầu để hệ thống kiểm tồn kho và trả ra Cần, Tồn khả dụng, Thiếu/Đủ.</InlineAlert>}
      {!status.isLoading && !status.isError && <>
      <TableViewport
        caption={presentation.usesDemand
          ? 'Mỗi dòng thuộc một ngày, khách hàng, đơn giá, nguyên liệu và đơn vị trong tuần đang chọn'
          : 'Mỗi dòng là tổng BOM dự kiến của cả tuần theo nguyên liệu và đơn vị; chưa phải kết quả kiểm tồn theo ngày'}
        size="weekly"
        className="ipc-cost-table-shell"
        ariaLabel={presentation.usesDemand ? 'Bảng đề xuất mua theo từng ngày trong tuần' : 'Bảng BOM dự kiến tổng cả tuần'}
      >
        <table className={cn('ipc-data-table ipc-cost-table table-fixed w-full', presentation.usesDemand && 'ipc-status-action-table')}>
          <thead>{presentation.usesDemand ? <tr>
            <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Ngày</th>
            <th style={{ width: '14%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguyên liệu</th>
            <th style={{ width: '20%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món ăn</th>
            <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Cần</th>
            <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Tồn khả dụng</th>
            <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Chênh lệch</th>
            <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Trạng thái</th>
            <th style={{ width: '11%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-center whitespace-nowrap`}>Tiếp theo</th>
          </tr> : <tr>
            <th style={{ width: '20%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Nguyên liệu</th>
            <th style={{ width: '8%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>ĐV</th>
            <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>LT cả tuần</th>
            <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>TT cả tuần</th>
            <th style={{ width: '30%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 text-left whitespace-nowrap`}>Món trong kế hoạch</th>
            <th style={{ width: '10%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Đơn giá</th>
            <th style={{ width: '12%' }} className={`${tableHeadClass} sticky top-0 z-10 bg-slate-100 whitespace-nowrap`}>Thành tiền</th>
          </tr>}</thead>
          <tbody>
            {presentation.demandRows.map((line, index) => {
              const available = line.available - line.reserved
              const variance = available - line.required
              return <tr key={`${line.id}-${presentation.pageIndex}-${index}`} className="table-row">
                <td className={`${tableCellClass} whitespace-nowrap`}>{line.serviceDate ? new Date(`${line.serviceDate}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa xác định'}</td>
                <td className={`${tableCellClass} text-left font-bold`}>{line.material}</td><td className={`${tableCellClass} text-left font-medium text-slate-800`}>{line.source}</td>
                <td className={tableCellClass}>{formatQuantityWithUnit(line.required, line.unit)}</td><td className={tableCellClass}>{formatQuantityWithUnit(available, line.unit)}</td>
                <td className={`${tableCellClass} font-bold ${variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{formatQuantityVariance(variance, line.unit)}</td>
                <td className="ipc-badge-cell">{line.tone === 'success'
                  ? <span className="ipc-inline-status"><CheckCircle2 size={15} aria-hidden="true" />Đủ</span>
                  : <StatusBadge variant={line.tone} className="ipc-table-badge ipc-table-badge--status">{line.status}</StatusBadge>}
                </td><td className={`${tableCellClass} text-left ${line.tone === 'success' ? 'text-slate-600' : 'font-semibold text-slate-800'}`}>{line.nextAction}</td>
              </tr>
            })}
            {presentation.materialRows.map(([identityKey, data]) => <tr key={identityKey} className="table-row">
              <td className={`${tableCellClass} text-left font-bold`}>{data.ingredientName}</td><td className={tableCellClass}>{data.unit}</td><td className={tableCellClass}>{data.theory.toFixed(2)}</td>
              <td className={`${tableCellClass} font-bold text-[var(--ipc-primary-600)]`}>{data.actual.toFixed(2)}</td><td className={`${tableCellClass} text-left font-medium text-slate-800`} title={data.dishNames.join(', ')}>{formatMaterialDishSource(data.dishNames)}</td>
              <td className={tableCellClass}>{formatCurrency(data.referencePrice)}</td><td className={`${tableCellClass} font-bold`}>{formatCurrency(data.actual * data.referencePrice)}</td>
            </tr>)}
            {presentation.totalItems === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={presentation.usesDemand ? 8 : 7}>Chưa có nguyên liệu tổng hợp. Kiểm tra thực đơn tuần và định lượng món ăn.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
      <PaginationBar className="mt-3" page={presentation.pageIndex + 1} pageSize={PURCHASE_SUMMARY_PAGE_SIZE} totalItems={presentation.totalItems} onPageChange={actions.setPage} />
      </>}
    </SectionPanel>
  )
}

export default PurchaseSummarySection
