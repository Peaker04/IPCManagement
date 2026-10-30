import { useMemo, useState } from 'react';
import { Badge } from '../../../components/ui/badge';
import { Num } from '../../../components/ui/num';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../../utils/dates';
import { formatTransactionType, formatUnitName, formatMaterialName } from '../../../utils/formatters';
import { ReconciliationIssueDetailModal } from '../../../components/workbench/ReconciliationIssueDetailModal';
import { DocumentCodeCell } from '../../../components/workbench/DocumentCodeCell';
import type { MrxTransactionHistoryReport } from '../../../api/mrxApi';

export interface ReconciliationTransactionsBranchProps {
  batchId: string;
  report: MrxTransactionHistoryReport | null;
}

export function ReconciliationTransactionsBranch({ batchId: _batchId, report }: ReconciliationTransactionsBranchProps) {
  const [inspectedIssueId, setInspectedIssueId] = useState<string | null>(null);

  const transactionColumns = useMemo<ColumnDef<MrxTransactionHistoryReport['rows'][number]>[]>(() => [
    {
      id: 'type',
      header: 'Loại giao dịch',
      width: '14%',
      minWidth: '130px',
      cell: (row) => (
        <Badge
          variant={row.transactionType === 'INITIAL_ISSUE' ? 'neutral' : row.transactionType === 'SUPPLEMENTAL_ISSUE' ? 'warning' : 'info'}
          size="sm"
        >
          {formatTransactionType(row.transactionType)}
        </Badge>
      ),
    },
    {
      id: 'doc',
      header: 'Mã chứng từ',
      width: '20%',
      minWidth: '220px',
      cell: (row) => (
        <DocumentCodeCell code={row.documentCode} onOpenDetail={setInspectedIssueId} />
      ),
    },
    {
      id: 'date',
      header: 'Ngày',
      width: '12%',
      minWidth: '100px',
      cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.date)}</span>,
    },
    {
      id: 'ingredient',
      header: 'Nguyên liệu',
      width: '22%',
      minWidth: '160px',
      cell: (row) => <span className="text-sm font-medium text-slate-900 truncate">{formatMaterialName(row.ingredientName)}</span>,
    },
    {
      id: 'quantity',
      header: 'Số lượng',
      width: '14%',
      minWidth: '110px',
      align: 'right',
      cell: (row) => <Num value={row.quantity} format="quantity" suffix={` ${formatUnitName(row.unitName)}`} className="font-semibold" />,
    },
    {
      id: 'actor',
      header: 'Người thực hiện',
      width: '18%',
      minWidth: '120px',
      cell: (row) => <span className="text-xs text-slate-700">{row.actorName || 'Thủ kho'}</span>,
    },
  ], []);

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
      <DataGrid
        data={report?.rows ?? []}
        columns={transactionColumns}
        keyExtractor={(row, idx) => `${row.documentCode}-${row.ingredientCode || idx}`}
        emptyMessage="Chưa có giao dịch kho nào cho lô này."
      />
      <ReconciliationIssueDetailModal
        isOpen={Boolean(inspectedIssueId)}
        onClose={() => setInspectedIssueId(null)}
        issueId={inspectedIssueId}
      />
    </div>
  );
}
