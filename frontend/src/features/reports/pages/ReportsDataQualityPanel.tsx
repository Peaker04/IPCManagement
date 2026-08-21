import { AlertTriangle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ContextStrip,
  PaginationBar,
  SectionPanel,
  SkeletonTableRow,
  StatusBadge,
  TableViewport,
} from '@/components/common';
import { Input } from '@/components/ui/input';
import { formatDataQualityRemediationStatus, formatPriorityLabel } from '@/lib/workflowConfig';
import { uiCopy } from '@/lib/uiCopy';
import { ReportEmptyRow as EmptyRow } from './ReportEmptyRow';
import { standardPageSizeOptions, type ReportsPageModel } from './useReportsPageModel';
import { typography } from '@/lib/typography';
import { cn } from '@/lib/utils';

export const ReportsDataQualityPanel = ({ model }: { model: ReportsPageModel }) => {
  const {
    dataQualityPage,
    dataQualityReport,
    dataQualityResult,
    dataQualityRows,
    dataQualitySearch,
    operationalPageSize,
    setDataQualityPage,
    setDataQualitySearch,
    setNumberedPage,
    setNumberedPageSize,
    setOperationalPageSize,
  } = model;

  return (
    <SectionPanel title={uiCopy.reports.preProductionQuality} icon={<AlertTriangle size={18} />}>
      <ContextStrip
        items={[
          { label: 'Tổng vấn đề', value: (dataQualityReport?.totalIssues ?? 0).toString(), tone: dataQualityRows.length ? 'warning' : 'success' },
          { label: uiCopy.reports.error, value: (dataQualityReport?.errorCount ?? 0).toString(), tone: dataQualityReport?.errorCount ? 'danger' : 'success' },
          { label: uiCopy.reports.warning, value: (dataQualityReport?.warningCount ?? 0).toString(), tone: dataQualityReport?.warningCount ? 'warning' : 'success' },
          { label: 'Vấn đề ưu tiên SLA', value: (dataQualityReport?.urgentIssueCount ?? 0).toString(), tone: dataQualityReport?.urgentIssueCount ? 'danger' : 'success' },
          { label: uiCopy.reports.resolvedWithIssues, value: (dataQualityReport?.resolvedIssueCount ?? 0).toString(), tone: dataQualityReport?.resolvedIssueCount ? 'warning' : 'success' },
          { label: 'Thiếu định lượng', value: (dataQualityReport?.missingBomCount ?? 0).toString(), tone: dataQualityReport?.missingBomCount ? 'warning' : 'success' },
          { label: 'Thiếu quy đổi', value: (dataQualityReport?.missingConversionCount ?? 0).toString(), tone: dataQualityReport?.missingConversionCount ? 'warning' : 'success' },
        ]}
      />
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <label className={cn(typography.label, 'grid min-w-[280px] flex-1 gap-1 text-slate-600')} htmlFor="report-data-quality-search">
          Tìm vấn đề dữ liệu
          <div className="relative max-w-xl">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="report-data-quality-search"
              type="search"
              value={dataQualitySearch}
              onChange={(event) => {
                setDataQualitySearch(event.target.value);
                setDataQualityPage(1);
              }}
              placeholder="Mã, đối tượng, nhóm lỗi, người phụ trách hoặc nội dung"
              className="h-9 bg-white pl-9"
            />
          </div>
        </label>
        {dataQualitySearch.trim() && (
          <span className={cn(typography.caption, 'pb-2 text-slate-500')} aria-live="polite">
            {dataQualityResult.data?.page.totalCount ?? 0} kết quả
          </span>
        )}
      </div>
      <TableViewport ariaLabel="Bảng vấn đề dữ liệu trước khi vận hành">
        <table className="ipc-data-table ipc-reports-quality-table">
          <thead>
            <tr>
              <th>Mức độ</th>
              <th>SLA và trạng thái</th>
              <th>{uiCopy.reports.owner}</th>
              <th>Nhóm lỗi và đối tượng</th>
              <th>Vấn đề</th>
              <th>Cách xử lý</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          {dataQualityResult.isLoading && dataQualityRows.length === 0 ? (
            <SkeletonTableRow columns={7} rowCount={8} />
          ) : <tbody>
            {dataQualityRows.length === 0
              ? dataQualitySearch.trim()
                ? <tr><td colSpan={7} className="py-8 text-center text-slate-500">Không tìm thấy vấn đề dữ liệu phù hợp.</td></tr>
                : <EmptyRow colSpan={7} />
              : dataQualityRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <StatusBadge variant={row.severity === 'error' ? 'danger' : 'warning'} className="ipc-table-badge ipc-table-badge--status">
                    {row.severity === 'error' ? uiCopy.reports.error : uiCopy.reports.warning}
                  </StatusBadge>
                </td>
                <td>
                  <div className="font-semibold text-slate-800">{row.slaLabel}</div>
                  <div className={cn(typography.caption, 'text-slate-500')}>{formatPriorityLabel(row.priorityRank)}</div>
                  <StatusBadge variant={row.remediationStatus === 'resolved' ? 'warning' : row.remediationStatus === 'reopened' ? 'danger' : 'neutral'} className="ipc-table-badge ipc-table-badge--status">
                    {formatDataQualityRemediationStatus(row.remediationStatus)}
                  </StatusBadge>
                </td>
                <td>{row.owner}</td>
                <td>
                  <div className="font-medium text-slate-800">{row.category}</div>
                  <div className="font-medium text-slate-800">{row.entityLabel}</div>
                  <div className={cn(typography.caption, 'text-slate-500')}>{row.entityName} / {row.entityCode}</div>
                </td>
                <td className="ipc-quality-description-cell text-left" title={row.message}>{row.message}</td>
                <td className="ipc-quality-action-guidance-cell text-left" title={row.suggestedAction}>{row.suggestedAction}</td>
                <td>
                  {row.route ? (
                    <Link className="ipc-button ipc-button-ghost ipc-button-bounded" to={row.route}>
                      {row.actionLabel}
                    </Link>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>}
        </table>
      </TableViewport>
      <PaginationBar
        page={dataQualityResult.data?.page.pageNumber ?? dataQualityPage}
        pageSize={dataQualityResult.data?.page.pageSize ?? operationalPageSize}
        totalItems={dataQualityResult.data?.page.totalCount ?? 0}
        itemLabel="vấn đề dữ liệu"
        isPending={dataQualityResult.isFetching}
        pageSizeOptions={standardPageSizeOptions}
        onPageSizeChange={(nextSize) => setNumberedPageSize(setDataQualityPage, setOperationalPageSize, nextSize)}
        onPageChange={(nextPage) => setNumberedPage(setDataQualityPage, nextPage)}
      />
    </SectionPanel>
  );
};
