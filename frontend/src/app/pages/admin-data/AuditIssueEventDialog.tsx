import { ReconciliationIssueDetailDialog } from '@/components/reconciliation/ReconciliationIssueDetailDialog'

interface AuditIssueEventDialogProps {
  eventId?: string
  expectedBatchId?: string
  open: boolean
  onOpenChange: (open: boolean, reason?: 'escape' | 'backdrop' | 'close-control') => void
}

export function AuditIssueEventDialog({ eventId, expectedBatchId, open, onOpenChange }: AuditIssueEventDialogProps) {
  return <ReconciliationIssueDetailDialog
    open={open}
    issueId={eventId ?? null}
    expectedBatchId={expectedBatchId}
    title="Chi tiết sự kiện xuất kho"
    ariaLabel="Chi tiết sự kiện xuất kho đối soát"
    onClose={(reason) => onOpenChange(false, reason)}
  />
}
