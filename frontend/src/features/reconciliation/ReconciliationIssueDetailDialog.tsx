import { useMemo } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import type { ReconciliationIssueHistoryItem } from '@/api/reconciliationApi'
import { useGetReconciliationBatchQuery, useGetReconciliationIssueQuery } from '@/api/reconciliationApi'
import { InlineAlert, SkeletonTableRow, TableViewport } from '@/components/common'
import { Button, buttonVariants } from '@/components/ui/button'
import { Drawer, DrawerBody, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { formatDateOnly, formatDateTime, formatQuantityWithUnit } from '@/lib/formatters'
import { ROUTES } from '@/lib/routeConfig'
import { typography } from '@/lib/typography'
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
  initialIssue?: ReconciliationIssueHistoryItem
  title?: string
  ariaLabel?: string
  description?: string
  onClose: (reason?: 'escape' | 'backdrop' | 'close-control') => void
  onOpenBatch?: (batchId: string, issueId: string) => void
}

const optionalText = (value?: string | null) => value?.trim() || 'Không có trong dữ liệu đã lưu'

export function ReconciliationIssueDetailDialog({ issueId, open = Boolean(issueId), expectedBatchId, initialIssue, title, ariaLabel = 'Chi tiết giao dịch xuất kho đối chiếu', description = 'Định danh chính xác bằng mã phiếu; vai trò giao dịch không được suy đoán khi chưa có dữ liệu lưu.', onClose, onOpenBatch }: Props) {
  const detailQuery = useGetReconciliationIssueQuery(issueId ?? '', { skip: !open || !issueId })
  const fetchedIssue = open ? detailQuery.currentData ?? detailQuery.data : undefined
  const issue = fetchedIssue ?? (initialIssue?.issueId === issueId ? initialIssue : undefined)
  const verifiedBatchId = fetchedIssue?.reconciliationBatchId ?? null
  const batchQuery = useGetReconciliationBatchQuery(verifiedBatchId ?? '', { skip: !verifiedBatchId })
  const batch = batchQuery.currentData ?? batchQuery.data
  const linkageMismatch = Boolean(expectedBatchId && issue && issue.reconciliationBatchId !== expectedBatchId)
  const relatedNotes = useMemo(() => collectIssueRelatedNotes(fetchedIssue ?? { lines: [] }, batch), [batch, fetchedIssue])

  return <Drawer open={open} onOpenChange={(nextOpen, reason) => { if (!nextOpen) onClose(reason) }}>
    <DrawerContent aria-label={ariaLabel}>
      <DrawerHeader>
        <DrawerTitle>{title || issue?.issueCode || 'Chi tiết giao dịch xuất kho'}</DrawerTitle>
        <DrawerDescription>{description}</DrawerDescription>
        {detailQuery.isFetching && issue && <p className="mt-2 flex items-center gap-2 text-xs text-slate-600" role="status"><RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />Đang cập nhật dữ liệu chi tiết...</p>}
      </DrawerHeader>

      <DrawerBody>
        {detailQuery.isError && !fetchedIssue && <InlineAlert title="Không tải được chi tiết phiếu" variant="danger"><Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => detailQuery.refetch()}>Thử lại</Button></InlineAlert>}
        {linkageMismatch && <InlineAlert title="Liên kết lô không khớp" variant="danger">Phiếu này không thuộc lô đang mở. Nội dung chi tiết được ẩn để tránh ghép nhầm giao dịch.</InlineAlert>}

        {!issue && detailQuery.isFetching && <div aria-label="Đang tải chi tiết phiếu" role="status" className="space-y-5">
          <div className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-slate-50 p-4" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => <span key={index} className="h-4 animate-pulse rounded bg-slate-200" />)}
          </div>
          <TableViewport ariaLabel="Đang tải các dòng giao dịch" caption="Các dòng giao dịch đang được tải">
            <table className="ipc-data-table"><thead><tr><th scope="col">Nguyên liệu</th><th scope="col" className="text-right">Số đã xuất</th><th scope="col">Đơn vị</th><th scope="col">Chi tiết</th></tr></thead><SkeletonTableRow columns={4} rowCount={6} /></table>
          </TableViewport>
        </div>}

        {issue && !linkageMismatch && <div className="space-y-5">
          <dl className="grid grid-cols-[minmax(9rem,auto)_1fr] gap-x-5 gap-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
            <dt className="text-slate-600">Mã phiếu</dt><dd className="font-medium text-slate-950">{issue.issueCode}</dd>
            <dt className="text-slate-600">ID phiếu</dt><dd className={`${typography.code} break-all text-slate-950`}>{issue.issueId}</dd>
            <dt className="text-slate-600">ID lô đối chiếu</dt><dd className={`${typography.code} break-all text-slate-950`}>{issue.reconciliationBatchId || 'Không có trong dữ liệu đã lưu'}</dd>
            <dt className="text-slate-600">Vai trò</dt><dd className="font-medium text-slate-950">{issueRoleLabel()}</dd>
            <dt className="text-slate-600">Trạng thái</dt><dd className="font-medium text-slate-950">{issueStatusLabel(issue)}</dd>
            <dt className="text-slate-600">Người tạo</dt><dd className="font-medium text-slate-950">{issueActorLabel(issue)}</dd>
            <dt className="text-slate-600">Thời điểm tạo</dt><dd className="font-medium text-slate-950">{formatDateTime(issue.createdAt)}</dd>
            <dt className="text-slate-600">Ngày phiếu</dt><dd className="font-medium text-slate-950">{formatDateOnly(issue.issueDate)}</dd>
            <dt className="text-slate-600">Người nhận</dt><dd className="font-medium text-slate-950">{fetchedIssue ? optionalText(fetchedIssue.receivedByName) : 'Đang cập nhật...'}</dd>
            <dt className="text-slate-600">Thời điểm nhận</dt><dd className="font-medium text-slate-950">{fetchedIssue ? fetchedIssue.receivedAt ? formatDateTime(fetchedIssue.receivedAt) : 'Chưa được ghi nhận' : 'Đang cập nhật...'}</dd>
            <dt className="text-slate-600">Số dòng</dt><dd className="font-medium text-slate-950">{issue.lines.length}</dd>
          </dl>

          <section aria-labelledby="issue-lines-heading">
            <h3 id="issue-lines-heading" className="font-semibold text-slate-950">Dòng giao dịch</h3>
            <TableViewport ariaLabel="Các dòng giao dịch xuất kho" caption="Nguyên liệu, số đã xuất và đơn vị của phiếu">
              <table className="ipc-data-table">
                <thead><tr><th scope="col">Nguyên liệu</th><th scope="col" className="text-right">Số đã xuất</th><th scope="col">Đơn vị</th><th scope="col">Chi tiết</th></tr></thead>
                <tbody>{issue.lines.map((line) => {
                  const batchLine = line.reconciliationBatchLineId
                    ? batch?.lines.find((candidate) => candidate.batchLineId === line.reconciliationBatchLineId)
                    : undefined
                  const ingredientName = line.ingredientName || batchLine?.ingredientName || 'Nguyên liệu chưa đặt tên'
                  const unitLabel = line.unitName || batchLine?.canonicalUnitName || line.unitId
                  return <tr key={line.issueLineId}>
                    <td className="font-medium text-slate-950">{ingredientName}</td>
                    <td className="text-right tabular-nums">{formatQuantityWithUnit(line.issuedQty, '', { maximumFractionDigits: 6 })}</td>
                    <td>{unitLabel}</td>
                    <td>
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-slate-700">Xem mã dòng</summary>
                        <dl className="mt-2 grid gap-1">
                          <dt className="text-slate-500">ID dòng phiếu</dt><dd className={`${typography.code} break-all`}>{line.issueLineId}</dd>
                          <dt className="text-slate-500">ID dòng lô</dt><dd className={`${typography.code} break-all`}>{line.reconciliationBatchLineId || 'Không có trong dữ liệu đã lưu'}</dd>
                        </dl>
                      </details>
                    </td>
                  </tr>
                })}</tbody>
              </table>
            </TableViewport>
          </section>

          {fetchedIssue && <section aria-labelledby="issue-notes-heading">
            <h3 id="issue-notes-heading" className="font-semibold text-slate-950">Lý do và ghi chú liên quan</h3>
            {batchQuery.isFetching && !batch && <p className="mt-2 text-sm text-slate-600" role="status">Đang tải dữ liệu lô...</p>}
            {batchQuery.isError && !batch && <p className="mt-2 text-sm text-red-700" role="alert">Không tải được ghi chú của lô. <Button type="button" variant="link" className="h-auto p-0" onClick={() => batchQuery.refetch()}>Thử lại</Button></p>}
            {batch && <div className="mt-2 space-y-2 text-sm">
              {relatedNotes.notes.length > 0 ? <ul className="list-disc space-y-1 pl-5">{relatedNotes.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p className="text-slate-600">Không có ghi chú liên quan trong lô.</p>}
              <p className="text-xs text-slate-500">Các ghi chú trên thuộc những dòng lô liên kết; dữ liệu hiện tại không lưu quan hệ để khẳng định ghi chú nào thuộc riêng phiếu này.</p>
              {fetchedIssue.lines.map((issueLine) => {
                const line = batch.lines.find((candidate) => candidate.batchLineId === issueLine.reconciliationBatchLineId)
                if (!line?.disposition) return null
                return <div key={issueLine.issueLineId} className="rounded-md bg-slate-50 p-3"><p className="font-medium">{line.ingredientName || issueLine.ingredientName || 'Nguyên liệu chưa đặt tên'}: {dispositionCategoryLabel(line.disposition.category)}</p><p className="mt-1 text-slate-700">{line.disposition.reason}</p><p className="mt-1 text-xs text-slate-500">Kết luận ở cấp dòng lô, không phải phân loại loại phiếu.</p></div>
              })}
            </div>}
          </section>}
        </div>}
      </DrawerBody>

      <DrawerFooter>
        {fetchedIssue && !linkageMismatch && fetchedIssue.reconciliationBatchId && (onOpenBatch
          ? <Button type="button" variant="outline" onClick={() => onOpenBatch(fetchedIssue.reconciliationBatchId!, fetchedIssue.issueId)}>Mở lô đối chiếu <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" /></Button>
          : <a className={buttonVariants({ variant: 'outline' })} href={`${ROUTES.RECONCILIATION}?batchId=${encodeURIComponent(fetchedIssue.reconciliationBatchId)}&issueId=${encodeURIComponent(fetchedIssue.issueId)}`}>Mở lô đối chiếu <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" /></a>)}
        <Button type="button" onClick={() => onClose('close-control')}>Đóng</Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
}
