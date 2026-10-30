import { useMemo } from 'react';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { formatVietnameseDateTime } from '../../../utils/dates';
import { formatAuditActor, formatAuditArea, formatAuditEntity, formatAuditField } from '../../../utils/formatters';
import type { MrxAuditTrailReport, MrxSourceChangeItem } from '../../../api/mrxApi';

export interface ReconciliationAuditBranchProps {
  batchId?: string;
  auditReport: MrxAuditTrailReport | null;
  sourceChanges: MrxSourceChangeItem[] | null;
  auditSubTab?: 'warehouse' | 'source';
}

export function ReconciliationAuditBranch({
  auditReport,
  sourceChanges,
  auditSubTab = 'warehouse',
}: ReconciliationAuditBranchProps) {

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
      cell: (row) => <span className="text-xs font-medium text-slate-900">{formatAuditActor(row.changedBy)}</span>,
    },
    {
      id: 'entity',
      header: 'Thực thể',
      width: '14%',
      cell: (row) => <span className="text-xs font-medium text-slate-800">{formatAuditEntity(row.entityName)}</span>,
    },
    {
      id: 'field',
      header: 'Trường thay đổi',
      width: '16%',
      cell: (row) => <span className="text-xs text-slate-700">{formatAuditField(row.fieldName)}</span>,
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
      cell: (row) => <span className="text-xs font-medium text-slate-900">{formatAuditActor(row.actor)}</span>,
    },
    {
      id: 'area',
      header: 'Phân hệ',
      width: '12%',
      cell: (row) => <span className="text-xs font-semibold text-slate-700">{formatAuditArea(row.businessArea)}</span>,
    },
    {
      id: 'entity',
      header: 'Thực thể / Trường',
      width: '18%',
      cell: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-900">{formatAuditEntity(row.entityName)}</span>
          <span className="text-slate-500 text-xs">{formatAuditField(row.fieldName)}</span>
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

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
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
