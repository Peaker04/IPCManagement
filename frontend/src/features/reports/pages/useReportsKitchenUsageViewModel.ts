import { useState } from 'react';
import {
  useGetIssueVsReturnUsagePageQuery,
  useGetKitchenIssuesPageQuery,
  type WorkflowReportQuery,
} from '@/api/workflowApi';
import {
  readPageSize,
  standardPageSizeOptions,
  toReportView,
  type ReportExportConfig,
  type ReportView,
} from './reportsPageModelShared';

type ReportsKitchenUsageViewModelArgs = {
  activeView: ReportView;
  initialPage: number;
  reportQuery: WorkflowReportQuery;
  searchParams: URLSearchParams;
};

export function useReportsKitchenUsageViewModel({ activeView, initialPage, reportQuery, searchParams }: ReportsKitchenUsageViewModelArgs) {
  const [operationalPageSize, setOperationalPageSize] = useState(() => readPageSize(searchParams.get('pageSize'), 8, standardPageSizeOptions));
  const [kitchenPage, setKitchenPage] = useState(initialPage);
  const [usagePage, setUsagePage] = useState(initialPage);
  const kitchenIssueResult = useGetKitchenIssuesPageQuery({ ...reportQuery, pageNumber: kitchenPage, pageSize: operationalPageSize }, { skip: activeView !== 'kitchen' });
  const usageResult = useGetIssueVsReturnUsagePageQuery({ ...reportQuery, pageNumber: usagePage, pageSize: operationalPageSize }, { skip: activeView !== 'usage' });
  const kitchenIssueView = toReportView(kitchenIssueResult, 'xuất kho cho bếp');
  const usageView = toReportView(usageResult, 'sử dụng thực tế');
  const kitchenIssueRows = kitchenIssueView.phase === 'ready' ? kitchenIssueView.data.items : [];
  const usageRows = usageView.phase === 'ready' ? usageView.data.items : [];
  const exportConfigs: Record<'kitchen' | 'usage', ReportExportConfig> = {
    kitchen: {
      filename: 'xuat-bep',
      rows: kitchenIssueRows,
      columns: [
        ['Phiếu xuất', (row) => row.issueCode],
        ['Ngày', (row) => new Date(row.issueDate).toLocaleDateString('vi-VN')],
        ['Ca', (row) => row.shiftName ?? 'Cả ngày'],
        ['Kho', (row) => row.warehouse],
        ['Nguyên liệu', (row) => row.ingredient],
        ['Yêu cầu', (row) => row.requestedQty],
        ['Đã xuất', (row) => row.issuedQty],
        ['Đơn vị', (row) => row.unit],
      ],
    },
    usage: {
      filename: 'su-dung-thuc-te',
      rows: usageRows,
      columns: [
        ['Phiếu xuất', (row) => row.issueCode],
        ['Ngày', (row) => new Date(row.issueDate).toLocaleDateString('vi-VN')],
        ['Ca', (row) => row.shiftName ?? 'Cả ngày'],
        ['Nguyên liệu', (row) => row.ingredient],
        ['Đã xuất', (row) => row.issuedQty],
        ['Hoàn kho', (row) => row.returnedQty],
        ['Đã dùng', (row) => row.usedQty],
        ['Đơn vị', (row) => row.unit],
      ],
    },
  };

  return {
    exportConfigs,
    kitchenIssueResult,
    kitchenIssueRows,
    kitchenPage,
    operationalPageSize,
    setKitchenPage,
    setOperationalPageSize,
    setUsagePage,
    usagePage,
    usageResult,
    usageRows,
    views: { kitchen: kitchenIssueView, usage: usageView },
  };
}
