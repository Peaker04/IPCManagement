import { useMemo } from 'react'
import { ChevronDown, History } from 'lucide-react'
import { EmptyState, InfoNote, QueryViewBoundary, SectionPanel, TableViewport } from '@/components/common'
import { formatDateOnly, formatDateTime, formatNumber } from '@/lib/formatters'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { useListReconciliationSourceChangesQuery, type ReconciliationSourceChange } from '@/api/reconciliationApi'
import { formatAuditActor, presentAudit } from '@/lib/auditPresentation'
import { formatShiftName } from '@/lib/workflowConfig'

interface SourceChangePresentation {
  action: string
  scopeNote?: string
  before: string
  after: string
  reason: string
}

function buildSourceChangePresentations(changes: ReconciliationSourceChange[]): Map<string, SourceChangePresentation> {
  // Sắp xếp thời gian tăng dần để tái hiện chuỗi giá trị trước -> sau
  const sortedAsc = [...changes].sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime())

  const servingsTracker = new Map<string, number>()
  const presentationMap = new Map<string, SourceChangePresentation>()

  for (const change of sortedAsc) {
    const rawNew = change.newValue?.trim() ?? ''
    const rawOld = change.oldValue?.trim() ?? ''
    const presentation = presentAudit({
      businessArea: change.businessArea,
      entityName: change.entityName,
      fieldName: change.fieldName ?? '',
      oldValue: change.oldValue,
      newValue: change.newValue,
      reason: change.reason,
    })

    const payloadNew = /^(\d{4}-\d{2}-\d{2})\|(MORNING|AFTERNOON)\|(.+)$/.exec(rawNew)
    const payloadOld = /^(\d{4}-\d{2}-\d{2})\|(MORNING|AFTERNOON)\|(.+)$/.exec(rawOld)

    if (payloadNew) {
      const scopeKey = `${payloadNew[1]}|${payloadNew[2]}`
      const newServings = Number(payloadNew[3])
      const previousServings = servingsTracker.get(scopeKey)

      let beforeText = 'Chưa thiết lập'
      if (payloadOld) {
        beforeText = `${formatNumber(Number(payloadOld[3]))} suất`
      } else if (rawOld && !isNaN(Number(rawOld))) {
        beforeText = `${formatNumber(Number(rawOld))} suất`
      } else if (previousServings !== undefined) {
        beforeText = `${formatNumber(previousServings)} suất`
      }

      servingsTracker.set(scopeKey, newServings)

      presentationMap.set(change.changeId, {
        action: presentation.action,
        scopeNote: `${formatShiftName(payloadNew[2])} · ${formatDateOnly(payloadNew[1])}`,
        before: beforeText,
        after: `${formatNumber(newServings)} suất`,
        reason: presentation.reason || change.reason || '—',
      })
      continue
    }

    // Nếu newValue là số thuần túy của số suất
    if (change.fieldName === 'QuickCompleteServings' || change.fieldName === 'QuickForecastServings' || change.businessArea === 'Coordination') {
      const newNum = Number(rawNew)
      const oldNum = Number(rawOld)
      if (!isNaN(newNum) && rawNew !== '') {
        const beforeText = (!isNaN(oldNum) && rawOld !== '') ? `${formatNumber(oldNum)} suất` : 'Chưa thiết lập'
        presentationMap.set(change.changeId, {
          action: presentation.action,
          before: beforeText,
          after: `${formatNumber(newNum)} suất`,
          reason: presentation.reason || change.reason || '—',
        })
        continue
      }
    }

    // Cam kết định lượng nguồn
    if (change.fieldName === 'Commit' || (change.businessArea === 'Reconciliation' && change.entityName === 'QuantityImportBatch')) {
      presentationMap.set(change.changeId, {
        action: 'Cam kết định lượng',
        before: 'Chưa cam kết',
        after: 'Đã cam kết nguồn định lượng',
        reason: presentation.reason || change.reason || '—',
      })
      continue
    }

    // Các trường hợp khác
    let beforeText = presentation.before
    if (beforeText === '—' || !beforeText) {
      beforeText = 'Chưa thiết lập'
    }

    presentationMap.set(change.changeId, {
      action: presentation.action,
      before: beforeText,
      after: presentation.after,
      reason: presentation.reason || change.reason || '—',
    })
  }

  return presentationMap
}

export function ReconciliationSourceChangeLog({ batchId, standalone = false }: { batchId: string; standalone?: boolean }) {
  const query = useListReconciliationSourceChangesQuery(batchId)
  const view = toLabeledQueryView(query, 'nhật ký nguồn lô đối chiếu', { instruction: 'Tải lại lô để xem các thay đổi món, định lượng món, số suất và thực đơn liên quan.' })
  const changes = query.currentData ?? query.data ?? []

  const presentations = useMemo(() => buildSourceChangePresentations(changes), [changes])

  const content = (
    <SectionPanel
      headingLevel={standalone ? 2 : 3}
      title={
        <div className="flex items-center gap-1.5">
          <span>Lịch sử thay đổi nguồn</span>
          <InfoNote
            title="Lịch sử thay đổi nguồn"
            content="Chỉ gồm thay đổi của nguồn dùng để tạo đúng lô này. Giao dịch Kho và chẩn đoán sẵn sàng thuộc các khu vực riêng."
          />
        </div>
      }
    >
      <QueryViewBoundary geometry={changes.length > 0 ? 'table' : 'compact'} queries={[{ label: 'nhật ký nguồn lô đối chiếu', view }]}>
        {changes.length === 0 ? (
          <EmptyState
            variant="empty"
            title="Chưa có thay đổi nguồn liên quan"
            description="Các thay đổi món, định lượng món, số suất hoặc phiên bản thực đơn sẽ xuất hiện khi có cùng định danh nguồn của lô."
          />
        ) : (
          <TableViewport ariaLabel="Lịch sử thay đổi nguồn lô đối chiếu" caption="Thay đổi nguồn theo ngôn ngữ nghiệp vụ">
            <table className="ipc-data-table">
              <thead>
                <tr>
                  <th scope="col">Thời điểm</th>
                  <th scope="col">Hoạt động</th>
                  <th scope="col">Trước</th>
                  <th scope="col">Sau / kết quả</th>
                  <th scope="col">Người thực hiện</th>
                  <th scope="col">Lý do</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((change) => {
                  const pres = presentations.get(change.changeId) ?? {
                    action: 'Cập nhật dữ liệu',
                    before: '—',
                    after: '—',
                    reason: change.reason || '—',
                  }
                  return (
                    <tr key={change.changeId}>
                      <td className="whitespace-nowrap text-slate-600">{formatDateTime(change.changedAt)}</td>
                      <td>
                        <span className="font-medium text-slate-950 block">{pres.action}</span>
                        {pres.scopeNote && (
                          <span className="text-xs text-slate-500 block mt-0.5">{pres.scopeNote}</span>
                        )}
                      </td>
                      <td className="max-w-48 break-words text-slate-600">{pres.before}</td>
                      <td className="max-w-48 break-words font-medium text-slate-950">{pres.after}</td>
                      <td className="whitespace-nowrap font-medium text-slate-800">
                        {formatAuditActor(change.actor)}
                      </td>
                      <td className="max-w-xs break-words text-slate-700">
                        {pres.reason}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableViewport>
        )}
      </QueryViewBoundary>
    </SectionPanel>
  )

  if (standalone) {
    return <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">{content}</div>
  }

  return (
    <details className="group rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold text-slate-950 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <span className="inline-flex items-center gap-2"><History size={18} aria-hidden="true" />Xem lịch sử thay đổi nguồn ({changes.length})</span>
        <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-slate-200 p-4">
        {content}
      </div>
    </details>
  )
}
