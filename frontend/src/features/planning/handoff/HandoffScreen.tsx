import { Fragment, useState } from 'react'
import type { WeeklyMenuScope } from '@/features/projects/weekly-menu/schedule/types'
import type { MaterialSummary } from '@/features/projects/weekly-menu/model/types'
import { usePurchaseSummary } from '@/features/projects/weekly-menu/purchasing/usePurchaseSummary'
import { QueryViewBoundary, type QueryViewEntry } from '@/components/common/QueryViewBoundary'
import { PaginationBar, SearchField, EmptyState, ContextStrip, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatDateOnly, formatQuantity, formatUnit } from '@/lib/formatters'
import { downloadPlanningCsv } from '../downloadPlanningCsv'

export function HandoffScreen({ scope, customerCode, materialSummary }: { scope: WeeklyMenuScope; customerCode: string; materialSummary: MaterialSummary; bomQueries: QueryViewEntry[]; bomBlocked: boolean }) {
  const { queryView, state, actions, presentation: p } = usePurchaseSummary({ scopeKey: `${scope.customerId}:${scope.weekStartDate}:${scope.menuPrice}`, customerId: scope.customerId, customerCode, customerLabel: scope.customerLabel, weekStartDate: scope.weekStartDate, weekLabel: scope.weekLabel, materialSummary, demandLines: [], aggregatedDemandLines: [] })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [exported, setExported] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<{ search: string; page: number; totalItems: number } | null>(null)
  const deniedOrError = queryView?.phase === 'forbidden' || queryView?.phase === 'error'
  if (deniedOrError && pendingNavigation !== null) setPendingNavigation(null)
  const isPending = queryView?.phase === 'loading' || (queryView?.phase === 'ready' && queryView.isRefreshing)
  const pendingPage = isPending && pendingNavigation?.search === state.search.trim() ? pendingNavigation : null
  const pager = queryView?.phase === 'ready' ? { page: p.pageIndex + 1, totalItems: p.totalItems } : pendingPage
  function setPage(page: number) {
    if (isPending || queryView?.phase !== 'ready') return
    setExpanded(null); setExported(false)
    setPendingNavigation({ search: state.search.trim(), page, totalItems: p.totalItems })
    actions.setPage(page)
  }
  const q = (value: number | undefined) => value === undefined ? '—' : formatQuantity(value, { maximumFractionDigits: 6 })
  const canExport = queryView?.phase === 'ready' && !isPending && p.demandRows.length > 0
  function exportPage() {
    if (!canExport) return
    downloadPlanningCsv(`Ban_giao_${scope.weekStartDate}_trang_${p.pageIndex + 1}.csv`, [
      ['Ngày', 'Khách hàng', 'Định mức', 'Nguyên liệu', 'Đơn vị', 'Nhu cầu', 'Đã xuất', 'Còn xuất', 'Bếp đã nhận', 'Chờ Bếp nhận', 'Nguồn'],
      ...p.demandRows.map(line => [line.serviceDate ?? '', scope.customerLabel, line.priceTierAmount ?? 'Chưa xác định', line.material, line.unit, line.required, line.issuedQty ?? '', line.remainingToIssueQty ?? '', line.receivedByKitchenQty ?? '', line.pendingKitchenReceiptQty ?? '', line.source]),
    ])
    setExported(true)
  }
  return <section aria-label="Bàn giao vật lý tuần" className="planning-ledger">
    <div className="planning-ledger-heading"><SearchField id="handoff-search" label="Tìm nguyên liệu trên toàn bộ tuần" value={state.search} onChange={event => { setExpanded(null); setExported(false); setPendingNavigation(null); actions.setSearch(event.target.value) }} placeholder="Tên hoặc mã nguyên liệu" /><Button type="button" variant="outline" size="sm" disabled={!canExport} onClick={exportPage}>CSV bàn giao trang hiện tại</Button></div>
    <p className="planning-help">Báo cáo vật lý theo ngày, không phải tổng BOM. CSV chỉ chứa trang đang xem, không phải toàn tuần.{exported && <span role="status"> Đã tải CSV trang hiện tại.</span>}</p>
    <QueryViewBoundary queries={queryView ? [{ label: 'bàn giao tuần', view: queryView }] : []}>
      <ContextStrip variant="inline" items={[{ label: 'Dòng theo ngày', value: p.totalItems }, { label: 'Dòng chưa xuất', value: p.shortageCount }, { label: 'Dòng chờ Bếp nhận', value: p.pendingKitchenCount }]} />
      {p.demandRows.length === 0 ? <EmptyState title={state.search ? 'Không có kết quả phù hợp' : 'Chưa có dòng bàn giao vật lý trong tuần'} description="BOM dự kiến không thay thế kết quả vật lý rỗng." /> : <TableViewport ariaLabel="Bàn giao vật lý theo ngày" appearance="quiet-operational" density="compact"><table className="ipc-data-table"><caption className="sr-only">Ngày · khách hàng · định mức · nguyên liệu · đơn vị. Hai bộ đếm có thể giao nhau; chưa xuất không đồng nghĩa quyền mua.</caption><thead><tr><th scope="col">Nguyên liệu / ngày</th><th scope="col">Đơn vị</th><th scope="col" data-cell-role="numeric">Đã xuất</th><th scope="col" data-cell-role="numeric">Còn xuất</th><th scope="col" data-cell-role="numeric">Bếp đã nhận</th><th scope="col" data-cell-role="numeric">Chờ Bếp nhận</th><th scope="col">Trạng thái</th></tr></thead><tbody>{p.demandRows.map(line => <Fragment key={line.id}><tr data-selected={expanded === line.id || undefined}><th scope="row"><button type="button" className="planning-row-trigger" aria-expanded={expanded === line.id} aria-controls={`handoff-${line.id}`} onClick={() => setExpanded(expanded === line.id ? null : line.id)}>{line.material}</button><small>{line.serviceDate ? formatDateOnly(line.serviceDate) : 'Chưa xác định ngày'}</small></th><td>{formatUnit(line.unit)}</td><td data-cell-role="numeric">{q(line.issuedQty)}</td><td data-cell-role="numeric">{q(line.remainingToIssueQty)}</td><td data-cell-role="numeric">{q(line.receivedByKitchenQty)}</td><td data-cell-role="numeric">{q(line.pendingKitchenReceiptQty)}</td><td>{line.status}</td></tr>
        {expanded === line.id && <tr id={`handoff-${line.id}`} className="planning-row-detail" onKeyDown={event => { if (event.key === 'Escape') { setExpanded(null); event.currentTarget.previousElementSibling?.querySelector('button')?.focus() } }}><td colSpan={7}><h3>Nguồn bàn giao · {line.material}</h3><p>{line.source}</p><p>Nhu cầu: {q(line.required)} {formatUnit(line.unit)} · {line.nextAction}</p><p>Báo cáo tổng hợp không trả mã phiếu xuất/nhận theo từng dòng; không suy chứng từ từ số lượng.</p><Button type="button" variant="ghost" size="sm" onClick={event => { const trigger = event.currentTarget.closest('tr')?.previousElementSibling?.querySelector('button'); setExpanded(null); trigger?.focus() }}>Đóng chi tiết</Button></td></tr>}
      </Fragment>)}</tbody></table></TableViewport>}
    </QueryViewBoundary>
    {pager && !deniedOrError && <><span role="status" className="sr-only">{isPending ? `Đang tải trang ${pager.page}; chưa có kết quả cho trang yêu cầu.` : `Trang ${pager.page} đã tải.`}</span><PaginationBar page={pager.page} pageSize={10} totalItems={pager.totalItems} isPending={isPending} preserveFocusWhilePending onPageChange={setPage} /></>}
  </section>
}
