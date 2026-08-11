import { ClipboardList } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EmptyState, PaginationBar, SectionPanel, StatusBadge, TableViewport } from '@/components/common';
import { useGetServiceRunPageQuery } from '@/api/workflowApi';
import { getServiceRunStatusPresentation } from '@/lib/workflowConfig';
import { readStoredAuthSnapshot } from '@/lib/auth/authStorage';
import type { TablePreferenceConfig } from '@/components/common/tablePreferences';

type Props = { dateFrom: string; dateTo: string; shiftName: string };
const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);

const serviceRunPreferenceConfig: TablePreferenceConfig = {
  tableId: 'service-run-report',
  columns: [
    { id: 'plan', label: 'KHSX / ca', locked: true },
    { id: 'status', label: 'Trạng thái' },
    { id: 'blocker', label: 'Blocker' },
    { id: 'demand', label: 'Nhu cầu' },
    { id: 'issue', label: 'Xuất / trả' },
    { id: 'supplemental', label: 'Bổ sung' },
    { id: 'cost', label: 'Chi phí' },
    { id: 'servings', label: 'Suất' },
  ],
};

export function ServiceRunReportPanel({ dateFrom, dateTo, shiftName }: Props) {
  const [page, setPage] = useState(1);
  const currentAccountId = readStoredAuthSnapshot().user?.id;
  const serviceDate = dateFrom && dateFrom === dateTo ? dateFrom : undefined;
  const { data, isFetching, isError, refetch } = useGetServiceRunPageQuery({ pageNumber: page, pageSize: 20, serviceDate, shiftName: shiftName || undefined });
  const rows = data?.items ?? [];

  return <SectionPanel title="Ca phục vụ và chứng từ nguồn" icon={<ClipboardList size={18} />} description="Trạng thái do backend tính từ KHSX, nhu cầu, phiếu xuất/trả và cấp bổ sung. Ca đã đóng dùng snapshot tại thời điểm close; legacy chưa có snapshot được ghi rõ.">
    {isError ? <EmptyState variant="error" title="Không tải được Ca phục vụ" description="Không thể kết luận tình trạng đóng ca khi projection chứng từ nguồn chưa tải được." onRetry={() => void refetch()} isRetrying={isFetching} /> : <>
      <TableViewport ariaLabel="Bảng Ca phục vụ" caption="Các chứng từ nguồn được hiển thị theo từng Ca, không gộp theo tên nguyên liệu." preferences={{ accountId: currentAccountId, config: serviceRunPreferenceConfig }}>
        {({ columns }) => <table className="ipc-data-table ipc-status-action-table min-w-[1080px]">
          <thead><tr>{columns.map((column) => <th scope="col" key={column.id}>{column.label}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={columns.length} className="py-8 text-center text-slate-600">Chưa có Ca phục vụ trong phạm vi đang lọc.</td></tr> : rows.map((row) => {
              const { lifecycle, materialRequestCodes, issueCodes, returnCodes, supplementalRequestCodes, materialRequestLineIds, issueLineIds, estimatedPurchaseCost, actualReceivedCost, isCloseSnapshot } = row;
              const statusPresentation = getServiceRunStatusPresentation(lifecycle.status);
              const cells: Record<string, ReactNode> = {
                plan: <><div className="font-medium text-slate-800">{lifecycle.planCode}</div><div className="text-xs text-slate-500">{lifecycle.shiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'}{lifecycle.status === 'CLOSED' ? (isCloseSnapshot ? ' · Snapshot đóng ca' : ' · Legacy: dữ liệu live') : ''}</div></>,
                status: <StatusBadge variant={statusPresentation.tone}>{statusPresentation.label}</StatusBadge>,
                blocker: <span className="max-w-64 text-xs">{lifecycle.blockers.length ? lifecycle.blockers.join(' · ') : '—'}</span>,
                demand: <span className="text-xs">{materialRequestCodes.join(', ') || '—'}<span className="mt-1 block text-slate-500">{materialRequestLineIds.length} source-line</span></span>,
                issue: <span className="text-xs">{[...issueCodes, ...returnCodes].join(', ') || '—'}<span className="mt-1 block text-slate-500">{issueLineIds.length} source-line</span></span>,
                supplemental: <span className="text-xs">{supplementalRequestCodes.join(', ') || '—'}</span>,
                cost: <span className="text-right text-xs tabular-nums"><span className="block">Chi phí mua ước tính: {formatCurrency(estimatedPurchaseCost ?? 0)}</span><span className="mt-1 block text-slate-500">Chi phí mua thực nhận: {actualReceivedCost == null ? 'Chưa phát sinh nhập' : formatCurrency(actualReceivedCost)}</span></span>,
                servings: <span className="ipc-numeric-cell tabular-nums">{lifecycle.actualServings ?? '—'} / {lifecycle.plannedServings}</span>,
              };
              return <tr key={lifecycle.serviceRunId}>{columns.map((column) => <td key={column.id}>{cells[column.id]}</td>)}</tr>;
            })}
          </tbody>
        </table>}
      </TableViewport>
      <PaginationBar page={data?.pageNumber ?? page} pageSize={data?.pageSize ?? 20} totalItems={data?.totalCount ?? 0} onPageChange={setPage} />
    </>}
  </SectionPanel>;
}
