import { SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { formatImportDate } from '../model/formatters'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

export function WeeklyMenuImportHistory({ workflow }: { workflow: WeeklyMenuImportWorkflow }) {
  const { history, status, actions } = workflow
  return (
    <SectionPanel title="Lịch sử import thực đơn tuần">
      <TableViewport caption="Lịch sử import thực đơn tuần" className="max-h-[260px]" ariaLabel="Lịch sử import thực đơn tuần">
        <table className="ipc-data-table">
          <thead>
            <tr>
              <th className="text-left">Khách hàng</th><th className="text-left">Tuần</th><th className="text-center">Phiên bản</th>
              <th className="text-center">Trạng thái</th><th className="text-center">Dòng</th><th className="text-left">Người tạo</th><th className="text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => {
              const label = `${item.customerCode} - tuần ${formatImportDate(item.weekStartDate)} (v${item.versionNo})`
              return (
                <tr key={item.menuVersionId}>
                  <td>{item.customerCode} - {item.customerName}</td>
                  <td>{formatImportDate(item.weekStartDate)}</td>
                  <td className="text-center">v{item.versionNo}</td>
                  <td className="text-center"><StatusBadge variant={item.status === 'DRAFT' ? 'success' : item.status === 'ROLLED_BACK' ? 'danger' : 'neutral'}>{item.status}</StatusBadge></td>
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
            {history.length === 0 && <tr><td colSpan={7} className="p-5 text-center text-sm font-medium text-slate-500">Chưa có lịch sử import thực đơn tuần.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
    </SectionPanel>
  )
}
