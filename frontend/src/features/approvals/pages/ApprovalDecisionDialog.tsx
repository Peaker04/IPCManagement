import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime, formatQuantityWithUnit } from '@/lib/formatters'
import type { InventoryReceipt } from '@/api/workflowApiTypes'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type DecisionStatus = 'Approve' | 'Reject'

type ApprovalDecisionDialogProps = {
  open: boolean
  status: DecisionStatus
  reason: string
  error: string | null
  isDeciding: boolean
  copy: { title: string; description: string; safeLabel: string; submitLabel: string }
  onReasonChange: (reason: string) => void
  onClose: () => void
  onSubmit: () => void
  onRetry: () => void
  receipt?: InventoryReceipt
  isReceiptLoading?: boolean
  isReceiptError?: boolean
}

export function ApprovalDecisionDialog({ open, status, reason, error, isDeciding, copy, onReasonChange, onClose, onSubmit, onRetry, receipt, isReceiptLoading = false, isReceiptError = false }: ApprovalDecisionDialogProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const continueEditingRef = useRef<HTMLButtonElement>(null)
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    if (confirmDiscard) continueEditingRef.current?.focus()
    else cancelRef.current?.focus()
  }, [confirmDiscard, open])

  useEffect(() => {
    if (error && status === 'Reject') reasonRef.current?.focus()
  }, [error, status])

  const requestClose = () => {
    if (isDeciding) return
    if (reason.trim()) setConfirmDiscard(true)
    else onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={() => undefined}
      onCloseRequest={() => {
        requestClose()
        return false
      }}
    >
      <DialogContent size="md" aria-describedby="approval-decision-description">
        {confirmDiscard ? (
          <>
            <DialogHeader>
              <DialogTitle>Bỏ lý do đang nhập?</DialogTitle>
              <DialogDescription id="approval-decision-description">
                Nội dung chưa được lưu. Bạn có thể tiếp tục chỉnh sửa hoặc bỏ thay đổi để đóng.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button ref={continueEditingRef} type="button" variant="outline" onClick={() => setConfirmDiscard(false)}>
                Tiếp tục chỉnh sửa
              </Button>
              <Button type="button" variant="destructive" onClick={() => { setConfirmDiscard(false); onClose() }}>
                Bỏ thay đổi
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); if (!isDeciding) onSubmit() }}>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription id="approval-decision-description">{copy.description}</DialogDescription>
            </DialogHeader>
            {(isReceiptLoading || isReceiptError || receipt) && (
              <section className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3" aria-label="Bằng chứng kiểm tra phiếu nhập">
                <h3 className="text-sm font-semibold text-slate-950">Kết quả kiểm tra chất lượng</h3>
                {isReceiptLoading ? <p className="mt-1 text-sm text-slate-600">Đang tải số lượng đạt, không đạt và lý do…</p>
                  : isReceiptError ? <p role="alert" className="mt-1 text-sm text-red-800">Không tải được chi tiết kiểm tra; quyết định đang bị chặn.</p>
                  : receipt && <>
                    <p className="mt-1 text-xs text-slate-600">{receipt.receiptCode} · kiểm tra lúc {receipt.qualityCheckedAt ? formatDateTime(receipt.qualityCheckedAt) : 'chưa xác định'}</p>
                    <ul className="mt-2 grid max-h-48 gap-2 overflow-y-auto text-sm">
                      {receipt.lines.map((line) => <li key={line.receiptLineId} className="rounded border border-slate-200 bg-white p-2">
                        <strong>{line.ingredientName ?? line.ingredientId}</strong>
                        <span className="mt-1 block text-slate-700">Đạt {formatQuantityWithUnit(line.acceptedQuantity ?? 0, line.unitName ?? '')} · Không đạt {formatQuantityWithUnit(line.rejectedQuantity ?? 0, line.unitName ?? '')}</span>
                        {(line.rejectedQuantity ?? 0) > 0 && <span className="block text-amber-800">Lý do: {line.qualityReason || 'Chưa có lý do'}</span>}
                      </li>)}
                    </ul>
                  </>}
              </section>
            )}
            <div className="space-y-2 py-4">
              <label htmlFor="decision-reason" className="text-sm font-semibold text-slate-700">
                {status === 'Approve' ? 'Ghi chú duyệt (tùy chọn)' : 'Lý do từ chối'}
              </label>
              <Textarea
                ref={reasonRef}
                id="decision-reason"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder={status === 'Approve' ? 'Ví dụ: Đồng ý duyệt...' : 'Nhập lý do từ chối bắt buộc...'}
                className="min-h-[100px] resize-none"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'decision-error' : undefined}
                disabled={isDeciding}
              />
            </div>
            {error && (
              <div id="decision-error" role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p>{error}</p>
                <Button type="button" variant="outline" className="mt-2" onClick={onRetry} disabled={isDeciding}>Tải lại hàng đợi</Button>
              </div>
            )}
            <DialogFooter className="mt-4">
              <Button ref={cancelRef} data-inp-action="confirm-approval-decision" type="button" variant="outline" onClick={requestClose} disabled={isDeciding}>
                {copy.safeLabel}
              </Button>
              <Button type="submit" variant={status === 'Reject' ? 'destructive' : 'default'} disabled={isDeciding || isReceiptLoading || isReceiptError}>
                {isDeciding ? 'Đang xử lý...' : copy.submitLabel}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
