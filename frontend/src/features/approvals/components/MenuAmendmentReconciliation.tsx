import { useMemo, useState } from 'react'
import {
  useExecuteMenuAmendmentDecisionMutation,
  useGetCoordinationCustomersQuery,
  useGetMenuAmendmentDecisionPageQuery,
} from '@/api/coordinationApi'
import { EmptyState, QueryErrorAlert, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDateOnly, formatDateTime } from '@/lib/formatters'
import { formatShiftName } from '@/lib/workflowConfig'
import { amendmentDecisionStatus, type MenuAmendmentDecisionItem } from '@/types/menuAmendmentDecision'

const PAGE_SIZE = 20
const ALL_CUSTOMERS = '__all__'

export function MenuAmendmentReconciliation() {
  const [scope, setScope] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<MenuAmendmentDecisionItem>()
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const allCustomers = scope === ALL_CUSTOMERS
  const customerId = scope && !allCustomers ? scope : undefined
  const customersQuery = useGetCoordinationCustomersQuery()
  const decisionQuery = useGetMenuAmendmentDecisionPageQuery(
    { customerId, allCustomers, page, pageSize: PAGE_SIZE },
    { skip: !scope },
  )
  const [executeDecision, { isLoading: isSaving }] = useExecuteMenuAmendmentDecisionMutation()
  const decisionPage = decisionQuery.data?.data
  const items = decisionPage?.items ?? []
  const scopeLabel = useMemo(() => {
    if (allCustomers) return 'Tất cả khách hàng'
    return customersQuery.data?.data?.find((customer) => customer.customerId === customerId)?.customerName
  }, [allCustomers, customerId, customersQuery.data])

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
      setFeedback('Đã ghi nhận điều chỉnh và cập nhật lại danh sách.')
      setSelected(undefined)
      setReason('')
      await decisionQuery.refetch()
    } catch {
      setFeedback('Nội dung đã thay đổi hoặc bạn không còn quyền xử lý. Hãy tải lại danh sách trước khi thử lại.')
      await decisionQuery.refetch()
    }
  }

  return (
    <section aria-labelledby="menu-reconciliation-title" className="border-b border-slate-200 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="menu-reconciliation-title" className="text-sm font-semibold text-slate-900">Đối soát điều chỉnh thực đơn</h2>
          <p className="mt-1 text-sm text-slate-600">Xử lý các thay đổi đã liên quan đến chứng từ vận hành.</p>
        </div>
        <label htmlFor="menu-reconciliation-customer" className="grid min-w-56 gap-1 text-xs font-semibold text-slate-700">
          Khách hàng
          <select
            id="menu-reconciliation-customer"
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900"
            value={scope}
            onChange={(event) => { setScope(event.target.value); setPage(1); setFeedback('') }}
          >
            <option value="">Chọn khách hàng</option>
            {customersQuery.data?.data?.map((customer) => (
              <option key={customer.customerId} value={customer.customerId}>{customer.customerCode} - {customer.customerName}</option>
            ))}
            <option value={ALL_CUSTOMERS}>Tất cả khách hàng</option>
          </select>
        </label>
      </div>

      {feedback && <p role="status" className="mt-3 text-sm text-slate-700">{feedback}</p>}
      {!scope ? (
        <p className="mt-3 text-sm text-slate-500">Chọn khách hàng để xem yêu cầu cần xử lý.</p>
      ) : decisionQuery.isError ? (
        <div className="mt-3"><QueryErrorAlert title="Không tải được yêu cầu đối soát" onRetry={decisionQuery.refetch}>Chưa thể xác định danh sách đang trống. Hãy tải lại trước khi xử lý.</QueryErrorAlert></div>
      ) : decisionQuery.isLoading ? (
        <p role="status" className="mt-3 text-sm text-slate-600">Đang tải yêu cầu đối soát...</p>
      ) : items.length === 0 ? (
        <EmptyState title={`${scopeLabel ?? 'Phạm vi này'} chưa có yêu cầu cần đối soát`} className="!min-h-0 !p-4" />
      ) : (
        <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
          <table className="ipc-data-table min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700"><tr><th className="px-3 py-2">Khách hàng / thời điểm</th><th className="px-3 py-2">Chứng từ liên quan</th><th className="px-3 py-2">Lý do</th><th className="px-3 py-2">Phụ trách</th><th className="px-3 py-2">Hạn xử lý</th><th className="px-3 py-2">Trạng thái</th><th className="px-3 py-2">Thao tác</th></tr></thead>
            <tbody>{items.map((item) => {
              const presentation = amendmentDecisionStatus(item.status)
              return <tr key={item.decisionItemId} className="border-t border-slate-100"><td className="px-3 py-2"><strong>{item.customerName}</strong><br /><span className="text-xs text-slate-600">{formatDateOnly(item.serviceDate)} · {formatShiftName(item.shiftName)} · {item.priceTierAmount == null ? 'Chưa xác định mức giá' : formatCurrency(item.priceTierAmount)}</span></td><td className="px-3 py-2">{item.documentIds.length ? `${item.documentIds.length} chứng từ` : 'Chưa có chứng từ'}<br /><span className="text-xs text-slate-600">{item.sourceLineIds.length} dòng chứng từ</span></td><td className="px-3 py-2">{item.reason}</td><td className="px-3 py-2">{item.accountableRole}</td><td className="whitespace-nowrap px-3 py-2">{formatDateTime(item.dueAt)}</td><td className="px-3 py-2"><StatusBadge variant={presentation.tone}>{presentation.label}</StatusBadge></td><td className="px-3 py-2"><Button size="sm" onClick={() => setSelected(item)}>Xem chi tiết</Button></td></tr>
            })}</tbody>
          </table>
        </div>
      )}

      {decisionPage && decisionPage.totalCount > PAGE_SIZE && <div className="mt-3 flex items-center justify-end gap-2"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Trang trước</Button><span className="text-xs text-slate-600">Trang {page}</span><Button size="sm" variant="outline" disabled={page * PAGE_SIZE >= decisionPage.totalCount} onClick={() => setPage((current) => current + 1)}>Trang sau</Button></div>}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(undefined) }}>
        <DialogContent size="lg"><DialogHeader><DialogTitle>Chi tiết yêu cầu đối soát</DialogTitle><DialogDescription>{selected?.customerName} · {selected ? `${formatDateOnly(selected.serviceDate)} · ${formatShiftName(selected.shiftName)}` : ''}</DialogDescription></DialogHeader>
          {selected && <div className="space-y-3 text-sm"><p><strong>Lý do:</strong> {selected.reason}</p><p><strong>Chứng từ:</strong> {selected.documentIds.join(', ') || 'Chưa có'}</p><p><strong>Dòng chứng từ:</strong> {selected.sourceLineIds.join(', ') || 'Chưa có'}</p>{selected.allowedActions.includes('APPEND_CORRECTION') && <label className="block font-medium">Lý do điều chỉnh<Input className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Lý do điều chỉnh" /></label>}</div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelected(undefined)}>Đóng</Button>{selected?.allowedActions.includes('APPEND_CORRECTION') && <Button disabled={!reason.trim() || isSaving} onClick={() => void complete()}>{isSaving ? 'Đang lưu...' : 'Ghi nhận điều chỉnh'}</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
