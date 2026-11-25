import { subscribeMrxReads } from '../../api/mrxCacheInvalidation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { SplitView } from '../../components/workbench/SplitView';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Num } from '../../components/ui/num';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Input } from '../../components/ui/input';
import { VietnameseDateInput } from '../../components/ui/vietnamese-date-input';
import { Modal } from '../../components/ui/modal';
import { InlineBanner } from '../../components/ui/inline-banner';
import { ActionGuard } from '../../components/ui/action-guard';
import { useAuth } from '../../store/useAuth';
import { useOperationalRecovery } from '../../hooks/useOperationalRecovery';
import { approvalsApi, type ApprovalInboxItem, type ApprovalHistoryItem, type OperationalApprovalDetail, type OperationalApprovalFilters, type OperationalApprovalAction } from '../../api/approvalsApi';
import { formatVietnameseDate, formatVietnameseDateTime } from '../../utils/dates';
import { ApiError } from '../../api/client';
import { getMrxShiftLabel } from '../../constants/mrxConstants';
import { getDraftStorageKey } from '../../hooks/useClientDraftPersistence';
import type { OperationalApprovalCommandContext } from '../../api/approvalsApi';

interface PendingDecision {
  scope: string;
  context: OperationalApprovalCommandContext;
  decision: OperationalApprovalAction;
  reason: string;
  commandId: string;
}

const decisionCopy: Record<OperationalApprovalAction, { button: string; confirm: string }> = {
  APPROVE: { button: 'Phê duyệt hồ sơ', confirm: 'Xác nhận phê duyệt' },
  REJECT: { button: 'Từ chối hồ sơ', confirm: 'Xác nhận từ chối' },
  REVIEW_APPROVE: { button: 'Duyệt đối chiếu', confirm: 'Xác nhận duyệt đối chiếu' },
  REVIEW_REJECT: { button: 'Từ chối đối chiếu', confirm: 'Xác nhận từ chối đối chiếu' },
  APPLY: { button: 'Áp dụng liên kết', confirm: 'Xác nhận áp dụng liên kết' },
};
const decisionActions: OperationalApprovalAction[] = ['REJECT', 'REVIEW_REJECT', 'APPROVE', 'REVIEW_APPROVE', 'APPLY'];
const isReject = (action: OperationalApprovalAction) => action === 'REJECT' || action === 'REVIEW_REJECT';

function statusLabel(status: string, targetType?: string) {
  if (targetType === 'mrx-batch-review' && status === 'DRAFT') return 'Đã tạo lô';
  if (targetType === 'mrx-batch-review' && status === 'COMPLETION_READY') return 'Sẵn sàng chốt lô';
  if (targetType === 'mrx-supplemental-demand' && status === 'DRAFT') return 'Đã lưu nháp';
  if (targetType === 'legacy-lineage-disposition' && status === 'APPROVED') return 'Chờ áp dụng';
  const labels: Record<string, string> = { DRAFT: 'Chờ duyệt', PENDING: 'Chờ duyệt', PENDING_REVIEW: 'Chờ xem xét',
    PENDING_APPROVAL: 'Chờ duyệt', PENDING_MANAGER_REVIEW: 'Chờ đối chiếu', REVIEWING: 'Chờ duyệt kiểm kê', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối',
    PENDING_NEXT_APPROVAL: 'Chờ bước duyệt tiếp theo', APPROVED_FOR_EXECUTION: 'Đã duyệt, chờ áp dụng',
    MANAGERAPPROVED: 'Đã duyệt nhu cầu', MANAGERREJECTED: 'Đã từ chối nhu cầu', STEP_APPROVED: 'Đã duyệt bước',
    ADMIN_DIRECT: 'Admin ghi nhận trực tiếp', READY: 'Đã đóng băng', TRANSFERRED: 'Đã chuyển sang Kho', IN_PROGRESS: 'Đang đối soát', COMPLETED: 'Đã chốt', CANCELLED: 'Đã hủy',
    APPLIED: 'Đã áp dụng', EXECUTED: 'Đã áp dụng', CORRECTION_REQUIRED: 'Cần điều chỉnh' };
  return labels[status] ?? 'Đang xử lý';
}

function statusVariant(status: string, targetType?: string): 'success' | 'danger' | 'warning' | 'info' {
  if (targetType === 'mrx-batch-review' && ['DRAFT', 'COMPLETION_READY'].includes(status)) return 'info';
  if (targetType === 'legacy-lineage-disposition' && status === 'APPROVED') return 'info';
  if (['APPROVED', 'MANAGERAPPROVED', 'APPLIED', 'EXECUTED', 'COMPLETED'].includes(status)) return 'success';
  if (['REJECTED', 'CANCELLED'].includes(status)) return 'danger';
  if (['STEP_APPROVED', 'PENDING_NEXT_APPROVAL', 'APPROVED_FOR_EXECUTION'].includes(status)) return 'info';
  return 'warning';
}

export function ApprovalPage() {
  const { user, operationalMode, operationalModeVersion } = useAuth();
  const [params] = useSearchParams();
  const scope = JSON.stringify([user?.userId, user?.roleCode, user?.permissions, operationalMode, operationalModeVersion]);
  return <ApprovalWorkbench key={`${scope}:${params.toString()}`} scope={scope} mode={operationalMode} />;
}

function ApprovalWorkbench({ scope, mode }: { scope: string; mode: string }) {
  const { user } = useAuth();
  const commandKey = mode === 'MATERIAL_RECONCILIATION' && user
    ? getDraftStorageKey(`mrx_approval_command_${mode}`, user.userId) : null;
  const [restoredCommand] = useState<PendingDecision | null>(() => {
    if (!commandKey) return null;
    try {
      const saved = JSON.parse(localStorage.getItem(commandKey) || 'null') as PendingDecision | null;
      return saved && typeof saved.scope === 'string' && saved.context?.mode === mode
        && typeof saved.context.item?.targetType === 'string' && typeof saved.context.item.targetId === 'string'
        && typeof saved.context.fingerprint === 'string' && typeof saved.context.modeVersion === 'number'
        && decisionActions.includes(saved.decision) && typeof saved.reason === 'string' && typeof saved.commandId === 'string'
        ? saved : null;
    } catch { return null; }
  });
  const pendingCommand = useRef(restoredCommand);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const initialType = params.get('targetType') || params.get('type') || 'ALL';
  const initialState = params.get('view') === 'history' || params.get('state') === 'PROCESSED' ? 'PROCESSED' : 'PENDING';
  const [selection, setSelection] = useState<{ type: string; id: string } | null>(() => {
    const id = params.get('targetId'); return id && initialType !== 'ALL' ? { type: initialType, id } : null;
  });
  const fetcher = useCallback((filters: OperationalApprovalFilters) => approvalsApi.getOperationalInbox(filters), []);
  const recovery = useOperationalRecovery({ queryKey: `operational-approvals:${mode}:${scope}`, cacheByFilters: true, fetcher,
    initialFilters: { type: initialType, cursor: '', search: '', state: initialState }, defaultFilters: { type: 'ALL', cursor: '', search: '', state: 'PENDING' } });
  const { data, error, isLoading, isFetching, refetch } = recovery;
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [customerCode, setCustomerCode] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [detail, setDetail] = useState<OperationalApprovalDetail | null>(null);
  const [detailError, setDetailError] = useState<Error | null>(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(params.get('targetId')));
  const [detailRevision, setDetailRevision] = useState(0);
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState<Error | null>(null);
  const [historyLoading, setHistoryLoading] = useState(Boolean(params.get('targetId')));
  const [historyRevision, setHistoryRevision] = useState(0);
  const [decision, setDecision] = useState<OperationalApprovalAction | null>(restoredCommand?.scope === scope ? restoredCommand.decision : null);
  const [reason, setReason] = useState(restoredCommand?.reason ?? '');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const commandRef = useRef(restoredCommand?.commandId ?? '');
  const [mutationError, setMutationError] = useState<Error | null>(null);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(Boolean(restoredCommand));
  const recoveryScopeChanged = Boolean(restoredCommand && restoredCommand.scope !== scope);

  useEffect(() => {
    if (mode !== 'MATERIAL_RECONCILIATION') return;
    return subscribeMrxReads(() => {
      if (sendingRef.current) return;
      void refetch();
      if (!selection || decision || uncertain) return;
      setDetailError(null); setDetailLoading(true);
      setHistoryError(null); setHistoryLoading(true);
      setDetailRevision(value => value + 1);
      setHistoryRevision(value => value + 1);
    });
  }, [mode, refetch, selection, decision, uncertain]);

  useEffect(() => {
    if (!selection) return;
    let active = true;
    approvalsApi.getDetail(selection.type, selection.id, recovery.filters.state).then(result => {
      if (!active) return;
      if (result.item.targetType !== selection.type || result.item.targetId !== selection.id
        || (mode === 'MATERIAL_RECONCILIATION' && result.mode !== mode))
        throw new Error('Chi tiết trả về không khớp hồ sơ đang chọn.');
      setDetail(result); setDetailLoading(false);
    }).catch((cause: unknown) => { if (active) { setDetailError(cause instanceof Error ? cause : new Error(String(cause))); setDetailLoading(false); } });
    return () => { active = false; };
  }, [selection, detailRevision, recovery.filters.state, mode]);

  useEffect(() => {
    if (!selection) return;
    let active = true;
    approvalsApi.getHistory(selection.type, selection.id).then(result => {
      if (active) { setHistory(result); setHistoryLoading(false); }
    }).catch((cause: unknown) => { if (active) { setHistoryError(cause instanceof Error ? cause : new Error(String(cause))); setHistoryLoading(false); } });
    return () => { active = false; };
  }, [selection, historyRevision]);

  const changeScope = (patch: Partial<OperationalApprovalFilters>) => {
    setSelection(null); setDetail(null); setCursorStack([]);
    recovery.setFilters({ ...recovery.filters, ...patch, cursor: '' });
  };
  const review = (item: ApprovalInboxItem) => {
    if (isFetching || isLoading || decision !== null || sendingRef.current) return;
    if (selection?.id === item.targetId && selection.type === item.targetType) return;
    if (mode !== 'MATERIAL_RECONCILIATION') setDetail(null);
    setDetailError(null); setDetailLoading(true);
    setHistory([]); setHistoryError(null); setHistoryLoading(true);
    setSelection({ type: item.targetType, id: item.targetId }); setReason(''); setMutationError(null); setUncertain(Boolean(pendingCommand.current));
  };
  const detailCurrent = Boolean(selection && detail && detail.item.targetId === selection.id
    && detail.item.targetType === selection.type && (mode !== 'MATERIAL_RECONCILIATION' || detail.mode === mode)
    && !detailLoading && !detailError);
  const submit = async () => {
    if ((!pendingCommand.current && (!detail || !detailCurrent)) || !decision || sendingRef.current) return;
    if (!reason.trim()) { setMutationError(new Error('Vui lòng nhập căn cứ quyết định.')); return; }
    const command: PendingDecision = pendingCommand.current ?? { scope, context: {
      mode: detail!.mode, modeVersion: detail!.modeVersion, fingerprint: detail!.fingerprint,
      item: { targetType: detail!.item.targetType, targetId: detail!.item.targetId },
    }, decision, reason: reason.trim(), commandId: commandRef.current };
    if (command.scope !== scope || command.context.mode !== mode) {
      setMutationError(new Error('Vai trò hoặc phiên bản chế độ đã thay đổi. Cần đối chiếu lệnh đã gửi trong đúng phiên làm việc.')); return;
    }
    if (commandKey) {
      try { localStorage.setItem(commandKey, JSON.stringify(command)); }
      catch { setMutationError(new Error('Chưa lưu được mã lệnh khôi phục. Hãy kiểm tra bộ nhớ trình duyệt trước khi gửi.')); return; }
      pendingCommand.current = command;
    }
    sendingRef.current = true; setSending(true); setMutationError(null);
    try {
      const result = await approvalsApi.decideOperational(command.context, command.decision, command.reason, command.commandId);
      pendingCommand.current = null;
      if (commandKey) { try { localStorage.removeItem(commandKey); } catch { /* Server receipt remains authoritative on recovery. */ } }
      const outcome = result.status === 'PENDING_NEXT_APPROVAL' ? result.status : result.newStatus || result.status;
      setAccepted(`Đã ghi nhận quyết định · ${statusLabel(outcome, command.context.item.targetType)}`);
      setUncertain(false);
      setDecision(null); setSelection(null); setDetail(null); setReason('');
      await recovery.refetch();
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      setMutationError(failure);
      if (!(failure instanceof ApiError) || failure.status >= 500 || failure.status === 0
        || (commandKey && (failure.status === 401 || failure.code === 'SESSION_CHANGED'))) setUncertain(true);
      else {
        pendingCommand.current = null;
        if (commandKey) { try { localStorage.removeItem(commandKey); } catch { /* Retain server-side conflict evidence. */ } }
        setUncertain(false); commandRef.current = crypto.randomUUID();
      }
    } finally { sendingRef.current = false; setSending(false); }
  };

  const columns: ColumnDef<ApprovalInboxItem>[] = [
    { id: 'document', header: 'Hồ sơ / Phạm vi', minWidth: '180px', cell: row => <div className="min-w-0" title={`${row.title} · ${row.source}`}><div className="text-sm font-medium truncate leading-4">{row.title}</div><div className="flex items-center gap-1 text-xs leading-none text-slate-500"><IdentifierText value={row.targetCode} copyable={false} className="py-0 leading-none" /><span className="truncate">{row.source}</span>{row.weekStartDate && <span className="shrink-0">{formatVietnameseDate(row.weekStartDate)}</span>}</div></div> },
    { id: 'submitted', header: 'Người gửi', minWidth: '130px', cell: row => <div className="leading-4"><span>{row.submittedBy}</span><div className="text-xs leading-none text-slate-500">{formatVietnameseDateTime(row.submittedAt)}</div></div> },
    { id: 'status', header: 'Trạng thái', align: 'center', minWidth: '112px', cell: row => <Badge variant={statusVariant(row.status, row.targetType)} size="sm">{statusLabel(row.status, row.targetType)}</Badge> },
    { id: 'action', header: 'Thao tác', align: 'center', minWidth: '88px', cell: row => <Button variant="outline" size="xs" disabled={isFetching || isLoading} onClick={event => { event.stopPropagation(); review(row); }}>Xem xét</Button> },
  ];
  const selected = data?.items.find(row => row.targetId === selection?.id && row.targetType === selection?.type);
  const canPageBack = cursorStack.length > 0 && !isFetching;
  const canPageForward = Boolean(data?.hasNext && data.nextCursor && !isFetching && !error);
  const hasFilters = recovery.filters.type !== 'ALL' || Boolean(recovery.filters.search
    || recovery.filters.customerCode || recovery.filters.date || recovery.filters.cursor);
  const isMrx = mode === 'MATERIAL_RECONCILIATION';
  const unavailableSources = data?.unavailableSources ?? [];
  const hasPartialMrxQueue = isMrx && unavailableSources.length > 0;
  const retryPartialQueue = () => {
    if (recovery.filters.cursor) changeScope({ cursor: '' });
    else void recovery.refetch();
  };
  const queueScope = <div className="w-44 max-w-full shrink-0"><Select aria-label="Phạm vi hàng đợi" value={recovery.filters.state}
    options={[{ value: 'PENDING', label: 'Chờ xử lý' }, { value: 'PROCESSED', label: 'Lịch sử quyết định' }]}
    onChange={event => changeScope({ state: event.target.value as 'PENDING' | 'PROCESSED' })} /></div>;
  return <div className="flex-1 min-h-0 flex flex-col h-full bg-white">
    <WorkspaceHeader responsive className={selection ? '[&_[data-slot=header-scope]]:hidden lg:[&_[data-slot=header-scope]]:flex' : undefined} title="Duyệt vận hành" breadcrumb="Điều hành" contextSelectors={<div className="flex flex-wrap items-center gap-2 min-w-0 w-full">
      {isMrx && queueScope}
      <div className="w-56 max-w-full shrink-0"><Select aria-label="Lọc loại yêu cầu phê duyệt" value={recovery.filters.type}
        options={[{ value: 'ALL', label: 'Tất cả loại hồ sơ' }, ...(data?.targets ?? []).map(target => ({ value: target.targetType, label: target.label }))]}
        onChange={event => changeScope({ type: event.target.value })} /></div>
      <form className="flex flex-wrap flex-1 basis-64 items-center gap-2 min-w-0" onSubmit={event => { event.preventDefault(); changeScope({ search: search.trim(),
        ...(mode === 'MATERIAL_RECONCILIATION' ? { customerCode: customerCode.trim().toUpperCase(), date: serviceDate } : {}) }); }}>
        {mode === 'MATERIAL_RECONCILIATION' && <>
          <Input aria-label="Lọc mã khách hàng" placeholder="Mã khách hàng" className="w-32" value={customerCode} onChange={event => setCustomerCode(event.target.value)} />
          <VietnameseDateInput aria-label="Lọc ngày phục vụ" className="w-40" value={serviceDate} onChange={setServiceDate} />
        </>}
        <Input aria-label="Tìm hồ sơ" className="flex-1 basis-40 min-w-0" placeholder="Tìm mã, khách hàng, nguyên liệu..." value={search} onChange={event => setSearch(event.target.value)} />
        <Button variant="outline" type="submit">Tìm</Button>
      </form>
    </div>} actions={<Button variant="outline" disabled={isFetching} onClick={() => {
      if (hasPartialMrxQueue) {
        retryPartialQueue();
        return;
      }
      setSelection(null);
      void recovery.refetch();
    }}>{hasPartialMrxQueue ? 'Tải lại hàng đợi' : 'Làm mới'}</Button>} />
    <TelemetrySubbar responsive className={selection ? 'hidden lg:flex' : undefined} leftControls={isMrx ? undefined : queueScope} telemetryPills={<span>{data ? `${data.items.length} hồ sơ trên trang` : error ? 'Chưa tải được hàng đợi' : 'Đang tải hàng đợi'}</span>}
      rightActions={<nav aria-label="Phân trang hàng đợi phê duyệt" className="flex items-center gap-2">
        <Button variant="outline" size="sm" aria-disabled={!canPageBack || undefined} tabIndex={cursorStack.length ? undefined : -1} onClick={() => {
        if (!canPageBack) return;
        const previous = cursorStack.at(-1) || ''; setCursorStack(stack => stack.slice(0, -1)); setSelection(null);
        recovery.updateFilter('cursor', previous);
      }}>Trang trước</Button><Button variant="outline" size="sm" aria-disabled={!canPageForward || undefined} tabIndex={data?.hasNext ? undefined : -1} onClick={() => {
        if (!canPageForward || !data?.nextCursor) return;
        setCursorStack(stack => [...stack, recovery.filters.cursor]); setSelection(null);
        recovery.updateFilter('cursor', data.nextCursor);
      }}>Trang sau</Button></nav>} />
    {recoveryScopeChanged && <InlineBanner variant="warning" title="Có lệnh duyệt cần đối chiếu"
      actionLabel="Tra cứu lịch sử hồ sơ" onAction={() => {
        const target = pendingCommand.current!.context.item;
        navigate(`/approvals?targetType=${encodeURIComponent(target.targetType)}&targetId=${encodeURIComponent(target.targetId)}&state=PROCESSED`);
      }}>Vai trò hoặc phiên bản chế độ đã thay đổi. Lệnh cũ được giữ lại; cần đăng nhập đúng vai trò và chế độ đã gửi để kiểm tra kết quả.</InlineBanner>}
    {hasPartialMrxQueue && <InlineBanner variant="warning" title="Hàng đợi chưa đầy đủ">
      <ul className="list-disc pl-4">{unavailableSources.map(source => <li key={source.targetType}>{source.message}</li>)}</ul>
    </InlineBanner>}
    {!isMrx && unavailableSources.map(source => <InlineBanner key={source.targetType} variant="warning"
      actionLabel="Tải lại hàng đợi" onAction={retryPartialQueue}>{source.message}</InlineBanner>)}
    <StateBoundary isLoading={isLoading} isFetching={isFetching} isPreviousData={isFetching && Boolean(data)} lockContent={Boolean(error)}
      hasExistingData={Boolean(data)} recoverableNoticePlacement="bottom" error={error} onRetry={recovery.handleRetry}
      isForbidden={error instanceof ApiError && error.status === 403} isEmpty={Boolean(data && !data.items.length)}
      emptyTitle={data?.unavailableSources?.length ? 'Chưa đọc đủ hàng đợi' : recovery.filters.state === 'PROCESSED' ? 'Chưa có quyết định trong phạm vi này' : 'Không có hồ sơ chờ xử lý'}
      emptyDescription={isMrx ? null : 'Hồ sơ trong phạm vi đã chọn sẽ hiển thị tại đây.'}
      emptyScenario={hasFilters ? 'filter-empty' : 'true-empty'}
      actionLabel={hasFilters ? 'Xóa bộ lọc' : isMrx ? undefined : 'Tải lại danh sách'}
      onAction={!hasFilters && !isMrx ? () => void recovery.refetch() : undefined}
      onResetFilters={hasFilters ? () => { setSearch(''); setCustomerCode(''); setServiceDate(''); changeScope({ type: 'ALL', search: '', customerCode: '', date: '' }); } : undefined} contextDomain="approvals">
      <SplitView masterWidthClass={selection ? 'w-full lg:w-1/2' : 'w-full'} hasActiveDetail={Boolean(selection)} onBackToMaster={() => setSelection(null)}
        master={<DataGrid data={data?.items ?? []} columns={columns} keyExtractor={row => row.inboxItemId}
          selectedKey={selected?.inboxItemId} onRowClick={isFetching ? undefined : review} minWidth="min-w-[510px]" />}
        detail={selection ? <StateBoundary isLoading={detailLoading && !detail} error={detailError} onRetry={() => { setDetailError(null); setDetailLoading(true); setDetailRevision(value => value + 1); }} contextDomain="approvals">
          {detail && <div className="flex-1 min-h-0 flex flex-col bg-white" aria-busy={!detailCurrent}>
            <div className="px-4 py-3 border-b border-slate-200"><h2 className="font-semibold text-base">{detail.item.title}</h2>{!detailCurrent && <p role="status" className="text-sm text-slate-600">Đang tải hồ sơ đã chọn. Bên dưới là hồ sơ trước.</p>}<IdentifierText value={detail.item.targetCode} /></div>
            <div className="flex-1 min-h-0 overflow-auto p-4 space-y-5 text-sm">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><dt className="text-xs text-slate-500">Nguồn / Khách hàng</dt><dd>{detail.item.source}</dd></div>
                <div><dt className="text-xs text-slate-500">Trạng thái</dt><dd><Badge variant={statusVariant(detail.item.status, detail.item.targetType)}>{statusLabel(detail.item.status, detail.item.targetType)}</Badge></dd></div>
                <div><dt className="text-xs text-slate-500">Người gửi</dt><dd>{detail.item.submittedBy}</dd></div>
                <div><dt className="text-xs text-slate-500">Thời điểm gửi</dt><dd>{formatVietnameseDateTime(detail.item.submittedAt)}</dd></div>
                {detail.item.weekStartDate && <div><dt className="text-xs text-slate-500">Tuần phục vụ</dt><dd>{formatVietnameseDate(detail.item.weekStartDate)}</dd></div>}
                {detail.supplementalDemand && <div><dt className="text-xs text-slate-500">Ngày phục vụ</dt><dd>{formatVietnameseDate(detail.supplementalDemand.serviceDate)}</dd></div>}
                <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Lý do</dt><dd className="break-words">{detail.item.reason || '—'}</dd></div>
              </dl>
              {detail.historicalPurpose && <section className="space-y-2">
                <h3 className="font-semibold">Phân bổ đề xuất</h3>
                <div>{detail.historicalPurpose.issueCode} · {detail.historicalPurpose.ingredientName} · {detail.historicalPurpose.unitName}</div>
                <div>Dòng phiếu <IdentifierText value={detail.historicalPurpose.issueLineId} /></div>
                <DataGrid data={detail.historicalPurpose.allocations} keyExtractor={row => `${row.purpose}:${row.demandMaterialId ?? ''}`} columns={[
                  { id: 'purpose', header: 'Mục đích', cell: row => row.purpose === 'BASELINE_SHORTAGE' ? 'Bù nhu cầu gốc'
                    : row.purpose === 'UNPLANNED_EXTRA' ? 'Cấp ngoài nhu cầu' : 'Cấp nhu cầu đã duyệt' },
                  { id: 'demand', header: 'Dòng nhu cầu', cell: row => row.demandMaterialId ? <IdentifierText value={row.demandMaterialId} /> : '—' },
                  { id: 'quantity', header: 'Lượng phân bổ', align: 'right', cell: row => <Num value={row.quantity} format="plain" decimals={6} /> },
                ]} />
              </section>}
              {detail.legacyLineage && <section className="space-y-3">
                <h3 className="font-semibold">Liên kết chứng từ đã đối chiếu</h3>
                <p className="text-slate-600">Duyệt đối chiếu chưa gắn liên kết. Admin áp dụng sau khi duyệt; thao tác không thay đổi số lượng hoặc tồn kho.</p>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><dt className="text-xs text-slate-500">Loại dòng chứng từ</dt><dd>{detail.legacyLineage.legacyLineType === 'ISSUE_LINE' ? 'Dòng xuất kho' : 'Dòng trả kho'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Phiên bản hồ sơ</dt><dd><Num value={detail.legacyLineage.version} format="plain" decimals={0} /></dd></div>
                  <div className="min-w-0"><dt className="text-xs text-slate-500">Dòng chứng từ cũ</dt><dd><IdentifierText value={detail.legacyLineage.legacyLineId} className="max-w-full break-all whitespace-normal text-left" /></dd></div>
                  <div className="min-w-0"><dt className="text-xs text-slate-500">Dòng nguồn đã đối chiếu</dt><dd><IdentifierText value={detail.legacyLineage.targetMaterialRequestLineId || detail.legacyLineage.targetIssueLineId || '—'} className="max-w-full break-all whitespace-normal text-left" /></dd></div>
                </dl>
                {detail.legacyLineage.reviewReason && <p className="break-words">Căn cứ duyệt: {detail.legacyLineage.reviewReason}</p>}
              </section>}
              {detail.stocktake && <section><h3 className="font-semibold mb-2">Chênh lệch kiểm kê</h3>
                <p className="mb-2">Duyệt kiểm kê sẽ điều chỉnh tồn kho vật lý theo chênh lệch đã kiểm đếm.</p>
                <DataGrid data={detail.stocktake.lines} keyExtractor={row => row.lineId} columns={[
                  { id: 'ingredient', header: 'Nguyên liệu', cell: row => <div>{row.ingredientName}<div className="text-xs text-slate-500">{row.unitName}</div></div> },
                  { id: 'system', header: 'Tồn hệ thống', align: 'right', cell: row => <Num value={row.systemQty} format="plain" decimals={6} /> },
                  { id: 'actual', header: 'Kiểm đếm', align: 'right', cell: row => <Num value={row.actualQty} format="plain" decimals={6} /> },
                  { id: 'variance', header: 'Chênh lệch', align: 'right', cell: row => <Num value={row.discrepancyQty} format="plain" decimals={6} /> },
                  { id: 'reason', header: 'Ghi chú', cell: row => row.reason || '—' },
                ]} />
              </section>}
              {detail.sourceChange && <section className="space-y-3"><h3 className="font-semibold">Nội dung thay đổi nguồn</h3>
                <DataGrid data={detail.sourceChange.impactLines} keyExtractor={(_, index) => String(index)} columns={[
                  { id: 'date', header: 'Ngày / Ca', cell: row => <div>{formatVietnameseDate(row.serviceDate)}<div className="text-xs text-slate-500">{getMrxShiftLabel(row.shiftName)}</div></div> },
                  { id: 'savoryBefore', header: 'Mặn trước', align: 'right', cell: row => <Num value={row.currentSavoryServings} format="plain" decimals={0} /> },
                  { id: 'savoryAfter', header: 'Mặn sau', align: 'right', cell: row => <Num value={row.newSavoryServings} format="plain" decimals={0} /> },
                  { id: 'vegetarianBefore', header: 'Chay trước', align: 'right', cell: row => <Num value={row.currentVegetarianServings} format="plain" decimals={0} /> },
                  { id: 'vegetarianAfter', header: 'Chay sau', align: 'right', cell: row => <Num value={row.newVegetarianServings} format="plain" decimals={0} /> },
                ]} />
                {detail.sourceChange.impactLines.filter(row => row.oldDishId !== row.newDishId).map((row, index) =>
                  <div key={index} className="space-y-2 border-b border-slate-200 pb-2">
                    <p className="font-medium">{formatVietnameseDate(row.serviceDate)} · {getMrxShiftLabel(row.shiftName)}</p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div><dt className="text-xs text-slate-500">Món trước</dt><dd>{detail.sourceDishNames?.[row.oldDishId] || <IdentifierText value={row.oldDishId} />}</dd></div>
                    <div><dt className="text-xs text-slate-500">Món sau</dt><dd>{detail.sourceDishNames?.[row.newDishId] || <IdentifierText value={row.newDishId} />}</dd></div>
                    </dl>
                  </div>)}
              </section>}
              {detail.supplementalDemand && <section><h3 className="font-semibold mb-2">Suất phát sinh đề nghị</h3>
                <DataGrid data={detail.supplementalDemand.dishes} keyExtractor={row => row.demandDishId}
                  columns={[{ id: 'dish', header: 'Món ăn', cell: row => row.dishName },
                    { id: 'scope', header: 'Ca / Loại suất', cell: row => `${getMrxShiftLabel(row.shiftName)} · ${row.menuVariant === 'vegetarian' ? 'Chay' : row.menuVariant === 'savory' ? 'Mặn' : row.menuVariant}` },
                    { id: 'servings', header: 'Suất thêm', align: 'right', cell: row => <Num value={row.extraServings} format="plain" decimals={0} /> }]} />
              </section>}
              {detail.item.materials?.length ? <section><h3 className="font-semibold mb-2">Nội dung yêu cầu</h3><DataGrid data={detail.item.materials} keyExtractor={(_, index) => String(index)}
                columns={[{ id: 'name', header: 'Nguyên liệu', cell: row => row.name },
                  { id: 'quantity', header: 'Số lượng', align: 'right', cell: row => <Num value={row.quantity} format="plain" decimals={6} /> },
                  { id: 'unit', header: 'Đơn vị', cell: row => row.unit }]} /></section> : null}
              {detail.materialImpact.length > 0 && <section><h3 className="font-semibold mb-2">Ảnh hưởng nguyên liệu</h3>
                <DataGrid data={detail.materialImpact} keyExtractor={(row, index) => `${row.ingredientCode}-${row.serviceDate}-${index}`} columns={[
                  { id: 'name', header: 'Nguyên liệu / Đơn vị', cell: row => <div>{row.ingredientName}<div className="text-xs text-slate-500">{row.unitName}</div></div> },
                  { id: 'before', header: 'Trước', align: 'right', cell: row => <Num value={row.previousQuantity} format="plain" decimals={6} /> },
                  { id: 'after', header: 'Sau', align: 'right', cell: row => <Num value={row.newQuantity} format="plain" decimals={6} /> },
                  { id: 'delta', header: 'Chênh lệch', align: 'right', cell: row => <Num value={row.newQuantity - row.previousQuantity} format="plain" decimals={6} /> }]} /></section>}
              {detail.blockedReasons.map(message => <InlineBanner key={message} variant="warning">{message}</InlineBanner>)}
              <section><h3 className="font-semibold mb-2">Lịch sử xử lý</h3>
                {historyLoading || !detailCurrent ? <p role="status">Đang tải lịch sử...</p> : historyError ? <InlineBanner variant="error" actionLabel="Tải lại lịch sử" onAction={() => { setHistoryError(null); setHistoryLoading(true); setHistoryRevision(value => value + 1); }}>{historyError.message}</InlineBanner> :
                  history.length ? <ol className="space-y-3">{history.map(event => <li key={event.historyId} className="border-b border-slate-200 pb-2">
                    <div className="flex flex-wrap justify-between gap-2"><strong>{event.actionByName}</strong><span>{formatVietnameseDateTime(event.actionAt)}</span></div>
                    <p>{statusLabel(['STEP_APPROVED', 'ADMIN_DIRECT'].includes(event.decision) ? event.decision : event.newStatus || event.decision, detail.item.targetType)}</p>{event.reason && <p className="text-slate-600 break-words">{event.reason}</p>}
                  </li>)}</ol> : <p className="text-slate-500">Chưa có quyết định được ghi nhận.</p>}
              </section>
            </div>
            <div className="border-t border-slate-200 p-3 flex flex-wrap justify-end gap-2">
              {detail.item.targetType === 'mrx-batch-review' && <Button disabled={!detailCurrent} onClick={() => navigate(detail.item.route)}>Mở đối soát</Button>}
              {decisionActions.map(action => <ActionGuard key={action} capabilityId="APPR.DECISION" roles={action === 'APPLY' ? ['ADMIN'] : action.startsWith('REVIEW_') ? ['MANAGER', 'Quản lý'] : ['ADMIN', 'MANAGER', 'Quản lý']} allowedActions={[...detail.allowedActions]} requiredAction={action}>
                <Button variant={isReject(action) ? 'outline' : 'default'} disabled={!detailCurrent || sending || uncertain || historyLoading || Boolean(historyError)} title={uncertain ? 'Chưa xác định kết quả gửi. Kiểm tra lịch sử trước khi thực hiện lại.' : historyError ? 'Tải lại lịch sử trước khi quyết định.' : undefined}
                  onClick={() => { commandRef.current = crypto.randomUUID(); setMutationError(null); setDecision(action); }}>{decisionCopy[action].button}</Button>
              </ActionGuard>)}
            </div>
          </div>}
        </StateBoundary> : null} />
    </StateBoundary>
    {accepted && <InlineBanner variant="success" onClose={() => setAccepted(null)} className="shrink-0 rounded-none border-x-0">{accepted}</InlineBanner>}
    <Modal isOpen={decision !== null} onClose={() => { setDecision(null); setReason(''); }} isDirty={Boolean(reason.trim())} closeDisabled={sending || uncertain}
      title={decisionCopy[decision || 'APPROVE'].confirm} description={detail?.item.targetCode}
      footer={requestClose => <><Button variant="outline" disabled={sending || uncertain} onClick={requestClose}>Hủy bỏ</Button>
        <Button disabled={sending || uncertain || !reason.trim()} loading={sending} onClick={() => void submit()}>{decisionCopy[decision || 'APPROVE'].confirm}</Button></>}>
      <div className="space-y-3 text-sm">
        <p>Quyết định được ghi nhận theo bước duyệt và thẩm quyền của hồ sơ.</p>
        {uncertain ? <InlineBanner variant="warning" title="Chưa xác định kết quả duyệt" actionLabel={recoveryScopeChanged ? undefined : 'Kiểm tra kết quả'}
          isActionLoading={sending} onAction={recoveryScopeChanged ? undefined : () => void submit()}>{recoveryScopeChanged
            ? 'Vai trò hoặc phiên bản chế độ đã thay đổi. Đăng nhập đúng vai trò và chế độ đã gửi để đối chiếu lệnh; không gửi một quyết định mới.'
            : 'Kiểm tra lại bằng mã lệnh đã gửi trước khi thực hiện quyết định khác.'}</InlineBanner>
          : mutationError && <InlineBanner variant={mutationError instanceof ApiError && mutationError.status === 409 ? 'conflict' : 'error'}>{mutationError.message}</InlineBanner>}
        <label className="block space-y-1"><span>Căn cứ quyết định</span><Input value={reason} disabled={sending || uncertain} onChange={event => setReason(event.target.value)} /></label>
      </div>
    </Modal>
  </div>;
}
