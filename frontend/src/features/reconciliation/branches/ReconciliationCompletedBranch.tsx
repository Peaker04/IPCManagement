import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Num } from '../../../components/ui/num';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { PaginationBar } from '../../../components/workbench/PaginationBar';
import { toVietnameseDate } from '../../../utils/dates';
import type { MrxCompletedRegisterReport } from '../../../api/mrxApi';

export interface ReconciliationCompletedBranchProps {
  report: MrxCompletedRegisterReport | null;
  page?: number;
  onPageChange?: (page: number) => void;
  pending?: boolean;
}

export function ReconciliationCompletedBranch({ report, page = 1, onPageChange, pending }: ReconciliationCompletedBranchProps) {
  const navigate = useNavigate();
  const totalPages = Math.max(1, Math.ceil((report?.totalCount ?? 0) / 50));
  const completedColumns = useMemo<ColumnDef<NonNullable<MrxCompletedRegisterReport>['rows'][number]>[]>(() => [
    {
      id: 'customer',
      header: 'Khách hàng',
      width: '21%',
      cell: (row) => <span title={row.customerName} className="text-sm font-semibold text-slate-900 truncate">{row.customerName}</span>,
    },
    {
      id: 'period',
      header: 'Tuần phục vụ',
      width: '21%',
      cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.weekStartDate)} – {toVietnameseDate(row.weekEndDate)}</span>,
    },
    {
      id: 'required',
      header: 'Nhu cầu',
      width: '12%',
      align: 'right',
      cell: (row) => row.quantityUnitName
        ? <Num value={row.totalRequired} format="plain" decimals={6} suffix={` ${row.quantityUnitName}`} />
        : <span className="text-xs text-slate-500">Theo từng đơn vị</span>,
    },
    {
      id: 'issued',
      header: 'Thực xuất',
      width: '12%',
      align: 'right',
      cell: (row) => row.totalIssued == null
        ? <span className="text-xs text-slate-500">Chưa đủ dữ liệu</span>
        : row.quantityUnitName
          ? <Num value={row.totalIssued} format="plain" decimals={6} suffix={` ${row.quantityUnitName}`} />
          : <span className="text-xs text-slate-500">Theo từng đơn vị</span>,
    },
    {
      id: 'variance',
      header: 'Chênh lệch',
      width: '10%',
      align: 'right',
      cell: (row) => row.totalVariance == null
        ? <span className="text-xs text-slate-500">—</span>
        : !row.quantityUnitName
          ? <span className="text-xs text-slate-500">Theo từng đơn vị</span>
          : (
          <Num
            value={row.totalVariance}
            format="plain"
            decimals={6}
            prefix={row.totalVariance > 0 ? '+' : ''}
            suffix={` ${row.quantityUnitName}`}
            className={row.totalVariance > 0 ? 'text-amber-700 font-semibold' : 'text-slate-700'}
          />
        ),
    },
    {
      id: 'completedBy',
      header: 'Người chốt',
      width: '12%',
      cell: (row) => <span className="text-xs text-slate-700">{/^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(row.completedBy) ? '—' : row.completedBy}</span>,
    },
    {
      id: 'actions',
      header: 'Thao tác',
      width: '12%',
      minWidth: '120px',
      cell: (row) => (
        <Button
          variant="outline"
          size="xs"
          onClick={() => navigate(`/reconciliation?view=lines&batchId=${encodeURIComponent(row.batchId)}&date=${row.weekStartDate}`)}
          aria-label={`Đối chiếu lô tuần ${toVietnameseDate(row.weekStartDate)} · ${row.customerName}`}
        >
          Đối chiếu
        </Button>
      ),
    },
  ], [navigate]);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
      <DataGrid
        data={report?.rows ?? []}
        columns={completedColumns}
        minWidth="min-w-[1000px]"
        keyExtractor={(row) => row.batchId}
        emptyMessage="Chưa có lô đối soát nào hoàn tất."
      />
      {onPageChange && <PaginationBar label="Phân trang hồ sơ hoàn tất" page={page} pageSize={50}
        totalCount={report?.totalCount} totalPages={report ? Math.ceil(report.totalCount / 50) : undefined}
        hasPrev={Boolean(report && page > 1)} hasNext={Boolean(report && page < totalPages)}
        pending={pending} onPageChange={onPageChange} />}
    </div>
  );
}
