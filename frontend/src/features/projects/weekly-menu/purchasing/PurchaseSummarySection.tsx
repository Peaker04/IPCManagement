import { AlertCircle, ArrowRight, Check, Clock, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, PaginationBar, SearchField, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary'
import { formatCurrency, formatDateOnly, formatQuantity, formatQuantityWithUnit } from '@/lib/formatters'
import { formatMaterialDishSource, formatQuantityVariance } from '../model/formatters'
import { PURCHASE_SUMMARY_PAGE_SIZE } from './purchaseSummaryModel'
import type { PurchaseSummaryWorkflow } from './usePurchaseSummary'
import { Link } from 'react-router-dom'

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
  return (
    <SectionPanel
      title="Bàn giao nguyên liệu"
      headingLevel={2}
      icon={<ShoppingCart size={18} color="var(--ipc-slate-600)" />}
      description="Theo dõi lượng đã xuất, chờ Bếp nhận và đã nhận theo ngày."
      actions={
        <SearchField
          id="weekly-purchase-search"
          label="Tìm nguyên liệu trong tuần của khách hàng đang chọn"
          hideLabel
          width="compact"
          value={state.search}
          disabled={Boolean(queryView && queryView.phase !== 'ready')}
          onChange={(event) => actions.setSearch(event.target.value)}
          placeholder="Tìm tên hoặc mã nguyên liệu..."
          inputClassName="bg-slate-50 text-xs focus:bg-white"
        />
      }
    >
      <QueryViewBoundary
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
          { label: 'Giá trị định lượng', value: formatCurrency(presentation.totalCost), tone: 'info' },
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
            <th style={{ width: '10%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Ngày</th>
            <th style={{ width: '15%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Nguyên liệu</th>
            <th style={{ width: '21%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Nguồn</th>
            <th style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Cần</th>
            <th style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Đã xuất</th>
            <th style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Chưa xuất</th>
            <th style={{ width: '12%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Trạng thái</th>
            <th style={{ width: '12%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Tiếp theo</th>
          </tr> : <tr>
            <th style={{ width: '20%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Nguyên liệu</th>
            <th style={{ width: '8%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">ĐV</th>
            <th style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">LT cả tuần</th>
            <th style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">TT cả tuần</th>
            <th style={{ width: '30%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Món trong kế hoạch</th>
            <th style={{ width: '10%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Đơn giá</th>
            <th style={{ width: '12%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Thành tiền</th>
          </tr>}</thead>
          <tbody>
            {presentation.demandRows.map((line, index) => {
              const available = line.issuedQty ?? line.available - line.reserved
              const variance = available - line.required
              return <tr key={`${line.id}-${presentation.pageIndex}-${index}`}>
                <td className="text-center whitespace-nowrap text-slate-600">{line.serviceDate ? formatDateOnly(line.serviceDate) : 'Chưa xác định'}</td>
                <td className="text-left font-medium text-slate-900">{line.material}</td>
                <td className="text-left text-slate-700">{line.source}</td>
                <td className="text-right tabular-nums">{formatQuantityWithUnit(line.required, line.unit)}</td>
                <td className="text-right tabular-nums">{formatQuantityWithUnit(available, line.unit)}</td>
                <td className={cn('text-right tabular-nums font-semibold', variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700')}>{line.projection === 'physical-handoff' ? formatQuantityWithUnit(line.remainingToIssueQty ?? 0, line.unit) : formatQuantityVariance(variance, line.unit)}</td>
                <td className="text-center whitespace-nowrap px-1">
                  <StatusBadge variant={line.tone} size="sm">
                    {renderStatusIcon(line.tone)}
                    <span>{line.projection === 'physical-handoff' ? (line.status === 'Chờ bếp xác nhận' ? 'Chờ nhận' : line.status) : formatStatusLabel(line.status, line.tone)}</span>
                  </StatusBadge>
                </td>
                <td className="text-center whitespace-nowrap px-1">
                  {line.actionHref ? (
                    <Link
                      className="inline-flex items-center justify-center gap-1 text-xs font-medium text-slate-700 hover:text-blue-700 hover:underline transition-colors focus-visible:ring-1 focus-visible:ring-blue-500 rounded px-1.5 py-0.5"
                      to={line.actionHref}
                    >
                      <span>{line.nextAction}</span>
                      <ArrowRight size={12} className="text-slate-400 shrink-0" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">{line.nextAction}</span>
                  )}
                </td>
              </tr>
            })}
            {presentation.materialRows.map(([identityKey, data]) => <tr key={identityKey}>
              <td className="text-left font-medium text-slate-900">{data.ingredientName}</td>
              <td className="text-center text-slate-600">{data.unit}</td>
              <td className="text-right tabular-nums">{formatQuantity(data.theory, { maximumFractionDigits: 2 })}</td>
              <td className="text-right tabular-nums font-semibold text-blue-700">{formatQuantity(data.actual, { maximumFractionDigits: 2 })}</td>
              <td className="text-left text-slate-700" title={data.dishNames.join(', ')}>{formatMaterialDishSource(data.dishNames)}</td>
              <td className="text-right tabular-nums">{formatCurrency(data.referencePrice)}</td>
              <td className="text-right tabular-nums font-semibold text-slate-900">{formatCurrency(data.actual * data.referencePrice)}</td>
            </tr>)}
            {presentation.totalItems === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={presentation.usesDemand ? 8 : 7}>Chưa có nguyên liệu tổng hợp. Kiểm tra thực đơn tuần và định lượng món ăn.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
      <PaginationBar className="mt-3" page={presentation.pageIndex + 1} pageSize={PURCHASE_SUMMARY_PAGE_SIZE} totalItems={presentation.totalItems} onPageChange={actions.setPage} />
      </QueryViewBoundary>
    </SectionPanel>
  )
}

export default PurchaseSummarySection
