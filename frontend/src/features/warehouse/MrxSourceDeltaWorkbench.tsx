import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mrxApi, type MrxSourceDelta } from '../../api/mrxApi';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { type ColumnDef } from '../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../utils/dates';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { MrxDeltaHeaderBranch } from './branches/MrxDeltaHeaderBranch';
import { MrxDeltaTableBranch } from './branches/MrxDeltaTableBranch';

const KIND_LABELS: Record<string, string> = {
  SOURCE_CHANGE: 'Thay đổi định lượng nguồn',
  SUPPLEMENTAL_ISSUE: 'Yêu cầu xuất bổ sung cũ',
  RETURN_REQUIRED: 'Yêu cầu hoàn trả cũ',
};
const STATUS_LABELS: Record<string, string> = { APPLIED: 'Đã áp dụng', PENDING: 'Đang chờ (dữ liệu cũ)', RESOLVED: 'Đã xử lý' };

export function MrxSourceDeltaWorkbench() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sourceHistoryQuery = useWorkbenchQuery({
    scopeKey: 'mrx_source_history', cacheKey: `mrx_source_history_${page}`,
    snapshotKey: `snapshot:mrx_source_history_${page}`,
    queryFn: () => mrxApi.getSourceDeltas(page, 25, 'ALL'),
    isDatasetEmpty: (result) => result.items.length === 0,
    emptyTitle: 'Chưa có lịch sử thay đổi nguồn',
    emptyDescription: 'Các thay đổi nguồn và dữ liệu tương thích cũ được giữ nguyên để tra cứu.',
  });
  const { data, stateProps, refetch } = sourceHistoryQuery;
  const current = data?.pageNumber === page ? data : null;
  const displayed = stateProps.error ? current : data;
  const pending = !stateProps.error && (stateProps.isFetching || stateProps.isPreviousData);
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refetch(true); } finally { setIsRefreshing(false); }
  };
  const columns = useMemo<ColumnDef<MrxSourceDelta>[]>(() => [
    { id: 'ingredient', header: 'Nguyên liệu', minWidth: '180px', cell: (row) => <div><span>{row.ingredientName ?? 'Chưa rõ nguyên liệu'}</span>{row.ingredientCode && <IdentifierText value={row.ingredientCode} />}</div> },
    { id: 'date', header: 'Ngày phục vụ', minWidth: '110px', cell: (row) => toVietnameseDate(row.serviceDate) },
    { id: 'batch', header: 'Lô / Phiên thay đổi', minWidth: '180px', cell: (row) => <div><IdentifierText value={row.batchId} /><IdentifierText value={row.sourceRevisionId} /></div> },
    { id: 'previous', header: 'Nhu cầu trước', align: 'right', minWidth: '120px', cell: (row) => <Num value={row.previousRequiredQuantity} format="plain" decimals={6} /> },
    { id: 'next', header: 'Nhu cầu sau', align: 'right', minWidth: '120px', cell: (row) => <Num value={row.newRequiredQuantity} format="plain" decimals={6} /> },
    { id: 'delta', header: 'Chênh lệch', align: 'right', minWidth: '120px', cell: (row) => <Num value={row.deltaQuantity} format="plain" decimals={6} prefix={row.deltaQuantity > 0 ? '+' : ''} /> },
    { id: 'unit', header: 'Đơn vị', cell: (row) => row.canonicalUnitName ?? 'Chưa rõ đơn vị' },
    { id: 'kind', header: 'Loại thay đổi', minWidth: '180px', cell: (row) => <div><span>{KIND_LABELS[row.workKind] ?? 'Loại chưa nhận diện'}</span><span className="block text-xs text-slate-500">{row.workKind}</span></div> },
    { id: 'status', header: 'Trạng thái', minWidth: '160px', cell: (row) => STATUS_LABELS[row.status] ?? row.status },
  ], []);

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxDeltaHeaderBranch onNavigateDaily={() => navigate('/warehouse?view=mrx-daily')} isRefreshing={isRefreshing} onRefresh={handleRefresh} />
      <TelemetrySubbar leftControls={<span className="text-xs text-slate-700">Chỉ đọc · Không tạo phiếu xuất hoặc hoàn trả từ lịch sử thay đổi nguồn.</span>}
        telemetryPills={current ? <span className="text-xs">Tổng số thay đổi: <Num value={current.totalCount} /></span> : undefined} />
      <WorkspaceFrame.Body>
        <StateBoundary {...stateProps} isLoading={!displayed && !stateProps.error} hasExistingData={Boolean(displayed)} onRetry={() => void refetch(true)} onResolveConflict={() => void refetch(true)}>
          <MrxDeltaTableBranch items={displayed?.items ?? []} columns={columns} />
        </StateBoundary>
        <PaginationBar label="Phân trang lịch sử thay đổi nguồn" page={displayed?.pageNumber ?? page} pageSize={25}
          totalCount={displayed?.totalCount} totalPages={displayed?.totalPages}
          hasPrev={displayed?.hasPrev ?? false} hasNext={displayed?.hasNext ?? false}
          pending={pending} onPageChange={setPage} />
      </WorkspaceFrame.Body>
    </WorkspaceFrame.Root>
  );
}
