import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxSourceHistoryEvent } from '../../api/mrxApi';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { MrxDeltaHeaderBranch } from './branches/MrxDeltaHeaderBranch';
import { MrxDeltaTableBranch } from './branches/MrxDeltaTableBranch';
import { MrxSourceHistoryDetail } from './MrxSourceHistoryDetail';
import { Input } from '../../components/ui/input';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Button } from '../../components/ui/button';

function resolveFilters(params: URLSearchParams) {
  if (params.get('historyScope') === 'all') return { customerCode: '', batchId: '', serviceDate: '' };
  return { customerCode: params.get('customerCode') ?? '', batchId: params.get('batchId') ?? '', serviceDate: params.get('serviceDate') ?? params.get('date') ?? '' };
}

export function MrxSourceDeltaWorkbench() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState(() => resolveFilters(params));
  const [filters, setFilters] = useState(draftFilters);
  const [appliedUrl, setAppliedUrl] = useState(params.toString());
  const [selected, setSelected] = useState<MrxSourceHistoryEvent | null>(null);
  if (appliedUrl !== params.toString()) {
    const next = resolveFilters(params);
    setAppliedUrl(params.toString()); setDraftFilters(next); setFilters(next); setPage(1);
  }
  const filterKey = JSON.stringify(filters);
  const queryKey = `mrx_source_history_events_v2_${filterKey}_${page}`;
  const scrollRegion = useRef<HTMLDivElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const sourceHistoryQuery = useWorkbenchQuery({
    scopeKey: 'mrx_source_history', cacheKey: queryKey,
    snapshotKey: `snapshot:${queryKey}`,
    queryFn: async (_, signal) => ({ filterKey, result: await mrxApi.getSourceHistory(page, 25, filters, signal) }),
    isDatasetEmpty: ({ result }) => result.items.length === 0,
    emptyTitle: 'Chưa có lịch sử thay đổi nguồn',
  });
  const { data, stateProps, refetch } = sourceHistoryQuery;
  const matchingFilter = data?.filterKey === filterKey ? data.result : null;
  const displayed = stateProps.error ? matchingFilter : data?.result;
  const settledPage = matchingFilter?.pageNumber === page ? page : null;
  const pending = stateProps.isFetching || (!stateProps.error && stateProps.isPreviousData);
  useEffect(() => {
    if (settledPage !== null && scrollRegion.current) scrollRegion.current.scrollTop = 0;
  }, [filterKey, settledPage]);
  const applyFilters = (next: typeof filters) => {
    setPage(1); setDraftFilters(next); setFilters(next);
    setParams(current => {
      const updated = new URLSearchParams(current);
      for (const [key, value] of Object.entries(next)) { if (value) updated.set(key, value); else updated.delete(key); }
      updated.delete('date');
      updated.set('historyScope', Object.values(next).some(Boolean) ? 'selected' : 'all');
      return updated;
    }, { replace: true });
  };
  const handleRefresh = async () => { setIsRefreshing(true); try { await refetch(true); } finally { setIsRefreshing(false); } };
  return <WorkspaceFrame.Root className="select-text">
    <MrxDeltaHeaderBranch onNavigateDaily={() => navigate('/warehouse?view=mrx-daily')} isRefreshing={isRefreshing} onRefresh={handleRefresh} filters={<form className="mrx-source-filters flex flex-wrap items-center gap-2 min-w-0"
      onSubmit={event => { event.preventDefault(); applyFilters({ customerCode: draftFilters.customerCode.trim(), batchId: draftFilters.batchId.trim(), serviceDate: draftFilters.serviceDate }); }}>
      <label className="mrx-source-customer min-w-0"><span className="sr-only">Mã khách hàng</span>
        <Input aria-label="Mã khách hàng lịch sử nguồn" value={draftFilters.customerCode} onChange={event => setDraftFilters(current => ({ ...current, customerCode: event.target.value }))} placeholder="Mã khách hàng" />
      </label>
      <label className="mrx-source-batch min-w-0"><span className="sr-only">Mã lô đối soát</span>
        <Input aria-label="Mã lô lịch sử nguồn" value={draftFilters.batchId} onChange={event => setDraftFilters(current => ({ ...current, batchId: event.target.value }))} placeholder="Dán mã lô nếu cần" />
      </label>
      <div className="mrx-source-date"><span className="sr-only">Ngày phục vụ</span>
        <VietnameseDateInput aria-label="Ngày phục vụ lịch sử nguồn" value={draftFilters.serviceDate} onChange={serviceDate => setDraftFilters(current => ({ ...current, serviceDate }))} />
      </div>
      <Button type="submit" aria-label="Lọc lịch sử nguồn">Lọc</Button>
      {Object.values(filters).some(Boolean) && <Button type="button" variant="ghost" size="sm" onClick={() => applyFilters({ customerCode: '', batchId: '', serviceDate: '' })}>Xem tất cả</Button>}
    </form>} />
    <WorkspaceFrame.Body>
      <StateBoundary {...stateProps} isLoading={!displayed && !stateProps.error} hasExistingData={Boolean(displayed)}
        isEmpty={!stateProps.error && !pending && displayed?.items.length === 0}
        emptyTitle={Object.values(filters).some(Boolean) ? 'Không tìm thấy thay đổi phù hợp' : 'Chưa có lịch sử thay đổi nguồn'}
        emptyDescription={Object.values(filters).some(Boolean) ? 'Thử đổi khách hàng, ngày hoặc mã lô.' : null}
        onRetry={() => void refetch(true)} onResolveConflict={() => void refetch(true)}>
        <div ref={scrollRegion} className="mrx-history-scroll" role="region" tabIndex={0} aria-label="Danh sách thay đổi nguồn">
          <MrxDeltaTableBranch items={displayed?.items ?? []} onOpen={setSelected} />
        </div>
      </StateBoundary>
      <PaginationBar label="Phân trang lịch sử thay đổi nguồn" hideVisibleLabel page={stateProps.error ? page : displayed?.pageNumber ?? page} pageSize={25}
        totalCount={matchingFilter?.totalCount} totalPages={matchingFilter?.totalPages}
        hasPrev={page > 1} hasNext={settledPage !== null && Boolean(matchingFilter?.hasNext)}
        pending={pending} retainButtonFocus onPageChange={setPage} />
    </WorkspaceFrame.Body>
    <MrxSourceHistoryDetail event={selected} onClose={() => setSelected(null)} />
  </WorkspaceFrame.Root>;
}
