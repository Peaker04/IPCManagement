import { XCircle } from 'lucide-react';
import { InlineAlert, KeepAliveTabPanel, PaginationBar, PaginatedTableFrame, SectionPanel, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/routeConfig';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';
import { formatDateTime } from '@/lib/formatters';
import { formatDataQualityRemediationStatus, formatPriorityLabel } from '@/lib/workflowConfig';

type AdminCleanupPanelProps = { model: AdminDataPageModel };

export function AdminCleanupPanel({ model }: AdminCleanupPanelProps) {
  const { dataQualityFeedback, dataQualityIssues, dataQualityReport, effectiveActiveView, handleDataQualityRemediation, qualityPage, queryViews, setActiveView, setQualityPage, updateDataQualityIssueRemediationState } = model;
  return (
    <KeepAliveTabPanel id="admin-cleanup" active={effectiveActiveView === 'cleanup'} className="flex flex-col gap-4">
      <SectionPanel
        title="Kiểm tra dữ liệu lỗi"
        icon={<XCircle size={18} />}
        description="Phát hiện và xử lý các điểm dữ liệu bất thường, thiếu liên kết hoặc vi phạm SLA trong hệ thống."
      >
        <AdminQueryBoundary queries={[{ label: 'chất lượng dữ liệu', view: queryViews.dataQuality }]}>
          {dataQualityFeedback && (
            <InlineAlert title={dataQualityFeedback.type === 'success' ? 'Đã cập nhật vấn đề dữ liệu' : 'Chưa cập nhật được vấn đề'} variant={dataQualityFeedback.type === 'success' ? 'info' : 'danger'}>
              {dataQualityFeedback.message}
            </InlineAlert>
          )}

          <PaginatedTableFrame ariaLabel="Bảng vấn đề dữ liệu cần xử lý" className="mt-4">
            <table className="ipc-data-table ipc-erp-grid-table ipc-admin-quality-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Vấn đề</th>
                  <th className="text-center">Ưu tiên</th>
                  <th className="text-center">Trạng thái xử lý</th>
                  <th className="text-left">Phụ trách</th>
                  <th className="text-left">Đối tượng</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dataQualityIssues.length === 0 ? <EmptyRow colSpan={6} /> : dataQualityIssues.map((issue, index) => (
                  <tr key={`${issue.id}-${index}`}>
                    <td className="text-left"><div className="font-semibold text-slate-900">{issue.category}</div><div className="text-xs text-slate-600" title={issue.message}>{issue.message}</div></td>
                    <td className="whitespace-nowrap">
                      <StatusBadge variant={issue.remediationStatus === 'resolved' ? 'success' : issue.severity === 'error' ? 'danger' : 'warning'} className="ipc-table-badge ipc-table-badge--status">
                        {issue.remediationStatus === 'resolved' ? 'Đã xử lý' : issue.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}
                      </StatusBadge>
                      <div className="mt-1 text-xs font-semibold text-slate-700">{issue.slaLabel}</div>
                      <div className="text-xs text-slate-500">{formatPriorityLabel(issue.priorityRank)}</div>
                    </td>
                    <td className="ipc-badge-cell whitespace-nowrap">
                      <StatusBadge variant={issue.remediationStatus === 'resolved' ? 'success' : issue.remediationStatus === 'reopened' ? 'danger' : 'neutral'} className="ipc-table-badge ipc-table-badge--status">
                        {formatDataQualityRemediationStatus(issue.remediationStatus)}
                      </StatusBadge>
                      {issue.remediationAt && (
                        <div className="text-xs text-slate-500">
                          {formatDateTime(issue.remediationAt)}
                        </div>
                      )}
                    </td>
                    <td>{issue.owner}</td>
                    <td>
                      <div className="font-semibold text-slate-900">{issue.entityCode}</div>
                      <div className="text-xs text-slate-500">{issue.entityName} / {issue.entityLabel}</div>
                    </td>
                    <td className="ipc-quality-action-guidance-cell text-right text-slate-600" title={issue.suggestedAction}>
                      <span className="ipc-quality-guidance-copy">{issue.suggestedAction}</span>
                      <Link
                        className="ipc-button ipc-button-ghost ipc-button-bounded ipc-table-action-control"
                        to={issue.categoryCode === 'missing_bom'
                          ? `${ROUTES.ADMIN_DATA}?view=bom-import${issue.entityId ? `&dishId=${encodeURIComponent(issue.entityId)}` : ''}`
                          : issue.route || ROUTES.ADMIN_DATA}
                        onClick={() => {
                          if (issue.categoryCode === 'missing_bom' && issue.entityId) {
                            setActiveView('bom-import');
                          }
                        }}
                      >
                        {issue.actionLabel}
                      </Link>
                      <Button
                        variant="outline"
                        size="xs"
                        className="ipc-table-action-control"
                        type="button"
                        disabled={updateDataQualityIssueRemediationState.isLoading}
                        onClick={() => void handleDataQualityRemediation(issue, issue.remediationStatus === 'resolved' ? 'reopen' : 'resolve')}
                      >
                        {issue.remediationStatus === 'resolved' ? 'Mở lại xử lý' : 'Đánh dấu đã xử lý'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PaginatedTableFrame>
          <PaginationBar
            page={dataQualityReport?.page.pageNumber ?? qualityPage}
            pageSize={dataQualityReport?.page.pageSize ?? 8}
            totalItems={dataQualityReport?.page.totalCount ?? 0}
            onPageChange={setQualityPage}
          />
        </AdminQueryBoundary>
      </SectionPanel>
    </KeepAliveTabPanel>
  );
}
