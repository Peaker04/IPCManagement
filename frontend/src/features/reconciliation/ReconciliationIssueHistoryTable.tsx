import type { ReconciliationIssueHistoryItem } from '@/api/reconciliationApi'
import { TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { formatDateOnly, formatDateTime, formatQuantityWithUnit } from '@/lib/formatters'
import { issueActorLabel, issueRoleLabel, issueStatusLabel } from './reconciliationIssueCorrelation'

export function ReconciliationIssueHistoryTable({ issues, onOpenIssue }: { issues: ReconciliationIssueHistoryItem[]; onOpenIssue: (issueId: string) => void }) {
  return <TableViewport ariaLabel="Lịch sử phiếu xuất của lô đối chiếu" caption="Các phiếu xuất đã tạo cho lô đang chọn">
    <table className="ipc-data-table"><thead><tr><th scope="col">Phiếu xuất</th><th scope="col">Ngày xuất</th><th scope="col" className="text-right">Nguyên liệu</th><th scope="col">Số lượng theo dòng</th><th scope="col">Người lập</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.issueId}>
      <td><strong className="block text-slate-950">{issue.issueCode}</strong><span className="block text-xs text-slate-500">Tạo lúc {formatDateTime(issue.createdAt)}</span><span className="block font-mono text-[11px] text-slate-500">{issue.issueId}</span></td>
      <td>{formatDateOnly(issue.issueDate)}</td>
      <td className="text-right tabular-nums">{issue.lines.length}</td>
      <td><ul className="space-y-1 text-xs">{issue.lines.map((line) => <li key={line.issueLineId}>{line.ingredientName || 'Nguyên liệu chưa đặt tên'}: <span className="tabular-nums">{formatQuantityWithUnit(line.issuedQty, line.unitName ?? line.unitId, { maximumFractionDigits: 6 })}</span></li>)}</ul></td>
      <td>{issueActorLabel(issue)}</td>
      <td><span className="block">{issueStatusLabel(issue)}</span><span className="mt-1 block text-xs text-slate-500">{issueRoleLabel()}</span></td>
      <td><Button type="button" variant="ghost" size="sm" onClick={() => onOpenIssue(issue.issueId)}>Xem giao dịch</Button></td>
    </tr>)}</tbody></table>
  </TableViewport>
}
