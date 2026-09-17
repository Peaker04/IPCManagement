import { useState } from 'react'
import {
  useExecuteMenuAmendmentMutation,
  useGetMenuAmendmentsQuery,
  useReviewMenuAmendmentMutation,
  type MenuAmendmentInboxItem,
} from '@/api/coordinationApi'
import { EmptyState, QueryErrorAlert, SectionPanel, StatusBadge, TableSkeleton, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatDateOnly, formatDateTime } from '@/lib/formatters'
import { useHasRole } from '@/lib/useHasRole'

const statusPresentation = (status: string) => ({
  PENDING_REVIEW: { label: 'Chờ Quản lý duyệt', tone: 'warning' as const },
  APPROVED_FOR_EXECUTION: { label: 'Chờ Admin thực thi', tone: 'info' as const },
  CORRECTION_REQUIRED: { label: 'Cần Điều phối chỉnh sửa', tone: 'danger' as const },
  RATIFIED_RECONCILIATION_REQUIRED: { label: 'Đã duyệt · cần đối soát', tone: 'warning' as const },
  EXECUTED: { label: 'Đã thực thi', tone: 'success' as const },
  RECONCILIATION_REQUIRED: { label: 'Cần đối soát', tone: 'warning' as const },
}[status] ?? { label: status || 'Chưa cập nhật', tone: 'neutral' as const })

export function MenuAmendmentInbox() {
  const canReview = useHasRole(['quanly'])
  const canExecute = useHasRole(['admin'])
  const enabled = canReview || canExecute
  const query = useGetMenuAmendmentsQuery(undefined, { skip: !enabled })
  const [review, reviewState] = useReviewMenuAmendmentMutation()
  const [execute, executeState] = useExecuteMenuAmendmentMutation()
  const [selected, setSelected] = useState<MenuAmendmentInboxItem>()
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [reasonError, setReasonError] = useState('')
  const rows = query.data?.data ?? []
  if (!enabled) return null

  const reviewSelected = async (approved: boolean) => {
    if (!selected) return
    if (!approved && !reason.trim()) {
      setReasonError('Nhập lý do từ chối.')
      requestAnimationFrame(() => document.getElementById('menu-amendment-reject-reason')?.focus())
      return
    }
    try {
      await review({ id: selected.menuAmendmentId, approved, reason: reason.trim() || undefined }).unwrap()
      setFeedback(approved ? 'Đã duyệt yêu cầu thay đổi thực đơn.' : 'Đã từ chối yêu cầu thay đổi thực đơn.')
      setSelected(undefined)
      setReason('')
    } catch {
      setFeedback('Không xử lý được yêu cầu. Hãy tải lại danh sách và thử lại.')
    }
  }
  const executeSelected = async () => {
    if (!selected) return
    try {
      await execute(selected.menuAmendmentId).unwrap()
      setFeedback('Đã thực thi thay đổi thực đơn; phạm vi còn mutable cần tính lại nguyên liệu.')
      setSelected(undefined)
    } catch {
      setFeedback('Không thực thi được yêu cầu. Hãy tải lại trạng thái trước khi thử lại.')
    }
  }

  return <SectionPanel title="Điều chỉnh thực đơn chờ xử lý" description="Quản lý duyệt yêu cầu; Admin chỉ thực thi yêu cầu đã duyệt." descriptionPlacement="inline">
    <div className="space-y-3">
      {feedback && <p role="status" className="text-sm text-slate-700">{feedback}</p>}
      {query.isError ? <QueryErrorAlert title="Không tải được yêu cầu điều chỉnh" onRetry={query.refetch}>Hãy tải lại trước khi xử lý.</QueryErrorAlert>
        : query.isLoading ? <TableSkeleton columns={5} rows={3} ariaLabel="Đang tải yêu cầu điều chỉnh thực đơn..." />
          : rows.length === 0 ? <EmptyState title="Không có yêu cầu điều chỉnh thực đơn đang chờ" className="!min-h-0 !p-4" />
            : <TableViewport ariaLabel="Yêu cầu điều chỉnh thực đơn" caption="Yêu cầu thay đổi thực đơn theo tuần và actor chịu trách nhiệm.">
              <table className="ipc-data-table table-fixed min-w-[760px]">
                <thead><tr><th scope="col">Khách hàng / tuần</th><th scope="col">Lý do</th><th scope="col">Tác động</th><th scope="col">Trạng thái</th><th scope="col" className="text-right">Thao tác</th></tr></thead>
                <tbody>{rows.map((item) => {
                  const status = statusPresentation(item.status)
                  const actionable = canReview && (item.status === 'PENDING_REVIEW' || item.status === 'RECONCILIATION_REQUIRED') || canExecute && item.status === 'APPROVED_FOR_EXECUTION'
                  return <tr key={item.menuAmendmentId}>
                    <td><strong>{item.customerName}</strong><br /><span className="text-xs text-slate-500">Tuần {formatDateOnly(item.weekStartDate)} · tạo {formatDateTime(item.createdAt)}</span></td>
                    <td>{item.reason}</td>
                    <td>{item.requiresReconciliation ? 'Đã có chứng từ · cần đối soát' : `${item.affectedDemandCount} nhu cầu · ${item.affectedPurchaseRequestCount} đề xuất mua`}</td>
                    <td><StatusBadge variant={status.tone} size="sm">{status.label}</StatusBadge></td>
                    <td className="text-right">{actionable ? <Button size="sm" onClick={() => { setSelected(item); setReason(''); setReasonError('') }}>Xử lý</Button> : <span className="text-xs text-slate-500">Theo dõi</span>}</td>
                  </tr>
                })}</tbody>
              </table>
            </TableViewport>}

      {selected && <Dialog open onOpenChange={(open) => { if (!open) setSelected(undefined) }}>
        <DialogContent><DialogHeader><DialogTitle>{canReview ? 'Duyệt điều chỉnh thực đơn' : 'Thực thi điều chỉnh thực đơn'}</DialogTitle><DialogDescription>{selected.customerName} · tuần {formatDateOnly(selected.weekStartDate)}</DialogDescription></DialogHeader>
          <div className="space-y-2 text-sm"><p><strong>Lý do:</strong> {selected.reason}</p><p>{selected.requiresReconciliation ? 'Yêu cầu đã có chứng từ vật lý và phải xử lý tại vùng đối soát.' : 'Sau khi thực thi, nhu cầu nguyên liệu của phạm vi còn mutable cần được tính lại.'}</p>{canReview && <label className="block font-medium" htmlFor="menu-amendment-reject-reason">Lý do khi từ chối<Input id="menu-amendment-reject-reason" className="mt-1" value={reason} onChange={(event) => { setReason(event.target.value); setReasonError('') }} aria-invalid={Boolean(reasonError) || undefined} aria-describedby={reasonError ? 'menu-amendment-reject-reason-error' : undefined} />{reasonError && <span id="menu-amendment-reject-reason-error" className="mt-1 block text-xs text-red-700">{reasonError}</span>}</label>}</div>
          <DialogFooter><Button variant="outline" onClick={() => setSelected(undefined)}>Đóng</Button>{canReview ? <><Button variant="outline" disabled={reviewState.isLoading} onClick={() => void reviewSelected(false)}>Từ chối</Button><Button disabled={reviewState.isLoading} onClick={() => void reviewSelected(true)}>Duyệt</Button></> : <Button disabled={executeState.isLoading} onClick={() => void executeSelected()}>Thực thi</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  </SectionPanel>
}
