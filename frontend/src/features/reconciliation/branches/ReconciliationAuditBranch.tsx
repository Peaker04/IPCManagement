import { useMemo } from 'react';
import { WorkbenchSkeleton } from '../../../components/workbench/WorkbenchSkeleton';
import { LocalFindBar } from '../../../components/workbench/LocalFindBar';
import { DataGrid, type ColumnDef } from '../../../components/workbench/DataGrid';
import { PaginationBar } from '../../../components/workbench/PaginationBar';
import { formatVietnameseDateTime } from '../../../utils/dates';
import { formatAuditActor, formatAuditArea, formatAuditEntity, formatAuditField, formatAuditValue } from '../../../utils/formatters';
import type { MrxAuditTrailReport, MrxSourceChangeItem } from '../../../api/mrxApi';

export interface ReconciliationAuditBranchProps {
  batchId?: string;
  auditReport: MrxAuditTrailReport | null;
  sourceChanges: MrxSourceChangeItem[] | null;
  auditSubTab?: 'warehouse' | 'source';
  page?: number;
  pending?: boolean;
  onPageChange?: (page: number) => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  sourceTotalCount?: number;
}

export function ReconciliationAuditBranch({
  auditReport,
  sourceChanges,
  auditSubTab = 'warehouse',
  page = 1,
  pending = false,
  onPageChange,
  searchTerm = '',
  onSearchChange,
  sourceTotalCount,
}: ReconciliationAuditBranchProps) {
  const visibleAuditRows = auditReport?.rows ?? [];
  const sourcePageRows = sourceChanges ?? [];
  const totalCount = auditSubTab === 'warehouse' ? auditReport?.totalCount : sourceTotalCount;
  const totalPages = totalCount === undefined ? undefined : Math.ceil(totalCount / 50);
  const query = searchTerm.trim();
  const isColdTarget = pending && !(auditSubTab === 'source' ? sourceChanges : auditReport);

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
      cell: (row) => <span className="text-xs text-slate-800" title={row.newValue ?? ''}>{formatAuditValue(row.fieldName, row.newValue)}</span>,
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
        <span className="text-xs text-slate-800" title={`Gốc: ${row.oldValue || '—'} → ${row.newValue || '—'}`}>
          <span className="line-through text-slate-500 mr-1">{row.oldDisplayValue || formatAuditValue(row.fieldName, row.oldValue)}</span>
          <span>→ <strong>{row.newDisplayValue || formatAuditValue(row.fieldName, row.newValue)}</strong></span>
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
      <LocalFindBar
        label={auditSubTab === 'source' ? 'Tìm trong lịch sử nguồn và BOM' : 'Tìm trong nhật ký kiểm toán kho'}
        value={searchTerm}
        onChange={value => onSearchChange?.(value)} disabled={!onSearchChange}
        matched={totalCount} total={totalCount}
        scope={auditSubTab === 'source' ? 'Tìm trong toàn bộ lịch sử nguồn và BOM của lô.' : 'Tìm trong toàn bộ nhật ký kiểm toán kho của lô.'}
      />
      {isColdTarget ? <WorkbenchSkeleton geometry={{ kind: 'table', columns: 6, rows: 10 }} /> : auditSubTab === 'warehouse' ? (
        <DataGrid
          data={visibleAuditRows}
          hideHeaderWhenEmpty
          columns={auditColumns}
          minWidth="min-w-[1100px]"
          keyExtractor={(row, idx) => row.auditId || `audit-${idx}`}
          emptyMessage={query ? 'Không có bản ghi kiểm toán khớp tìm kiếm.' : 'Chưa có nhật ký kiểm toán nào cho phạm vi này.'}
        />
      ) : (
        <DataGrid
          data={sourcePageRows}
          hideHeaderWhenEmpty
          columns={sourceChangeColumns}
          minWidth="min-w-[1100px]"
          keyExtractor={(row, idx) => row.changeId || `sc-${idx}`}
          emptyMessage={query ? 'Không có thay đổi nguồn khớp tìm kiếm.' : 'Lô đối soát chưa có ghi nhận thay đổi nguồn hay điều chỉnh BOM nào.'}
        />
      )}
      {onPageChange && (
        <PaginationBar
          label="Phân trang nhật ký kiểm toán"
          page={page}
          pageSize={50}
          totalCount={totalCount}
          totalPages={totalPages}
          hasPrev={page > 1}
          hasNext={Boolean(totalPages && page < totalPages)}
          pending={pending}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
