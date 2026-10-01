import { useState } from 'react'
import type { WeeklyMenuScope } from '@/features/projects/weekly-menu/schedule/types'
import type { MaterialSummary } from '@/features/projects/weekly-menu/model/types'
import { usePurchaseSummary } from '@/features/projects/weekly-menu/purchasing/usePurchaseSummary'
import { buildWarehouseCsv } from '@/features/projects/weekly-menu/purchasing/purchaseSummaryModel'
import { QueryViewBoundary, type QueryViewEntry } from '@/components/common/QueryViewBoundary'
import { PaginationBar, SearchField, EmptyState, InlineAlert } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatDateOnly, formatQuantity, formatCurrency } from '@/lib/formatters'
export function HandoffScreen({ scope, customerCode, materialSummary, bomQueries, bomBlocked }: { scope: WeeklyMenuScope; customerCode: string; materialSummary: MaterialSummary; bomQueries: QueryViewEntry[]; bomBlocked: boolean }) {
  const { queryView, state, actions, presentation: p } = usePurchaseSummary({ scopeKey: `${scope.customerId}:${scope.weekStartDate}:${scope.menuPrice}`, customerId: scope.customerId, customerCode, customerLabel: scope.customerLabel, weekStartDate: scope.weekStartDate, weekLabel: scope.weekLabel, materialSummary, demandLines: [], aggregatedDemandLines: [] })
  const [exported, setExported] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<{ search: string; page: number; totalItems: number } | null>(null)
  const deniedOrError = queryView?.phase === 'forbidden' || queryView?.phase === 'error'
  if (deniedOrError && pendingNavigation !== null) setPendingNavigation(null)
  const isPending = queryView?.phase === 'loading' || (queryView?.phase === 'ready' && queryView.isRefreshing)
  // Only navigation metadata survives an uncached page read; rows and result counters never do.
  const pendingPage = isPending && pendingNavigation?.search === state.search.trim() ? pendingNavigation : null
  const pager = queryView?.phase === 'ready'
    ? { page: p.pageIndex + 1, totalItems: p.totalItems }
    : pendingPage
  function setPage(page: number) {
    if (isPending || queryView?.phase !== 'ready') return
    setPendingNavigation({ search: state.search.trim(), page, totalItems: p.totalItems })
    actions.setPage(page)
  }
  const canExport = !bomBlocked && bomQueries.every(query=>query.view.phase === 'ready') && Boolean(customerCode && scope.weekStartDate && Object.keys(materialSummary).length)
  function exportBom() {
    if (!canExport) return
    const csv = buildWarehouseCsv(materialSummary, customerCode, scope.weekStartDate)
    if (!csv) return
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}))
    const link = document.createElement('a')
    link.href = url; link.download = `BOM_du_kien_${customerCode}_${scope.weekStartDate}.csv`
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setExported(true)
  }
  return <section aria-label="Bàn giao vật lý tuần"><div className="flex flex-wrap items-end justify-between gap-3"><SearchField id="handoff-search" label="Tìm nguyên liệu trên toàn bộ tuần" value={state.search} onChange={event=>{ setPendingNavigation(null); actions.setSearch(event.target.value) }} placeholder="Tên hoặc mã nguyên liệu"/><Button type="button" variant="outline" disabled={!canExport} onClick={exportBom}>Xuất BOM dự kiến</Button></div>
    <p className="my-3 text-xs text-slate-500">CSV: tổng BOM dự kiến cả tuần từ thực đơn đã lưu, số suất và BOM hiệu lực theo khách hàng/định mức; LT/TT trong tệp đều là lượng dự kiến của model, không phải tiêu hao hoặc bàn giao vật lý. Không xuất trang báo cáo vật lý.</p>
    {!canExport && <details><summary>Vì sao chưa xuất được BOM dự kiến?</summary><QueryViewBoundary queries={bomQueries}><InlineAlert title="Chưa đủ nguồn BOM để xuất" variant="warning">{bomBlocked ? 'Định mức tuần không hợp lệ hoặc không đồng nhất.' : !customerCode ? 'Chưa xác định mã khách hàng thật.' : 'Chưa có nguyên liệu BOM dự kiến trong nguồn tuần.'}</InlineAlert></QueryViewBoundary></details>}
    {exported && <p role="status">Đã tải CSV BOM dự kiến, không tạo chứng từ bàn giao.</p>}
    <QueryViewBoundary queries={queryView ? [{label:'bàn giao tuần',view:queryView}] : []}>
      <div className="planning-read-summary"><span>Dòng theo ngày: <strong>{p.totalItems}</strong></span><span>Dòng chưa xuất: <strong>{p.shortageCount}</strong></span><span>Dòng chờ Bếp nhận: <strong>{p.pendingKitchenCount}</strong></span><span>Định mức BOM: <strong>{formatCurrency(scope.menuPrice)}</strong></span></div>
      <p className="mb-3 text-xs text-slate-500">Mỗi dòng: ngày · khách hàng · tier · nguyên liệu · đơn vị. Hai bộ đếm có thể giao nhau; chưa xuất không đồng nghĩa quyền mua.</p>
      {p.demandRows.length === 0 ? <EmptyState title={state.search ? 'Không có kết quả phù hợp' : 'Chưa có dòng bàn giao vật lý trong tuần'} description="BOM dự kiến không thay thế kết quả vật lý rỗng."/> : <div className="planning-read-table"><table><caption className="sr-only">Bàn giao vật lý theo ngày trong tuần</caption><colgroup>{[30,8,16,16,16,14].map((width,index)=><col key={index} style={{width:`${width}%`}}/>)}</colgroup><thead><tr><th scope="col">Nguyên liệu / ngày / nguồn</th><th scope="col">Đơn vị</th><th scope="col" data-cell-role="numeric">Cần / đã xuất</th><th scope="col" data-cell-role="numeric">Chưa xuất</th><th scope="col" data-cell-role="numeric">Bếp nhận / chờ nhận</th><th scope="col">Trạng thái / owner</th></tr></thead><tbody>{p.demandRows.map(line=><tr key={line.id}><td>{line.material}<small className="block text-slate-500">{line.serviceDate ? formatDateOnly(line.serviceDate) : 'Chưa xác định ngày'} · {line.source}</small></td><td>{line.unit}</td><td data-cell-role="numeric">{formatQuantity(line.required,{maximumFractionDigits:6})}<small className="block">Đã xuất: {formatQuantity(line.issuedQty ?? 0,{maximumFractionDigits:6})}</small></td><td data-cell-role="numeric">{formatQuantity(line.remainingToIssueQty ?? 0,{maximumFractionDigits:6})}</td><td data-cell-role="numeric">{formatQuantity(line.receivedByKitchenQty ?? 0,{maximumFractionDigits:6})}<small className="block">Chờ: {formatQuantity(line.pendingKitchenReceiptQty ?? 0,{maximumFractionDigits:6})}</small></td><td><span>{line.status}</span><small className="block text-slate-500">{line.nextAction}</small></td></tr>)}</tbody></table></div>}
    </QueryViewBoundary>
    {pager && !deniedOrError && <><span role="status" className="sr-only">{isPending ? `Đang tải trang ${pager.page}; chưa có kết quả cho trang yêu cầu.` : `Trang ${pager.page} đã tải.`}</span><PaginationBar page={pager.page} pageSize={10} totalItems={pager.totalItems} isPending={isPending} preserveFocusWhilePending onPageChange={setPage}/></>}
  </section>
}
