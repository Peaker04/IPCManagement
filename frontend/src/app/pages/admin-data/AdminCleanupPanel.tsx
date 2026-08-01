import { XCircle } from 'lucide-react';
import { ContextStrip, InlineAlert, PaginationBar, PaginatedTableFrame, SectionPanel, StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/lib/routeConfig';
import { AdminEmptyRow as EmptyRow } from './AdminEmptyRow';
import type { AdminDataPageModel } from './useAdminDataPageModel';
import { AdminQueryBoundary } from './AdminQueryBoundary';
import { formatDateTime } from '@/lib/formatters';

type AdminCleanupPanelProps = { model: AdminDataPageModel };

export function AdminCleanupPanel({ model }: AdminCleanupPanelProps) {
  const { dataQualityErrorCount, dataQualityFeedback, dataQualityIssues, dataQualityReport, effectiveActiveView, handleDataQualityRemediation, qualityPage, queryViews, setActiveView, setQualityPage, updateDataQualityIssueRemediationState } = model;
  return (
    <>
      {effectiveActiveView === 'cleanup' && (
        <div id="admin-cleanup-panel" role="tabpanel" aria-labelledby="admin-cleanup-tab" className="flex flex-col gap-4">
          <SectionPanel title="Kiểm tra dữ liệu lỗi" icon={<XCircle size={18} />}>
            <AdminQueryBoundary queries={[{ label: 'chất lượng dữ liệu', view: queryViews.dataQuality }]}>
            <ContextStrip
              items={[
                { label: 'Tổng lỗi', value: `${dataQualityErrorCount}`, tone: dataQualityErrorCount ? 'danger' : 'success' },
                { label: 'Thiếu BOM', value: `${dataQualityReport?.missingBomCount ?? 0}`, tone: (dataQualityReport?.missingBomCount ?? 0) ? 'danger' : 'success' },
                { label: 'Unit/quy đổi', value: `${(dataQualityReport?.invalidUnitCount ?? 0) + (dataQualityReport?.missingConversionCount ?? 0)}`, tone: ((dataQualityReport?.invalidUnitCount ?? 0) + (dataQualityReport?.missingConversionCount ?? 0)) ? 'danger' : 'success' },
                { label: 'Tồn âm', value: `${dataQualityReport?.negativeStockCount ?? 0}`, tone: (dataQualityReport?.negativeStockCount ?? 0) ? 'danger' : 'success' },
                { label: 'Phiếu orphan', value: `${dataQualityReport?.orphanDocumentCount ?? 0}`, tone: (dataQualityReport?.orphanDocumentCount ?? 0) ? 'warning' : 'success' },
                { label: 'SLA gấp', value: `${dataQualityReport?.urgentIssueCount ?? 0}`, tone: (dataQualityReport?.urgentIssueCount ?? 0) ? 'danger' : 'success' },
                { label: 'Đã xử lý', value: `${dataQualityReport?.resolvedIssueCount ?? 0}`, tone: 'success' },
              ]}
            />

            {dataQualityFeedback && (
              <InlineAlert title={dataQualityFeedback.type === 'success' ? 'Đã cập nhật data-quality issue' : 'Chưa cập nhật được issue'} variant={dataQualityFeedback.type === 'success' ? 'info' : 'danger'}>
                {dataQualityFeedback.message}
              </InlineAlert>
            )}

            <PaginatedTableFrame ariaLabel="Bảng vấn đề dữ liệu cần xử lý" className="mt-4">
              <table className="ipc-data-table ipc-admin-quality-table text-sm">
                <thead>
                  <tr>
                    <th>Nhóm lỗi</th>
                    <th>Mức</th>
                    <th>SLA</th>
                    <th>Trạng thái xử lý</th>
                    <th>Owner</th>
                    <th>Đối tượng</th>
                    <th className="text-left">Mô tả</th>
                    <th className="text-left">Cách xử lý</th>
                    <th>Đi tới</th>
                    <th>Resolve</th>
                  </tr>
                </thead>
                <tbody>
                  {dataQualityIssues.length === 0 ? <EmptyRow colSpan={10} /> : dataQualityIssues.map((issue, index) => (
                    <tr key={`${issue.id}-${index}`}>
                      <td className="font-semibold">{issue.category}</td>
                      <td>
                        <StatusBadge variant={issue.remediationStatus === 'resolved' ? 'success' : issue.severity === 'error' ? 'danger' : 'warning'}>
                          {issue.remediationStatus === 'resolved' ? 'Đã xử lý' : issue.severity === 'error' ? 'Lỗi' : 'Cảnh báo'}
                        </StatusBadge>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900">{issue.slaLabel}</div>
                        <div className="text-xs text-slate-500">Priority {issue.priorityRank}</div>
                      </td>
                      <td>
                        <StatusBadge variant={issue.remediationStatus === 'resolved' ? 'success' : issue.remediationStatus === 'reopened' ? 'danger' : 'neutral'}>
                          {issue.remediationStatus === 'resolved' ? 'Đã xử lý' : issue.remediationStatus === 'reopened' ? 'Reopened' : 'Open'}
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
                      <td className="ipc-quality-description-cell text-left text-slate-700">{issue.message}</td>
                      <td className="ipc-quality-action-guidance-cell text-left text-slate-600">{issue.suggestedAction}</td>
                      <td className="ipc-row-action-cell">
                        <Link
                          className="ipc-button ipc-button-ghost ipc-button-bounded ipc-table-action-control"
                          to={issue.category === 'missing_bom'
                            ? `${ROUTES.ADMIN_DATA}?view=bom-import${issue.entityId ? `&dishId=${encodeURIComponent(issue.entityId)}` : ''}`
                            : issue.route || ROUTES.ADMIN_DATA}
                          onClick={() => {
                            if (issue.category === 'missing_bom' && issue.entityId) {
                              setActiveView('bom-import');
                            }
                          }}
                        >
                          Sửa
                        </Link>
                      </td>
                      <td className="ipc-row-action-cell">
                        <Button
                          variant="outline"
                          size="xs"
                          className="ipc-table-action-control"
                          type="button"
                          disabled={updateDataQualityIssueRemediationState.isLoading}
                          onClick={() => void handleDataQualityRemediation(issue, issue.remediationStatus === 'resolved' ? 'reopen' : 'resolve')}
                        >
                          {issue.remediationStatus === 'resolved' ? 'Reopen' : 'Resolve'}
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
        </div>
      )}


    </>
  );
}
