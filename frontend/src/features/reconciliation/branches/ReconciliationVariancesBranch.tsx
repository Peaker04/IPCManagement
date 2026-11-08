import { useMemo, useState } from 'react';
import { StateBoundary } from '../../../components/workbench/StateBoundary';
import { LocalFindBar } from '../../../components/workbench/LocalFindBar';
import { normalizeSearchText } from '../../../utils/search';
import { IdentifierText } from '../../../components/ui/identifier-text';
import { Num } from '../../../components/ui/num';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../../utils/dates';
import { formatUnitName } from '../../../utils/formatters';
import { MRX_DISPOSITION_CATEGORY_LABELS } from '../../../constants/mrxConstants';
import type { MrxVarianceRegisterReport } from '../../../api/mrxApi';

export interface ReconciliationVariancesBranchProps {
  batchId: string;
  report: MrxVarianceRegisterReport | null;
}

export function ReconciliationVariancesBranch({ report }: ReconciliationVariancesBranchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const query = normalizeSearchText(searchTerm);
  const visibleRows = useMemo(() => report?.rows.filter(row =>
    [row.ingredientName, row.ingredientCode, row.shiftName, row.dispositionReason].some(value => normalizeSearchText(value).includes(query))
  ) ?? [], [report, query]);
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
      cell: (row) => <span className="font-mono text-xs text-slate-600">{row.canonicalUnitName ? formatUnitName(row.canonicalUnitName) : ''}</span>,
    },
    {
      id: 'required',
      header: 'Định mức',
      width: '10%',
      align: 'right',
      cell: (row) => <Num value={row.requiredQuantity} format="plain" decimals={6} className="font-mono text-xs" />,
    },
    {
      id: 'issued',
      header: 'Đã xuất',
      width: '10%',
      align: 'right',
      cell: (row) => <Num value={row.issuedQuantity} format="plain" decimals={6} className="font-mono text-xs" />,
    },
    {
      id: 'diff',
      header: 'Lệch',
      width: '10%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.difference}
          format="plain"
          decimals={6}
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
          {row.dispositionCategory ? `${MRX_DISPOSITION_CATEGORY_LABELS[row.dispositionCategory] ?? 'Danh mục chưa xác định'}: ${row.dispositionReason || '—'}` : 'Chưa xử lý'}
        </span>
      ),
    },
  ], []);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
      <StateBoundary isEmpty={Boolean(report && report.rows.length === 0)}
        emptyTitle="Chưa ghi nhận chênh lệch xuất kho"
        emptyDescription="Xem tiến độ xuất kho tại Rà soát dòng ngày.">
      {(Boolean(report?.rows.length) || Boolean(query)) && <LocalFindBar label="Tìm trong sổ chênh lệch" value={searchTerm} onChange={setSearchTerm}
        matched={report ? visibleRows.length : undefined} total={report?.rows.length}
        scope="Trong sổ tuần đã tải; tệp xuất vẫn cả lô." />}
      <DataGrid
        data={visibleRows}
        columns={varianceColumns}
        keyExtractor={(_, idx) => `variance-${idx}`}
        emptyMessage={query ? 'Không có dòng chênh lệch khớp tìm kiếm.' : 'Chưa ghi nhận chênh lệch xuất kho'}
      />
      </StateBoundary>
    </div>
  );
}
