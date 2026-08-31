import { ClipboardList } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EmptyState, PaginationBar, SectionPanel, StatusBadge, TableViewport } from '@/components/common';
import { useGetServiceRunPageQuery, useGetServiceRunAdjustmentsQuery } from '@/api/chefApi';
import { formatServiceRunBlocker, getServiceRunStatusPresentation } from '@/lib/workflowConfig';
import { readStoredAuthSnapshot } from '@/lib/auth/authStorage';
import { formatCurrency } from '@/lib/formatters';
import type { TablePreferenceConfig } from '@/components/common/tablePreferences';

type Props = { dateFrom: string; dateTo: string; shiftName: string };

const serviceRunPreferenceConfig: TablePreferenceConfig = {
  tableId: 'service-run-report',
  columns: [
    { id: 'plan', label: 'KHSX / ca', locked: true },
    { id: 'status', label: 'Trạng thái' },
    { id: 'blocker', label: 'Điều kiện chặn' },
    { id: 'demand', label: 'Nhu cầu' },
    { id: 'issue', label: 'Xuất / trả' },
    { id: 'supplemental', label: 'Bổ sung' },
    { id: 'cost', label: 'Chi phí' },
    { id: 'servings', label: 'Suất' },
    { id: 'correction', label: 'Điều chỉnh hậu kiểm' },
  ],
};

function CorrectionOverlay({ serviceRunId, snapshotActual, isCloseSnapshot }: { serviceRunId: string; snapshotActual: number | null | undefined; isCloseSnapshot: boolean }) {
  const { data: adjustments, isLoading, isFetching, isError } = useGetServiceRunAdjustmentsQuery(serviceRunId, { skip: !isCloseSnapshot });
  if (!isCloseSnapshot) return <span className="text-xs text-slate-500">Không có snapshot đóng ca (legacy).</span>;
  if (isLoading) return <span className="block min-h-10 text-xs text-slate-500" role="status">Đang tải điều chỉnh hậu kiểm…</span>;
  if (isError) return <span className="text-xs text-red-700" role="alert">Không tải được điều chỉnh hậu kiểm; snapshot đóng ca vẫn được giữ riêng.</span>;
  const latest = adjustments?.[0];
  if (!latest) return <span className="block min-h-10 text-xs text-slate-500" data-refreshing={isFetching || undefined}>Không có điều chỉnh hậu kiểm.</span>;
  const delta = latest.correctedActualServings - (snapshotActual ?? 0);
  return <span className="block min-h-10 text-xs" data-refreshing={isFetching || undefined} aria-busy={isFetching || undefined}><span className="block font-medium text-slate-800">Điều chỉnh hậu kiểm · {latest.correctedActualServings} suất ({delta >= 0 ? '+' : ''}{delta})</span><span className="block text-slate-500">{latest.reason}</span></span>;
}

export function ServiceRunReportPanel({ dateFrom, dateTo, shiftName }: Props) {
  const [page, setPage] = useState(1);
  const currentAccountId = readStoredAuthSnapshot().user?.id;
  const serviceDate = dateFrom && dateFrom === dateTo ? dateFrom : undefined;
  const { data, isFetching, isError, refetch } = useGetServiceRunPageQuery({ pageNumber: page, pageSize: 20, serviceDate, shiftName: shiftName || undefined });
  const rows = data?.items ?? [];

  return <SectionPanel title="Ca phục vụ và chứng từ nguồn" icon={<ClipboardList size={18} />} description="Trạng thái được tổng hợp từ kế hoạch sản xuất, nhu cầu, phiếu xuất/trả và cấp bổ sung. Bản chốt đóng ca được giữ nguyên; điều chỉnh hậu kiểm luôn hiển thị tách riêng, không mở lại ca.">
    {isError ? <EmptyState variant="error" title="Không tải được Ca phục vụ" description="Không thể kết luận tình trạng đóng ca khi projection chứng từ nguồn chưa tải được." onRetry={() => void refetch()} isRetrying={isFetching} /> : <>
      <TableViewport ariaLabel="Bảng Ca phục vụ" caption="Các chứng từ nguồn được hiển thị theo từng Ca, không gộp theo tên nguyên liệu." preferences={{ accountId: currentAccountId, config: serviceRunPreferenceConfig }}>
        {({ columns }) => <table className="ipc-data-table ipc-erp-grid-table table-fixed w-full min-w-[1240px]">
          <thead><tr>{columns.map((column) => <th scope="col" key={column.id} className={column.id === 'cost' || column.id === 'servings' ? 'text-right' : column.id === 'status' ? 'text-center' : 'text-left'}>{column.label}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={columns.length} className="py-8 text-center text-slate-500">Chưa có Ca phục vụ trong phạm vi đang lọc.</td></tr> : rows.map((row) => {
              const { lifecycle, materialRequestCodes, issueCodes, returnCodes, supplementalRequestCodes, materialRequestLineIds, issueLineIds, estimatedPurchaseCost, actualReceivedCost, isCloseSnapshot } = row;
              const statusPresentation = getServiceRunStatusPresentation(lifecycle.status);
              const cells: Record<string, ReactNode> = {
                plan: <><div className="font-medium text-slate-800">{lifecycle.planCode}</div><div className="text-xs text-slate-500">{lifecycle.shiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'}{lifecycle.status === 'CLOSED' ? (isCloseSnapshot ? ' · Dữ liệu tại thời điểm đóng ca' : ' · Dữ liệu lịch sử, chưa có bản chốt') : ''}</div></>,
                status: <div className="flex justify-center"><StatusBadge variant={statusPresentation.tone} size="sm">{statusPresentation.label}</StatusBadge></div>,
                blocker: <span className="max-w-64 text-xs">{lifecycle.blockers.length ? lifecycle.blockers.map(formatServiceRunBlocker).join(' · ') : '—'}</span>,
                demand: <span className="text-xs">{materialRequestCodes.join(', ') || '—'}<span className="mt-1 block text-slate-500">{materialRequestLineIds.length} dòng nhu cầu</span></span>,
                issue: <span className="text-xs">{[...issueCodes, ...returnCodes].join(', ') || '—'}<span className="mt-1 block text-slate-500">{issueLineIds.length} dòng chứng từ</span></span>,
                supplemental: <span className="text-xs">{supplementalRequestCodes.join(', ') || '—'}</span>,
                cost: <span className="text-right text-xs tabular-nums"><span className="block">Chi phí mua ước tính: {formatCurrency(estimatedPurchaseCost ?? 0)}</span><span className="mt-1 block text-slate-500">Chi phí mua thực nhận: {actualReceivedCost == null ? 'Chưa phát sinh nhập' : formatCurrency(actualReceivedCost)}</span></span>,
                servings: <span className="tabular-nums font-semibold">{lifecycle.actualServings ?? '—'} / {lifecycle.plannedServings}</span>,
                correction: <CorrectionOverlay serviceRunId={lifecycle.serviceRunId} snapshotActual={lifecycle.actualServings} isCloseSnapshot={isCloseSnapshot} />,
              };
              return <tr key={lifecycle.serviceRunId}>{columns.map((column) => <td key={column.id} className={column.id === 'cost' || column.id === 'servings' ? 'text-right' : column.id === 'status' ? 'text-center' : undefined}>{cells[column.id]}</td>)}</tr>;
            })}
          </tbody>
        </table>}
      </TableViewport>
      <PaginationBar page={data?.pageNumber ?? page} pageSize={data?.pageSize ?? 20} totalItems={data?.totalCount ?? 0} onPageChange={setPage} />
    </>}
  </SectionPanel>;
}
