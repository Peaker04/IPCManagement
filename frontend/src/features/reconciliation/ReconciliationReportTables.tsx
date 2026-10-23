import { useMemo } from 'react';
import { Button } from '../../components/ui/button';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Num } from '../../components/ui/num';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { toVietnameseDate, formatVietnameseDateTime } from '../../utils/dates';
import type {
  MrxVarianceRegisterReport,
  MrxTransactionHistoryReport,
  MrxAuditTrailReport,
  MrxCompletedRegisterReport,
} from '../../api/mrxApi';

interface ReconciliationReportTablesProps {
  activeTab: 'variances' | 'transactions' | 'audit' | 'completed';
  batchId: string;
  variancesReport: MrxVarianceRegisterReport | null;
  transactionsReport: MrxTransactionHistoryReport | null;
  auditReport: MrxAuditTrailReport | null;
  completedReport?: MrxCompletedRegisterReport | null;
}

export function ReconciliationReportTables({
  activeTab,
  batchId,
  variancesReport,
  transactionsReport,
  auditReport,
  completedReport,
}: ReconciliationReportTablesProps) {
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
      cell: (row) => <span className="text-sm font-semibold text-slate-900 truncate">{row.ingredientName}</span>,
    },
    {
      id: 'required',
      header: 'Nhu cầu',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.requiredQuantity} format="quantity" suffix={row.canonicalUnitName ? ` ${row.canonicalUnitName}` : ''} />,
    },
    {
      id: 'issued',
      header: 'Thực xuất',
      width: '12%',
      align: 'right',
      cell: (row) => <Num value={row.issuedQuantity} format="quantity" suffix={row.canonicalUnitName ? ` ${row.canonicalUnitName}` : ''} />,
    },
    {
      id: 'difference',
      header: 'Chênh lệch',
      width: '12%',
      align: 'right',
      cell: (row) => (
        <Num
          value={row.difference}
          format="quantity"
          prefix={row.difference > 0 ? '+' : ''}
          className={row.difference > 0 ? 'text-amber-700 font-semibold' : 'text-slate-700 font-medium'}
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

  const transactionColumns = useMemo<ColumnDef<MrxTransactionHistoryReport['rows'][number]>[]>(() => [
    {
      id: 'type',
      header: 'Loại giao dịch',
      width: '14%',
      cell: (row) => <span className="text-xs font-medium text-slate-800">{row.transactionType}</span>,
    },
    {
      id: 'doc',
      header: 'Mã chứng từ',
      width: '16%',
      cell: (row) => <IdentifierText value={row.documentCode} />,
    },
    {
      id: 'date',
      header: 'Ngày',
      width: '12%',
      cell: (row) => <span className="font-mono text-xs">{toVietnameseDate(row.date)}</span>,
    },
    {
      id: 'ingredient',
      header: 'Nguyên liệu',
      width: '24%',
      cell: (row) => <span className="text-sm font-medium text-slate-900 truncate">{row.ingredientName}</span>,
    },
    {
      id: 'quantity',
      header: 'Số lượng',
      width: '14%',
      align: 'right',
      cell: (row) => <Num value={row.quantity} format="quantity" suffix={row.unitName ? ` ${row.unitName}` : ''} className="font-semibold" />,
    },
    {
      id: 'actor',
      header: 'Người thực hiện',
      width: '20%',
      cell: (row) => <span className="text-xs text-slate-700">{row.actorName}</span>,
    },
  ], []);

  const auditColumns = useMemo<ColumnDef<MrxAuditTrailReport['rows'][number]>[]>(() => [
    {
      id: 'time',
      header: 'Thời gian',
      width: '16%',
      cell: (row) => <span className="font-mono text-xs text-slate-700">{formatVietnameseDateTime(row.changedAt)}</span>,
    },
    {
      id: 'actor',
      header: 'Người thực hiện',
      width: '14%',
      cell: (row) => <span className="text-xs font-medium text-slate-900">{row.changedBy}</span>,
    },
    {
      id: 'entity',
      header: 'Thực thể',
      width: '14%',
      cell: (row) => <span className="text-xs font-mono text-slate-700">{row.entityName}</span>,
    },
    {
      id: 'field',
      header: 'Trường thay đổi',
      width: '16%',
      cell: (row) => <span className="text-xs font-mono text-slate-600">{row.fieldName ?? '—'}</span>,
    },
    {
      id: 'newVal',
      header: 'Giá trị mới',
      width: '16%',
      cell: (row) => <span className="text-xs font-mono text-slate-800">{row.newValue ?? '—'}</span>,
    },
    {
      id: 'reason',
      header: 'Lý do',
      width: '24%',
      cell: (row) => <span className="text-xs text-slate-700 truncate block" title={row.reason ?? ''}>{row.reason ?? '—'}</span>,
    },
  ], []);

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

  if (activeTab === 'variances') {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-700">Sổ theo dõi chênh lệch & quyết định xử lý tuần</span>
          <Button
            variant="outline"
            size="xs"
            disabled={!batchId}
            onClick={() => window.open(`/api/reconciliation/reports/variance-register/csv?batchId=${batchId}`, '_blank')}
          >
            Tải CSV Sổ chênh lệch
          </Button>
        </div>
        <DataGrid
          data={variancesReport?.rows ?? []}
          columns={varianceColumns}
          keyExtractor={(_, idx) => `variance-${idx}`}
          emptyMessage="Lô không có chênh lệch xuất kho nào cần xử lý."
        />
      </div>
    );
  }

  if (activeTab === 'transactions') {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-700">Lịch sử giao dịch kho (Xuất ban đầu, Xuất bổ sung & Hoàn trả)</span>
          <Button
            variant="outline"
            size="xs"
            disabled={!batchId}
            onClick={() => window.open(`/api/reconciliation/reports/transactions-history/csv?batchId=${batchId}`, '_blank')}
          >
            Tải CSV Lịch sử kho
          </Button>
        </div>
        <DataGrid
          data={transactionsReport?.rows ?? []}
          columns={transactionColumns}
          keyExtractor={(row, idx) => row.documentCode || `tx-${idx}`}
          emptyMessage="Chưa có giao dịch kho nào cho lô này."
        />
      </div>
    );
  }

  if (activeTab === 'audit') {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-700">Nhật ký kiểm toán đối soát nguyên liệu (Audit Trail)</span>
          <Button
            variant="outline"
            size="xs"
            disabled={!batchId}
            onClick={() => window.open(`/api/reconciliation/reports/audit-trail/csv?batchId=${batchId}`, '_blank')}
          >
            Tải CSV Nhật ký
          </Button>
        </div>
        <DataGrid
          data={auditReport?.rows ?? []}
          columns={auditColumns}
          keyExtractor={(row, idx) => row.auditId || `audit-${idx}`}
          emptyMessage="Chưa có nhật ký kiểm toán nào cho phạm vi này."
        />
      </div>
    );
  }

  if (activeTab === 'completed') {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-slate-700">Danh bạ lô đối soát đã hoàn tất</span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => window.open('/api/reconciliation/reports/completed-register/csv', '_blank')}
          >
            Tải CSV Danh bạ hoàn tất
          </Button>
        </div>
        <DataGrid
          data={completedReport?.rows ?? []}
          columns={completedColumns}
          keyExtractor={(row) => row.batchId}
          emptyMessage="Chưa có lô đối soát nào hoàn tất."
        />
      </div>
    );
  }

  return null;
}
