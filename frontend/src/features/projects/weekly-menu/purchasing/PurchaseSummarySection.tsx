import { AlertCircle, Check, Clock, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, Num, PaginationBar, SearchField, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary'
import { formatDateOnly, formatQuantityWithUnit } from '@/lib/formatters'
import { formatMaterialDishSource, formatQuantityVariance } from '../model/formatters'
import { PURCHASE_SUMMARY_PAGE_SIZE } from './purchaseSummaryModel'
import type { PurchaseSummaryWorkflow } from './usePurchaseSummary'

const formatStatusLabel = (status: string, tone: string) => {
  if (tone === 'success') return 'Đủ hàng'
  if (status === 'Còn thiếu nguyên liệu') return 'Thiếu hàng'
  if (status === 'Chờ bếp xác nhận') return 'Chờ nhận'
  if (status === 'Cần tính lại nhu cầu') return 'Cần tính lại'
  return status
}

const renderStatusIcon = (tone: string) => {
  if (tone === 'danger') return <AlertCircle size={12} className="inline mr-1 shrink-0" aria-hidden="true" />
  if (tone === 'success') return <Check size={12} className="inline mr-1 shrink-0" aria-hidden="true" />
  if (tone === 'warning') return <Clock size={12} className="inline mr-1 shrink-0" aria-hidden="true" />
  return null
}

const PurchaseSummarySection = ({ workflow }: { workflow: PurchaseSummaryWorkflow }) => {
  const { actions, presentation, queryView, state } = workflow
  const isPaginationPending = queryView?.phase === 'loading' || Boolean(queryView?.phase === 'ready' && queryView.isRefreshing)
  return (
    <SectionPanel
      title="Bàn giao nguyên liệu"
      headingLevel={2}
      icon={<ShoppingCart size={18} />}
      description="Theo dõi lượng đã xuất, chờ Bếp nhận và đã nhận theo ngày."
      actions={
        <SearchField
          id="weekly-purchase-search"
          label="Tìm nguyên liệu trong tuần của khách hàng đang chọn"
          hideLabel
          width="standard"
          className="w-64 sm:w-72"
          value={state.search}
          disabled={Boolean(queryView && queryView.phase !== 'ready')}
          onChange={(event) => actions.setSearch(event.target.value)}
          placeholder="Tìm tên hoặc mã nguyên liệu..."
          inputClassName="h-8 min-h-8 bg-slate-50 text-xs focus:bg-white"
        />
      }
    >
      <QueryViewBoundary
        geometry="table"
        skeletonColumns={presentation.usesDemand ? 5 : 7}
        queries={queryView ? [{ label: 'tổng hợp mua của tuần', view: queryView }] : []}
        refreshLabel="Đang cập nhật tổng hợp tuần"
      >
      <div className="mb-3">
        <ContextStrip items={[
          { label: 'Khách hàng', value: presentation.customerLabel, tone: 'neutral' },
          { label: 'Tuần', value: presentation.weekLabel, tone: 'neutral' },
          { label: presentation.usesDemand ? 'Dòng ngày - nguyên liệu' : 'Nguyên liệu tổng tuần', value: (presentation.usesDemand ? presentation.totalItems : presentation.materialCount).toString(), tone: 'neutral' },
          { label: 'Dòng chưa xuất', value: presentation.usesDemand ? `${presentation.shortageCount} dòng` : 'BOM dự kiến', tone: presentation.shortageCount > 0 ? 'danger' : 'neutral' },
          { label: 'Dòng chờ Bếp nhận', value: presentation.usesDemand ? `${presentation.pendingKitchenCount} dòng` : '—', tone: presentation.pendingKitchenCount > 0 ? 'warning' : 'neutral' },
          { label: 'Giá trị BOM dự kiến', value: <Num value={presentation.totalCost} type="currency" />, tone: 'info' },
        ]} />
      </div>
      <TableViewport
        caption={presentation.usesDemand
          ? 'Mỗi dòng thuộc một ngày, khách hàng, đơn giá, nguyên liệu và đơn vị trong tuần đang chọn'
          : 'Mỗi dòng là tổng BOM dự kiến của cả tuần theo nguyên liệu và đơn vị; chưa phải kết quả kiểm tồn theo ngày'}
        size={presentation.totalItems > 0 ? 'weekly' : 'default'}
        className="ipc-cost-table-shell"
        ariaLabel={presentation.usesDemand ? 'Bảng nhu cầu và bàn giao theo từng ngày trong tuần' : 'Bảng BOM dự kiến tổng cả tuần'}
      >
        <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
          <thead>{presentation.usesDemand ? <tr>
            <th scope="col" style={{ width: '12%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Ngày</th>
            <th scope="col" style={{ width: '32%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Nguyên liệu / nguồn</th>
            <th scope="col" style={{ width: '16%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Cần</th>
            <th scope="col" style={{ width: '24%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Bàn giao</th>
            <th scope="col" style={{ width: '16%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Trạng thái</th>
          </tr> : <tr>
            <th scope="col" style={{ width: '20%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Nguyên liệu</th>
            <th scope="col" style={{ width: '8%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">ĐV</th>
            <th scope="col" style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">LT cả tuần</th>
            <th scope="col" style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">TT cả tuần</th>
            <th scope="col" style={{ width: '30%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Món trong kế hoạch</th>
            <th scope="col" style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Đơn giá</th>
            <th scope="col" style={{ width: '12%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Thành tiền</th>
          </tr>}</thead>
          <tbody>
            {presentation.demandRows.map((line, index) => {
              const available = line.issuedQty ?? line.available - line.reserved
              const variance = available - line.required
              return <tr key={`${line.id}-${presentation.pageIndex}-${index}`}>
                <td className="text-center whitespace-nowrap text-slate-600">{line.serviceDate ? formatDateOnly(line.serviceDate) : 'Chưa xác định'}</td>
                <td className="text-left"><span className="block font-medium text-slate-900">{line.material}</span><span className="block text-xs text-slate-500">{line.source}</span></td>
                <td data-cell-role="numeric" className="text-right tabular-nums">{formatQuantityWithUnit(line.required, line.unit)}</td>
                <td data-cell-role="numeric" className={cn('text-right text-xs tabular-nums', variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700')}><span className="block">Đã xuất: {formatQuantityWithUnit(available, line.unit)}</span><span className="block font-semibold">Chưa xuất: {line.projection === 'physical-handoff' ? formatQuantityWithUnit(line.remainingToIssueQty ?? 0, line.unit) : formatQuantityVariance(variance, line.unit)}</span></td>
                <td className="text-center whitespace-nowrap px-1">
                  <StatusBadge variant={line.tone} size="sm">
                    {renderStatusIcon(line.tone)}
                    <span>{line.projection === 'physical-handoff' ? (line.status === 'Chờ bếp xác nhận' ? 'Chờ nhận' : line.status) : formatStatusLabel(line.status, line.tone)}</span>
                  </StatusBadge>
                </td>
              </tr>
            })}
            {presentation.materialRows.map(([identityKey, data]) => <tr key={identityKey}>
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
            </tr>)}
            {presentation.totalItems === 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-slate-500" colSpan={presentation.usesDemand ? 5 : 7}>
                  {state.search.trim().length > 0 ? (
                    <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
                      <span>Không tìm thấy nguyên liệu nào phù hợp với từ khóa &ldquo;{state.search}&rdquo;.</span>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={() => actions.setSearch('')}
                        className="h-auto p-0 font-medium text-primary underline focus-visible:outline-2 focus-visible:outline-primary rounded"
                      >
                        Xóa tìm kiếm
                      </Button>
                    </span>
                  ) : presentation.usesDemand ? (
                    'Chưa có dòng nhu cầu đã phát sinh trong tuần này. Giá trị BOM dự kiến không phải lượng đã bàn giao.'
                  ) : (
                    'Chưa có nguyên liệu tổng hợp. Kiểm tra thực đơn tuần và định lượng món ăn.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableViewport>
      <PaginationBar className="mt-3" page={presentation.pageIndex + 1} pageSize={PURCHASE_SUMMARY_PAGE_SIZE} totalItems={presentation.totalItems} isPending={isPaginationPending} preserveFocusWhilePending onPageChange={actions.setPage} />
      </QueryViewBoundary>
    </SectionPanel>
  )
}

export default PurchaseSummarySection
