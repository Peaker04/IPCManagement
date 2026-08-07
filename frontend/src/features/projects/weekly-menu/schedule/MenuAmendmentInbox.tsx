import { useState } from 'react'
import {
  useExecuteMenuAmendmentMutation,
  useGetMenuAmendmentsQuery,
  useReviewMenuAmendmentMutation,
} from '@/api/coordinationApi'
import { ActionGuard } from '@/components/common/ActionGuard'
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Chờ hậu kiểm',
  APPROVED_FOR_EXECUTION: 'Đã duyệt thực thi',
  CORRECTION_REQUIRED: 'Cần Điều phối chỉnh sửa',
  RECONCILIATION_REQUIRED: 'Cần đối soát chứng từ',
  RATIFIED_RECONCILIATION_REQUIRED: 'Đã hậu kiểm, chờ đối soát',
  EXECUTED: 'Đã thực thi',
}

export function MenuAmendmentInbox() {
  const { data, isError, isLoading, refetch } = useGetMenuAmendmentsQuery()
  const [review, { isLoading: reviewing }] = useReviewMenuAmendmentMutation()
  const [execute, { isLoading: executing }] = useExecuteMenuAmendmentMutation()
  const [correctionId, setCorrectionId] = useState<string | null>(null)
  const [correctionReason, setCorrectionReason] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const items = data?.data ?? []

  const complete = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action()
      setFeedback(message)
    } catch {
      setFeedback('Không thể cập nhật yêu cầu. Dữ liệu hoặc quyền thao tác có thể đã thay đổi; hãy tải lại.')
    }
  }

  if (isError) {
    return (
      <section className="mb-4" aria-label="Yêu cầu thay đổi thực đơn">
        <QueryErrorAlert title="Không tải được yêu cầu thay đổi thực đơn" onRetry={refetch}>
          Không thể kết luận chưa có yêu cầu thay đổi. Hãy tải lại trước khi tiếp tục xử lý thực đơn.
        </QueryErrorAlert>
      </section>
    )
  }
  if (!isLoading && items.length === 0) return null
  return (
    <section className="mb-4 rounded border border-amber-200 bg-amber-50 p-3" aria-label="Yêu cầu thay đổi thực đơn">
      <h2 className="text-sm font-semibold text-amber-900">Yêu cầu thay đổi thực đơn</h2>
      {feedback && <p role="status" className="mt-1 text-sm text-amber-900">{feedback}</p>}
      {isLoading ? <p className="mt-1 text-sm text-amber-800">Đang tải...</p> : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.menuAmendmentId} className="rounded border border-amber-100 bg-white p-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <strong>{item.customerName}</strong> · {item.weekStartDate} · {statusLabel[item.status] ?? item.status}
                  <br />
                  <small>{item.reason}</small>
                  {item.requiresReconciliation && (
                    <small className="block font-medium text-amber-800">
                      Cần đối soát: {item.hasPurchaseOrder && 'PO '}{item.hasReceipt && 'Nhập kho '}{item.hasIssue && 'Xuất bếp '}
                      · demand {item.affectedDemandCount}, PR {item.affectedPurchaseRequestCount}
                    </small>
                  )}
                </span>
                <ActionGuard allowedRoles={['admin', 'quanly']}>
                  <span className="flex gap-2">
                    {item.status === 'PENDING_REVIEW' && <>
                      <Button size="sm" onClick={() => void complete(
                        () => review({ id: item.menuAmendmentId, approved: true }).unwrap(),
                        'Đã duyệt yêu cầu thay đổi. Có thể thực thi khi chưa có chứng từ vật lý.',
                      )} disabled={reviewing}>Duyệt</Button>
                      <Button size="sm" variant="outline" onClick={() => setCorrectionId(item.menuAmendmentId)} disabled={reviewing}>Yêu cầu sửa</Button>
                    </>}
                    {item.status === 'APPROVED_FOR_EXECUTION' && <Button size="sm" onClick={() => void complete(
                      () => execute(item.menuAmendmentId).unwrap(),
                      'Đã thực thi thay đổi và tạo version thực đơn mới.',
                    )} disabled={executing}>Thực thi</Button>}
                  </span>
                </ActionGuard>
              </div>
              <ActionGuard allowedRoles={['admin', 'quanly']}>
                {correctionId === item.menuAmendmentId && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Lý do cần chỉnh sửa" />
                    <Button size="sm" disabled={!correctionReason.trim() || reviewing} onClick={() => void complete(
                      async () => {
                        await review({ id: item.menuAmendmentId, approved: false, reason: correctionReason }).unwrap()
                        setCorrectionId(null)
                        setCorrectionReason('')
                      },
                      'Đã gửi yêu cầu chỉnh sửa cho Điều phối.',
                    )}>Gửi</Button>
                  </div>
                )}
              </ActionGuard>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
