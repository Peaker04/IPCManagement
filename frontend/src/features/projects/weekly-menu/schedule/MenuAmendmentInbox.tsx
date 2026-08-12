import { useMemo, useState } from 'react'
import { useGetCoordinationCustomersQuery, useExecuteMenuAmendmentDecisionMutation, useGetMenuAmendmentDecisionPageQuery } from '@/api/coordinationApi'
import { EmptyState } from '@/components/common/EmptyState'
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDateOnly, formatDateTime } from '@/lib/formatters'
import { formatShiftName } from '@/lib/workflowConfig'
import { amendmentDecisionStatus, type MenuAmendmentDecisionItem } from './menuAmendmentDecisionTypes'

const PAGE_SIZE = 20

export function MenuAmendmentInbox() {
  const [customerId, setCustomerId] = useState<string | undefined>()
  const [allCustomers, setAllCustomers] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MenuAmendmentDecisionItem>()
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const customersQuery = useGetCoordinationCustomersQuery()
  const decisionQuery = useGetMenuAmendmentDecisionPageQuery({ customerId, allCustomers, page, pageSize: PAGE_SIZE })
  const [executeDecision, { isLoading: isSaving }] = useExecuteMenuAmendmentDecisionMutation()
  const decisionPage = decisionQuery.data?.data
  const items = decisionPage?.items ?? []
  const customerName = useMemo(() => customersQuery.data?.data?.find((customer) => customer.customerId === customerId)?.customerName, [customerId, customersQuery.data])

  const selectScope = (nextCustomerId?: string, nextAllCustomers = false) => {
    setCustomerId(nextCustomerId)
    setAllCustomers(nextAllCustomers)
    setPage(1)
  }

  const complete = async () => {
    if (!selected || !reason.trim()) return
    const action = selected.allowedActions.find((item) => item === 'APPEND_CORRECTION')
    if (!action) return
    try {
      await executeDecision({
        decisionItemId: selected.decisionItemId,
        action,
        commandId: crypto.randomUUID(),
        expectedVersion: selected.version,
        reason: reason.trim(),
      }).unwrap()
      setFeedback('Đã ghi correction append-only và tải lại đúng phạm vi quyết định.')
      setSelected(undefined)
      setReason('')
      await decisionQuery.refetch()
    } catch {
      setFeedback('Quyết định đã thay đổi hoặc bạn không còn quyền. Hệ thống đang giữ trạng thái hiện hành; hãy tải lại trước khi thử lại.')
      await decisionQuery.refetch()
    }
  }

  if (decisionQuery.isError) {
    return <section className="mb-4" aria-label="Cần quyết định"><QueryErrorAlert title="Không tải được hàng đợi Cần quyết định" onRetry={decisionQuery.refetch}>Không thể kết luận hàng đợi đang trống. Hãy tải lại trước khi xử lý điều chỉnh thực đơn.</QueryErrorAlert></section>
  }

  return (
    <section className="mb-4 rounded border border-amber-200 bg-amber-50 p-3" aria-label="Cần quyết định">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-sm font-semibold text-amber-900">Cần quyết định</h2><p className="mt-1 text-sm text-amber-800">Đối soát theo khách hàng, ngày, ca, tier và source-line do máy chủ xác định.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={allCustomers ? 'outline' : 'default'} onClick={() => selectScope(undefined, false)}>Khách hàng đã chọn</Button>
          <Button size="sm" variant={allCustomers ? 'default' : 'outline'} onClick={() => selectScope(undefined, true)}>Tất cả khách hàng</Button>
        </div>
      </div>

      {!allCustomers && customersQuery.data?.data?.length ? <label className="mt-3 block text-sm font-medium text-slate-800">Khách hàng
        <select className="mt-1 block min-h-11 w-full rounded border border-slate-300 bg-white px-2 sm:min-h-9" value={customerId ?? ''} onChange={(event) => selectScope(event.target.value || undefined)}>
          <option value="">Chọn khách hàng để xem hàng đợi</option>
          {customersQuery.data.data.map((customer) => <option key={customer.customerId} value={customer.customerId}>{customer.customerName}</option>)}
        </select>
      </label> : null}
      {(allCustomers || customerName) && <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Bộ lọc đang áp dụng"><span className="rounded bg-white px-2 py-1 text-xs text-slate-700">{allCustomers ? 'Tất cả khách hàng' : customerName}</span>{!allCustomers && <Button size="sm" variant="ghost" onClick={() => selectScope(undefined, false)}>Bỏ lọc</Button>}</div>}
      {feedback && <p role="status" className="mt-3 text-sm text-amber-900">{feedback}</p>}

      {decisionQuery.isLoading ? <div role="status" className="mt-3 min-h-24 animate-pulse rounded border border-amber-100 bg-white p-3 text-sm text-slate-600">Đang tải hàng đợi quyết định...</div>
        : !allCustomers && !customerId ? <EmptyState title="Chọn khách hàng để xem việc cần quyết định" description="Hàng đợi mặc định giữ đúng phạm vi khách hàng đang làm việc." />
          : items.length === 0 ? <EmptyState title={allCustomers ? 'Chưa có quyết định nào trong toàn bộ phạm vi được phép xem' : 'Khách hàng này chưa có quyết định cần xử lý'} description="Thay đổi đã có chứng từ vật lý sẽ xuất hiện ở đây với phạm vi source-line chính xác." />
            : <div className="mt-3 overflow-x-auto rounded border border-amber-100 bg-white"><table className="min-w-[980px] text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-slate-700"><tr><th scope="col" className="sticky left-0 bg-slate-50 px-3 py-2">Khách hàng / phạm vi</th><th scope="col" className="px-3 py-2">Chứng từ nguồn</th><th scope="col" className="px-3 py-2">Lý do</th><th scope="col" className="px-3 py-2">Phụ trách</th><th scope="col" className="px-3 py-2">Hạn xử lý</th><th scope="col" className="px-3 py-2">Trạng thái</th><th scope="col" className="px-3 py-2">Thao tác</th></tr></thead><tbody>
              {items.map((item) => { const presentation = amendmentDecisionStatus(item.status); return <tr key={item.decisionItemId} className="border-t border-slate-100"><td className="sticky left-0 bg-white px-3 py-2"><strong>{item.customerName}</strong><br /><span className="text-xs text-slate-600">{formatDateOnly(item.serviceDate)} · {formatShiftName(item.shiftName)} · {item.priceTierAmount == null ? 'Chưa xác định tier' : formatCurrency(item.priceTierAmount)}</span></td><td className="px-3 py-2"><span>{item.documentIds.length ? `Chứng từ ${item.documentIds.length} mục` : 'Chưa có chứng từ'}</span><br /><span className="text-xs text-slate-600">{item.sourceLineIds.length} dòng nguồn</span></td><td className="px-3 py-2">{item.reason}</td><td className="px-3 py-2">{item.accountableRole}</td><td className="px-3 py-2 whitespace-nowrap">{formatDateTime(item.dueAt)}</td><td className="px-3 py-2"><StatusBadge variant={presentation.tone}>{presentation.label}</StatusBadge></td><td className="px-3 py-2"><Button size="sm" onClick={() => setSelected(item)}>Xem bằng chứng</Button></td></tr> })}
            </tbody></table></div>}
      {decisionPage && decisionPage.totalCount > PAGE_SIZE && <div className="mt-3 flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Trang trước</Button><span className="text-xs text-slate-600">Trang {page}</span><Button size="sm" variant="outline" disabled={page * PAGE_SIZE >= decisionPage.totalCount} onClick={() => setPage((current) => current + 1)}>Trang sau</Button></div>}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(undefined) }}>
        <DialogContent size="lg"><DialogHeader><DialogTitle>Chi tiết bằng chứng đối soát</DialogTitle><DialogDescription>{selected?.customerName} · {selected ? `${formatDateOnly(selected.serviceDate)} · ${formatShiftName(selected.shiftName)}` : ''}</DialogDescription></DialogHeader>
          {selected && <div className="space-y-3 text-sm"><p><strong>Lý do:</strong> {selected.reason}</p><p><strong>Chứng từ:</strong> {selected.documentIds.join(', ') || 'Chưa có'}</p><p><strong>Dòng nguồn:</strong> {selected.sourceLineIds.join(', ') || 'Chưa có'}</p>{selected.allowedActions.includes('APPEND_CORRECTION') && <label className="block font-medium">Lý do correction <Input className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Lý do correction append-only" /></label>}</div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelected(undefined)}>Đóng</Button>{selected?.allowedActions.includes('APPEND_CORRECTION') && <Button disabled={!reason.trim() || isSaving} onClick={() => void complete()}>{isSaving ? 'Đang lưu...' : 'Ghi correction append-only'}</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
