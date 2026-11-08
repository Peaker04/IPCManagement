import { useEffect, useMemo, useState, useRef, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxWarehouseDaily, type MrxIssuePage, type MrxBatchSummary, type MrxBatchPage } from '../../../api/mrxApi';
import { ApiError } from '../../../api/client';
import { invalidateMrxCaches } from '../../../api/mrxCacheInvalidation';
import { serverStateCache } from '../../../store/serverStateCache';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';
import { isServiceDate, todayInBusinessTimezone, weekStartFor } from '../../../utils/dates';
import { useAuth } from '../../../store/useAuth';
import { getDraftStorageKey } from '../../../hooks/useClientDraftPersistence';
import { normalizeQuantity } from '../mrxQuantity';

interface UseMrxDailyWorkspaceProps {
  batchId?: string;
  serviceDate?: string;
}

interface MrxDailyCachedPayload {
  activeBatchId?: string;
  activeDate?: string;
  daily?: MrxWarehouseDaily;
  data?: { daily?: MrxWarehouseDaily };
}

const isUnknownIssueOutcome = (cause: unknown) => !(cause instanceof ApiError) || cause.status >= 500 || cause.code === 'SESSION_CHANGED';

export function useMrxDailyWorkspace({
  batchId: propBatchId = '',
  serviceDate: propServiceDate = '',
}: UseMrxDailyWorkspaceProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const sessionScope = workspaceSessionStore.getScope();
  const cachedBatches = serverStateCache.get<MrxBatchSummary[]>('mrx_daily_batches')?.data;
  const [snapshot] = useState(() => serverStateCache.get<MrxDailyCachedPayload>('snapshot:mrx_daily')?.data);
  const [batches, setBatches] = useState<MrxBatchSummary[]>(() => cachedBatches ?? []);
  const [catalogLoading, setCatalogLoading] = useState(!cachedBatches);
  const [catalogError, setCatalogError] = useState<Error | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPaging, setCatalogPaging] = useState<MrxBatchPage | null>(null);
  const retryCatalog = () => { setCatalogLoading(true); setCatalogError(null); setCatalogRetry((value) => value + 1); };

  const explicitBatchId = propBatchId || searchParams.get('batchId') || '';
  const explicitDate = propServiceDate || searchParams.get('date') || '';
  const resolvedInitialBatchId = explicitBatchId || snapshot?.activeBatchId || sessionScope.batchId || cachedBatches?.[0]?.batchId || '';
  const initialCache = resolvedInitialBatchId
    ? serverStateCache.get<MrxDailyCachedPayload>(`mrx_daily_${resolvedInitialBatchId}`)?.data
    : null;
  const urlDate = explicitDate || null;
  const initialDailyCandidate = initialCache?.daily ?? initialCache?.data?.daily ?? snapshot?.daily ?? snapshot?.data?.daily;
  const initialDaily = initialDailyCandidate?.batchId === resolvedInitialBatchId ? initialDailyCandidate : null;
  const matchedDateInDaily = initialDaily?.dates.find((date) => date.serviceDate === (urlDate || snapshot?.activeDate || sessionScope.serviceDate));
  const fallbackDailyDate = initialDaily?.dates[0]?.serviceDate;
  const resolvedInitialDate = urlDate || (matchedDateInDaily ? matchedDateInDaily.serviceDate : (fallbackDailyDate || snapshot?.activeDate || sessionScope.serviceDate || todayInBusinessTimezone()));

  const [selectedDate, setActiveDate] = useState(() => resolvedInitialDate);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState(() => resolvedInitialBatchId);
  const [historyPageState, setHistoryPageState] = useState({ batchId: activeBatchId, page: 1 });
  const historyPage = historyPageState.batchId === activeBatchId ? historyPageState.page : 1;
  const setHistoryPage = (page: number) => setHistoryPageState({ batchId: activeBatchId, page });

  const [issueOutcomeUnknown, setIssueOutcomeUnknown] = useState(false);
  const attemptedCommand = useRef<{ initial?: string; supplemental?: string }>({});
  const [draft, setDraft] = useState<{ scope: string; quantities: Record<string, string>; reasons: Record<string, string> }>({ scope: '', quantities: {}, reasons: {} });
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [issueSuccessScope, setIssueSuccessScope] = useState('');

  const [isSupplementalOpen, setIsSupplementalOpen] = useState(false);
  const [suppMaterialId, setSuppMaterialId] = useState('');
  const [suppQuantity, setSuppQuantity] = useState('');
  const [suppReason, setSuppReason] = useState('');
  const [isSubmittingSupp, setIsSubmittingSupp] = useState(false);
  const [suppError, setSuppError] = useState<string | null>(null);
  const [suppOutcomeUnknown, setSuppOutcomeUnknown] = useState(false);
  const [inspectedIssueId, setInspectedIssueId] = useState<string | null>(null);

  const scopeLocked = saving || isSubmittingSupp || issueOutcomeUnknown || suppOutcomeUnknown;
  const routeBatchMismatch = Boolean(explicitBatchId && explicitBatchId !== activeBatchId);
  const routeDateMismatch = Boolean(explicitDate && explicitDate !== selectedDate);
  const routeMismatch = routeBatchMismatch || routeDateMismatch;

  const resetTransientScopeState = () => {
    if (scopeLocked) return;
    setDraft({ scope: '', quantities: {}, reasons: {} });
    setDateValidationError(null);
    setMutationError(null);
    setIssueSuccessScope('');
    setIsSupplementalOpen(false);
    setSuppMaterialId('');
    setSuppQuantity('');
    setSuppReason('');
    setSuppError(null);
    setInspectedIssueId(null);
    attemptedCommand.current = {};
  };

  if (routeMismatch && !scopeLocked) {
    setDraft({ scope: '', quantities: {}, reasons: {} });
    setDateValidationError(null);
    setMutationError(null);
    setIssueSuccessScope('');
    setIsSupplementalOpen(false);
    setSuppMaterialId('');
    setSuppQuantity('');
    setSuppReason('');
    setSuppError(null);
    setInspectedIssueId(null);
    const targetBatchId = explicitBatchId || activeBatchId;
    if (explicitBatchId && explicitBatchId !== activeBatchId) {
      setActiveBatchId(explicitBatchId);
      setHistoryPageState({ batchId: explicitBatchId, page: 1 });
    }
    if (explicitDate) {
      setActiveDate(explicitDate);
    } else if (explicitBatchId && explicitBatchId !== activeBatchId) {
      const cachedTarget = serverStateCache.get<MrxDailyCachedPayload>(`mrx_daily_${targetBatchId}`)?.data;
      const targetDaily = cachedTarget?.daily ?? cachedTarget?.data?.daily;
      const batchSummary = batches.find((item) => item.batchId === targetBatchId);
      const nextDate = (targetDaily?.batchId === targetBatchId ? targetDaily.dates[0]?.serviceDate : undefined)
        || batchSummary?.weekStartDate
        || '';
      setActiveDate(nextDate);
    }
  }

  const resolveActiveDate = (source: MrxWarehouseDaily | null) => {
    const candidate = selectedDate;
    if (urlDate === selectedDate && urlDate) return candidate;
    if (candidate === 'ALL' || !source?.dates.length || source.dates.some(date => date.serviceDate === candidate)) return candidate;
    return source.dates[0].serviceDate;
  };

  const dailyQuery = useWorkbenchQuery<{ daily: MrxWarehouseDaily | null; history: MrxIssuePage | null }>({
    scopeKey: 'mrx_daily',
    cacheKey: `mrx_daily_${activeBatchId}${historyPage > 1 ? `_history_${historyPage}` : ''}`,
    snapshotKey: historyPage === 1 && snapshot?.activeBatchId === activeBatchId
      ? 'snapshot:mrx_daily'
      : `snapshot:mrx_daily_${activeBatchId}_${historyPage}`,
    scopeId: activeBatchId,
    isCatalogLoading: catalogLoading,
    queryFn: async () => {
      const [nextDaily, nextHistory] = await Promise.all([
        mrxApi.getWarehouseDaily(activeBatchId),
        mrxApi.getIssues(activeBatchId, historyPage, 25),
      ]);
      return { daily: nextDaily, history: nextHistory };
    },
    isCompatibilityBlocked: (cause) => {
      const err = cause instanceof Error ? cause : new Error();
      return err.message.includes('LEGACY_DAILY_LINEAGE_MISSING') || (cause instanceof ApiError && cause.code === 'LEGACY_DAILY_LINEAGE_MISSING');
    },
    isDatasetEmpty: (res) => {
      if (!res.daily) return true;
      const date = resolveActiveDate(res.daily);
      if (date === 'ALL') return res.daily.dates.every((d) => d.lines.length === 0);
      const d = res.daily.dates.find((item) => item.serviceDate === date);
      return !d || d.lines.length === 0;
    },
    emptyTitle: !activeBatchId ? 'Chưa có lô đối soát' : 'Không có định lượng cho ngày đã chọn',
    emptyDescription: !activeBatchId
      ? 'Chưa có lô đối soát nào được chọn hoặc khởi tạo cho tuần này.'
      : 'Kiểm tra lại ngày phục vụ hoặc chuyển sang màn hình Chuẩn bị phối hợp để xem toàn bộ các lô.',
  });
  const { data: queryPayload, stateProps, refetch: load } = dailyQuery;

  const daily = queryPayload?.daily?.batchId === activeBatchId ? queryPayload.daily : null;
  const activeDate = resolveActiveDate(daily);
  const isWeeklyAll = activeDate === 'ALL';
  useEffect(() => {
    if (!activeBatchId || !daily) return;
    workspaceSessionStore.setScope({ batchId: activeBatchId, serviceDate: activeDate, weekStartDate: activeDate === 'ALL' ? undefined : weekStartFor(activeDate) });
  }, [activeBatchId, activeDate, daily]);
  const history = daily && queryPayload?.history?.pageNumber === historyPage ? queryPayload.history : null;

  const draftScope = `${user?.userId}_${activeBatchId}_${activeDate}_${daily?.sourceVersion}`;
  const quantities = draft.scope === draftScope || issueOutcomeUnknown ? draft.quantities : {};
  const reasons = draft.scope === draftScope || issueOutcomeUnknown ? draft.reasons : {};
  const updateDraft = (field: 'quantities' | 'reasons', action: SetStateAction<Record<string, string>>) => {
    setDraft((current) => {
      const scoped = current.scope === draftScope ? current : { scope: draftScope, quantities: {}, reasons: {} };
      return { ...scoped, [field]: typeof action === 'function' ? action(scoped[field]) : action };
    });
  };
  const setQuantities = (action: SetStateAction<Record<string, string>>) => updateDraft('quantities', action);
  const setReasons = (action: SetStateAction<Record<string, string>>) => updateDraft('reasons', action);

  const activeBatchIdRef = useRef(activeBatchId);
  const explicitBatchIdRef = useRef(explicitBatchId);
  const sessionScopeRef = useRef(sessionScope);

  useEffect(() => {
    activeBatchIdRef.current = activeBatchId;
    explicitBatchIdRef.current = explicitBatchId;
    sessionScopeRef.current = sessionScope;
  }, [activeBatchId, explicitBatchId, sessionScope]);

  useEffect(() => {
    if (!scopeLocked) {
      attemptedCommand.current = {};
    }
  }, [activeBatchId, activeDate, scopeLocked]);

  useEffect(() => {
    if (!routeMismatch || !scopeLocked) return;
    setSearchParams((curr) => {
      const next = new URLSearchParams(curr);
      if (activeBatchId) next.set('batchId', activeBatchId);
      if (activeDate) next.set('date', activeDate);
      return next;
    }, { replace: true });
  }, [routeMismatch, scopeLocked, activeBatchId, activeDate, setSearchParams]);

  useEffect(() => {
    let ignore = false;
    mrxApi.getBatchPage({ pageSize: 50, pageNumber: catalogPage }).then((page) => {
      if (ignore) return;
      const items = [...(page?.items ?? [])].sort(
        (a, b) => new Date(b.weekStartDate || 0).getTime() - new Date(a.weekStartDate || 0).getTime()
      );
      setCatalogLoading(false);
      setCatalogError(null);
      setBatches(previous => {
        const selected = previous.find(item => item.batchId === activeBatchIdRef.current);
        return selected && !items.some(item => item.batchId === selected.batchId) ? [selected, ...items] : items;
      });
      setCatalogPaging(page);
      if (catalogPage === 1) serverStateCache.set('mrx_daily_batches', items);
      if (items.length > 0) {
        const curBatchId = explicitBatchIdRef.current || activeBatchIdRef.current;
        const curSession = sessionScopeRef.current;
        const existing = curBatchId && items.find((b) => b.batchId === curBatchId);
        if (existing) {
          workspaceSessionStore.setScope({ batchId: existing.batchId, customerId: existing.customerId, customerCode: existing.customerCode || '', customerName: existing.customerName || '' });
          return;
        }
        if (curBatchId) return;
        const sessionBatch = curSession.batchId;
        const matched = (sessionBatch && items.find((b) => b.batchId === sessionBatch)) ||
          (curSession.customerId && items.find((b) => b.customerId === curSession.customerId)) ||
          items.find((b) => b.status === 'TRANSFERRED' || b.status === 'IN_PROGRESS') || items[0];
        if (matched) {
          setActiveBatchId(matched.batchId);
          workspaceSessionStore.setScope({ batchId: matched.batchId, customerId: matched.customerId, customerCode: matched.customerCode || '', customerName: matched.customerName || '' });
          setSearchParams((curr) => { const next = new URLSearchParams(curr); next.set('batchId', matched.batchId); return next; }, { replace: true });
        }
      }
    }).catch((cause: unknown) => {
      if (ignore) return;
      setCatalogLoading(false);
      setCatalogError(cause instanceof Error ? cause : new Error('Không thể tải danh sách lô.'));
    });
    return () => { ignore = true; };
  }, [setSearchParams, catalogRetry, catalogPage]);

  const day = daily?.dates.find((item) => item.serviceDate === activeDate);
  const lines = useMemo(() => day?.lines.filter((l) => l.requiredQuantity > 0) ?? [], [day]);
  const hasInitialIssue = lines.some((l) => (l.issuedQuantity ?? 0) > 0);
  const draftKey = user?.userId && activeBatchId && !isWeeklyAll
    ? getDraftStorageKey(`mrx_initial_${activeBatchId}_${activeDate}`, user.userId) : null;

  const [restoredDraftKey, setRestoredDraftKey] = useState('');
  const restorableDraft = useMemo(() => {
    if (!draftKey || restoredDraftKey === draftKey || daily?.batchId !== activeBatchId || hasInitialIssue || lines.length === 0) return null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved.outcomeUnknown || saved.version !== daily.sourceVersion) return null;
      const ids = new Set(lines.map((line) => line.dailyLineId));
      const validRecord = (value: unknown): value is Record<string, string> =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
        && Object.entries(value).every(([id, text]) => ids.has(id) && typeof text === 'string');
      if (!validRecord(saved.quantities) || !validRecord(saved.reasons)
        || Object.keys(saved.quantities).length !== ids.size) return null;
      return { quantities: saved.quantities, reasons: saved.reasons };
    } catch {
      return null;
    }
  }, [draftKey, restoredDraftKey, daily, activeBatchId, lines, hasInitialIssue]);

  const restoreIssueDraft = () => {
    if (!draftKey || !restorableDraft) return;
    setQuantities(restorableDraft.quantities);
    setReasons(restorableDraft.reasons);
    setRestoredDraftKey(draftKey);
  };
  const isLegacyMissing = Boolean(stateProps.isPartial || stateProps.error?.message.includes('LEGACY_DAILY_LINEAGE_MISSING'));

  const weeklyAggregateLines = useMemo(() => {
    if (!daily?.dates) return [];
    const map = new Map<string, { id: string; ingredientCode: string; ingredientName: string; unitName: string; requiredQuantity: number; issuedQuantity: number | null; remainingQuantity: number; }>();
    for (const d of daily.dates) {
      for (const l of d.lines) {
        const key = `${l.ingredientId}_${l.canonicalUnitId}`;
        const existing = map.get(key);
        if (existing) {
          existing.requiredQuantity += l.requiredQuantity;
          existing.issuedQuantity = existing.issuedQuantity == null && l.issuedQuantity == null ? null : (existing.issuedQuantity ?? 0) + (l.issuedQuantity ?? 0);
          existing.remainingQuantity += l.remainingQuantity;
        } else {
          map.set(key, { id: key, ingredientCode: l.ingredientCode || l.ingredientId || '', ingredientName: l.ingredientName || '—', unitName: l.canonicalUnitName || 'Chưa rõ đơn vị', requiredQuantity: l.requiredQuantity, issuedQuantity: l.issuedQuantity ?? null, remainingQuantity: l.remainingQuantity });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.requiredQuantity - a.requiredQuantity);
  }, [daily]);

  const handleFillAll = () => {
    setQuantities(Object.fromEntries(lines.map((l) => [l.dailyLineId, String(l.requiredQuantity)])));
  };

  const canSubmit = Boolean(isServiceDate(activeDate) && !dateValidationError && !routeMismatch && daily?.batchId === activeBatchId && !stateProps.error && !stateProps.isFetching && !scopeLocked && day?.isApplicable && lines.length > 0 && !hasInitialIssue && !isWeeklyAll &&
    lines.every((l) => {
      const issued = normalizeQuantity(Number(quantities[l.dailyLineId]));
      return Number.isFinite(issued) && issued > 0 && (issued <= l.requiredQuantity || reasons[l.dailyLineId]?.trim());
    }));

  const submit = async () => {
    if (!daily || !day || !canSubmit || !activeBatchId || routeMismatch || scopeLocked) return;
    setSaving(true);
    setMutationError(null);
    setIssueSuccessScope('');
    if (draftKey) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ version: daily.sourceVersion, quantities, reasons, outcomeUnknown: true }));
      } catch {
        // Retain the in-memory draft if browser storage is unavailable.
      }
    }
    try {
      const receipt = await mrxApi.createIssue({
        commandId: attemptedCommand.current.initial ??= crypto.randomUUID(),
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
          issuedQty: normalizeQuantity(Number(quantities[l.dailyLineId])),
          varianceReason: reasons[l.dailyLineId]?.trim() || undefined,
        })),
      });
      if (!receipt?.issueId?.trim() || !receipt.issueCode?.trim()) throw new Error('Thiếu xác nhận phiếu xuất kho.');
      attemptedCommand.current.initial = undefined;
      if (draftKey) {
        try { localStorage.removeItem(draftKey); } catch { /* Committed issues cannot restore an editable draft. */ }
      }
      setIssueSuccessScope(`${activeBatchId}:${activeDate}`);
      setQuantities({});
      serverStateCache.delete(`mrx_daily_${activeBatchId}`);
      await load(true);
    } catch (cause) {
      const unknown = isUnknownIssueOutcome(cause);
      setIssueOutcomeUnknown(unknown);
      if (!unknown) {
        attemptedCommand.current.initial = undefined;
        if (draftKey) {
          try { localStorage.setItem(draftKey, JSON.stringify({ version: daily.sourceVersion, quantities, reasons })); }
          catch { /* Keep the in-memory draft. */ }
        }
      }
      setMutationError(cause instanceof Error ? cause : new Error('Không thể xác nhận xuất kho.'));
      if (cause instanceof ApiError && cause.status === 409) invalidateMrxCaches();
    } finally {
      setSaving(false);
    }
  };

  const handleSupplementalSubmit = async (customLines?: Array<{ dailyLineId: string; quantity: number; reason: string }>) => {
    if (!isServiceDate(activeDate) || dateValidationError || routeMismatch || !daily || !day || !activeBatchId || scopeLocked || stateProps.error || stateProps.isFetching) return;
    const items = customLines?.length ? customLines : (!suppMaterialId || !suppReason.trim() ? [] : [{
      dailyLineId: suppMaterialId, quantity: Number(suppQuantity), reason: suppReason.trim(),
    }]);
    if (items.length === 0 || items.some((item) => !Number.isFinite(normalizeQuantity(item.quantity)) || normalizeQuantity(item.quantity) <= 0 || !item.reason.trim())) return;
    setIsSubmittingSupp(true);
    setSuppError(null);
    setIssueSuccessScope('');
    try {
      const issueLines = items.map((item) => {
        const target = lines.find((l) => l.dailyLineId === item.dailyLineId);
        if (!target) throw new Error('Không tìm thấy nguyên liệu.');
        return {
          reconciliationBatchLineId: target.batchLineId,
          reconciliationBatchDailyLineId: target.dailyLineId,
          ingredientId: target.ingredientId,
          unitId: target.canonicalUnitId,
          requestedQty: normalizeQuantity(item.quantity),
          issuedQty: normalizeQuantity(item.quantity),
          varianceReason: item.reason,
        };
      });
      const receipt = await mrxApi.createIssue({
        commandId: attemptedCommand.current.supplemental ??= crypto.randomUUID(),
        expectedVersion: daily.sourceVersion,
        issueDate: activeDate,
        reconciliationBatchId: activeBatchId,
        isSupplemental: true,
        lines: issueLines,
      });
      if (!receipt?.issueId?.trim() || !receipt.issueCode?.trim()) throw new Error('Thiếu xác nhận phiếu xuất kho.');
      attemptedCommand.current.supplemental = undefined;
      setIssueSuccessScope(`${activeBatchId}:${activeDate}`);
      setIsSupplementalOpen(false);
      setSuppQuantity('');
      setSuppReason('');
      await load(true);
    } catch (cause) {
      const unknown = isUnknownIssueOutcome(cause);
      setSuppOutcomeUnknown(unknown);
      if (!unknown) attemptedCommand.current.supplemental = undefined;
      setSuppError(unknown
        ? 'Kết nối bị gián đoạn; phiếu có thể đã được ghi. Hãy tải lại để kiểm tra lịch sử trước khi xuất thêm.'
        : cause instanceof Error ? cause.message : 'Không thể thực hiện xuất bổ sung.');
    } finally {
      setIsSubmittingSupp(false);
    }
  };

  return {
    batches,
    catalogLoading,
    catalogPage,
    catalogPaging,
    changeCatalogPage: (page: number) => { if (!scopeLocked) { setCatalogLoading(true); setCatalogError(null); setCatalogPage(page); } },
    catalogError,
    retryCatalog,
    scopeLocked,
    resetTransientScopeState,
    activeBatchId,
    setActiveBatchId: (id: string) => { setDateValidationError(null); setActiveBatchId(id); },
    activeDate,
    setActiveDate: (date: string) => { setDateValidationError(null); setActiveDate(date); },
    setDateValidationError,
    isWeeklyAll,
    daily,
    day,
    history,
    historyPage,
    setHistoryPage,
    lines,
    weeklyAggregateLines,
    hasInitialIssue,
    isLegacyMissing,
    stateProps,
    load,
    quantities,
    hasRestorableIssueDraft: Boolean(restorableDraft),
    restoreIssueDraft,
    setQuantities,
    reasons,
    setReasons,
    saving,
    mutationError,
    issueOutcomeUnknown,
    setMutationError,
    issueSucceeded: issueSuccessScope === `${activeBatchId}:${activeDate}`,
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
    suppOutcomeUnknown,
    setSuppError,
    inspectedIssueId,
    setInspectedIssueId,
    handleFillAll,
    canSubmit,
    submit,
    handleSupplementalSubmit,
  };
}
