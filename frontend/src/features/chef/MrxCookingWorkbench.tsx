import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxKitchenCooking, type MrxBatchSummary, type MrxBatchPage } from '../../api/mrxApi';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import { LocalFindBar } from '../../components/workbench/LocalFindBar';
import { normalizeSearchText } from '../../utils/search';
import { getMrxShiftLabel } from '../../constants/mrxConstants';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkbenchSkeleton } from '../../components/workbench/WorkbenchSkeleton';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { InlineBanner } from '../../components/ui/inline-banner';
import { Button } from '../../components/ui/button';
import { getCachedArray, serverStateCache } from '../../store/serverStateCache';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { toVietnameseDate } from '../../utils/dates';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { MrxCookingHeaderBranch } from './branches/MrxCookingHeaderBranch';
import { MrxCookingDishListBranch, type DishGroup } from './branches/MrxCookingDishListBranch';
import { ReconciliationBatchPicker } from '../../components/workbench/ReconciliationBatchPicker';

export function MrxCookingWorkbench() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionScope = workspaceSessionStore.getScope();
  const urlBatchId = searchParams.get('batchId') || '';
  const cachedBatches = getCachedArray<MrxBatchSummary>('mrx_daily_batches');
  const snapshot = serverStateCache.get<{ batchId?: string; selectedShift?: 'ALL' | 'MORNING' | 'AFTERNOON' }>('snapshot:mrx_cooking')?.data;
  const [batches, setBatches] = useState<MrxBatchSummary[]>(() => cachedBatches ?? []);
  const [batchListError, setBatchListError] = useState<Error | null>(null);
  const [batchListRetry, setBatchListRetry] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [historyPickerOpen, setHistoryPickerOpen] = useState(false);
  const [catalogInfo, setCatalogInfo] = useState<MrxBatchPage | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(!cachedBatches);
  const hasSessionSelection = Boolean(sessionScope.customerId || sessionScope.customerCode || sessionScope.weekStartDate);
  const matchingSessionBatch = cachedBatches?.find(batch => batch.customerId === sessionScope.customerId && batch.weekStartDate === sessionScope.weekStartDate)
    || cachedBatches?.find(batch => batch.customerId === sessionScope.customerId);
  const resolvedBatchId = urlBatchId || sessionScope.batchId || (hasSessionSelection ? matchingSessionBatch?.batchId : cachedBatches?.[0]?.batchId) || '';
  const [fallbackBatchId, setBatchId] = useState(() => resolvedBatchId);
  if (urlBatchId && urlBatchId !== fallbackBatchId) {
    setBatchId(urlBatchId);
  }
  const batchId = urlBatchId || fallbackBatchId;
  useEffect(() => {
    if (!urlBatchId && fallbackBatchId) {
      setSearchParams((curr) => {
        const next = new URLSearchParams(curr);
        next.set('batchId', fallbackBatchId);
        return next;
      }, { replace: true });
    }
  }, [urlBatchId, fallbackBatchId, setSearchParams]);
  const selectionRef = useRef({ batchId, urlBatchId, setSearchParams });
  useEffect(() => { selectionRef.current = { batchId, urlBatchId, setSearchParams }; }, [batchId, urlBatchId, setSearchParams]);
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'MORNING' | 'AFTERNOON'>(() => snapshot?.selectedShift || 'ALL');
  const [searchTerm, setSearchTerm] = useState('');
  useEffect(() => {
    serverStateCache.set('snapshot:mrx_cooking', { batchId, selectedShift });
  }, [batchId, selectedShift]);

  const cookingQuery = useWorkbenchQuery<MrxKitchenCooking>({
    scopeKey: 'mrx_cooking',
    cacheKey: `mrx_cooking_${batchId}`,
    snapshotKey: `snapshot:mrx_cooking_${batchId || 'none'}`,
    scopeId: batchId,
    isCatalogLoading: !batchId && catalogLoading,
    queryFn: () => mrxApi.getKitchenCooking(batchId),
    isCompatibilityBlocked: (cause: unknown) => {
      const err = cause instanceof Error ? cause : new Error();
      return err.message.includes('KITCHEN_FROZEN_LINEAGE_MISSING') || err.message.includes('LEGACY_DAILY_LINEAGE_MISSING');
    },
    isDatasetEmpty: (res: MrxKitchenCooking) => !res || res.rows.length === 0,
    emptyTitle: !batchId ? 'Chưa có lô đối soát' : 'Không có dòng phiếu nấu cho lô đã chọn',
    emptyDescription: !batchId ? 'Chưa có lô đối soát nào được chọn.' : 'Lô này chưa có dữ liệu món ăn cho ca đã chọn.',
  });
  const { data: cookingData, stateProps, refetch: loadCookingData } = cookingQuery;
  const isLegacyLineageMissing = Boolean(
    stateProps.error?.message.includes('KITCHEN_FROZEN_LINEAGE_MISSING') ||
    stateProps.error?.message.includes('LEGACY_DAILY_LINEAGE_MISSING') ||
    stateProps.isPartial
  );
  const [hasUserSwitchedBatch, setHasUserSwitchedBatch] = useState(false);
  const isTransitioningBatch = Boolean(hasUserSwitchedBatch && cookingData && cookingData.batchId !== batchId && !stateProps.error && !isLegacyLineageMissing);
  const data = !isLegacyLineageMissing ? (cookingData?.batchId === batchId ? cookingData : (isTransitioningBatch ? cookingData : null)) : null;
  const isForeignData = Boolean(cookingData && cookingData.batchId !== batchId && !isTransitioningBatch);

  useEffect(() => {
    let ignore = false;
    mrxApi.getBatchPage({ pageSize: 50, pageNumber: catalogPage })
      .then((page) => {
        if (ignore) return;
        const { batchId, urlBatchId, setSearchParams } = selectionRef.current;
        const items = page?.items ?? [];
        setBatches(previous => {
          const selected = previous.find(item => item.batchId === batchId);
          return selected && !items.some(item => item.batchId === batchId) ? [selected, ...items] : items;
        });
        setCatalogInfo(page);
        setCatalogLoading(false);
        setBatchListError(null);
        if (catalogPage === 1) serverStateCache.set('mrx_daily_batches', items);
        if (!urlBatchId && items.length > 0) {
          const existing = batchId && items.find((b) => b.batchId === batchId);
          if (existing) {
            workspaceSessionStore.setScope({
              batchId: existing.batchId,
              customerId: existing.customerId,
              customerCode: existing.customerCode || '',
              customerName: existing.customerName || '',
            });
            return;
          }
          if (batchId && workspaceSessionStore.getScope().batchId === batchId) return;
          const scope = workspaceSessionStore.getScope();
          const chosen = scope.customerId
            ? items.find(b => b.customerId === scope.customerId && b.weekStartDate === scope.weekStartDate) || items.find(b => b.customerId === scope.customerId)
            : items.find((b) => b.status === 'TRANSFERRED' || b.status === 'IN_PROGRESS') || items[0];
          if (!chosen) return;
          setBatchId(chosen.batchId);
          workspaceSessionStore.setScope({
            batchId: chosen.batchId,
            customerId: chosen.customerId,
            customerCode: chosen.customerCode || '',
            customerName: chosen.customerName || '',
          });
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('batchId', chosen.batchId);
            return next;
          }, { replace: true });
        }
      })
      .catch((cause: unknown) => { if (!ignore) { setCatalogLoading(false); setBatchListError(cause instanceof Error ? cause : new Error('Không thể tải danh sách lô nấu.')); } });
    return () => { ignore = true; };
  }, [batchListRetry, catalogPage]);

  const dishGroups = useMemo<DishGroup[]>(() => {
    if (!data?.rows) return [];
    const map = new Map<string, DishGroup>();
    for (const r of data.rows) {
      const key = `${r.serviceDate}_${r.shiftName}_${r.menuVariant}_${r.dishCode}`;
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(r);
      } else {
        map.set(key, {
          key,
          serviceDate: r.serviceDate,
          weekday: r.weekday,
          shiftName: r.shiftName,
          menuVariant: r.menuVariant,
          dishCode: r.dishCode,
          dishName: r.dishName,
          servings: r.servings,
          rows: [r],
        });
      }
    }
    return Array.from(map.values());
  }, [data]);

  const filteredDishGroups = useMemo(() => {
    if (selectedShift === 'ALL') return dishGroups;
    return dishGroups.filter(group => getMrxShiftLabel(group.shiftName) === getMrxShiftLabel(selectedShift));
  }, [dishGroups, selectedShift]);

  const queryText = normalizeSearchText(searchTerm);
  const visibleDishGroups = useMemo(() => filteredDishGroups.filter(group =>
    [group.dishName, group.dishCode, ...group.rows.flatMap(row => [row.ingredientName, row.ingredientCode])]
      .some(value => normalizeSearchText(value).includes(queryText))
  ), [filteredDishGroups, queryText]);

  const totalFilteredServings = useMemo(() => {
    const meals = new Map<string, number>();
    for (const group of filteredDishGroups) {
      const key = `${group.serviceDate}_${group.shiftName}_${group.menuVariant}`;
      for (const row of group.rows) {
        if (!Number.isFinite(row.servings) || row.servings < 0 || (meals.has(key) && meals.get(key) !== row.servings)) return null;
        meals.set(key, row.servings);
      }
    }
    return [...meals.values()].reduce((sum, servings) => sum + servings, 0);
  }, [filteredDishGroups]);

  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const canOutput = Boolean(data?.batchId === batchId && data.rows.length > 0
    && !stateProps.isFetching && !stateProps.isPreviousData && !stateProps.error && !isLegacyLineageMissing);
  async function downloadCooking(format: 'csv' | 'xlsx') {
    if (!canOutput || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const blob = await mrxApi.downloadKitchenCookingBlob(batchId, format);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      try {
        anchor.href = url;
        anchor.download = `phieu-nau-${batchId}.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        URL.revokeObjectURL(url);
      }
    } catch (cause) {
      setDownloadError(cause instanceof Error ? cause.message : 'Không thể tải phiếu nấu. Vui lòng thử lại.');
    } finally {
      setIsDownloading(false);
    }
  }
  const isScopePending = !stateProps.error && Boolean(!data || data.batchId !== batchId);
  const hasData = Boolean(data && data.rows.length > 0);
  const hasCurrentData = hasData && !isScopePending;
  const isFilteredEmpty = hasData && visibleDishGroups.length === 0;

  const displayedError = isLegacyLineageMissing ? null : stateProps.error;
  const nextAvailableBatch = batches.find((b) => b.batchId !== batchId && (b.status === 'READY' || b.status === 'TRANSFERRED' || b.status === 'IN_PROGRESS'));

  const selectBatch = (newId: string, historicalBatch?: MrxBatchSummary) => {
    const b = historicalBatch ?? batches.find(item => item.batchId === newId);
    setHasUserSwitchedBatch(true);
    setBatchId(newId);
    if (b) {
      setBatches(previous => previous.some(item => item.batchId === b.batchId) ? previous : [b, ...previous]);
      workspaceSessionStore.setScope({ batchId: newId, customerId: b.customerId, customerCode: b.customerCode || '',
        customerName: b.customerName || '', weekStartDate: b.weekStartDate });
    }
    setSearchParams(curr => { const next = new URLSearchParams(curr); next.set('batchId', newId); return next; }, { replace: true });
  };

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxCookingHeaderBranch
        batches={batches}
        batchId={batchId}
        onSelectBatch={selectBatch}
        selectedShift={selectedShift}
        onSelectShift={(shift) => setSelectedShift(shift)}
        isPending={isScopePending}
        data={isScopePending ? null : data}
        actions={<>
          <Button variant="outline" size="sm" disabled={!canOutput || isDownloading} onClick={() => void downloadCooking('csv')}>Tải CSV cả lô</Button>
          <Button variant="outline" size="sm" disabled={!canOutput || isDownloading} onClick={() => void downloadCooking('xlsx')}>Tải Excel cả lô</Button>
          <Button variant="outline" size="sm" disabled={!canOutput || isFilteredEmpty} onClick={() => { if (canOutput && !isFilteredEmpty) window.print(); }}>In phiếu nấu</Button>
        </>}
        catalogNavigation={<><PaginationBar label="Phân trang danh sách lô nấu" placement="selector" page={catalogInfo?.pageNumber ?? catalogPage} pageSize={50}
          totalCount={catalogInfo?.totalCount} totalPages={catalogInfo?.totalPages}
          hasPrev={catalogInfo?.hasPrev ?? false} hasNext={catalogInfo?.hasNext ?? false}
          pending={catalogLoading || Boolean(batchListError)} onPageChange={next => { setCatalogLoading(true); setCatalogPage(next); }} />
          <Button variant="outline" size="sm" onClick={() => setHistoryPickerOpen(true)}>Tìm lô cũ</Button></>}
      />

      <LocalFindBar label="Tìm món, nguyên liệu trong phiếu nấu" value={searchTerm} onChange={setSearchTerm}
        disabled={!hasData || isLegacyLineageMissing || Boolean(displayedError)}
        matched={visibleDishGroups.length} total={filteredDishGroups.length}
        scope="Trong ca; giữ đủ nguyên liệu mỗi món, tệp tải vẫn cả lô.">
        <span className="text-xs text-slate-600">Số món: <strong className="inline-block min-w-[3ch] text-right font-mono tabular-nums text-slate-900">{hasCurrentData ? `${visibleDishGroups.length}/${filteredDishGroups.length}` : '—'}</strong></span>
        <span className="text-xs text-slate-600">Tổng suất trong ca: <strong className="inline-block min-w-[3ch] text-right font-mono tabular-nums text-slate-900">{!hasCurrentData ? '—' : totalFilteredServings === null ? 'Chưa xác định' : `${totalFilteredServings} suất`}</strong></span>
        <span className="text-xs text-slate-600">Dòng nguyên liệu đang xem: <strong className="inline-block min-w-[3ch] text-right font-mono tabular-nums text-slate-900">{hasCurrentData ? visibleDishGroups.reduce((sum, group) => sum + group.rows.length, 0) : '—'}</strong></span>
      </LocalFindBar>

      <WorkspaceFrame.Body>
        {batchListError && <InlineBanner variant="error" actionLabel="Tải lại danh sách lô" onAction={() => { setCatalogLoading(true); setBatchListError(null); setBatchListRetry((value) => value + 1); }}>{batchListError.message}</InlineBanner>}
        {downloadError && <InlineBanner variant="error">{downloadError}</InlineBanner>}
        <StateBoundary
          {...stateProps}
          hasExistingData={Boolean(data)}
          isPreviousData={stateProps.isPreviousData || isTransitioningBatch}
          customSkeleton={<div className="flex-1 min-h-0 flex flex-col bg-white">
            <div aria-hidden="true" className="px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0 space-y-0.5">
              <div className="h-5 w-64 rounded bg-slate-200" /><div className="h-4 w-48 rounded bg-slate-200" />
            </div>
            <WorkbenchSkeleton geometry={{ kind: 'table', columns: 5, rows: 8, columnWidths: ['35%', '12%', '18%', '15%', '20%'] }} className="[&_[data-skeleton-header]]:h-8 [&_[data-skeleton-row]]:h-9" />
          </div>}
          isLoading={stateProps.isLoading || (isForeignData && !stateProps.error)}
          error={displayedError}
          onRetry={() => { if (batchId) void loadCookingData(true); }}
          onResolveConflict={() => { if (batchId) void loadCookingData(true); }}
          isPartial={false}
          isEmpty={stateProps.isEmpty || isLegacyLineageMissing}
          emptyTitle={isLegacyLineageMissing ? 'Chưa đủ dữ liệu phiếu nấu' : stateProps.emptyTitle}
          emptyDescription={isLegacyLineageMissing ? 'Dữ liệu đóng băng thiếu hoặc chưa khớp; chưa thể xem, in hay tải phiếu nấu.' : 'Cần lịch món, số suất và BOM đã đóng băng.'}
          actionLabel={isLegacyLineageMissing && nextAvailableBatch ? `Chuyển lô ${nextAvailableBatch.customerCode ?? 'khác'} · ${toVietnameseDate(nextAvailableBatch.weekStartDate)}` : isLegacyLineageMissing ? 'Về Bàn điều hành' : (!batchId || batches.length === 0 ? 'Về Bàn điều hành' : undefined)}
          onAction={isLegacyLineageMissing && nextAvailableBatch ? () => {
            setBatchId(nextAvailableBatch.batchId);
            setSearchParams((curr) => {
              const next = new URLSearchParams(curr);
              next.set('batchId', nextAvailableBatch.batchId);
              return next;
            }, { replace: true });
          } : (isLegacyLineageMissing || !batchId || batches.length === 0 ? () => navigate('/') : undefined)}
        >
          <MrxCookingDishListBranch
            groups={visibleDishGroups}
            emptyFilterState={
              isFilteredEmpty
                ? {
                    title: queryText ? 'Không có món khớp tìm kiếm' : 'Không có món cho ca đã chọn',
                    description: 'Xóa tìm kiếm hoặc chọn ca khác. Tệp tải xuống vẫn gồm cả lô.',
                    actionLabel: queryText ? 'Xóa tìm trong phiếu nấu' : 'Xem tất cả ca',
                    onAction: () => (queryText ? setSearchTerm('') : setSelectedShift('ALL')),
                  }
                : undefined
            }
          />
        </StateBoundary>
      </WorkspaceFrame.Body>
      {historyPickerOpen && <ReconciliationBatchPicker selectedBatchId={batchId} onClose={() => setHistoryPickerOpen(false)}
        onSelect={batch => { selectBatch(batch.batchId, batch); setHistoryPickerOpen(false); }} />}
    </WorkspaceFrame.Root>
  );
}
