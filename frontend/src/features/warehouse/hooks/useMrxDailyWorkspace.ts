import { useEffect, useMemo, useState, useRef, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxWarehouseDaily, type MrxIssuePage, type MrxBatchSummary, type MrxBatchPage, type CreateMrxIssueRequest } from '../../../api/mrxApi';
import { ApiError } from '../../../api/client';
import { invalidateMrxCaches } from '../../../api/mrxCacheInvalidation';
import { getCachedArray, serverStateCache } from '../../../store/serverStateCache';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';
import { isServiceDate, todayInBusinessTimezone, weekStartFor } from '../../../utils/dates';
import { useAuth } from '../../../store/useAuth';
import { getDraftStorageKey } from '../../../hooks/useClientDraftPersistence';
import type { SupplementalIssueSelection } from '../MrxSupplementalFulfillmentForm';
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

interface PendingIssueCommand {
  actorId: string;
  mode: string;
  modeVersion: number | null;
  request: CreateMrxIssueRequest;
}

const isUnknownIssueOutcome = (cause: unknown) => !(cause instanceof ApiError) || cause.status >= 500 || cause.code === 'SESSION_CHANGED';

export function useMrxDailyWorkspace({
  batchId: propBatchId = '',
  serviceDate: propServiceDate = '',
}: UseMrxDailyWorkspaceProps = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, operationalMode, operationalModeVersion } = useAuth();

  const sessionScope = workspaceSessionStore.getScope();
  const cachedBatches = getCachedArray<MrxBatchSummary>('mrx_daily_batches');
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
  const hasSessionSelection = Boolean(sessionScope.customerId || sessionScope.customerCode || sessionScope.weekStartDate);
  const matchingSessionBatch = cachedBatches?.find(batch => batch.customerId === sessionScope.customerId && batch.weekStartDate === sessionScope.weekStartDate)
    || cachedBatches?.find(batch => batch.customerId === sessionScope.customerId);
  const resolvedInitialBatchId = explicitBatchId || sessionScope.batchId || (hasSessionSelection ? matchingSessionBatch?.batchId : cachedBatches?.[0]?.batchId) || '';
  const initialCache = resolvedInitialBatchId
    ? serverStateCache.get<MrxDailyCachedPayload>(`mrx_daily_${resolvedInitialBatchId}`)?.data
    : null;
  const urlDate = explicitDate || null;
  const initialDailyCandidate = initialCache?.daily ?? initialCache?.data?.daily ?? snapshot?.daily ?? snapshot?.data?.daily;
  const initialDaily = initialDailyCandidate?.batchId === resolvedInitialBatchId ? initialDailyCandidate : null;
  const rememberedDate = sessionScope.batchId === resolvedInitialBatchId ? sessionScope.serviceDate : '';
  const matchedDateInDaily = initialDaily?.dates.find((date) => date.serviceDate === (urlDate || rememberedDate));
  const fallbackDailyDate = initialDaily?.dates[0]?.serviceDate;
  const resolvedInitialDate = urlDate || (matchedDateInDaily ? matchedDateInDaily.serviceDate : (fallbackDailyDate || rememberedDate || todayInBusinessTimezone()));

  const [selectedDate, setActiveDate] = useState(() => resolvedInitialDate);
  const [dateValidationError, setDateValidationError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState(() => resolvedInitialBatchId);
  const [historyPageState, setHistoryPageState] = useState({ batchId: activeBatchId, page: 1 });
  const historyPage = historyPageState.batchId === activeBatchId ? historyPageState.page : 1;
  const setHistoryPage = (page: number) => setHistoryPageState({ batchId: activeBatchId, page });

  const initialStorageKey = (batch: string, date: string) => user?.userId
    ? getDraftStorageKey(`mrx_initial_${batch}_${date}`, user.userId) : null;
  const [pendingInitial, setPendingInitial] = useState<PendingIssueCommand | null>(() => {
    const key = initialStorageKey(resolvedInitialBatchId, resolvedInitialDate);
    if (!key) return null;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      return saved?.outcomeUnknown && saved.actorId === user?.userId && saved.mode === operationalMode
        && saved.request?.reconciliationBatchId === resolvedInitialBatchId && saved.request?.issueDate === resolvedInitialDate
        && saved.request?.isSupplemental === false && typeof saved.request?.commandId === 'string'
        && Array.isArray(saved.request.lines) && saved.request.lines.length > 0
        ? { actorId: saved.actorId, mode: saved.mode, modeVersion: saved.modeVersion, request: saved.request } : null;
    } catch { return null; }
  });
  const issueOutcomeUnknown = Boolean(pendingInitial);
  const attemptedCommand = useRef<{ initial?: string; supplemental?: string }>({});
  const [draft, setDraft] = useState<{ scope: string; quantities: Record<string, string>; reasons: Record<string, string> }>({ scope: '', quantities: {}, reasons: {} });
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const initialSending = useRef(false);
  const [issueSuccessScope, setIssueSuccessScope] = useState('');

  const supplementalStorageKey = (batch: string, date: string) => user?.userId
    ? getDraftStorageKey(`mrx_supplemental_command_${operationalMode}_${batch}_${date}`, user.userId) : null;
  const [pendingSupplemental, setPendingSupplemental] = useState<PendingIssueCommand | null>(() => {
    const key = supplementalStorageKey(resolvedInitialBatchId, resolvedInitialDate);
    if (!key) return null;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null');
      return saved?.actorId === user?.userId && saved?.mode === operationalMode
        && saved?.request?.reconciliationBatchId === resolvedInitialBatchId && saved?.request?.issueDate === resolvedInitialDate
        && saved?.request?.isSupplemental === true && typeof saved?.request?.commandId === 'string'
        && Array.isArray(saved.request.lines) && saved.request.lines.length > 0 ? saved : null;
    } catch { return null; }
  });
  const [isSupplementalOpen, setIsSupplementalOpen] = useState(Boolean(pendingSupplemental));
  const [isSubmittingSupp, setIsSubmittingSupp] = useState(false);
  const supplementalSending = useRef(false);
  const [suppError, setSuppError] = useState<string | null>(pendingSupplemental ? 'Lệnh xuất trước chưa rõ kết quả. Kiểm tra lại cùng lệnh đã gửi trước khi xuất thêm.' : null);
  const [suppOutcomeUnknown, setSuppOutcomeUnknown] = useState(Boolean(pendingSupplemental));
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

  const dailyQuery = useWorkbenchQuery<{ daily: MrxWarehouseDaily | null }>({
    scopeKey: 'mrx_daily',
    cacheKey: `mrx_daily_${activeBatchId}`,
    snapshotKey: snapshot?.activeBatchId === activeBatchId
      ? 'snapshot:mrx_daily'
      : `snapshot:mrx_daily_${activeBatchId}_1`,
    scopeId: activeBatchId,
    isCatalogLoading: catalogLoading,
    queryFn: async (_, signal) => {
      const daily = await mrxApi.getWarehouseDaily(activeBatchId, signal);
      if (!daily || !Array.isArray(daily.dates)) throw new Error('Không nhận được định lượng xuất kho của lô.');
      return { daily };
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
  const historyQuery = useWorkbenchQuery<{ batchId: string; requestedPage: number; page: MrxIssuePage }>({
    scopeKey: 'mrx_daily_history',
    cacheKey: `mrx_daily_history_${activeBatchId}_${historyPage}`,
    snapshotKey: '',
    scopeId: activeBatchId,
    queryFn: async (_, signal) => {
      const page = await mrxApi.getIssues(activeBatchId, historyPage, 25, signal);
      if (!page || !Array.isArray(page.items)) throw new Error('Không nhận được lịch sử phiếu xuất của lô.');
      return { batchId: activeBatchId, requestedPage: historyPage, page };
    },
  });
  const { data: queryPayload, stateProps, refetch: refetchDaily } = dailyQuery;
  const { data: historyPayload, stateProps: historyState, refetch: refetchHistory } = historyQuery;
  const load = async (force?: boolean) => {
    await Promise.all([refetchDaily(force), refetchHistory(force)]);
  };

  const isLegacyMissing = Boolean(stateProps.isPartial || stateProps.error?.message.includes('LEGACY_DAILY_LINEAGE_MISSING'));
  const isTransitioningBatch = Boolean(
    queryPayload?.daily &&
    queryPayload.daily.batchId !== activeBatchId &&
    !stateProps.error &&
    !isLegacyMissing &&
    batches.some((b) => b.batchId === queryPayload.daily?.batchId)
  );
  const daily = queryPayload?.daily?.batchId === activeBatchId
    ? queryPayload.daily
    : (isTransitioningBatch ? (queryPayload?.daily ?? null) : null);
  const activeDate = resolveActiveDate(daily);
  const isWeeklyAll = activeDate === 'ALL';
  const [renderedScope, setRenderedScope] = useState({ batchId: activeBatchId, date: activeDate });
  if (daily?.batchId === activeBatchId && (renderedScope.batchId !== activeBatchId || renderedScope.date !== activeDate)) {
    setRenderedScope({ batchId: activeBatchId, date: activeDate });
  }
  // Keep the retained response paired with its own day until the requested lot arrives.
  const displayDate = isTransitioningBatch && renderedScope.batchId === daily?.batchId ? renderedScope.date : activeDate;
  useEffect(() => {
    if (!activeBatchId || !daily || daily.batchId !== activeBatchId) return;
    workspaceSessionStore.setScope({ batchId: activeBatchId, serviceDate: activeDate, weekStartDate: activeDate === 'ALL' ? undefined : weekStartFor(activeDate) });
  }, [activeBatchId, activeDate, daily]);
  const history = daily?.batchId === historyPayload?.batchId ? historyPayload?.page ?? null : null;
  const isHistoryPageStale = Boolean(history && historyPayload?.requestedPage !== historyPage);

  const draftScope = `${user?.userId}_${activeBatchId}_${activeDate}_${daily?.sourceVersion}`;
  const quantities: Record<string, string> = pendingInitial ? Object.fromEntries(pendingInitial.request.lines.map(line => [line.reconciliationBatchDailyLineId, String(line.issuedQty)]))
    : draft.scope === draftScope ? draft.quantities : {};
  const reasons: Record<string, string> = pendingInitial ? Object.fromEntries(pendingInitial.request.lines.map(line => [line.reconciliationBatchDailyLineId, line.varianceReason ?? '']))
    : draft.scope === draftScope ? draft.reasons : {};
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

  const setSearchParamsRef = useRef(setSearchParams);
  useEffect(() => {
    activeBatchIdRef.current = activeBatchId;
    explicitBatchIdRef.current = explicitBatchId;
    sessionScopeRef.current = sessionScope;
    setSearchParamsRef.current = setSearchParams;
  }, [activeBatchId, explicitBatchId, sessionScope, setSearchParams]);

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
          (curSession.customerId
            ? items.find(b => b.customerId === curSession.customerId && b.weekStartDate === curSession.weekStartDate)
              || items.find((b) => b.customerId === curSession.customerId)
            : items.find((b) => b.status === 'TRANSFERRED' || b.status === 'IN_PROGRESS') || items[0]);
        if (matched) {
          setActiveBatchId(matched.batchId);
          workspaceSessionStore.setScope({ batchId: matched.batchId, customerId: matched.customerId, customerCode: matched.customerCode || '', customerName: matched.customerName || '' });
          setSearchParamsRef.current((curr) => { const next = new URLSearchParams(curr); next.set('batchId', matched.batchId); return next; }, { replace: true });
        }
      }
    }).catch((cause: unknown) => {
      if (ignore) return;
      setCatalogLoading(false);
      setCatalogError(cause instanceof Error ? cause : new Error('Không thể tải danh sách lô.'));
    });
    return () => { ignore = true; };
  }, [catalogRetry, catalogPage]);

  const day = daily?.dates.find((item) => item.serviceDate === activeDate);
  const lines = useMemo(() => day?.lines.filter((l) => l.requiredQuantity > 0) ?? [], [day]);
  const hasInitialIssue = lines.some((l) => (l.issuedQuantity ?? 0) + (l.returnedQuantity ?? 0) > 0);
  const draftKey = user?.userId && activeBatchId && !isWeeklyAll
    ? initialStorageKey(activeBatchId, activeDate) : null;

  const [restoredDraftKey, setRestoredDraftKey] = useState('');
  const restorableDraft = useMemo(() => {
    if (!draftKey || issueOutcomeUnknown || restoredDraftKey === draftKey || daily?.batchId !== activeBatchId || hasInitialIssue || lines.length === 0) return null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved.version !== daily.sourceVersion) return null;
      if (saved.outcomeUnknown && (typeof saved.commandId !== 'string'
        || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(saved.commandId))) return null;
      const ids = new Set(lines.map((line) => line.dailyLineId));
      const validRecord = (value: unknown): value is Record<string, string> =>
        value !== null && typeof value === 'object' && !Array.isArray(value)
        && Object.entries(value).every(([id, text]) => ids.has(id) && typeof text === 'string');
      if (!validRecord(saved.quantities) || !validRecord(saved.reasons)
        || Object.keys(saved.quantities).length !== ids.size) return null;
      return { quantities: saved.quantities, reasons: saved.reasons, commandId: saved.outcomeUnknown ? saved.commandId as string : undefined };
    } catch {
      return null;
    }
  }, [draftKey, issueOutcomeUnknown, restoredDraftKey, daily, activeBatchId, lines, hasInitialIssue]);

  const restoreIssueDraft = () => {
    if (!draftKey || !restorableDraft) return;
    setQuantities(restorableDraft.quantities);
    setReasons(restorableDraft.reasons);
    attemptedCommand.current.initial = restorableDraft.commandId;
    setRestoredDraftKey(draftKey);
  };

  const weeklyAggregateLines = useMemo(() => {
    if (!daily?.dates) return [];
    const map = new Map<string, { id: string; ingredientCode: string; ingredientName: string; unitName: string; requiredQuantity: number; issuedQuantity: number | null; remainingQuantity: number | null; }>();
    for (const d of daily.dates) {
      for (const l of d.lines) {
        const key = `${l.ingredientId}_${l.canonicalUnitId}`;
        const existing = map.get(key);
        if (existing) {
          existing.requiredQuantity += l.requiredQuantity;
          existing.issuedQuantity = existing.issuedQuantity == null && l.issuedQuantity == null ? null : (existing.issuedQuantity ?? 0) + (l.issuedQuantity ?? 0);
          existing.remainingQuantity = existing.remainingQuantity != null && l.remainingQuantity != null
            ? existing.remainingQuantity + l.remainingQuantity : null;
        } else {
          map.set(key, { id: key, ingredientCode: l.ingredientCode || l.ingredientId || '', ingredientName: l.ingredientName || '—', unitName: l.canonicalUnitName || 'Chưa rõ đơn vị', requiredQuantity: l.requiredQuantity, issuedQuantity: l.issuedQuantity ?? null, remainingQuantity: l.remainingQuantity ?? null });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.requiredQuantity - a.requiredQuantity);
  }, [daily]);

  // Check the lifecycle too, so older API responses cannot offer writes before handoff.
  const canIssueBatch = daily?.batchId === activeBatchId && daily.compatibility.canIssueByDate
    && (daily.batchStatus === 'TRANSFERRED' || daily.batchStatus === 'IN_PROGRESS');

  const handleFillAll = () => {
    if (!canIssueBatch) return;
    setQuantities(Object.fromEntries(lines.map((l) => [l.dailyLineId, String(l.requiredQuantity)])));
  };

  const canSubmit = Boolean(isServiceDate(activeDate) && !dateValidationError && !routeMismatch && canIssueBatch && !stateProps.error && !stateProps.isFetching && !scopeLocked && day?.isApplicable && lines.length > 0 && !hasInitialIssue && !isWeeklyAll &&
    lines.every((l) => {
      const issued = normalizeQuantity(Number(quantities[l.dailyLineId]));
      return Number.isFinite(issued) && issued > 0 && (issued <= l.requiredQuantity || reasons[l.dailyLineId]?.trim());
    }));

  const sendInitial = async (request: CreateMrxIssueRequest, recovering = false) => {
    if (initialSending.current || !user) return;
    initialSending.current = true;
    setSaving(true);
    setMutationError(null);
    setIssueSuccessScope('');
    const key = initialStorageKey(request.reconciliationBatchId!, request.issueDate);
    const pending = { actorId: user.userId, mode: operationalMode, modeVersion: operationalModeVersion, request };
    if (key && !recovering) {
      try {
        localStorage.setItem(key, JSON.stringify({ version: request.expectedVersion, quantities, reasons, commandId: request.commandId,
          outcomeUnknown: true, ...pending }));
      } catch {
        // Retain the in-memory draft if browser storage is unavailable.
      }
    }
    try {
      const receipt = await mrxApi.createIssue(request);
      if (!receipt?.issueId?.trim() || !receipt.issueCode?.trim()) throw new Error('Thiếu xác nhận phiếu xuất kho.');
      attemptedCommand.current.initial = undefined;
      if (key) {
        try { localStorage.removeItem(key); } catch { /* A replay still uses the same command. */ }
      }
      setIssueSuccessScope(`${request.reconciliationBatchId}:${request.issueDate}`);
      serverStateCache.delete(`mrx_daily_${request.reconciliationBatchId}`);
      await load(true);
      setPendingInitial(null);
    } catch (cause) {
      const unknown = recovering || isUnknownIssueOutcome(cause);
      setPendingInitial(unknown ? pending : null);
      if (!unknown) {
        attemptedCommand.current.initial = undefined;
        if (key) {
          try { localStorage.setItem(key, JSON.stringify({ version: request.expectedVersion, quantities, reasons })); }
          catch { /* Keep the in-memory draft. */ }
        }
      }
      setMutationError(cause instanceof Error ? cause : new Error('Không thể xác nhận xuất kho.'));
      if (cause instanceof ApiError && cause.status === 409) invalidateMrxCaches();
    } finally {
      initialSending.current = false;
      setSaving(false);
    }
  };
  const submit = async () => {
    if (!daily || !day || !canSubmit || !activeBatchId || routeMismatch || scopeLocked) return;
    await sendInitial({
      commandId: attemptedCommand.current.initial ??= crypto.randomUUID(), expectedVersion: daily.sourceVersion,
      issueDate: activeDate, reconciliationBatchId: activeBatchId, isSupplemental: false,
      lines: lines.map(line => ({ allocations: [], reconciliationBatchLineId: line.batchLineId,
        reconciliationBatchDailyLineId: line.dailyLineId, ingredientId: line.ingredientId, unitId: line.canonicalUnitId,
        requestedQty: line.requiredQuantity, issuedQty: normalizeQuantity(Number(quantities[line.dailyLineId])),
        varianceReason: reasons[line.dailyLineId]?.trim() || undefined,
      })),
    });
  };
  const canRecoverInitial = Boolean(pendingInitial && operationalMode === 'MATERIAL_RECONCILIATION'
    && pendingInitial.mode === operationalMode && pendingInitial.actorId === user?.userId
    && operationalModeVersion != null && pendingInitial.modeVersion === operationalModeVersion
    && pendingInitial.request.reconciliationBatchId === activeBatchId && pendingInitial.request.issueDate === activeDate);
  const recoverInitial = () => {
    if (canRecoverInitial && pendingInitial) void sendInitial(pendingInitial.request, true);
  };

  const executeSupplemental = async (request: CreateMrxIssueRequest, recovering = false) => {
    if (supplementalSending.current) return;
    supplementalSending.current = true;
    const key = supplementalStorageKey(request.reconciliationBatchId!, request.issueDate);
    const pending = { actorId: user!.userId, mode: operationalMode, modeVersion: operationalModeVersion, request };
    setPendingSupplemental(pending);
    if (key) { try { localStorage.setItem(key, JSON.stringify(pending)); } catch { /* Keep exact in-memory command. */ } }
    setIsSubmittingSupp(true); setSuppError(null); setIssueSuccessScope('');
    let acknowledged = false;
    try {
      const receipt = await mrxApi.createIssue(request);
      if (!receipt?.issueId?.trim() || !receipt.issueCode?.trim()) throw new Error('Thiếu xác nhận phiếu xuất kho.');
      acknowledged = true;
      if (key) { try { localStorage.removeItem(key); } catch { /* Receipt is already committed. */ } }
      setPendingSupplemental(null); setSuppOutcomeUnknown(false);
      attemptedCommand.current.supplemental = undefined;
      setIssueSuccessScope(`${request.reconciliationBatchId}:${request.issueDate}`);
      setIsSupplementalOpen(false);
      await load(true);
    } catch (cause) {
      if (acknowledged) {
        setMutationError(new Error('Phiếu xuất bổ sung đã được ghi. Chưa tải lại được dữ liệu; hãy làm mới để kiểm tra lịch sử.'));
      } else {
        const unknown = recovering || isUnknownIssueOutcome(cause);
        setSuppOutcomeUnknown(unknown);
        if (!unknown) {
          attemptedCommand.current.supplemental = undefined; setPendingSupplemental(null);
          if (key) { try { localStorage.removeItem(key); } catch { /* In-memory rejection remains authoritative. */ } }
        }
        setSuppError(unknown ? 'Lệnh xuất chưa rõ kết quả. Kiểm tra lại cùng lệnh đã gửi; không lập lệnh mới.'
          : cause instanceof Error ? cause.message : 'Không thể thực hiện xuất bổ sung.');
      }
    } finally { supplementalSending.current = false; setIsSubmittingSupp(false); }
    return acknowledged;
  };
  const recoverSupplemental = async () => {
    if (!pendingSupplemental || isSubmittingSupp) return;
    if (pendingSupplemental.actorId !== user?.userId || pendingSupplemental.mode !== operationalMode
      || pendingSupplemental.modeVersion !== operationalModeVersion) {
      setSuppError('Người dùng hoặc phiên bản chế độ đã thay đổi. Cần đọc lại phiếu đã ghi để đối chiếu lệnh cũ.'); return;
    }
    await executeSupplemental(pendingSupplemental.request, true);
  };
  const handleSupplementalSubmit = async (items: SupplementalIssueSelection[]) => {
    if (!isServiceDate(activeDate) || dateValidationError || routeMismatch || !daily || !day || !activeBatchId || !user
      || !canIssueBatch || daily.batchStatus !== 'IN_PROGRESS'
      || scopeLocked || stateProps.error || stateProps.isFetching || pendingSupplemental) return;
    if (!items.length || items.some(item => !Number.isFinite(normalizeQuantity(item.quantity)) || normalizeQuantity(item.quantity) <= 0 || !item.reason.trim())) return;
    const issueLines = items.map(item => {
      const target = lines.find(l => l.dailyLineId === item.dailyLineId);
      if (!target) throw new Error('Không tìm thấy nguyên liệu.');
      return { allocations: item.allocations ?? [], reconciliationBatchLineId: target.batchLineId,
        reconciliationBatchDailyLineId: target.dailyLineId, ingredientId: target.ingredientId, unitId: target.canonicalUnitId,
        requestedQty: normalizeQuantity(item.quantity), issuedQty: normalizeQuantity(item.quantity), varianceReason: item.reason };
    });
    return executeSupplemental({ commandId: attemptedCommand.current.supplemental ??= crypto.randomUUID(), expectedVersion: daily.sourceVersion,
      issueDate: activeDate, reconciliationBatchId: activeBatchId, isSupplemental: true, lines: issueLines });
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
    displayDate,
    setActiveDate: (date: string) => { setDateValidationError(null); setActiveDate(date); },
    setDateValidationError,
    isWeeklyAll,
    daily,
    day,
    history,
    historyState,
    isHistoryPageStale,
    refetchHistory,
    historyPage,
    setHistoryPage,
    lines,
    weeklyAggregateLines,
    hasInitialIssue,
    isLegacyMissing,
    stateProps: {
      ...stateProps,
      isPreviousData: stateProps.isPreviousData || isTransitioningBatch,
      hasExistingData: Boolean(daily),
    },
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
    isSubmittingSupp,
    suppError,
    suppOutcomeUnknown,
    setSuppError,
    inspectedIssueId,
    setInspectedIssueId,
    handleFillAll,
    canIssueBatch,
    canSubmit,
    submit,
    canRecoverInitial,
    recoverInitial,
    handleSupplementalSubmit,
    recoverSupplemental,
  };
}
