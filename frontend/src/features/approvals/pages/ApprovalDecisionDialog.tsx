import { useEffect, useId, useRef, type HTMLAttributes } from 'react'
import { Button } from '@/components/ui/button'

type DecisionStatus = 'Approve' | 'Reject'

const DialogContent = (props: HTMLAttributes<HTMLDivElement>) => <div {...props} />

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
  const titleId = useId()
  const descriptionId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeciding) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isDeciding, onClose, open])

  if (!open) return null

  return (
    <div data-ipc-dialog-portal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => { if (!isDeciding) onClose() }} />
      <DialogContent role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="relative z-10 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <form onSubmit={(event) => { event.preventDefault(); if (!isDeciding && (status === 'Approve' || reason.trim())) onSubmit() }}>
          <header className="space-y-1.5 text-center sm:text-left">
            <h2 id={titleId} className="text-lg font-semibold leading-none tracking-tight">{copy.title}</h2>
            <p id={descriptionId} className="text-sm text-muted-foreground">{copy.description}</p>
          </header>
          <div className="space-y-2 py-4">
            <label htmlFor="decision-reason" className="text-sm font-semibold text-slate-700">
              {status === 'Approve' ? 'Ghi chú duyệt (tùy chọn)' : 'Lý do từ chối'}
            </label>
            <textarea
              id="decision-reason"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder={status === 'Approve' ? 'Ví dụ: Đồng ý duyệt...' : 'Nhập lý do từ chối bắt buộc...'}
              className="flex min-h-[100px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
          <footer className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button ref={cancelRef} data-inp-action="confirm-approval-decision" type="button" variant="outline" onClick={onClose} disabled={isDeciding}>
              {copy.safeLabel}
            </Button>
            <Button type="submit" variant={status === 'Reject' ? 'destructive' : 'default'} disabled={isDeciding || (status === 'Reject' && !reason.trim())}>
              {isDeciding ? 'Đang xử lý...' : copy.submitLabel}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </div>
  )
}
