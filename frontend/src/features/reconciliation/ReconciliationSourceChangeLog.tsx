import { History } from 'lucide-react'
import { EmptyState, QueryViewBoundary, SectionPanel, TableViewport } from '@/components/common'
import { formatDateTime } from '@/lib/formatters'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { useListReconciliationSourceChangesQuery } from '@/api/reconciliationApi'

const sourceLabel = (area: string, entity: string) => {
  const value = `${area} ${entity}`.toLowerCase()
  if (value.includes('dish') || value.includes('menuitem')) return 'Món ăn'
  if (value.includes('bom')) return 'BOM'
  if (value.includes('quantity') || value.includes('serving')) return 'Số suất'
  if (value.includes('menu')) return 'Thực đơn'
  if (value.includes('inventoryissue')) return 'Phiếu xuất kho'
  return 'Nguồn đối chiếu'
}

export function ReconciliationSourceChangeLog({ batchId }: { batchId: string }) {
  const query = useListReconciliationSourceChangesQuery(batchId)
  const view = toLabeledQueryView(query, 'nhật ký nguồn lô đối chiếu', { instruction: 'Tải lại lô để xem các thay đổi món, BOM, số suất và thực đơn liên quan.' })
  const changes = query.currentData ?? query.data ?? []
  return <SectionPanel title="Nhật ký thay đổi nguồn" description="Theo đúng lô đang chọn; lô đã đóng băng không bị tính lại khi nguồn dùng chung thay đổi." icon={<History size={18} aria-hidden="true" />}>
    <QueryViewBoundary geometry={changes.length > 0 ? 'table' : 'compact'} queries={[{ label: 'nhật ký nguồn lô đối chiếu', view }]}>
      {changes.length === 0 ? <EmptyState variant="empty" title="Chưa có thay đổi nguồn liên quan" description="Các thay đổi món, BOM, số suất hoặc phiên bản thực đơn sẽ xuất hiện tại đây khi có cùng định danh nguồn của lô." /> : <TableViewport ariaLabel="Nhật ký thay đổi nguồn lô đối chiếu" caption="Nhật ký thay đổi món, BOM, số suất và thực đơn">
        <table className="ipc-data-table"><thead><tr><th scope="col">Thời điểm</th><th scope="col">Nguồn</th><th scope="col">Trường</th><th scope="col">Trước</th><th scope="col">Sau</th><th scope="col">Người thực hiện / lý do</th></tr></thead><tbody>{changes.map((change) => <tr key={change.changeId}><td className="whitespace-nowrap">{formatDateTime(change.changedAt)}</td><td><strong>{sourceLabel(change.businessArea, change.entityName)}</strong><span className="block text-xs text-slate-500" title={change.entityId ?? undefined}>{change.entityName}</span></td><td>{change.fieldName || 'Cập nhật'}</td><td className="max-w-48 break-words text-slate-600" title={change.oldValue ?? undefined}>{change.oldValue || '—'}</td><td className="max-w-48 break-words font-medium" title={change.newValue ?? undefined}>{change.newValue || '—'}</td><td><strong>{change.actor}</strong><span className="block text-xs text-slate-600">{change.reason || 'Không ghi lý do riêng'}</span></td></tr>)}</tbody></table>
      </TableViewport>}
    </QueryViewBoundary>
  </SectionPanel>
}
