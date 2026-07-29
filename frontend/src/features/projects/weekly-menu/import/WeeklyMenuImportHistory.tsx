import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { Input } from '@/components/ui/input'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'
import { formatImportDate } from '../model/formatters'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary'

export function WeeklyMenuImportHistory({ workflow }: { workflow: WeeklyMenuImportWorkflow }) {
  const { history, status, actions } = workflow
  const [search, setSearch] = useState('')
  const filteredHistory = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi-VN')
    if (!needle) return history
    return history.filter((item) => [
      item.customerCode,
      item.customerName,
      item.weekStartDate,
      `v${item.versionNo}`,
      getWorkflowStatusPresentation(item.status).label,
      item.createdByName,
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(needle))
  }, [history, search])

  return (
    <SectionPanel title="Lịch sử import thực đơn tuần">
      <QueryViewBoundary preserveFallback={history.length > 0} queries={[{ label: 'lịch sử import thực đơn tuần', view: workflow.historyDataState }]} refreshLabel="Đang cập nhật lịch sử import">
        <div className="relative mb-3 max-w-md">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm khách hàng, tuần, phiên bản hoặc người tạo"
            aria-label="Tìm trong lịch sử import thực đơn"
            className="pl-9"
          />
        </div>
        <TableViewport caption="Lịch sử import thực đơn tuần" className="max-h-[260px]" ariaLabel="Lịch sử import thực đơn tuần">
          <table className="ipc-data-table">
            <thead>
              <tr>
                <th className="text-left">Khách hàng</th><th className="text-left">Tuần</th><th className="text-center">Phiên bản</th>
                <th className="text-center">Trạng thái</th><th className="text-center">Dòng</th><th className="text-left">Người tạo</th><th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((item) => {
                const label = `${item.customerCode} - tuần ${formatImportDate(item.weekStartDate)} (v${item.versionNo})`
                const statusPresentation = getWorkflowStatusPresentation(item.status)
                return (
                  <tr key={item.menuVersionId}>
                    <td>{item.customerCode} - {item.customerName}</td>
                    <td>{formatImportDate(item.weekStartDate)}</td>
                    <td className="text-center">v{item.versionNo}</td>
                    <td className="text-center"><StatusBadge variant={statusPresentation.tone}>{statusPresentation.label}</StatusBadge></td>
                    <td className="text-center text-xs">
                      {item.successRowCount} thành công{item.errorRowCount > 0 ? ` / ${item.errorRowCount} lỗi` : ''}{item.warningRowCount > 0 ? ` / ${item.warningRowCount} cảnh báo` : ''}
                    </td>
                    <td>{item.createdByName ?? '-'}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => actions.requestRollback(item.menuVersionId, label)}
                        disabled={!item.canRollback || status.isRollingBack}
                        title={item.canRollback ? undefined : item.cannotRollbackReason ?? 'Không thể rollback'}
                        className="ipc-button ipc-button-ghost ipc-button-bounded"
                      >
                        Rollback
                      </button>
                    </td>
                  </tr>
                )
              })}
              {history.length === 0 && (
                <tr><td colSpan={7} className="p-5 text-center text-sm font-medium text-slate-500">Chưa có lịch sử import thực đơn tuần.</td></tr>
              )}
              {history.length > 0 && filteredHistory.length === 0 && (
                <tr><td colSpan={7} className="p-5 text-center text-sm font-medium text-slate-500">Không tìm thấy lịch sử import phù hợp.</td></tr>
              )}
            </tbody>
          </table>
        </TableViewport>
      </QueryViewBoundary>
    </SectionPanel>
  )
}
