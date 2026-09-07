import { History } from 'lucide-react'
import { EmptyState, QueryViewBoundary, SectionPanel, TableViewport } from '@/components/common'
import { formatDateTime } from '@/lib/formatters'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { useListReconciliationSourceChangesQuery } from '@/api/reconciliationApi'
import { presentAudit } from '@/app/pages/admin-data/auditPresentation'

export function ReconciliationSourceChangeLog({ batchId }: { batchId: string }) {
  const query = useListReconciliationSourceChangesQuery(batchId)
  const view = toLabeledQueryView(query, 'nhật ký nguồn lô đối chiếu', { instruction: 'Tải lại lô để xem các thay đổi món, định lượng món, số suất và thực đơn liên quan.' })
  const changes = query.currentData ?? query.data ?? []
  return <details className="rounded-lg border border-slate-200 bg-white">
    <summary className="cursor-pointer list-none p-4 font-semibold text-slate-950"><span className="inline-flex items-center gap-2"><History size={18} aria-hidden="true" />Xem lịch sử thay đổi nguồn ({changes.length})</span></summary>
    <div className="border-t border-slate-200 p-4">
      <SectionPanel title="Lịch sử thay đổi nguồn">
        <p className="text-sm text-slate-600">Chỉ gồm thay đổi của nguồn dùng để tạo đúng lô này. Giao dịch Kho và chẩn đoán sẵn sàng thuộc các khu vực riêng.</p>
        <QueryViewBoundary geometry={changes.length > 0 ? 'table' : 'compact'} queries={[{ label: 'nhật ký nguồn lô đối chiếu', view }]}>
          {changes.length === 0 ? <EmptyState variant="empty" title="Chưa có thay đổi nguồn liên quan" description="Các thay đổi món, định lượng món, số suất hoặc phiên bản thực đơn sẽ xuất hiện khi có cùng định danh nguồn của lô." /> : <TableViewport ariaLabel="Lịch sử thay đổi nguồn lô đối chiếu" caption="Thay đổi nguồn theo ngôn ngữ nghiệp vụ">
            <table className="ipc-data-table"><thead><tr><th scope="col">Thời điểm</th><th scope="col">Hoạt động</th><th scope="col">Trước</th><th scope="col">Sau / kết quả</th><th scope="col">Người thực hiện / lý do</th><th scope="col">Chi tiết</th></tr></thead><tbody>{changes.map((change) => {
              const presentation = presentAudit({ businessArea: change.businessArea, entityName: change.entityName, fieldName: change.fieldName ?? '', oldValue: change.oldValue, newValue: change.newValue, reason: change.reason })
              const technicalValues = [presentation.oldValueTitle, presentation.newValueTitle, presentation.reasonTitle].filter((value): value is string => Boolean(value))
              return <tr key={change.changeId}><td className="whitespace-nowrap">{formatDateTime(change.changedAt)}</td><td className="font-medium text-slate-950">{presentation.action}</td><td className="max-w-48 break-words text-slate-600">{presentation.before}</td><td className="max-w-48 break-words font-medium">{presentation.after}</td><td><strong>{change.actor}</strong><span className="block text-xs text-slate-600">{presentation.reason}</span></td><td><details className="text-xs"><summary className="cursor-pointer font-medium text-slate-700">Xem thông tin kỹ thuật</summary><dl className="mt-2 grid gap-1 break-all text-slate-600"><dt>Phạm vi nguồn</dt><dd>{presentation.technicalTuple}</dd>{technicalValues.map((value, index) => <div key={`${value}-${index}`}><dt>Giá trị lưu</dt><dd>{value}</dd></div>)}</dl></details></td></tr>
            })}</tbody></table>
          </TableViewport>}
        </QueryViewBoundary>
      </SectionPanel>
    </div>
  </details>
}
