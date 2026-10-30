import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxKitchenCooking, type MrxBatchSummary } from '../../api/mrxApi';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { WorkspaceFrame } from '../../components/workbench/WorkspaceFrame';
import { ApiError } from '../../api/client';
import { serverStateCache } from '../../store/serverStateCache';
import { workspaceSessionStore } from '../../store/workspaceSessionStore';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { MrxCookingHeaderBranch } from './branches/MrxCookingHeaderBranch';
import { MrxCookingDishListBranch, type DishGroup } from './branches/MrxCookingDishListBranch';

export function MrxCookingWorkbench() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const sessionScope = workspaceSessionStore.getScope();
  const urlBatchId = searchParams.get('batchId') || '';
  const cachedBatches = serverStateCache.get<MrxBatchSummary[]>('mrx_daily_batches')?.data;
  const snapshot = serverStateCache.get<any>('snapshot:mrx_cooking')?.data;
  const [batches, setBatches] = useState<MrxBatchSummary[]>(() => cachedBatches ?? []);
  const resolvedBatchId = urlBatchId || snapshot?.batchId || sessionScope.batchId || (cachedBatches?.[0]?.batchId || '');
  const [batchId, setBatchId] = useState(() => resolvedBatchId);
  const [selectedShift, setSelectedShift] = useState<'ALL' | 'MORNING' | 'AFTERNOON'>(() => snapshot?.selectedShift || 'ALL');

  const {
    data,
    stateProps,
    refetch: loadCookingData,
  } = useWorkbenchQuery<MrxKitchenCooking>({
    scopeKey: 'mrx_cooking',
    cacheKey: `mrx_cooking_${batchId}`,
    snapshotKey: 'snapshot:mrx_cooking',
    scopeId: batchId,
    isCatalogLoading: !cachedBatches && batches.length === 0,
    queryFn: () => mrxApi.getKitchenCooking(batchId),
    isCompatibilityBlocked: (cause: unknown) => {
      const err = cause instanceof Error ? cause : new Error();
      return err.message.includes('KITCHEN_FROZEN_LINEAGE_MISSING') || err.message.includes('LEGACY_DAILY_LINEAGE_MISSING') || (cause instanceof ApiError && cause.status === 409);
    },
    isDatasetEmpty: (res: MrxKitchenCooking) => !res || res.rows.length === 0,
    emptyTitle: !batchId ? 'Chưa có lô đối soát' : 'Không có dòng phiếu nấu cho lô đã chọn',
    emptyDescription: !batchId ? 'Chưa có lô đối soát nào được chọn.' : 'Lô này chưa có dữ liệu món ăn cho ca đã chọn.',
  });

  useEffect(() => {
    let ignore = false;
    mrxApi.getBatchPage({ pageSize: 50 })
      .then((page) => {
        if (ignore) return;
        const items = page?.items ?? [];
        setBatches(items);
        serverStateCache.set('mrx_daily_batches', items);
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
          const chosen = items.find((b) => b.status === 'TRANSFERRED' || b.status === 'IN_PROGRESS') || items[0];
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
      .catch(() => {});
    return () => { ignore = true; };
  }, [batchId, urlBatchId, setSearchParams]);

  const dishGroups = useMemo<DishGroup[]>(() => {
    if (!data?.rows) return [];
    const map = new Map<string, DishGroup>();
    for (const r of data.rows) {
      const key = `${r.serviceDate}_${r.shiftName}_${r.dishCode}`;
      const existing = map.get(key);
      if (existing) {
        existing.rows.push(r);
      } else {
        map.set(key, {
          key,
          serviceDate: r.serviceDate,
          weekday: r.weekday,
          shiftName: r.shiftName,
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
    const filterText = selectedShift === 'MORNING' ? 'Ca 1' : 'Ca 2';
    return dishGroups.filter((g) => g.shiftName.includes(filterText));
  }, [dishGroups, selectedShift]);

  const totalFilteredServings = useMemo(
    () => filteredDishGroups.reduce((sum, g) => sum + g.servings, 0),
    [filteredDishGroups]
  );

  const csvUrl = batchId ? `/api/reconciliation/batches/${encodeURIComponent(batchId)}/kitchen-cooking/csv` : '';
  const xlsxUrl = batchId ? `/api/reconciliation/batches/${encodeURIComponent(batchId)}/kitchen-cooking/xlsx` : '';

  const isLegacyLineageMissing = Boolean(
    stateProps.error?.message.includes('KITCHEN_FROZEN_LINEAGE_MISSING') ||
    stateProps.error?.message.includes('LEGACY_DAILY_LINEAGE_MISSING') ||
    stateProps.isPartial
  );
  const displayedError = isLegacyLineageMissing ? null : stateProps.error;
  const nextAvailableBatch = batches.find((b) => b.batchId !== batchId && (b.status === 'READY' || b.status === 'TRANSFERRED' || b.status === 'IN_PROGRESS'));

  return (
    <WorkspaceFrame.Root className="select-text">
      <MrxCookingHeaderBranch
        batches={batches}
        batchId={batchId}
        onSelectBatch={(newId) => {
          const b = batches.find((item) => item.batchId === newId);
          setBatchId(newId);
          if (b) {
            workspaceSessionStore.setScope({
              batchId: newId,
              customerId: b.customerId,
              customerCode: b.customerCode || '',
              customerName: b.customerName || '',
            });
          }
          setSearchParams((curr) => {
            const next = new URLSearchParams(curr);
            next.set('batchId', newId);
            return next;
          }, { replace: true });
        }}
        selectedShift={selectedShift}
        onSelectShift={(shift) => setSelectedShift(shift)}
        data={data}
        onDownloadCsv={() => {
          if (csvUrl) window.open(csvUrl, '_blank');
        }}
        onDownloadXlsx={() => {
          if (xlsxUrl) window.open(xlsxUrl, '_blank');
        }}
        onPrint={() => window.print()}
      />

      <TelemetrySubbar
        leftControls={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">Phiếu nấu theo từng món ăn trong ca</span>
          </div>
        }
        telemetryPills={data ? (
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Số món:</span>
              <strong className="text-slate-900 font-mono">{filteredDishGroups.length}</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng suất:</span>
              <strong className="text-slate-900 font-mono">{totalFilteredServings} suất</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Dòng nguyên liệu:</span>
              <strong className="text-slate-900 font-mono">
                {filteredDishGroups.reduce((sum, g) => sum + g.rows.length, 0)}
              </strong>
            </span>
          </>
        ) : null}
      />

      <WorkspaceFrame.Body>
        <StateBoundary
          {...stateProps}
          error={displayedError}
          onRetry={() => { if (batchId) void loadCookingData(true); }}
          isPartial={false}
          isEmpty={stateProps.isEmpty || isLegacyLineageMissing}
          emptyTitle={isLegacyLineageMissing ? "Lô đối soát chưa có phân rã phiếu nấu theo ca" : stateProps.emptyTitle}
          emptyDescription={isLegacyLineageMissing ? "Lô đối soát này được tạo từ phiên bản trước khi áp dụng tính năng phân rã phiếu nấu theo ca. Vui lòng chọn lô đối soát khác trong danh sách phía trên." : "Lô đối soát cần có lịch món, số suất và BOM định mức đã đóng băng."}
          actionLabel={isLegacyLineageMissing && nextAvailableBatch ? `Chuyển sang lô ${nextAvailableBatch.customerCode ?? 'khác'} (${nextAvailableBatch.batchId.slice(0, 8)})` : (!batchId || batches.length === 0 ? 'Xem tiến độ tại Bàn điều hành' : undefined)}
          onAction={isLegacyLineageMissing && nextAvailableBatch ? () => {
            setBatchId(nextAvailableBatch.batchId);
            setSearchParams((curr) => {
              const next = new URLSearchParams(curr);
              next.set('batchId', nextAvailableBatch.batchId);
              return next;
            }, { replace: true });
          } : (!batchId || batches.length === 0 ? () => navigate('/') : undefined)}
        >
          <MrxCookingDishListBranch groups={filteredDishGroups} />
        </StateBoundary>
      </WorkspaceFrame.Body>
    </WorkspaceFrame.Root>
  );
}
