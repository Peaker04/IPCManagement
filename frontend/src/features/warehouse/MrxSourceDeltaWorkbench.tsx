import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxSourceDelta } from '../../api/mrxApi';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { type ColumnDef } from '../../components/workbench/DataGrid';
import { toVietnameseDate } from '../../utils/dates';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { MrxDeltaHeaderBranch } from './branches/MrxDeltaHeaderBranch';
import { MrxDeltaTableBranch } from './branches/MrxDeltaTableBranch';
import { Input } from '../../components/ui/input';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';

const KIND_LABELS: Record<string, string> = {
  SOURCE_CHANGE: 'Thay đổi định lượng nguồn',
  SUPPLEMENTAL_ISSUE: 'Yêu cầu xuất bổ sung cũ',
  RETURN_REQUIRED: 'Yêu cầu hoàn trả cũ',
};
const STATUS_LABELS: Record<string, string> = { APPLIED: 'Đã áp dụng', PENDING: 'Đang chờ (dữ liệu cũ)', RESOLVED: 'Đã xử lý' };

function resolveFilters(params: URLSearchParams) {
  if (params.get('historyScope') === 'all') return { customerCode: '', batchId: '', serviceDate: '' };
  const scope = workspaceSessionStore.getScope();
  const explicitCustomer = params.get('customerCode');
  const explicitBatch = params.get('batchId');
  const sameCustomer = !explicitCustomer || explicitCustomer === scope.customerCode;
  const sameBatch = !explicitBatch || explicitBatch === scope.batchId;
  return {
    customerCode: explicitCustomer ?? (sameBatch ? scope.customerCode : ''),
    batchId: explicitBatch ?? (sameCustomer ? scope.batchId : ''),
    serviceDate: params.get('serviceDate') ?? params.get('date') ?? (sameCustomer && sameBatch ? scope.serviceDate : ''),
  };
}

export function MrxSourceDeltaWorkbench() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState(() => resolveFilters(params));
  const [filters, setFilters] = useState(draftFilters);
  const [appliedUrl, setAppliedUrl] = useState(params.toString());
  if (appliedUrl !== params.toString()) {
    const next = resolveFilters(params);
    setAppliedUrl(params.toString());
    setDraftFilters(next);
    setFilters(next);
    setPage(1);
  }
  const filterKey = JSON.stringify(filters);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sourceHistoryQuery = useWorkbenchQuery({
    scopeKey: 'mrx_source_history', cacheKey: `mrx_source_history_${filterKey}_${page}`,
    snapshotKey: `snapshot:mrx_source_history_${filterKey}_${page}`,
    queryFn: () => Object.values(filters).some(Boolean) ? mrxApi.getSourceDeltas(page, 25, 'ALL', filters) : mrxApi.getSourceDeltas(page, 25, 'ALL'),
    isDatasetEmpty: (result) => result.items.length === 0,
    emptyTitle: 'Chưa có lịch sử thay đổi nguồn',
  });
  const { data, stateProps, refetch } = sourceHistoryQuery;
  const current = data?.pageNumber === page ? data : null;
  const displayed = stateProps.error ? current : data;
  const pending = !stateProps.error && (stateProps.isFetching || stateProps.isPreviousData);
  const applyFilters = (next: typeof filters) => {
    setPage(1);
    setDraftFilters(next);
    setFilters(next);
    setParams(current => {
      const updated = new URLSearchParams(current);
      for (const [key, value] of Object.entries(next)) { if (value) updated.set(key, value); else updated.delete(key); }
      updated.delete('date');
      updated.set('historyScope', Object.values(next).some(Boolean) ? 'selected' : 'all');
      return updated;
    }, { replace: true });
  };
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try { await refetch(true); } finally { setIsRefreshing(false); }
  };
  const columns = useMemo<ColumnDef<MrxSourceDelta>[]>(() => [
    { id: 'ingredient', header: 'Nguyên liệu', width: '200px', cell: (row) => <div><span title={row.ingredientName ?? undefined}>{row.ingredientName ?? 'Chưa rõ nguyên liệu'}</span>{row.ingredientCode && <IdentifierText value={row.ingredientCode} />}</div> },
    { id: 'date', header: 'Ngày phục vụ', width: '140px', cell: (row) => toVietnameseDate(row.serviceDate) },
    { id: 'batch', header: 'Lô / Lần cập nhật', width: '220px', cell: (row) => <div className="flex items-center gap-1"><IdentifierText value={row.batchId} displayValue={row.batchId.slice(0, 8)} /><IdentifierText value={row.sourceRevisionId} displayValue={row.sourceRevisionId.slice(0, 8)} /></div> },
    { id: 'previous', header: 'Nhu cầu trước', align: 'right', width: '140px', cell: (row) => <Num value={row.previousRequiredQuantity} format="plain" decimals={6} /> },
    { id: 'next', header: 'Nhu cầu sau', align: 'right', width: '140px', cell: (row) => <Num value={row.newRequiredQuantity} format="plain" decimals={6} /> },
    { id: 'delta', header: 'Chênh lệch', align: 'right', width: '140px', cell: (row) => <Num value={row.deltaQuantity} format="plain" decimals={6} prefix={row.deltaQuantity > 0 ? '+' : ''} /> },
    { id: 'unit', header: 'Đơn vị', width: '90px', cell: (row) => row.canonicalUnitName ?? 'Chưa rõ đơn vị' },
    { id: 'kind', header: 'Loại thay đổi', width: '220px', cell: (row) => <span title={KIND_LABELS[row.workKind]}>{KIND_LABELS[row.workKind] ?? 'Loại chưa nhận diện'}</span> },
    { id: 'status', header: 'Trạng thái', width: '150px', cell: (row) => STATUS_LABELS[row.status] ?? row.status },
  ], []);

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxDeltaHeaderBranch onNavigateDaily={() => navigate('/warehouse?view=mrx-daily')} isRefreshing={isRefreshing} onRefresh={handleRefresh} filters={<form className="flex flex-wrap items-end gap-2 min-w-0"
        onSubmit={event => { event.preventDefault(); applyFilters({ customerCode: draftFilters.customerCode.trim(), batchId: draftFilters.batchId.trim(), serviceDate: draftFilters.serviceDate }); }}>
        <label className="w-32 text-xs text-slate-700">Mã khách hàng
          <Input aria-label="Mã khách hàng lịch sử nguồn" value={draftFilters.customerCode} onChange={event => setDraftFilters(current => ({ ...current, customerCode: event.target.value }))} placeholder="Ví dụ: ANV" />
        </label>
        <label className="w-72 max-w-full text-xs text-slate-700">Mã lô đối soát
          <Input aria-label="Mã lô lịch sử nguồn" value={draftFilters.batchId} onChange={event => setDraftFilters(current => ({ ...current, batchId: event.target.value }))} placeholder="Dán mã lô nếu cần" />
        </label>
        <div className="text-xs text-slate-700"><span className="block">Ngày phục vụ</span>
          <VietnameseDateInput aria-label="Ngày phục vụ lịch sử nguồn" value={draftFilters.serviceDate} onChange={serviceDate => setDraftFilters(current => ({ ...current, serviceDate }))} />
        </div>
        <Button type="submit" aria-label="Lọc lịch sử nguồn">Lọc</Button>
        {Object.values(filters).some(Boolean) && <Button type="button" variant="ghost" size="sm" onClick={() => applyFilters({ customerCode: '', batchId: '', serviceDate: '' })}>Xem tất cả</Button>}
      </form>} />
      <WorkspaceFrame.Body>
        <StateBoundary {...stateProps} isLoading={!displayed && !stateProps.error} hasExistingData={Boolean(displayed)}
          isEmpty={!pending && displayed?.items.length === 0}
          emptyTitle={Object.values(filters).some(Boolean) ? 'Không tìm thấy thay đổi phù hợp' : 'Chưa có lịch sử thay đổi nguồn'}
          emptyDescription={Object.values(filters).some(Boolean) ? 'Thử đổi khách hàng, ngày hoặc mã lô.' : 'Các lần cập nhật định lượng nguồn sẽ hiển thị tại đây.'}
          onRetry={() => void refetch(true)} onResolveConflict={() => void refetch(true)}>
          <MrxDeltaTableBranch items={displayed?.items ?? []} columns={columns} />
        </StateBoundary>
        <PaginationBar label="Phân trang lịch sử thay đổi nguồn" hideVisibleLabel page={displayed?.pageNumber ?? page} pageSize={25}
          totalCount={displayed?.totalCount} totalPages={displayed?.totalPages}
          hasPrev={displayed?.hasPrev ?? false} hasNext={displayed?.hasNext ?? false}
          pending={pending} onPageChange={setPage} />
      </WorkspaceFrame.Body>
    </WorkspaceFrame.Root>
  );
}
