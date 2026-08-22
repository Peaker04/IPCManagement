import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

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
}

export function ApprovalDecisionDialog({ open, status, reason, error, isDeciding, copy, onReasonChange, onClose, onSubmit, onRetry }: ApprovalDecisionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }} onCloseRequest={() => !isDeciding}>
      <DialogContent aria-label={copy.title} className="max-w-md">
        <form onSubmit={(event) => { event.preventDefault(); if (!isDeciding && (status === 'Approve' || reason.trim())) onSubmit() }}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <label htmlFor="decision-reason" className="text-sm font-semibold text-slate-700">
            {status === 'Approve' ? 'Ghi chú duyệt (tùy chọn)' : 'Lý do từ chối'}
          </label>
          <Textarea
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
        <DialogFooter className="gap-2">
          <Button data-inp-action="confirm-approval-decision" type="button" variant="outline" onClick={onClose} disabled={isDeciding} autoFocus>
            {copy.safeLabel}
          </Button>
          <Button type="submit" variant={status === 'Reject' ? 'destructive' : 'default'} disabled={isDeciding || (status === 'Reject' && !reason.trim())}>
            {isDeciding ? 'Đang xử lý...' : copy.submitLabel}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
