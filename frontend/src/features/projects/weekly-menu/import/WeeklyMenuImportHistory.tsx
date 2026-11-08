import { PaginationBar, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'
import { formatImportDate } from '../model/formatters'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary'

export function WeeklyMenuImportHistory({ workflow }: { workflow: WeeklyMenuImportWorkflow }) {
  const { history, historyPage, historyPageInfo, setHistoryPage, status, actions } = workflow

  return (
    <SectionPanel
      title="Lịch sử import thực đơn tuần"
      description="Danh sách các phiên import thực đơn đã thực hiện, trạng thái và khả năng hủy phiên."
    >
      <QueryViewBoundary preserveFallback={history.length > 0} queries={[{ label: 'lịch sử import thực đơn tuần', view: workflow.historyDataState }]} refreshLabel="Đang cập nhật lịch sử import">
        <TableViewport caption="Lịch sử import thực đơn tuần" className="max-h-[260px]" ariaLabel="Lịch sử import thực đơn tuần" frozenFirstIdentifier={false}>
          <table className="ipc-data-table table-fixed">
            <thead>
              <tr>
                <th className="text-left">Khách hàng</th><th className="text-left">Tuần</th><th className="text-center">Phiên bản</th>
                <th className="text-center">Trạng thái</th><th className="text-center">Dòng</th><th className="text-left">Người tạo</th><th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => {
                const label = `${item.customerCode} - tuần ${formatImportDate(item.weekStartDate)} (v${item.versionNo})`
                const statusPresentation = getWorkflowStatusPresentation(item.status)
                return (
                  <tr key={item.menuVersionId}>
                    <td>{item.customerCode} - {item.customerName}</td>
                    <td>{formatImportDate(item.weekStartDate)}</td>
                    <td className="text-center">v{item.versionNo}</td>
                    <td className="text-center"><StatusBadge variant={statusPresentation.tone}>{statusPresentation.label}</StatusBadge></td>
                    <td className="text-center text-xs tabular-nums">
                      {item.successRowCount} thành công{item.errorRowCount > 0 ? ` / ${item.errorRowCount} lỗi` : ''}{item.warningRowCount > 0 ? ` / ${item.warningRowCount} cảnh báo` : ''}
                    </td>
                    <td>{item.createdByName ?? '-'}</td>
                    <td className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => actions.requestRollback(item.menuVersionId, label)}
                        disabled={!item.canRollback || status.isRollingBack}
                        title={item.canRollback ? undefined : item.cannotRollbackReason ?? 'Không thể hủy phiên import'}
                      >
                        Hủy phiên
                      </Button>
                    </td>
                  </tr>
                )
              })}
              {history.length === 0 && (
                <tr><td colSpan={7} className="p-5 text-center text-sm font-medium text-slate-500">Chưa có lịch sử import thực đơn tuần.</td></tr>
              )}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar
          page={historyPage}
          pageSize={historyPageInfo?.pageSize ?? 8}
          totalItems={historyPageInfo?.totalCount ?? 0}
          onPageChange={setHistoryPage}
        />
      </QueryViewBoundary>
    </SectionPanel>
  )
}
