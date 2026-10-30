import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { mrxApi, type MrxBatch, type MrxMenuChangeInboxItem, type MrxMenuChangeRequest, type MrxMenuChangeResult, type MrxQuantityPreview, type MrxWeeklySource } from '../../../api/mrxApi';
import { weeklyMenuApi } from '../../../api/weeklyMenuApi';
import { apiClient } from '../../../api/client';
import { useAuth } from '../../../store/useAuth';
import type { CustomerOption } from '../../../types';
import { toIsoDate } from '../../../utils/dates';
import { serverStateCache } from '../../../store/serverStateCache';
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

export function useMrxBatchWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('Admin') || hasRole('ADMIN');
  const sessionScope = workspaceSessionStore.getScope();
  const cachedCustomers = serverStateCache.get<CustomerOption[]>('catalog_customers')?.data;
  const snapshot = serverStateCache.get<any>('snapshot:mrx_batch')?.data;
  const [customers, setCustomers] = useState<CustomerOption[]>(() => cachedCustomers ?? []);
  const initialCustomerId = searchParams.get('customerId') || snapshot?.customerId || sessionScope.customerId || cachedCustomers?.[0]?.customerId || '';
  const initialWeek = searchParams.get('weekStartDate') || (snapshot?.customerId === initialCustomerId ? snapshot?.weekStartDate : '') || sessionScope.weekStartDate || currentWeekStart();
  const [customerId, setCustomerId] = useState(() => initialCustomerId);
  const [weekStartDate, setWeekStartDate] = useState(() => initialWeek);

  const {
    data: batchData,
    stateProps,
    refetch: loadSource,
    setData: setBatchData,
  } = useWorkbenchQuery<{ source: MrxWeeklySource | null; batch: MrxBatch | null }>({
    scopeKey: 'mrx_batch',
    cacheKey: `mrx_source_${customerId}_${weekStartDate}`,
    snapshotKey: 'snapshot:mrx_batch',
    scopeId: customerId,
    isCatalogLoading: !cachedCustomers && customers.length === 0,
    queryFn: async () => {
      try {
        const [sourceResult, batchPage] = await Promise.all([
          mrxApi.getWeeklySource(customerId, weekStartDate),
          mrxApi.getBatchPage({ customerId, weekStartDate, pageSize: 1 }).catch(() => null),
        ]);
        let loadedBatch: MrxBatch | null = null;
        if (batchPage && batchPage.items.length > 0) {
          loadedBatch = await mrxApi.getBatch(batchPage.items[0].batchId).catch(() => null);
        }
        if (loadedBatch) {
          workspaceSessionStore.setScope({ batchId: loadedBatch.batchId, weekStartDate: loadedBatch.weekStartDate || '' });
        }
        return { source: sourceResult, batch: loadedBatch };
      } catch (cause: unknown) {
        const is404 = (cause && typeof cause === 'object' && 'status' in cause && Number((cause as { status?: unknown }).status) === 404) ||
          (cause instanceof Error && cause.message.includes('404'));
        if (is404) {
          return { source: null, batch: null };
        }
        throw cause;
      }
    },
    isDatasetEmpty: (res) => !res || (!res.source && !res.batch),
    emptyTitle: 'Chưa có nguồn thực đơn đã phát hành',
    emptyDescription: 'Hãy hoàn tất thực đơn và số suất của khách hàng trong tuần đã chọn trước khi tạo lô đối soát.',
    emptyScenario: 'prerequisite-blocked',
  });

  const source = batchData?.source ?? null;
  const batch = batchData?.batch ?? null;
  const setBatch = (newBatch: MrxBatch | null) => setBatchData((prev) => ({ source: prev?.source ?? null, batch: newBatch }));
  const setSource = (newSource: MrxWeeklySource | null) => setBatchData((prev) => ({ source: newSource, batch: prev?.batch ?? null }));

  const previewCacheKey = `mrx_preview_${customerId}_${weekStartDate}`;
  const cachedPreview = serverStateCache.get<MrxQuantityPreview>(previewCacheKey)?.data ?? null;
  const [preview, setPreviewState] = useState<MrxQuantityPreview | null>(() => cachedPreview);

  const setPreview = (val: MrxQuantityPreview | null) => {
    setPreviewState(val);
    if (val) {
      serverStateCache.set(previewCacheKey, val);
    } else {
      serverStateCache.delete(previewCacheKey);
    }
  };

  useEffect(() => {
    const cached = serverStateCache.get<MrxQuantityPreview>(previewCacheKey)?.data;
    if (cached) {
      setPreviewState(cached);
    }
  }, [previewCacheKey]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [isChangeOpen, setIsChangeOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedSourceLine, setSelectedSourceLine] = useState('');
  const [newServings, setNewServings] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changePreview, setChangePreview] = useState<MrxMenuChangeResult | null>(null);
  const [changeMessage, setChangeMessage] = useState('');
  const [changeInbox, setChangeInbox] = useState<MrxMenuChangeInboxItem[]>([]);
  const [reviewRequest, setReviewRequest] = useState<MrxMenuChangeInboxItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isDishesModalOpen, setIsDishesModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!source?.menuVersionId || !batch) {
      return;
    }
    const isPub = source.menuVersionStatus === 'PUBLISHED' || source.menuVersionStatus === 'ACTIVE';
    if (isPub) {
      let ignore = false;
      mrxApi.previewQuantityImport({
        menuVersionId: source.menuVersionId,
        sourceLabel: `Tuần ${source.weekStartDate ?? weekStartDate}`,
      }).then((previewData) => {
        if (!ignore && previewData) setPreview(previewData);
      }).catch(() => {});
      return () => { ignore = true; };
    }
  }, [source?.menuVersionId, source?.menuVersionStatus, weekStartDate, batch?.batchId]);

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
      const existing = customerId && items.find((i) => i.customerId === customerId);
      if (existing) {
        workspaceSessionStore.setScope({ customerId: existing.customerId, customerCode: existing.customerCode, customerName: existing.customerName });
        return;
      }
      const urlCustId = searchParams.get('customerId');
      const sessionCustId = workspaceSessionStore.getScope().customerId;
      const resolvedCustId = (urlCustId && items.some((i) => i.customerId === urlCustId))
        ? urlCustId
        : (sessionCustId && items.some((i) => i.customerId === sessionCustId))
        ? sessionCustId
        : (items[0]?.customerId || '');
      setCustomerId((current: string) => current || resolvedCustId);
      const matched = items.find((i) => i.customerId === (customerId || resolvedCustId));
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
  }, [searchParams, customerId]);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    mrxApi.getSourceChangeInbox()
      .then((items) => { if (!ignore) setChangeInbox(items); })
      .catch((cause: unknown) => { if (!ignore) setActionError(cause instanceof Error ? cause : new Error('Không thể tải yêu cầu chờ duyệt.')); });
    return () => { ignore = true; };
  }, [isAdmin]);

  const run = async (operation: () => Promise<void>) => {
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

  const sourceLines = useMemo(() => preview?.plans.flatMap((plan) => plan.lines.map((line) => ({
    key: `${plan.serviceDate}|${line.quantityPlanLineId}`,
    serviceDate: plan.serviceDate,
    shiftName: line.shift,
    dishSlot: line.dishes[0]?.dishSlot || 'main',
    label: `${plan.serviceDate} · ${line.shift} · ${line.menuName}`,
    finalServings: line.finalServings,
  }))) ?? [], [preview]);

  const openSourceChange = () => {
    const first = sourceLines[0];
    if (!first) return;
    setSelectedSourceLine(first.key);
    setNewServings(String(first.finalServings));
    setChangeReason('');
    setChangePreview(null);
    setChangeMessage('');
    setIsChangeOpen(true);
  };

  const buildSourceChange = (): MrxMenuChangeRequest | null => {
    const selected = sourceLines.find((line) => line.key === selectedSourceLine);
    const servings = Number(newServings);
    if (!source?.menuVersionId || !selected || !Number.isInteger(servings) || servings <= 0 || !changeReason.trim()) return null;
    return {
      customerId,
      weekStartDate,
      expectedBaseMenuVersionId: source.menuVersionId,
      reason: changeReason.trim(),
      lines: [{ serviceDate: selected.serviceDate, shiftName: selected.shiftName, dishSlot: selected.dishSlot, newServings: servings }],
    };
  };

  const previewSourceChange = () => run(async () => {
    const request = buildSourceChange();
    if (request) setChangePreview(await mrxApi.previewSourceChange(request));
  });

  const saveSourceChange = () => run(async () => {
    const request = buildSourceChange();
    if (!request) return;
    const result = isAdmin ? await mrxApi.confirmSourceChange(request) : await mrxApi.submitSourceChange(request);
    setIsChangeOpen(false);
    setChangeMessage(isAdmin || result.status === 'EXECUTED'
      ? 'Đã áp dụng thay đổi nguồn.'
      : 'Đã gửi yêu cầu thay đổi để Admin duyệt.');
    if (isAdmin) await loadSource();
  });

  const decideSourceChange = (approved: boolean) => run(async () => {
    if (!reviewRequest || (!approved && !rejectionReason.trim())) return;
    await mrxApi.decideSourceChange(reviewRequest.menuAmendmentId, approved, approved ? undefined : rejectionReason.trim());
    setChangeInbox((items) => items.filter((item) => item.menuAmendmentId !== reviewRequest.menuAmendmentId));
    setReviewRequest(null);
    setRejectionReason('');
    setChangeMessage(approved ? 'Đã áp dụng thay đổi nguồn.' : 'Đã từ chối yêu cầu thay đổi.');
    if (approved) await loadSource();
  });

  const publishMenu = () => run(async () => {
    if (!customerId || !weekStartDate) return;
    const isoDate = toIsoDate(weekStartDate);
    const schedules = await weeklyMenuApi.getMenuSchedules(customerId, isoDate);
    if (schedules.length === 0) throw new Error('Không tìm thấy lịch thực đơn để xuất bản.');
    await weeklyMenuApi.publishMenuSchedule(schedules[0].menuScheduleId, 'Xuất bản thực đơn tuần từ Kế hoạch MRX');
    for (const s of schedules) {
      await apiClient('/coordination/meal-quantity-plans/quick-servings', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          serviceDate: s.serviceDate,
          shiftName: s.shiftName,
          servings: 100,
          complete: true,
        }),
      }).catch(() => null);
    }
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
      ? {
          label: 'Xem hồ sơ đối soát tuần →',
          action: () => navigate(`/reconciliation?batchId=${encodeURIComponent(batch.batchId)}`),
          capability: 'RECON.BATCH.READ',
        }
      : batch && (batch.status === 'TRANSFERRED' || batch.status === 'IN_PROGRESS')
        ? {
            label: 'Đi đến Trạm Kho nguyên liệu →',
            action: () => navigate(`/warehouse?view=mrx-daily&batchId=${encodeURIComponent(batch.batchId)}&date=${encodeURIComponent(weekStartDate)}`),
            capability: 'RECON.BATCH.READ',
          }
        : batch?.status === 'READY'
          ? { label: 'Chuyển sang Kho', action: transfer, capability: 'RECON.BATCH.TRANSFER_WAREHOUSE' }
          : batch?.status === 'DRAFT'
            ? { label: 'Đóng băng lô', action: markReady, capability: 'RECON.BATCH.READY' }
            : !preview
              ? { label: 'Kiểm tra định lượng', action: checkQuantities, capability: 'RECON.BATCH.PREVIEW_IMPORT' }
              : preview.diagnostics.length > 0
                ? null
                : { label: 'Tạo lô nháp', action: commitDraft, capability: 'RECON.BATCH.COMMIT_IMPORT' };

  return {
    isAdmin,
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
    rejectionReason,
    setRejectionReason,
    isChangeOpen,
    setIsChangeOpen,
    isImportModalOpen,
    setIsImportModalOpen,
    isDishesModalOpen,
    setIsDishesModalOpen,
    isRefreshing,
    handleRefresh,
    openSourceChange,
    sourceLines,
    selectedSourceLine,
    setSelectedSourceLine,
    newServings,
    setNewServings,
    changeReason,
    setChangeReason,
    changePreview,
    setChangePreview,
    buildSourceChange,
    previewSourceChange,
    saveSourceChange,
    decideSourceChange,
    checkQuantities,
    commitDraft,
    markReady,
    transfer,
    loadSource,
    primaryAction,
  };
}
