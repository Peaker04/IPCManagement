import { useDeferredValue, useEffect, useState } from 'react';
import { useGetAuditChangePageQuery, useGetDataQualityPageQuery } from '@/features/reports/reportsApi';
import { toNextReportCursor, type ReportCursor, type WorkflowReportQuery } from '@/api/workflowApiTypes';
import { uiCopy } from '@/lib/uiCopy';
import { formatDateTime } from '@/lib/formatters';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import {
  toReportView,
  type ReportExportConfig,
  type ReportView,
} from './reportsPageModelShared';

type ReportsAuditQualityViewModelArgs = {
  activeView: ReportView;
  initialPage: number;
  operationalPageSize: number;
  reportPageSize: number;
  reportQuery: WorkflowReportQuery;
  sortDirection: 'desc' | 'asc';
};

export function useReportsAuditQualityViewModel({ activeView, initialPage, operationalPageSize, reportPageSize, reportQuery, sortDirection }: ReportsAuditQualityViewModelArgs) {
  const [auditCursors, setAuditCursors] = useState<ReportCursor[]>([]);
  const [dataQualityPage, setDataQualityPage] = useState(initialPage);
  const [dataQualitySearch, setDataQualitySearchState] = useState('');
  const [debouncedDataQualitySearch, setDebouncedDataQualitySearch] = useState('');
  const deferredDataQualitySearch = useDeferredValue(debouncedDataQualitySearch);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => setDebouncedDataQualitySearch(dataQualitySearch.trim()), 300);
    return () => globalThis.clearTimeout(timer);
  }, [dataQualitySearch]);

  const auditCursor = auditCursors.at(-1);
  const auditResult = useGetAuditChangePageQuery({
    ...reportQuery,
    cursorDate: auditCursor?.cursorDate,
    cursorId: auditCursor?.cursorId,
    cursorOffset: auditCursor?.cursorOffset,
    limit: reportPageSize,
    sortDirection,
  }, { skip: activeView !== 'audit' });
  const dataQualityResult = useGetDataQualityPageQuery({
    ...reportQuery,
    pageNumber: dataQualityPage,
    pageSize: operationalPageSize,
    searchKeyword: deferredDataQualitySearch || undefined,
  }, { skip: activeView !== 'data-quality' });
  const auditView = toReportView(auditResult, 'nhật ký thay đổi');
  const dataQualityView = toReportView(dataQualityResult, 'chất lượng dữ liệu');
  const auditRows = auditView.phase === 'ready' ? auditView.data.items : [];
  const dataQualityReport = dataQualityView.phase === 'ready' ? dataQualityView.data : undefined;
  const dataQualityRows = dataQualityReport?.page.items ?? [];
  const openNextAuditPage = () => {
    const nextCursor = auditView.phase === 'ready' && auditView.data.hasNext
      ? toNextReportCursor(auditView.data)
      : null;
    if (nextCursor) setAuditCursors((current) => [...current, nextCursor]);
  };
  const setDataQualitySearch = (value: string) => {
    setDataQualitySearchState(value);
    setDataQualityPage(1);
  };
  const exportConfigs: Record<'audit' | 'data-quality', ReportExportConfig> = {
    audit: {
      filename: 'audit',
      rows: auditRows,
      columns: [
        ['Thời gian', (row) => formatDateTime(row.timestamp)],
        ['Người thực hiện', (row) => row.actor],
        ['Mảng nghiệp vụ', (row) => row.businessArea],
        ['Đối tượng', (row) => row.fieldAffected],
        ['Giá trị cũ', (row) => row.oldValue],
        ['Giá trị mới', (row) => row.newValue],
        ['Lý do', (row) => row.reason],
      ],
    },
    'data-quality': {
      filename: 'data-quality',
      rows: dataQualityRows,
      columns: [
        ['Mức độ', (row) => row.severity],
        ['Hạn xử lý (SLA)', (row) => row.slaLabel],
        ['Mức ưu tiên', (row) => row.priorityRank],
        ['Trạng thái xử lý', (row) => formatWorkflowStatus(row.remediationStatus)],
        [uiCopy.reports.owner, (row) => row.owner],
        ['Nhóm lỗi', (row) => row.category],
        ['Bảng dữ liệu', (row) => row.entityName],
        ['Mã', (row) => row.entityCode],
        ['Đối tượng', (row) => row.entityLabel],
        ['Vấn đề', (row) => row.message],
        ['Cách xử lý', (row) => row.suggestedAction],
        ['Nơi xử lý', (row) => row.route],
      ],
    },
  };

  return {
    auditCursor,
    auditCursors,
    auditResult,
    auditRows,
    dataQualityPage,
    dataQualityReport,
    dataQualityResult,
    dataQualityRows,
    dataQualitySearch,
    exportConfigs,
    openNextAuditPage,
    setAuditCursors,
    setDataQualityPage,
    setDataQualitySearch,
    views: { audit: auditView, 'data-quality': dataQualityView },
  };
}
