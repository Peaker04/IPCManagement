import { useState } from 'react';
import {
  useGetDataQualityPageQuery,
  useUpdateDataQualityIssueRemediationMutation,
  type DataQualityIssueRow,
} from '@/api/workflowApi';
import { getMutationErrorMessage, type AdminView } from './adminDataPageTypes';
import { toAdminView } from './adminDataPageModelShared';

export function useAdminCleanupPanelModel(activeView: AdminView, operationalDate: string) {
  const [qualityPage, setQualityPage] = useState(1);
  const [dataQualityFeedback, setDataQualityFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const dataQualityQuery = useGetDataQualityPageQuery(
    { pageNumber: qualityPage, pageSize: 8, serviceDate: operationalDate },
    { skip: activeView !== 'cleanup' },
  );
  const dataQualityView = toAdminView(dataQualityQuery, 'chất lượng dữ liệu');
  const dataQualityReport = dataQualityView.phase === 'ready' ? dataQualityView.data : undefined;
  const [updateDataQualityIssueRemediation, updateDataQualityIssueRemediationState] = useUpdateDataQualityIssueRemediationMutation();
  const dataQualityIssues = dataQualityReport?.page.items ?? [];
  const dataQualityErrorCount = dataQualityReport?.errorCount ?? 0;

  const handleDataQualityRemediation = async (issue: DataQualityIssueRow, action: 'resolve' | 'reopen') => {
    try {
      await updateDataQualityIssueRemediation({
        issueId: issue.id,
        action,
        note: action === 'resolve'
          ? 'Đánh dấu đã xử lý từ màn Quản trị dữ liệu.'
          : 'Mở lại issue từ màn Quản trị dữ liệu.',
      }).unwrap();
      setDataQualityFeedback({
        type: 'success',
        message: action === 'resolve'
          ? 'Đã đánh dấu issue là resolved. Nếu lỗi gốc vẫn còn, issue vẫn nằm trong bảng để xử tiếp.'
          : 'Đã mở lại issue để tiếp tục xử lý.',
      });
    } catch (error) {
      setDataQualityFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa cập nhật được trạng thái data-quality issue.') });
    }
  };

  return {
    queryView: dataQualityView,
    dataQualityErrorCount,
    dataQualityFeedback,
    dataQualityIssues,
    dataQualityReport,
    handleDataQualityRemediation,
    qualityPage,
    setQualityPage,
    updateDataQualityIssueRemediationState,
  };
}
