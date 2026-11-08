import { ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContextStrip, PaginationBar, SearchField, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary'
import { formatCurrency, formatDateOnly, formatQuantity, formatQuantityWithUnit } from '@/lib/formatters'
import { formatMaterialDishSource, formatQuantityVariance } from '../model/formatters'
import { PURCHASE_SUMMARY_PAGE_SIZE } from './purchaseSummaryModel'
import type { PurchaseSummaryWorkflow } from './usePurchaseSummary'
import { Link } from 'react-router-dom'

const PurchaseSummarySection = ({ workflow }: { workflow: PurchaseSummaryWorkflow }) => {
  const { actions, presentation, queryView, state } = workflow
  return (
    <SectionPanel
      title="Tổng hợp nhu cầu mua"
      headingLevel={2}
      icon={<ShoppingCart size={18} color="var(--ipc-slate-600)" />}
      description="Tổng hợp nguyên liệu cần thu mua theo toàn bộ tuần phục vụ dựa trên nhu cầu thực tế và tồn kho."
      actions={
        <SearchField
          id="weekly-purchase-search"
          label="Tìm nguyên liệu trong tuần của khách hàng đang chọn"
          hideLabel
          width="compact"
          value={state.search}
          onChange={(event) => actions.setSearch(event.target.value)}
          placeholder="Tìm tên hoặc mã nguyên liệu..."
          inputClassName="bg-slate-50 text-xs focus:bg-white"
        />
      }
    >
      <div className="mb-3">
        <ContextStrip items={[
          { label: 'Khách hàng', value: presentation.customerLabel, tone: 'neutral' },
          { label: 'Tuần', value: presentation.weekLabel, tone: 'neutral' },
          { label: presentation.usesDemand ? 'Dòng ngày - nguyên liệu' : 'Nguyên liệu tổng tuần', value: (presentation.usesDemand ? presentation.totalItems : presentation.materialCount).toString(), tone: 'neutral' },
          { label: 'Dòng chưa xuất', value: presentation.usesDemand ? `${presentation.shortageCount} dòng` : 'Chưa kiểm tồn', tone: presentation.shortageCount > 0 ? 'danger' : 'neutral' },
          { label: 'Dòng chờ Bếp nhận', value: presentation.usesDemand ? `${presentation.pendingKitchenCount} dòng` : '—', tone: presentation.pendingKitchenCount > 0 ? 'warning' : 'neutral' },
          { label: 'Giá trị định lượng', value: formatCurrency(presentation.totalCost), tone: 'info' },
        ]} />
      </div>
      <QueryViewBoundary
        queries={queryView ? [{ label: 'tổng hợp mua của tuần', view: queryView }] : []}
        refreshLabel="Đang cập nhật tổng hợp tuần"
      >
      <TableViewport
        caption={presentation.usesDemand
          ? 'Mỗi dòng thuộc một ngày, khách hàng, đơn giá, nguyên liệu và đơn vị trong tuần đang chọn'
          : 'Mỗi dòng là tổng BOM dự kiến của cả tuần theo nguyên liệu và đơn vị; chưa phải kết quả kiểm tồn theo ngày'}
        size={presentation.totalItems > 0 ? 'weekly' : 'default'}
        className="ipc-cost-table-shell"
        ariaLabel={presentation.usesDemand ? 'Bảng đề xuất mua theo từng ngày trong tuần' : 'Bảng BOM dự kiến tổng cả tuần'}
      >
        <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full">
          <thead>{presentation.usesDemand ? <tr>
            <th style={{ width: '11%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Ngày</th>
            <th style={{ width: '14%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Nguyên liệu</th>
            <th style={{ width: '20%' }} className="sticky top-0 z-10 text-left whitespace-nowrap">Món sử dụng</th>
            <th style={{ width: '11%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Cần</th>
            <th style={{ width: '11%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Tồn khả dụng</th>
            <th style={{ width: '11%' }} className="sticky top-0 z-10 text-right whitespace-nowrap">Chênh lệch</th>
            <th style={{ width: '11%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Trạng thái</th>
            <th style={{ width: '11%' }} className="sticky top-0 z-10 text-center whitespace-nowrap">Tiếp theo</th>
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
              const available = line.available - line.reserved
              const variance = available - line.required
              return <tr key={`${line.id}-${presentation.pageIndex}-${index}`}>
                <td className="text-center whitespace-nowrap text-slate-600">{line.serviceDate ? formatDateOnly(line.serviceDate) : 'Chưa xác định'}</td>
                <td className="text-left font-medium text-slate-900">{line.material}</td>
                <td className="text-left text-slate-700">{line.source}</td>
                <td className="text-right tabular-nums">{formatQuantityWithUnit(line.required, line.unit)}</td>
                <td className="text-right tabular-nums">{formatQuantityWithUnit(available, line.unit)}</td>
                <td className={cn('text-right tabular-nums font-semibold', variance < 0 ? 'text-red-700' : variance > 0 ? 'text-emerald-700' : 'text-slate-700')}>{formatQuantityVariance(variance, line.unit)}</td>
                <td className="text-center">
                  <StatusBadge variant={line.tone} size="sm">
                    {line.tone === 'success' ? 'Đủ hàng' : line.status}
                  </StatusBadge>
                </td>
                <td className="text-center">
                  {line.actionHref
                    ? <Link className="ipc-button ipc-button-primary ipc-button-compact" to={line.actionHref}>{line.nextAction}</Link>
                    : <span className="text-xs text-slate-500">{line.nextAction}</span>}
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
