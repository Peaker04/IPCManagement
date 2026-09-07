import { useMemo } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useGetReconciliationBatchQuery, useGetReconciliationIssueQuery } from '@/api/reconciliationApi'
import { InlineAlert } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateOnly, formatDateTime, formatQuantity } from '@/lib/formatters'
import { ROUTES } from '@/lib/routeConfig'
import {
  collectIssueRelatedNotes,
  dispositionCategoryLabel,
  issueActorLabel,
  issueRoleLabel,
  issueStatusLabel,
} from './reconciliationIssueCorrelation'

interface Props {
  issueId: string | null
  open?: boolean
  expectedBatchId?: string | null
  title?: string
  ariaLabel?: string
  description?: string
  onClose: (reason?: 'escape' | 'backdrop' | 'close-control') => void
  onOpenBatch?: (batchId: string, issueId: string) => void
}

const optionalText = (value?: string | null) => value?.trim() || 'Không có trong dữ liệu đã lưu'

export function ReconciliationIssueDetailDialog({ issueId, open = Boolean(issueId), expectedBatchId, title, ariaLabel = 'Chi tiết giao dịch xuất kho đối chiếu', description = 'Định danh chính xác bằng mã phiếu; vai trò giao dịch không được suy đoán khi chưa có dữ liệu lưu.', onClose, onOpenBatch }: Props) {
  const detailQuery = useGetReconciliationIssueQuery(issueId ?? '', { skip: !open || !issueId })
  const issue = open ? detailQuery.currentData ?? detailQuery.data : undefined
  const batchId = issue?.reconciliationBatchId ?? null
  const batchQuery = useGetReconciliationBatchQuery(batchId ?? '', { skip: !batchId })
  const batch = batchQuery.currentData ?? batchQuery.data
  const linkageMismatch = Boolean(issue && expectedBatchId && issue.reconciliationBatchId !== expectedBatchId)
  const relatedNotes = useMemo(() => collectIssueRelatedNotes(issue ?? { lines: [] }, batch), [batch, issue])

  return <Dialog open={open} onOpenChange={(nextOpen, reason) => { if (!nextOpen) onClose(reason) }}>
    <DialogContent aria-label={ariaLabel} size="lg">
      <DialogHeader>
        <DialogTitle>{title || issue?.issueCode || 'Chi tiết giao dịch xuất kho'}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      {detailQuery.isFetching && !issue && <div className="mt-5 flex items-center gap-2 text-sm text-slate-600" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Đang tải chi tiết phiếu...</div>}
      {detailQuery.isError && !issue && <InlineAlert title="Không tải được chi tiết phiếu" variant="danger"><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => detailQuery.refetch()}>Thử lại</Button></InlineAlert>}
      {linkageMismatch && <InlineAlert title="Liên kết lô không khớp" variant="danger">Phiếu này không thuộc lô đang mở. Nội dung chi tiết được ẩn để tránh ghép nhầm giao dịch.</InlineAlert>}

      {issue && !linkageMismatch && <div className="mt-5 space-y-5">
        <dl className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-5 gap-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <dt className="text-slate-600">Mã phiếu</dt><dd className="font-medium text-slate-950">{issue.issueCode}</dd>
          <dt className="text-slate-600">ID phiếu</dt><dd className="break-all font-mono text-xs text-slate-950">{issue.issueId}</dd>
          <dt className="text-slate-600">ID lô đối chiếu</dt><dd className="break-all font-mono text-xs text-slate-950">{issue.reconciliationBatchId || 'Không có trong dữ liệu đã lưu'}</dd>
          <dt className="text-slate-600">Vai trò</dt><dd className="font-medium text-slate-950">{issueRoleLabel()}</dd>
          <dt className="text-slate-600">Trạng thái</dt><dd className="font-medium text-slate-950">{issueStatusLabel(issue)}</dd>
          <dt className="text-slate-600">Người tạo</dt><dd className="font-medium text-slate-950">{issueActorLabel(issue)}</dd>
          <dt className="text-slate-600">Thời điểm tạo</dt><dd className="font-medium text-slate-950">{formatDateTime(issue.createdAt)}</dd>
          <dt className="text-slate-600">Ngày phiếu</dt><dd className="font-medium text-slate-950">{formatDateOnly(issue.issueDate)}</dd>
          <dt className="text-slate-600">Người nhận</dt><dd className="font-medium text-slate-950">{optionalText(issue.receivedByName)}</dd>
          <dt className="text-slate-600">Thời điểm nhận</dt><dd className="font-medium text-slate-950">{issue.receivedAt ? formatDateTime(issue.receivedAt) : 'Chưa được ghi nhận'}</dd>
          <dt className="text-slate-600">Số dòng</dt><dd className="font-medium text-slate-950">{issue.lines.length}</dd>
        </dl>

        <section aria-labelledby="issue-lines-heading">
          <h3 id="issue-lines-heading" className="font-semibold text-slate-950">Dòng giao dịch</h3>
          <div className="mt-2 space-y-2">{issue.lines.map((line) => <article key={line.issueLineId} className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-950">{line.ingredientName || 'Nguyên liệu chưa đặt tên'}</p>
            <p className="mt-1 text-slate-700">{formatQuantity(line.issuedQty)} {line.unitName || line.unitId}</p>
            <dl className="mt-2 grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-xs"><dt className="text-slate-500">ID dòng phiếu</dt><dd className="break-all font-mono">{line.issueLineId}</dd><dt className="text-slate-500">ID dòng lô</dt><dd className="break-all font-mono">{line.reconciliationBatchLineId || 'Không có trong dữ liệu đã lưu'}</dd></dl>
          </article>)}</div>
        </section>

        <section aria-labelledby="issue-notes-heading">
          <h3 id="issue-notes-heading" className="font-semibold text-slate-950">Lý do và ghi chú liên quan</h3>
          {batchQuery.isFetching && !batch && <p className="mt-2 text-sm text-slate-600" role="status">Đang tải dữ liệu lô...</p>}
          {batchQuery.isError && !batch && <p className="mt-2 text-sm text-red-700" role="alert">Không tải được ghi chú của lô. <Button type="button" variant="link" className="h-auto p-0" onClick={() => batchQuery.refetch()}>Thử lại</Button></p>}
          {batch && <div className="mt-2 space-y-2 text-sm">
            {relatedNotes.notes.length > 0 ? <ul className="list-disc space-y-1 pl-5">{relatedNotes.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p className="text-slate-600">Không có ghi chú liên quan trong lô.</p>}
            <p className="text-xs text-slate-500">Các ghi chú trên thuộc những dòng lô liên kết; dữ liệu hiện tại không lưu quan hệ để khẳng định ghi chú nào thuộc riêng phiếu này.</p>
            {issue.lines.map((issueLine) => {
              const line = batch.lines.find((candidate) => candidate.batchLineId === issueLine.reconciliationBatchLineId)
              if (!line?.disposition) return null
              return <div key={issueLine.issueLineId} className="rounded-md bg-slate-50 p-3"><p className="font-medium">{line.ingredientName || issueLine.ingredientName || 'Nguyên liệu chưa đặt tên'}: {dispositionCategoryLabel(line.disposition.category)}</p><p className="mt-1 text-slate-700">{line.disposition.reason}</p><p className="mt-1 text-xs text-slate-500">Kết luận ở cấp dòng lô, không phải phân loại loại phiếu.</p></div>
            })}
          </div>}
        </section>
      </div>}

      <DialogFooter className="mt-6">
        {issue && !linkageMismatch && issue.reconciliationBatchId && (onOpenBatch
          ? <Button type="button" variant="outline" onClick={() => onOpenBatch(issue.reconciliationBatchId!, issue.issueId)}>Mở lô đối chiếu <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" /></Button>
          : <a className={buttonVariants({ variant: 'outline' })} href={`${ROUTES.RECONCILIATION}?batchId=${encodeURIComponent(issue.reconciliationBatchId)}&issueId=${encodeURIComponent(issue.issueId)}`}>Mở lô đối chiếu <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" /></a>)}
        <Button type="button" onClick={() => onClose('close-control')}>Đóng</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
