import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Num } from '../../components/ui/num';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { toVietnameseDate, formatVietnameseDateTime } from '../../utils/dates';
import { ReconciliationIssueDetailModal } from '../../components/workbench/ReconciliationIssueDetailModal';
import { downloadAuthenticatedFile } from '../../utils/fileDownload';
import type {
  MrxVarianceRegisterReport,
  MrxTransactionHistoryReport,
  MrxAuditTrailReport,
  MrxCompletedRegisterReport,
  MrxSourceChangeItem,
} from '../../api/mrxApi';

interface ReconciliationReportTablesProps {
  activeTab: 'variances' | 'transactions' | 'audit' | 'completed';
  batchId: string;
  isReportLoading?: boolean;
  variancesReport: MrxVarianceRegisterReport | null;
  transactionsReport: MrxTransactionHistoryReport | null;
  auditReport: MrxAuditTrailReport | null;
  completedReport?: MrxCompletedRegisterReport | null;
  sourceChanges?: MrxSourceChangeItem[] | null;
}

export function ReconciliationReportTables({
  activeTab,
  batchId,
  isReportLoading = false,
  variancesReport,
  transactionsReport,
  auditReport,
  completedReport,
  sourceChanges,
}: ReconciliationReportTablesProps) {
  const [auditSubTab, setAuditSubTab] = useState<'warehouse' | 'source'>('warehouse');
  const [inspectedIssueId, setInspectedIssueId] = useState<string | null>(null);

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
      cell: (row) => (
        <button
          type="button"
          onClick={() => setInspectedIssueId(row.documentCode)}
          className="inline-flex items-center text-left hover:underline cursor-pointer text-blue-700 font-mono text-xs"
          title="Bấm để xem chi tiết phiếu xuất kho"
        >
          <IdentifierText value={row.documentCode} />
        </button>
      ),
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

  const sourceChangeColumns = useMemo<ColumnDef<MrxSourceChangeItem>[]>(() => [
    {
      id: 'time',
      header: 'Thời gian',
      width: '16%',
      cell: (row) => <span className="font-mono text-xs text-slate-700">{formatVietnameseDateTime(row.changedAt)}</span>,
    },
    {
      id: 'actor',
      header: 'Người sửa',
      width: '14%',
      cell: (row) => <span className="text-xs font-medium text-slate-900">{row.actor || '—'}</span>,
    },
    {
      id: 'area',
      header: 'Phân hệ',
      width: '12%',
      cell: (row) => <span className="text-xs font-mono text-slate-600">{row.businessArea}</span>,
    },
    {
      id: 'entity',
      header: 'Thực thể / Trường',
      width: '18%',
      cell: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-900">{row.entityName}</span>
          <span className="text-slate-500 font-mono text-[11px]">{row.fieldName || '—'}</span>
        </div>
      ),
    },
    {
      id: 'values',
      header: 'Biến động giá trị',
      width: '20%',
      cell: (row) => (
        <span className="text-xs font-mono text-slate-800">
          <span className="line-through text-slate-400 mr-1">{row.oldValue || '—'}</span>
          <span>→ <strong>{row.newValue || '—'}</strong></span>
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Lý do',
      width: '20%',
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

  if (isReportLoading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-8 bg-white text-center">
        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5 text-slate-400 animate-pulse">
          <span className="text-xs font-mono font-bold">...</span>
        </div>
        <p className="text-xs text-slate-500 animate-pulse">Đang tải số liệu báo cáo đối soát...</p>
      </div>
    );
  }

  if (activeTab === 'variances') {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">Sổ theo dõi chênh lệch & quyết định xử lý tuần</span>
            <span className="text-[11px] text-slate-500 hidden md:inline">· Quản lý cần phê duyệt giải trình để đạt trạng thái WEEK_COMPLETE</span>
          </div>
          <Button
            variant="outline"
            size="xs"
            disabled={!batchId}
            onClick={() => void downloadAuthenticatedFile(`/api/reconciliation/reports/variance-register/csv?batchId=${batchId}`, `so-chenh-lech-${batchId.slice(0, 8)}.csv`)}
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
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">Lịch sử giao dịch kho (Xuất ban đầu, Xuất bổ sung & Hoàn trả)</span>
            <span className="text-[11px] text-slate-500 hidden md:inline">· Nhật ký append-only ghi nhận từng lần kho xuất và bếp hoàn trả</span>
          </div>
          <Button
            variant="outline"
            size="xs"
            disabled={!batchId}
            onClick={() => void downloadAuthenticatedFile(`/api/reconciliation/reports/transactions-history/csv?batchId=${batchId}`, `lich-su-kho-${batchId.slice(0, 8)}.csv`)}
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
        <ReconciliationIssueDetailModal
          isOpen={Boolean(inspectedIssueId)}
          onClose={() => setInspectedIssueId(null)}
          issueId={inspectedIssueId}
        />
      </div>
    );
  }

  if (activeTab === 'audit') {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">Nhật ký kiểm toán đối soát nguyên liệu (Audit Trail)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAuditSubTab('warehouse')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  auditSubTab === 'warehouse'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kho ({auditReport?.rows?.length ?? 0})
              </button>
              <button
                type="button"
                onClick={() => setAuditSubTab('source')}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  auditSubTab === 'source'
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Nguồn & BOM ({sourceChanges?.length ?? 0})
              </button>
            </div>
          </div>
          <Button
            variant="outline"
            size="xs"
            disabled={!batchId}
            onClick={() => void downloadAuthenticatedFile(`/api/reconciliation/reports/audit-trail/csv?batchId=${batchId}`, `audit-trail-${batchId.slice(0, 8)}.csv`)}
          >
            Tải CSV Nhật ký
          </Button>
        </div>

        {auditSubTab === 'warehouse' ? (
          <DataGrid
            data={auditReport?.rows ?? []}
            columns={auditColumns}
            keyExtractor={(row, idx) => row.auditId || `audit-${idx}`}
            emptyMessage="Chưa có nhật ký kiểm toán nào cho phạm vi này."
          />
        ) : (
          <DataGrid
            data={sourceChanges ?? []}
            columns={sourceChangeColumns}
            keyExtractor={(row, idx) => row.changeId || `sc-${idx}`}
            emptyMessage="Lô đối soát chưa có ghi nhận thay đổi nguồn hay điều chỉnh BOM nào."
          />
        )}
      </div>
    );
  }

  if (activeTab === 'completed') {
    return (
      <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
        <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">Danh bạ lô đối soát đã hoàn tất</span>
            <span className="text-[11px] text-slate-500 hidden md:inline">· Hồ sơ đã đóng băng vĩnh viễn, lưu trữ số liệu quyết toán và kiểm toán</span>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={() => void downloadAuthenticatedFile('/api/reconciliation/reports/completed-register/csv', 'danh-ba-hoan-tat.csv')}
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
