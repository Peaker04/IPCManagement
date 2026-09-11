import { useState } from 'react';
import {
  useGetDataQualityPageQuery,
  useUpdateDataQualityIssueRemediationMutation,
} from '@/features/reports/reportsApi';
import type { DataQualityIssueRow } from '@/api/workflowApiTypes';
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
          : 'Mở lại vấn đề từ màn Quản trị dữ liệu.',
      }).unwrap();
      setDataQualityFeedback({
        type: 'success',
        message: action === 'resolve'
          ? 'Đã đánh dấu vấn đề là đã xử lý. Nếu nguyên nhân vẫn còn, vấn đề sẽ tiếp tục xuất hiện để xử lý.'
          : 'Đã mở lại vấn đề để tiếp tục xử lý.',
      });
    } catch (error) {
      setDataQualityFeedback({ type: 'error', message: getMutationErrorMessage(error, 'Chưa cập nhật được trạng thái vấn đề dữ liệu.') });
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
