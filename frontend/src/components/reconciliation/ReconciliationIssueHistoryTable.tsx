import { useMemo } from 'react'
import type { ReconciliationIssueHistoryItem, ReconciliationLine } from '@/api/reconciliationApi'
import { StatusBadge, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatDateOnly, formatQuantityWithUnit } from '@/lib/formatters'
import { issueActorLabel, issueStatusLabel } from '@/lib/reconciliationIssueCorrelation'

export function ReconciliationIssueHistoryTable({
  issues,
  batchLines,
  onOpenIssue,
}: {
  issues: ReconciliationIssueHistoryItem[]
  batchLines?: ReconciliationLine[]
  onOpenIssue: (issue: ReconciliationIssueHistoryItem) => void
}) {
  const batchLineMap = useMemo(() => {
    const map = new Map<string, ReconciliationLine>()
    if (batchLines) {
      for (const line of batchLines) {
        map.set(line.batchLineId, line)
      }
    }
    return map
  }, [batchLines])

  const resolveIngredientInfo = (line: ReconciliationIssueHistoryItem['lines'][number]) => {
    const matched = (line.reconciliationBatchLineId ? batchLineMap.get(line.reconciliationBatchLineId) : undefined)
      ?? (line.ingredientId ? batchLines?.find((item) => item.ingredientId === line.ingredientId) : undefined)
    const ingredientName = line.ingredientName || matched?.ingredientName || 'Nguyên liệu chưa đặt tên'
    const unitLabel = line.unitName || matched?.canonicalUnitName || 'Chưa có tên đơn vị'
    return { ingredientName, unitLabel }
  }

  return (
    <TableViewport ariaLabel="Lịch sử phiếu xuất của lô đối chiếu" caption="Các phiếu xuất đã tạo cho lô đang chọn">
      <table className="ipc-data-table">
        <thead>
          <tr>
            <th scope="col">Phiếu xuất</th>
            <th scope="col">Ngày xuất</th>
            <th scope="col" className="text-right">Số mặt hàng</th>
            <th scope="col">Chi tiết xuất</th>
            <th scope="col">Người lập</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => {
            const previewLines = issue.lines.slice(0, 2)
            const remainingLines = issue.lines.slice(2)
            return (
              <tr key={issue.issueId}>
                <td style={{ verticalAlign: 'top' }}>
                  <strong className="block text-slate-950">{issue.issueCode}</strong>
                </td>
                <td style={{ verticalAlign: 'top' }}>{formatDateOnly(issue.issueDate)}</td>
                <td style={{ verticalAlign: 'top' }} className="text-right tabular-nums">
                  <span className="font-semibold text-slate-900">{issue.lines.length}</span>
                  <span className="ml-1 text-xs text-slate-500">loại</span>
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <ul className="space-y-1 text-xs">
                    {previewLines.map((line) => {
                      const { ingredientName, unitLabel } = resolveIngredientInfo(line)
                      return (
                        <li key={line.issueLineId}>
                          <span className="font-medium text-slate-900">{ingredientName}</span>:{' '}
                          <span className="tabular-nums text-slate-700">
                            {formatQuantityWithUnit(line.issuedQty, unitLabel, { maximumFractionDigits: 6 })}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  {remainingLines.length > 0 && <p className="mt-1 text-xs text-slate-500">+{remainingLines.length} mặt hàng khác</p>}
                </td>
                <td style={{ verticalAlign: 'top' }}>{issueActorLabel(issue)}</td>
                <td style={{ verticalAlign: 'top' }}>
                  <StatusBadge variant={issue.receivedAt ? 'success' : 'info'} size="sm">
                    {issueStatusLabel(issue)}
                  </StatusBadge>
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <Button type="button" variant="outline" size="sm" onClick={() => onOpenIssue(issue)}>
                    Xem giao dịch
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableViewport>
  )
}
