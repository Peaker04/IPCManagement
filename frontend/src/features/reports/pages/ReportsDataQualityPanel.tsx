import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  ContextStrip,
  PaginationBar,
  SearchField,
  SectionPanel,
  SkeletonTableRow,
  StatusBadge,
  TableViewport,
} from '@/components/common';
import { formatDataQualityRemediationStatus, formatPriorityLabel } from '@/lib/workflowConfig';
import { uiCopy } from '@/lib/uiCopy';
import { ReportEmptyRow as EmptyRow } from './ReportEmptyRow';
import { standardPageSizeOptions, type ReportsPageModel } from './useReportsPageModel';
import { typography } from '@/lib/typography';

const compactDataQualityCopy = (value: string, fallback: string) => {
  const localized = value
    .replace(/chạy lại generate demand/gi, 'Tính lại nhu cầu')
    .replace(/\bdemand\b/gi, 'nhu cầu')
    .replace(/\bgenerate\b/gi, 'tính lại')
    .replace(/\bpurchase request\b/gi, 'đề xuất mua')
    .replace(/\bactive\b/gi, 'đang hoạt động');
  const primary = localized.split(/[:;。]/, 1)[0]?.trim() || fallback;
  const sentence = primary ? `${primary.charAt(0).toLocaleUpperCase('vi-VN')}${primary.slice(1)}` : fallback;
  return sentence.length > 52 ? `${sentence.slice(0, 49).trimEnd()}…` : sentence;
};

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
    <SectionPanel
      title={uiCopy.reports.preProductionQuality}
      icon={<AlertTriangle size={18} aria-hidden="true" />}
      description="Tổng hợp các điểm dữ liệu bất thường hoặc thiếu định mức trước khi đưa vào vận hành."
      actions={
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <SearchField
            id="report-data-quality-search"
            label="Tìm vấn đề dữ liệu"
            hideLabel
            width="standard"
            value={dataQualitySearch}
            onChange={(event) => {
              setDataQualitySearch(event.target.value);
              setDataQualityPage(1);
            }}
            placeholder="Tìm mã, nhóm lỗi, nội dung..."
          />
          {dataQualitySearch.trim() && (
            <span className={`${typography.caption} whitespace-nowrap text-slate-500`} aria-live="polite">
              {dataQualityResult.data?.page.totalCount ?? 0} kết quả
            </span>
          )}
        </div>
      }
    >
      <div className="mb-4">
        <ContextStrip
          items={[
            { label: uiCopy.reports.error, value: (dataQualityReport?.errorCount ?? 0).toString(), tone: dataQualityReport?.errorCount ? 'danger' : 'success' },
            { label: uiCopy.reports.warning, value: (dataQualityReport?.warningCount ?? 0).toString(), tone: dataQualityReport?.warningCount ? 'warning' : 'success' },
            { label: 'Ưu tiên SLA', value: (dataQualityReport?.urgentIssueCount ?? 0).toString(), tone: dataQualityReport?.urgentIssueCount ? 'danger' : 'success' },
            { label: 'Đã xử lý', value: (dataQualityReport?.resolvedIssueCount ?? 0).toString(), tone: dataQualityReport?.resolvedIssueCount ? 'warning' : 'success' },
          ]}
        />
      </div>
      <TableViewport ariaLabel="Bảng vấn đề dữ liệu trước khi vận hành">
        <table className="ipc-data-table ipc-erp-grid-table ipc-reports-quality-table min-w-[800px]">
          <thead>
            <tr>
              <th className="text-center">Mức độ</th>
              <th>SLA và trạng thái</th>
              <th>{uiCopy.reports.owner}</th>
              <th>Nhóm lỗi và đối tượng</th>
              <th>Vấn đề</th>
              <th>Cách xử lý</th>
              <th className="text-right">Thao tác</th>
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
                  <div
                    className="ipc-quality-sla-cell"
                    title={`${row.slaLabel} · ${formatPriorityLabel(row.priorityRank)} · ${formatDataQualityRemediationStatus(row.remediationStatus)}`}
                  >
                    <span className="min-w-0 truncate font-semibold text-slate-800">
                      {row.slaLabel} · {formatPriorityLabel(row.priorityRank)}
                    </span>
                  <StatusBadge variant={row.remediationStatus === 'resolved' ? 'warning' : row.remediationStatus === 'reopened' ? 'danger' : 'neutral'} className="ipc-table-badge ipc-table-badge--status">
                    {formatDataQualityRemediationStatus(row.remediationStatus)}
                  </StatusBadge>
                  </div>
                </td>
                <td><span className="ipc-quality-owner-cell" title={row.owner}>{row.owner}</span></td>
                <td>
                  <span
                    className="ipc-quality-entity-cell font-medium text-slate-800"
                    title={`${row.category} · ${row.entityLabel} · ${row.entityName} / ${row.entityCode}`}
                  >
                    {compactDataQualityCopy(row.category, 'Vấn đề dữ liệu')} · {row.entityName || row.entityLabel}
                  </span>
                </td>
                <td className="text-left">
                  <span className="ipc-quality-description-cell" title={row.message}>{compactDataQualityCopy(row.message, 'Cần kiểm tra dữ liệu')}</span>
                </td>
                <td className="text-left">
                  <span className="ipc-quality-action-guidance-cell" title={row.suggestedAction}>{compactDataQualityCopy(row.suggestedAction, 'Mở nghiệp vụ liên quan')}</span>
                </td>
                <td className="text-right">
                  {row.route ? (
                    <Link className="ipc-button ipc-button-ghost ipc-button-bounded ipc-table-action-control" to={row.route}>
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
