import { useMemo } from 'react';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Num } from '../../../components/ui/num';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../../utils/dates';
import type { MrxCompletedRegisterReport } from '../../../api/mrxApi';

export interface ReconciliationCompletedBranchProps {
  report: MrxCompletedRegisterReport | null;
}

export function ReconciliationCompletedBranch({ report }: ReconciliationCompletedBranchProps) {
  const completedColumns = useMemo<ColumnDef<NonNullable<MrxCompletedRegisterReport>['rows'][number]>[]>(() => [
    {
      id: 'batchId',
      header: 'Mã lô',
      width: '18%',
      cell: (row) => <IdentifierText value={row.batchId} />,
    },
    {
      id: 'customer',
      header: 'Khách hàng',
      width: '16%',
      cell: (row) => <span className="text-sm font-semibold text-slate-900 truncate">{row.customerName}</span>,
    },
    {
      id: 'period',
      header: 'Tuần phục vụ',
      width: '16%',
      cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.weekStartDate)} – {toVietnameseDate(row.weekEndDate)}</span>,
    },
    {
      id: 'required',
      header: 'Nhu cầu',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.totalRequired} format="quantity" suffix=" kg" />,
    },
    {
      id: 'issued',
      header: 'Thực xuất',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.totalIssued} format="quantity" suffix=" kg" />,
    },
    {
      id: 'variance',
      header: 'Chênh lệch',
      width: '12%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.totalVariance}
          format="quantity"
          prefix={row.totalVariance > 0 ? '+' : ''}
          suffix=" kg"
          className={row.totalVariance > 0 ? 'text-amber-700 font-semibold' : 'text-slate-700'}
        />
      ),
    },
    {
      id: 'completedBy',
      header: 'Người chốt',
      width: '14%',
      cell: (row) => <IdentifierText value={row.completedBy} />,
    },
  ], []);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
      <DataGrid
        data={report?.rows ?? []}
        columns={completedColumns}
        keyExtractor={(row) => row.batchId}
        emptyMessage="Chưa có lô đối soát nào hoàn tất."
      />
    </div>
  );
}
