import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxBatch, type MrxMenuChangeInboxItem, type MrxQuantityPreview, type MrxWeeklySource } from '../../../api/mrxApi';
import { weeklyMenuApi } from '../../../api/weeklyMenuApi';
import { useAuth } from '../../../store/useAuth';
import type { CustomerOption } from '../../../types';
import { isIsoDate, toIsoDate } from '../../../utils/dates';
import { getCachedArray, serverStateCache } from '../../../store/serverStateCache';
import { workspaceSessionStore } from '../../../store/workspaceSessionStore';
import { useWorkbenchQuery } from '../../../hooks/useWorkbenchQuery';

function currentWeekStart(): string {
  const value = new Date(`${new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())}T00:00:00Z`);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - (day === 0 ? 6 : day - 1));
  return value.toISOString().slice(0, 10);
}

type MrxBatchData = { customerId: string; weekStartDate: string; source: MrxWeeklySource | null; batch: MrxBatch | null };

export function useMrxBatchWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole, canNavigate } = useAuth();
  const canOpenWarehouse = canNavigate('/warehouse', '?view=mrx-daily');
  const canOpenReconciliation = canNavigate('/reconciliation');
  const canReviewSourceChanges = hasRole(['Admin', 'ADMIN', 'Manager', 'MANAGER', 'Quản lý']);
  const sessionScope = workspaceSessionStore.getScope();
  const cachedCustomers = getCachedArray<CustomerOption>('catalog_customers');
  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const initialCustomerId = searchParams.get('customerId') || (sessionScope.batchId ? sessionScope.customerId : sessionScope.weeklyMenuScope?.customerId)
    || sessionScope.customerId || cachedCustomers?.[0]?.customerId || '';
  const initialWeek = [searchParams.get('weekStartDate'),
    sessionScope.batchId && sessionScope.customerId === initialCustomerId ? sessionScope.weekStartDate : '',
    sessionScope.weeklyMenuScope?.customerId === initialCustomerId ? sessionScope.weeklyMenuScope.weekStartDate : '',
    sessionScope.customerId === initialCustomerId ? sessionScope.weekStartDate : '',
  ].find(isIsoDate) || currentWeekStart();
  const [customerId, setCustomerIdState] = useState(() => initialCustomerId);
  const [weekStartDate, setWeekStartDateState] = useState(() => initialWeek);
  const [hasUserSwitchedScope, setHasUserSwitchedScope] = useState(false);
  const setCustomerId = (next: string | ((prev: string) => string)) => {
    if (typeof next === 'string') setHasUserSwitchedScope(true);
    setCustomerIdState(next);
  };
  const setWeekStartDate = (next: string | ((prev: string) => string)) => {
    if (typeof next === 'string') setHasUserSwitchedScope(true);
    setWeekStartDateState(next);
  };
  const customerIdRef = useRef(customerId);
  const scopeKey = `${customerId}:${weekStartDate}`;
  const scopeToken = useMemo(() => Symbol(scopeKey), [scopeKey]);
  const activeScopeRef = useRef<symbol | null>(scopeToken);
  useLayoutEffect(() => {
    activeScopeRef.current = scopeToken;
    return () => { activeScopeRef.current = null; };
  }, [scopeToken]);
  useEffect(() => { customerIdRef.current = customerId; }, [customerId]);

  const batchQuery = useWorkbenchQuery<MrxBatchData>({
    scopeKey: 'mrx_batch',
    cacheKey: `mrx_source_${customerId}_${weekStartDate}`,
    snapshotKey: `snapshot:mrx_batch_${customerId}_${weekStartDate}`,
    scopeId: customerId,
    isCatalogLoading: !cachedCustomers && customers.length === 0,
    queryFn: async () => {
      try {
        const [sourceResult, batchPage] = await Promise.all([
          mrxApi.getWeeklySource(customerId, weekStartDate),
          mrxApi.getBatchPage({ customerId, weekStartDate, pageSize: 1 }).catch(() => null),
        ]);
        serverStateCache.set(`mrx_inspection_source_${customerId}_${weekStartDate}`, sourceResult);
        let loadedBatch: MrxBatch | null = null;
        if (batchPage && batchPage.items.length > 0) {
          loadedBatch = await mrxApi.getBatch(batchPage.items[0].batchId).catch(() => null);
        }
        const isPub = sourceResult?.menuVersionStatus === 'PUBLISHED' || sourceResult?.menuVersionStatus === 'ACTIVE';
        const nextPreviewKey = `mrx_preview_${customerId}_${weekStartDate}`;
        if (isPub && sourceResult?.menuVersionId && loadedBatch?.batchId && loadedBatch.status === 'DRAFT' && !serverStateCache.get<MrxQuantityPreview>(nextPreviewKey)?.data) {
          const previewData = await mrxApi.previewQuantityImport({
            menuVersionId: sourceResult.menuVersionId,
            sourceLabel: `Tuần ${sourceResult.weekStartDate ?? weekStartDate}`,
          }).catch(() => null);
          if (previewData) {
            serverStateCache.set(nextPreviewKey, previewData);
          }
        }
        return { customerId, weekStartDate, source: sourceResult, batch: loadedBatch };
      } catch (cause: unknown) {
        const is404 = (cause && typeof cause === 'object' && 'status' in cause && Number((cause as { status?: unknown }).status) === 404) ||
          (cause instanceof Error && cause.message.includes('404'));
        if (is404) {
          return { customerId, weekStartDate, source: null, batch: null };
        }
        throw cause;
      }
    },
    isDatasetEmpty: (res) => !res || (!res.source && !res.batch),
    emptyTitle: 'Chưa có nguồn thực đơn đã phát hành',
    emptyDescription: 'Hãy hoàn tất thực đơn và số suất của khách hàng trong tuần đã chọn trước khi tạo lô đối soát.',
    emptyScenario: 'prerequisite-blocked',
  });
  const {
    data: loadedBatchData,
    stateProps: queryStateProps,
    refetch: loadSource,
    setData: setBatchData,
  } = batchQuery;

  const loadedScope = loadedBatchData?.source ?? loadedBatchData?.batch;
  const isCurrentScope = (loadedBatchData?.customerId ?? loadedScope?.customerId) === customerId
    && (loadedBatchData?.weekStartDate ?? loadedScope?.weekStartDate) === weekStartDate;
  const isTransitioningScope = Boolean(loadedBatchData && !isCurrentScope && hasUserSwitchedScope && !queryStateProps.error);
  const batchData = isCurrentScope || isTransitioningScope ? loadedBatchData : null;
  const stateProps = {
    ...queryStateProps,
    hasExistingData: Boolean(batchData),
    isPreviousData: Boolean(queryStateProps.isPreviousData || isTransitioningScope),
    isLoading: queryStateProps.isLoading || Boolean(loadedBatchData && !batchData && !queryStateProps.error),
    isEmpty: Boolean(isCurrentScope && batchData) && queryStateProps.isEmpty,
  };
  const source = batchData?.source ?? null;
  const batch = batchData?.batch ?? null;
  useEffect(() => {
    if (!batchData || !isCurrentScope) return;
    serverStateCache.set('snapshot:mrx_batch', { data: batchData });
    const customer = customers.find((item) => item.customerId === customerId);
    workspaceSessionStore.setScope({
      customerId,
      customerCode: customer?.customerCode || '',
      customerName: customer?.customerName || '',
      weekStartDate,
      batchId: batch?.batchId || '',
      ...(customerId && isIsoDate(weekStartDate)
        ? { weeklyMenuScope: { customerId, weekStartDate } } : {}),
    });
  }, [batchData, batch?.batchId, customerId, customers, isCurrentScope, source, weekStartDate]);
  const setBatch = (newBatch: MrxBatch | null) => {
    if (activeScopeRef.current !== scopeToken) return;
    if (newBatch && ((newBatch.customerId && newBatch.customerId !== customerId)
      || (newBatch.weekStartDate && newBatch.weekStartDate !== weekStartDate)
      || (source?.menuVersionId && newBatch.menuVersionId !== source.menuVersionId))) {
      throw new Error('Lô trả về không khớp nguồn đang chọn. Hãy tải lại phạm vi.');
    }
    setBatchData((prev) => ({ customerId, weekStartDate, source: prev?.source ?? null, batch: newBatch }));
  };
  const setSource = (newSource: MrxWeeklySource | null) => {
    if (activeScopeRef.current !== scopeToken) return;
    if (newSource && (newSource.customerId !== customerId || newSource.weekStartDate !== weekStartDate)) {
      throw new Error('Nguồn trả về không khớp phạm vi đang chọn. Hãy tải lại phạm vi.');
    }
    setBatchData((prev) => ({ customerId, weekStartDate, source: newSource, batch: prev?.batch ?? null }));
  };

  const previewCacheKey = `mrx_preview_${customerId}_${weekStartDate}`;
  const cachedPreview = serverStateCache.get<MrxQuantityPreview>(previewCacheKey)?.data ?? null;
  const [previewState, setPreviewState] = useState<{ key: string; value: MrxQuantityPreview | null }>(() => ({
    key: previewCacheKey,
    value: cachedPreview,
  }));
  const preview = previewState.key === previewCacheKey ? previewState.value : cachedPreview;

  const setPreview = (val: MrxQuantityPreview | null) => {
    if (activeScopeRef.current !== scopeToken) return;
    setPreviewState({ key: previewCacheKey, value: val });
    if (val) {
      serverStateCache.set(previewCacheKey, val);
    } else {
      serverStateCache.delete(previewCacheKey);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [changeMessage, setChangeMessage] = useState('');
  const [changeInbox, setChangeInbox] = useState<MrxMenuChangeInboxItem[]>([]);
  const [reviewRequest, setReviewRequest] = useState<MrxMenuChangeInboxItem | null>(null);
  const [isDishesModalOpen, setIsDishesModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isCurrentScope || !source?.menuVersionId || !batch?.batchId || batch.status !== 'DRAFT' || cachedPreview) {
      return;
    }
    const isPub = source.menuVersionStatus === 'PUBLISHED' || source.menuVersionStatus === 'ACTIVE';
    if (isPub) {
      let ignore = false;
      mrxApi.previewQuantityImport({
        menuVersionId: source.menuVersionId,
        sourceLabel: `Tuần ${source.weekStartDate ?? weekStartDate}`,
      }).then((previewData) => {
        if (!ignore && previewData) {
          setPreviewState({ key: previewCacheKey, value: previewData });
          serverStateCache.set(previewCacheKey, previewData);
        }
      }).catch(() => {});
      return () => { ignore = true; };
    }
  }, [isCurrentScope, source?.menuVersionId, source?.menuVersionStatus, source?.weekStartDate, weekStartDate, batch?.batchId, batch?.status, cachedPreview, previewCacheKey]);

  const invalidateQuantityPreview = () => {
    setPreviewState({ key: previewCacheKey, value: null });
    serverStateCache.delete(previewCacheKey);
  };

  const handleImportSuccess = (scope?: { customerId: string; weekStartDate: string }) => {
    if (!scope) {
      invalidateQuantityPreview();
      void loadSource(true);
      return;
    }
    serverStateCache.delete(`mrx_preview_${scope.customerId}_${scope.weekStartDate}`);
    serverStateCache.delete(`mrx_source_${scope.customerId}_${scope.weekStartDate}`);
    serverStateCache.delete(`snapshot:mrx_batch_${scope.customerId}_${scope.weekStartDate}`);
    setCustomerId(scope.customerId);
    setWeekStartDate(scope.weekStartDate);
    const matchedCustomer = customers.find((item) => item.customerId === scope.customerId);
    workspaceSessionStore.setScope({
      customerId: scope.customerId,
      customerCode: matchedCustomer?.customerCode || '',
      customerName: matchedCustomer?.customerName || '',
      weekStartDate: scope.weekStartDate,
      batchId: '',
      ...(scope.customerId && isIsoDate(scope.weekStartDate)
        ? { weeklyMenuScope: { customerId: scope.customerId, weekStartDate: scope.weekStartDate } } : {}),
    });
    if (scope.customerId === customerId && scope.weekStartDate === weekStartDate) {
      invalidateQuantityPreview();
      void loadSource(true);
    }
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('customerId', scope.customerId);
      next.set('weekStartDate', scope.weekStartDate);
      next.delete('batchId');
      next.delete('action');
      return next;
    }, { replace: true });
  };

  const paramCustomerId = searchParams.get('customerId');
  const paramWeek = searchParams.get('weekStartDate');
  const paramAmendmentId = searchParams.get('amendmentId') || '';
  if (paramCustomerId && paramCustomerId !== customerId && !isSubmitting) {
    setCustomerId(paramCustomerId);
  }
  if (isIsoDate(paramWeek) && paramWeek !== weekStartDate && !isSubmitting) {
    setWeekStartDate(paramWeek);
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      serverStateCache.delete(previewCacheKey);
      await loadSource(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    weeklyMenuApi.getCustomers().then((items) => {
      if (ignore) return;
      setCustomers(items);
      serverStateCache.set('catalog_customers', items);
      const resolvedCustId = customerIdRef.current || items[0]?.customerId || '';
      setCustomerId((current: string) => current || resolvedCustId);
      const matched = items.find((i) => i.customerId === resolvedCustId);
      if (matched) {
        workspaceSessionStore.setScope({
          customerId: matched.customerId,
          customerCode: matched.customerCode,
          customerName: matched.customerName,
        });
      }
    }).catch((cause: unknown) => {
      if (!ignore) {
        setActionError(cause instanceof Error ? cause : new Error('Không thể tải danh sách khách hàng.'));
      }
    });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!canReviewSourceChanges) return;
    let ignore = false;
    mrxApi.getSourceChangeInbox()
      .then((items) => {
        if (ignore) return;
        setChangeInbox(items);
        if (paramAmendmentId) {
          const matched = items.find((item) => item.menuAmendmentId === paramAmendmentId);
          if (matched) setReviewRequest((current) => current ?? matched);
        }
      })
      .catch((cause: unknown) => { if (!ignore) setActionError(cause instanceof Error ? cause : new Error('Không thể tải yêu cầu chờ duyệt.')); });
    return () => { ignore = true; };
  }, [canReviewSourceChanges, paramAmendmentId]);

  const run = async (operation: () => Promise<void>) => {
    if (!isCurrentScope || stateProps.isPreviousData || stateProps.isLoading || stateProps.error || isSubmitting || isRefreshing) {
      setActionError(new Error('Phạm vi chưa sẵn sàng. Hãy đợi tải xong hoặc tải lại trước khi thao tác.'));
      return;
    }
    setIsSubmitting(true);
    setActionError(null);
    try { await operation(); }
    catch (cause: unknown) { setActionError(cause instanceof Error ? cause : new Error('Không thể cập nhật lô đối soát.')); }
    finally { setIsSubmitting(false); }
  };

  const checkQuantities = () => run(async () => {
    if (!source?.menuVersionId) return;
    setPreview(await mrxApi.previewQuantityImport({
      menuVersionId: source.menuVersionId,
      sourceLabel: `Tuần ${source.weekStartDate ?? weekStartDate}`,
    }));
  });

  const commitDraft = () => run(async () => {
    if (!preview || preview.diagnostics.length > 0) return;
    const committed = await mrxApi.commitQuantityImport({
      token: preview.token,
      contentFingerprint: preview.contentFingerprint,
      sourceLabel: `Tuần ${source?.weekStartDate ?? weekStartDate}`,
    });
    setBatch(await mrxApi.getBatch(committed.reconciliationBatchId));
  });

  const markReady = () => run(async () => {
    if (batch) setBatch(await mrxApi.markReady(batch.batchId, batch.version));
  });

  const transfer = () => run(async () => {
    if (!batch) return;
    await mrxApi.transferToWarehouse(batch.batchId, batch.version);
    setBatch(await mrxApi.getBatch(batch.batchId));
    setChangeMessage('Đã bàn giao lô đối soát sang Kho nguyên liệu thành công.');
  });

  const decideSourceChange = async (amendmentId: string, approved: boolean, reason?: string): Promise<boolean> => {
    if (!approved && !reason?.trim()) return false;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await mrxApi.decideSourceChange(amendmentId, approved, approved ? undefined : reason?.trim());
      setChangeInbox((items) => items.filter((item) => item.menuAmendmentId !== amendmentId));
      setChangeMessage(approved ? 'Đã áp dụng thay đổi nguồn.' : 'Đã từ chối yêu cầu thay đổi.');
      if (approved) void loadSource(true);
      return true;
    } catch (cause: unknown) {
      setActionError(cause instanceof Error ? cause : new Error('Thao tác thất bại.'));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const publishMenu = () => run(async () => {
    if (!customerId || !weekStartDate) return;
    const isoDate = toIsoDate(weekStartDate);
    const schedules = await weeklyMenuApi.getMenuSchedules(customerId, isoDate);
    if (schedules.length === 0) throw new Error('Không tìm thấy lịch thực đơn để xuất bản.');
    await weeklyMenuApi.publishMenuSchedule(schedules[0].menuScheduleId, 'Xuất bản thực đơn tuần từ Kế hoạch MRX');
    setChangeMessage('Đã xuất bản thực đơn tuần thành công và hoàn tất tính toán định lượng. Sẵn sàng tạo lô nháp.');
    const updatedSource = await mrxApi.getWeeklySource(customerId, weekStartDate);
    setSource(updatedSource);
    if (updatedSource?.menuVersionId) {
      const previewData = await mrxApi.previewQuantityImport({
        menuVersionId: updatedSource.menuVersionId,
        sourceLabel: `Tuần ${updatedSource.weekStartDate ?? weekStartDate}`,
      });
      setPreview(previewData);
    }
  });

  const isPublishedMenu = Boolean(
    source && (source.menuVersionStatus === 'PUBLISHED' || source.menuVersionStatus === 'ACTIVE')
  );
  const isDraftMenu = Boolean(source && source.menuVersionStatus === 'DRAFT');

  const primaryAction = !isPublishedMenu
    ? {
        label: isDraftMenu ? 'Xuất bản thực đơn tuần' : 'Nhập thực đơn Excel',
        action: isDraftMenu ? publishMenu : () => setIsImportModalOpen(true),
        capability: 'COORD.MENU_SCHEDULE.READ',
      }
    : batch?.status === 'COMPLETED'
      ? canOpenReconciliation ? {
          label: 'Xem hồ sơ đối soát tuần →',
          action: () => navigate(`/reconciliation?batchId=${encodeURIComponent(batch.batchId)}`),
          capability: 'RECON.BATCH.READ',
        } : null
      : batch && (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS')
        ? canOpenWarehouse ? {
            label: 'Đi đến Trạm Kho nguyên liệu →',
            action: () => navigate(`/warehouse?view=mrx-daily&batchId=${encodeURIComponent(batch.batchId)}&date=${encodeURIComponent(weekStartDate)}`),
            capability: 'RECON.BATCH.READ',
          } : null
        : batch?.status === 'READY'
          ? { label: 'Chuyển sang Kho', action: transfer, capability: 'RECON.BATCH.TRANSFER_WAREHOUSE' }
          : batch?.status === 'DRAFT'
            ? { label: 'Đóng băng lô', action: markReady, capability: 'RECON.BATCH.READY' }
            : !preview
              ? { label: 'Kiểm tra định lượng', action: checkQuantities, capability: 'RECON.BATCH.PREVIEW_IMPORT' }
              : preview.diagnostics.length > 0
                ? null
                : { label: 'Lập lô đối soát', action: commitDraft, capability: 'RECON.BATCH.COMMIT_IMPORT' };

  return {
    canOpenWarehouse,
    canReviewSourceChanges,
    customers,
    customerId,
    setCustomerId,
    weekStartDate,
    setWeekStartDate,
    source,
    batch,
    preview,
    stateProps,
    isSubmitting,
    actionError,
    setActionError,
    changeMessage,
    setChangeMessage,
    changeInbox,
    reviewRequest,
    setReviewRequest,
    isImportModalOpen,
    setIsImportModalOpen,
    isDishesModalOpen,
    setIsDishesModalOpen,
    isRefreshing,
    handleRefresh,
    handleImportSuccess,
    decideSourceChange,
    invalidateQuantityPreview,
    checkQuantities,
    commitDraft,
    markReady,
    transfer,
    loadSource,
    primaryAction,
  };
}
