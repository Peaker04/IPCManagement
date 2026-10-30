import { useMemo } from 'react';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Num } from '../../../components/ui/num';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../../utils/dates';
import type { MrxVarianceRegisterReport } from '../../../api/mrxApi';

function formatCanonicalUnit(unit?: string | null): string {
  if (!unit) return '';
  const lower = unit.toLowerCase().trim();
  if (lower === 'kilogram' || lower === 'kg') return 'kg';
  if (lower === 'gram' || lower === 'g') return 'g';
  if (lower === 'piece' || lower === 'cái') return 'cái';
  return unit;
}

export interface ReconciliationVariancesBranchProps {
  batchId: string;
  report: MrxVarianceRegisterReport | null;
}

export function ReconciliationVariancesBranch({ batchId: _batchId, report }: ReconciliationVariancesBranchProps) {
  const varianceColumns = useMemo<ColumnDef<MrxVarianceRegisterReport['rows'][number]>[]>(() => [
    {
      id: 'date',
      header: 'Ngày',
      width: '12%',
      cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.serviceDate)}</span>,
    },
    {
      id: 'shift',
      header: 'Ca',
      width: '10%',
      cell: (row) => <span className="text-xs font-medium">{row.shiftName}</span>,
    },
    {
      id: 'ingredient',
      header: 'Nguyên liệu',
      width: '24%',
      cell: (row) => (
        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold text-slate-900 text-sm truncate">{row.ingredientName}</span>
          {row.ingredientCode && <IdentifierText value={row.ingredientCode} />}
        </div>
      ),
    },
    {
      id: 'unit',
      header: 'ĐVT',
      width: '8%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs text-slate-600">{formatCanonicalUnit(row.canonicalUnitName)}</span>,
    },
    {
      id: 'required',
      header: 'Định mức',
      width: '10%',
      align: 'right',
      cell: (row) => <Num value={row.requiredQuantity} format="quantity" className="font-mono text-xs" />,
    },
    {
      id: 'issued',
      header: 'Đã xuất',
      width: '10%',
      align: 'right',
      cell: (row) => <Num value={row.issuedQuantity} format="quantity" className="font-mono text-xs" />,
    },
    {
      id: 'diff',
      header: 'Lệch',
      width: '10%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.difference}
          format="quantity"
          prefix={row.difference > 0 ? '+' : ''}
          className={row.difference !== 0 ? 'text-amber-700 font-bold font-mono' : 'text-slate-600 font-mono'}
        />
      ),
    },
    {
      id: 'disposition',
      header: 'Hướng xử lý',
      width: '18%',
      cell: (row) => (
        <span className="text-xs truncate block" title={row.dispositionReason ?? ''}>
          {row.dispositionCategory ? `${row.dispositionCategory}: ${row.dispositionReason}` : 'Chưa xử lý'}
        </span>
      ),
    },
  ], []);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
      <DataGrid
        data={report?.rows ?? []}
        columns={varianceColumns}
        keyExtractor={(_, idx) => `variance-${idx}`}
        emptyMessage="Lô không có chênh lệch xuất kho nào cần xử lý."
      />
    </div>
  );
}
