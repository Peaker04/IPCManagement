import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxWarehouseDaily, type MrxIssuePage, type MrxBatchSummary } from '../../../api/mrxApi';
import { ApiError } from '../../../api/client';
import { serverStateCache } from '../../../store/serverStateCache';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';
import { todayInBusinessTimezone, weekStartFor } from '../../../utils/dates';

interface UseMrxDailyWorkspaceProps {
  batchId?: string;
  serviceDate?: string;
}

export function useMrxDailyWorkspace({
  batchId: propBatchId = '',
  serviceDate: propServiceDate = '',
}: UseMrxDailyWorkspaceProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const sessionScope = workspaceSessionStore.getScope();
  const cachedBatches = serverStateCache.get<MrxBatchSummary[]>('mrx_daily_batches')?.data;
  const snapshot = serverStateCache.get<any>('snapshot:mrx_daily')?.data;
  const [batches, setBatches] = useState<MrxBatchSummary[]>(() => cachedBatches ?? []);

  const resolvedInitialBatchId = propBatchId || searchParams.get('batchId') || snapshot?.activeBatchId || sessionScope.batchId || cachedBatches?.[0]?.batchId || '';
  const initialCache = resolvedInitialBatchId
    ? serverStateCache.get<any>(`mrx_daily_${resolvedInitialBatchId}`)?.data
    : null;
  const urlDate = propServiceDate || searchParams.get('date');
  const initialDaily = snapshot?.daily ?? snapshot?.data?.daily ?? initialCache?.daily ?? initialCache?.data?.daily;
  const matchedDateInDaily = initialDaily?.dates.find((d: any) => d.serviceDate === (urlDate || snapshot?.activeDate || sessionScope.serviceDate));
  const fallbackDailyDate = initialDaily?.dates[0]?.serviceDate;
  const resolvedInitialDate = urlDate || (matchedDateInDaily ? matchedDateInDaily.serviceDate : (fallbackDailyDate || snapshot?.activeDate || sessionScope.serviceDate || todayInBusinessTimezone()));

  const [activeDate, setActiveDate] = useState(() => resolvedInitialDate);
  const [activeBatchId, setActiveBatchId] = useState(() => resolvedInitialBatchId);

  const isWeeklyAll = activeDate === 'ALL';

  const {
    data: queryPayload,
    stateProps,
    refetch: load,
  } = useWorkbenchQuery<{ daily: MrxWarehouseDaily | null; history: MrxIssuePage | null }>({
    scopeKey: 'mrx_daily',
    cacheKey: `mrx_daily_${activeBatchId}`,
    snapshotKey: 'snapshot:mrx_daily',
    scopeId: activeBatchId,
    isCatalogLoading: !cachedBatches && batches.length === 0,
    queryFn: async () => {
      const [nextDaily, nextHistory] = await Promise.all([
        mrxApi.getWarehouseDaily(activeBatchId),
        mrxApi.getIssues(activeBatchId),
      ]);
      const matched = nextDaily.dates.find((d) => d.serviceDate === activeDate);
      const selected = matched || (activeDate === 'ALL' ? undefined : nextDaily.dates[0]);
      workspaceSessionStore.setScope({
        batchId: activeBatchId,
        serviceDate: selected ? selected.serviceDate : activeDate,
        weekStartDate: weekStartFor(selected ? selected.serviceDate : activeDate),
      });
      return { daily: nextDaily, history: nextHistory };
    },
    isCompatibilityBlocked: (cause) => {
      const err = cause instanceof Error ? cause : new Error();
      return err.message.includes('LEGACY_DAILY_LINEAGE_MISSING') || (cause instanceof ApiError && cause.status === 409);
    },
    isDatasetEmpty: (res) => {
      if (!res.daily) return true;
      if (isWeeklyAll) return res.daily.dates.every((d) => d.lines.length === 0);
      const targetDate = res.daily.dates.some((d) => d.serviceDate === activeDate)
        ? activeDate
        : res.daily.dates[0]?.serviceDate || activeDate;
      const d = res.daily.dates.find((item) => item.serviceDate === targetDate);
      return !d || d.lines.length === 0;
    },
    emptyTitle: !activeBatchId ? 'Chưa có lô đối soát' : 'Không có định lượng cho ngày đã chọn',
    emptyDescription: !activeBatchId
      ? 'Chưa có lô đối soát nào được chọn hoặc khởi tạo cho tuần này.'
      : 'Kiểm tra lại ngày phục vụ hoặc chuyển sang màn hình Chuẩn bị phối hợp để xem toàn bộ các lô.',
  });

  const daily = queryPayload?.daily ?? null;
  const history = queryPayload?.history ?? null;

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<Error | null>(null);

  const [isSupplementalOpen, setIsSupplementalOpen] = useState(false);
  const [suppMaterialId, setSuppMaterialId] = useState('');
  const [suppQuantity, setSuppQuantity] = useState('');
  const [suppReason, setSuppReason] = useState('');
  const [isSubmittingSupp, setIsSubmittingSupp] = useState(false);
  const [suppError, setSuppError] = useState<string | null>(null);
  const [inspectedIssueId, setInspectedIssueId] = useState<string | null>(null);

  const activeBatchIdRef = useRef(activeBatchId);
  activeBatchIdRef.current = activeBatchId;
  const sessionScopeRef = useRef(sessionScope);
  sessionScopeRef.current = sessionScope;

  useEffect(() => {
    let ignore = false;
    mrxApi.getBatchPage({ pageSize: 50 }).then((page) => {
      if (ignore) return;
      const items = [...(page?.items ?? [])].sort(
        (a, b) => new Date(b.weekStartDate || 0).getTime() - new Date(a.weekStartDate || 0).getTime()
      );
      setBatches(items);
      serverStateCache.set('mrx_daily_batches', items);
      if (items.length > 0) {
        const curBatchId = activeBatchIdRef.current;
        const curSession = sessionScopeRef.current;
        const existing = curBatchId && items.find((b) => b.batchId === curBatchId);
        if (existing) {
          workspaceSessionStore.setScope({ batchId: existing.batchId, customerId: existing.customerId, customerCode: existing.customerCode || '', customerName: existing.customerName || '' });
          return;
        }
        const urlBatch = propBatchId || searchParams.get('batchId');
        const sessionBatch = curSession.batchId;
        const matched = (urlBatch && items.find((b) => b.batchId === urlBatch)) ||
          (sessionBatch && items.find((b) => b.batchId === sessionBatch)) ||
          (curSession.customerId && items.find((b) => b.customerId === curSession.customerId)) ||
          items.find((b) => b.status === 'TRANSFERRED' || b.status === 'IN_PROGRESS') || items[0];
        if (matched) {
          setActiveBatchId(matched.batchId);
          workspaceSessionStore.setScope({ batchId: matched.batchId, customerId: matched.customerId, customerCode: matched.customerCode || '', customerName: matched.customerName || '' });
          setSearchParams((curr) => { const next = new URLSearchParams(curr); next.set('batchId', matched.batchId); return next; }, { replace: true });
        }
      }
    }).catch(() => {});
    return () => { ignore = true; };
  }, [propBatchId, searchParams, setSearchParams]);

  const effectiveServiceDate = (daily && !isWeeklyAll && !daily.dates.some((d) => d.serviceDate === activeDate))
    ? (daily.dates[0]?.serviceDate || activeDate)
    : activeDate;
  const day = daily?.dates.find((item) => item.serviceDate === effectiveServiceDate);
  const lines = useMemo(() => day?.lines.filter((l) => l.requiredQuantity > 0) ?? [], [day]);
  const hasInitialIssue = lines.some((l) => (l.issuedQuantity ?? 0) > 0);
  const isLegacyMissing = Boolean(stateProps.isPartial || stateProps.error?.message.includes('LEGACY_DAILY_LINEAGE_MISSING'));

  useEffect(() => {
    if (daily && !isWeeklyAll && effectiveServiceDate !== activeDate) {
      setActiveDate(effectiveServiceDate);
      workspaceSessionStore.setScope({ serviceDate: effectiveServiceDate, weekStartDate: weekStartFor(effectiveServiceDate) });
      setSearchParams((curr) => {
        const next = new URLSearchParams(curr);
        next.set('date', effectiveServiceDate);
        return next;
      }, { replace: true });
    }
  }, [daily, isWeeklyAll, effectiveServiceDate, activeDate, setSearchParams]);

  const weeklyAggregateLines = useMemo(() => {
    if (!daily?.dates) return [];
    const map = new Map<string, { id: string; ingredientCode: string; ingredientName: string; unitName: string; requiredQuantity: number; issuedQuantity: number; remainingQuantity: number; }>();
    for (const d of daily.dates) {
      for (const l of d.lines) {
        const key = l.ingredientCode || l.ingredientId;
        const existing = map.get(key);
        if (existing) {
          existing.requiredQuantity += l.requiredQuantity;
          existing.issuedQuantity += (l.issuedQuantity ?? 0);
          existing.remainingQuantity += (l.remainingQuantity ?? 0);
        } else {
          map.set(key, { id: key, ingredientCode: l.ingredientCode || l.ingredientId || '', ingredientName: l.ingredientName || '—', unitName: l.canonicalUnitName || 'kg', requiredQuantity: l.requiredQuantity, issuedQuantity: l.issuedQuantity ?? 0, remainingQuantity: l.remainingQuantity ?? 0 });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.requiredQuantity - a.requiredQuantity);
  }, [daily]);

  const handleFillAll = () => {
    setQuantities(Object.fromEntries(lines.map((l) => [l.dailyLineId, String(l.requiredQuantity)])));
  };

  const canSubmit = Boolean(day?.isApplicable && lines.length > 0 && !hasInitialIssue && !saving && !isWeeklyAll &&
    lines.every((l) => {
      const issued = Number(quantities[l.dailyLineId]);
      return issued > 0 && (issued <= l.requiredQuantity || reasons[l.dailyLineId]?.trim());
    }));

  const submit = async () => {
    if (!daily || !day || !canSubmit || !activeBatchId) return;
    setSaving(true);
    setMutationError(null);
    try {
      await mrxApi.createIssue({
        commandId: crypto.randomUUID(),
        expectedVersion: daily.sourceVersion,
        issueDate: activeDate,
        reconciliationBatchId: activeBatchId,
        isSupplemental: false,
        lines: lines.map((l) => ({
          reconciliationBatchLineId: l.batchLineId,
          reconciliationBatchDailyLineId: l.dailyLineId,
          ingredientId: l.ingredientId,
          unitId: l.canonicalUnitId,
          requestedQty: l.requiredQuantity,
          issuedQty: Number(quantities[l.dailyLineId]),
          varianceReason: reasons[l.dailyLineId]?.trim() || undefined,
        })),
      });
      setQuantities({});
      serverStateCache.delete(`mrx_daily_${activeBatchId}`);
      await load(true);
    } catch (cause) {
      setMutationError(cause instanceof Error ? cause : new Error('Không thể xác nhận xuất kho.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSupplementalSubmit = async (customLines?: Array<{ dailyLineId: string; quantity: number; reason: string }>) => {
    if (!daily || !activeBatchId) return;
    const items = customLines?.length ? customLines : (!suppMaterialId || Number(suppQuantity) <= 0 || !suppReason.trim() ? [] : [{
      dailyLineId: suppMaterialId, quantity: Number(suppQuantity), reason: suppReason.trim(),
    }]);
    if (items.length === 0) return;
    setIsSubmittingSupp(true);
    setSuppError(null);
    try {
      const issueLines = items.map((item) => {
        const target = lines.find((l) => l.dailyLineId === item.dailyLineId);
        if (!target) throw new Error('Không tìm thấy nguyên liệu.');
        return {
          reconciliationBatchLineId: target.batchLineId,
          reconciliationBatchDailyLineId: target.dailyLineId,
          ingredientId: target.ingredientId,
          unitId: target.canonicalUnitId,
          requestedQty: item.quantity,
          issuedQty: item.quantity,
          varianceReason: item.reason,
        };
      });
      await mrxApi.createIssue({
        commandId: crypto.randomUUID(),
        expectedVersion: daily.sourceVersion,
        issueDate: activeDate,
        reconciliationBatchId: activeBatchId,
        isSupplemental: true,
        lines: issueLines,
      });
      setIsSupplementalOpen(false);
      setSuppQuantity('');
      setSuppReason('');
      await load(true);
    } catch (cause) {
      setSuppError(cause instanceof Error ? cause.message : 'Không thể thực hiện xuất bổ sung.');
    } finally {
      setIsSubmittingSupp(false);
    }
  };

  return {
    batches,
    activeBatchId,
    setActiveBatchId,
    activeDate,
    setActiveDate,
    isWeeklyAll,
    daily,
    day,
    history,
    lines,
    weeklyAggregateLines,
    hasInitialIssue,
    isLegacyMissing,
    stateProps,
    load,
    quantities,
    setQuantities,
    reasons,
    setReasons,
    saving,
    mutationError,
    setMutationError,
    isSupplementalOpen,
    setIsSupplementalOpen,
    suppMaterialId,
    setSuppMaterialId,
    suppQuantity,
    setSuppQuantity,
    suppReason,
    setSuppReason,
    isSubmittingSupp,
    suppError,
    setSuppError,
    inspectedIssueId,
    setInspectedIssueId,
    handleFillAll,
    canSubmit,
    submit,
    handleSupplementalSubmit,
  };
}
