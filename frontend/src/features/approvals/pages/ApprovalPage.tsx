import { lazy, Suspense, useDeferredValue, useEffect, useRef, useState } from 'react';
import { ClipboardCheck, FileCheck2, RotateCcw, Clock, ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { CommandBar } from '@/components/common/CommandBar';
import { ContextStrip } from '@/components/common/ContextStrip';
import { EmptyState } from '@/components/common/EmptyState';
import { InlineAlert } from '@/components/common/InlineAlert';
import { KeepAliveTabPanel } from '@/components/common/KeepAliveTabPanel';
import { OperationalFrame } from '@/components/common/OperationalFrame';
import { QueryErrorAlert } from '@/components/common/QueryErrorAlert';
import { SectionPanel } from '@/components/common/SectionPanel';
import { useToast } from '@/components/common/useToast';
import { ViewSwitcher } from '@/components/common/ViewSwitcher';
import { SplitWorkbench } from '@/components/common/SplitWorkbench';
import { ROUTES } from '@/lib/routeConfig';
import { toQueryView } from '@/lib/queryView';
import { useExecuteApprovalDecisionMutation, useGetApprovalRecordsQuery, useGetApprovalHistoryQuery } from '@/api/approvalsApi';
import { useGetWorkflowDocumentsQuery } from '@/api/workflowDocumentsApi';
import { useGetPurchaseRequestsPageQuery } from '@/api/purchasingApi';
import type { ApprovalRecord } from '@/types/workflow';
import { Button } from '@/components/ui/button';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import { formatDateOnly, formatDateTime } from '@/lib/formatters';
import { formatApprovalDecision, getApprovalDecisionCopy } from './approvalCopy';
import { resolveApprovalAvailability } from '@/lib/actionEligibility';
import {
  ApprovalQueueState,
  PurchaseRequestHistoryState,
  WorkflowDocumentsState,
} from './ApprovalQueryPanels';
import { visibleTabIds } from '@/lib/navigationPreferences';

const MenuAmendmentReconciliation = lazy(() => import('../components/MenuAmendmentReconciliation').then(({ MenuAmendmentReconciliation: component }) => ({ default: component })))
const ApprovalSearchField = lazy(() => import('./ApprovalSearchField').then(({ ApprovalSearchField: component }) => ({ default: component })))
const ApprovalDecisionDialog = lazy(() => import('./ApprovalDecisionDialog').then(({ ApprovalDecisionDialog: component }) => ({ default: component })))

export default function ApprovalPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const queueFocusRef = useRef<HTMLDivElement>(null);
  const decisionTriggerRef = useRef<HTMLElement | null>(null);
  const approvalTabIds = visibleTabIds('approvals') as Array<'queue' | 'history'>;
  const [activeView, setActiveView] = useState<'queue' | 'history'>(() => approvalTabIds[0] ?? 'queue');
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [approvalPagination, setApprovalPagination] = useState<{ scopeKey: string; cursors: string[] }>({ scopeKey: '', cursors: [] });
  const [purchaseRequestPage, setPurchaseRequestPage] = useState(1);
  const [approvalSearch, setApprovalSearch] = useState('');
  const deferredApprovalSearch = useDeferredValue(approvalSearch.trim());
  const requestedTargetType = searchParams.get('target') ?? searchParams.get('targetType');
  const requestedTargetId = searchParams.get('id') ?? searchParams.get('targetId');
  const requestedWeek = searchParams.get('week');
  const requestedDate = searchParams.get('date');
  const approvalScopeKey = [requestedTargetType, requestedTargetId, requestedWeek, requestedDate, deferredApprovalSearch].join('|');
  const scopedApprovalCursors = approvalPagination.scopeKey === approvalScopeKey ? approvalPagination.cursors : [];
  const approvalCursor = scopedApprovalCursors.at(-1);
  const approvalQuery = useGetApprovalRecordsQuery({
    limit: 20,
    cursor: approvalCursor,
    targetType: requestedTargetType ?? undefined,
    targetId: requestedTargetId ?? undefined,
    week: requestedWeek ?? undefined,
    date: requestedDate ?? undefined,
    searchKeyword: deferredApprovalSearch || undefined,
  });
  const approvalView = toQueryView(approvalQuery, {
    instruction: 'Mở trang duyệt vận hành để tải hàng đợi phê duyệt.',
    retry: () => approvalQuery.refetch(),
    errorMessage: 'Không tải được hàng đợi phê duyệt.',
    forbiddenMessage: 'Bạn không có quyền xem hàng đợi phê duyệt.',
  });
  const approvalPage = approvalView.phase === 'ready' ? approvalView.data : undefined;
  const approvalRecords = approvalPage?.items ?? [];
  const isFetchingApprovals = approvalView.phase === 'loading'
    || approvalView.phase === 'ready' && approvalView.isRefreshing;
  const isApprovalLoadError = approvalView.phase === 'error' || approvalView.phase === 'forbidden';

  const workflowDocumentQuery = useGetWorkflowDocumentsQuery({ limit: 20 });
  const workflowDocumentView = toQueryView(workflowDocumentQuery, {
    instruction: 'Đang chờ khởi tạo danh sách chứng từ workflow.',
    retry: () => workflowDocumentQuery.refetch(),
    errorMessage: 'Không tải được chứng từ workflow.',
    forbiddenMessage: 'Bạn không có quyền xem chứng từ workflow.',
  });
  const workflowDocuments = workflowDocumentView.phase === 'ready' ? workflowDocumentView.data : [];

  const purchaseRequestQuery = useGetPurchaseRequestsPageQuery({
    pageNumber: purchaseRequestPage,
    pageSize: 8,
  });
  const purchaseRequestView = toQueryView(purchaseRequestQuery, {
    instruction: 'Đang chờ khởi tạo danh sách đề xuất mua hàng.',
    retry: () => purchaseRequestQuery.refetch(),
    errorMessage: 'Không tải được danh sách đề xuất mua hàng.',
    forbiddenMessage: 'Bạn không có quyền xem danh sách đề xuất mua hàng.',
  });
  const approvalPageNumber = scopedApprovalCursors.length + 1;
  const goToPreviousApprovalPage = () => {
    setApprovalPagination({ scopeKey: approvalScopeKey, cursors: scopedApprovalCursors.slice(0, -1) });
  };
  const goToNextApprovalPage = () => {
    if (approvalPage?.hasNext && approvalPage.nextCursor) {
      setApprovalPagination({ scopeKey: approvalScopeKey, cursors: [...scopedApprovalCursors, approvalPage.nextCursor] });
    }
  };

  const historyQuery = useGetApprovalHistoryQuery(
    { documentType: 'purchaserequest', documentId: selectedPrId ?? '' },
    { skip: !selectedPrId }
  );
  const historyView = toQueryView(historyQuery, {
    instruction: 'Chọn một đề xuất mua hàng để xem tiến trình duyệt.',
    retry: () => historyQuery.refetch(),
    errorMessage: 'Không tải được lịch sử phê duyệt.',
    forbiddenMessage: 'Bạn không có quyền xem lịch sử phê duyệt.',
  });
  const historyItems = historyView.phase === 'ready' ? historyView.data.data ?? [] : [];

  const [executeApprovalDecision, { isLoading: isDeciding }] = useExecuteApprovalDecisionMutation();
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionAnnouncement, setDecisionAnnouncement] = useState<string | null>(null);
  
  const [decisionModal, setDecisionModal] = useState<{
    isOpen: boolean;
    record: ApprovalRecord | null;
    status: 'Approve' | 'Reject' | null;
    reason: string;
  }>({
    isOpen: false,
    record: null,
    status: null,
    reason: '',
  });

  const purchaseDocuments = workflowDocuments.filter((document) => document.type === 'Đơn mua');
  const sourceDocument = workflowDocumentView.phase === 'ready'
    ? workflowDocuments.find((document) => document.type === 'KHSX')
      ?? purchaseDocuments[0]
      ?? workflowDocuments[0]
    : undefined;
  const nearestDeadline = approvalView.phase === 'ready'
    ? approvalRecords.find((record) => record.deadline)?.deadline
    : undefined;
  const approvalAvailability = resolveApprovalAvailability(approvalRecords, {
    isFetching: isFetchingApprovals,
    isError: isApprovalLoadError,
    isDeciding,
  });
  const firstActionableRecord = approvalAvailability.firstActionableRecord;
  const requestedRecord = approvalRecords.find((record) =>
    record.targetType === requestedTargetType && record.targetId === requestedTargetId);
  const approvalScopeLabel = requestedDate
    ? `Ngày ${formatDateOnly(requestedDate)}`
    : requestedWeek
      ? `Tuần từ ${formatDateOnly(requestedWeek)}`
      : 'Tất cả ngày đang chờ duyệt';

  useEffect(() => {
    if (!requestedRecord) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`approval-record-${requestedRecord.id}`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedRecord]);

  const openDecisionModal = (record: ApprovalRecord, status: 'Approve' | 'Reject') => {
    decisionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setDecisionError(null);
    setDecisionModal({
      isOpen: true,
      record,
      status,
      reason: '',
    });
  };

  const closeDecisionModal = () => {
    if (isDeciding) return;
    setDecisionError(null);
    setDecisionModal({ isOpen: false, record: null, status: null, reason: '' });
    window.requestAnimationFrame(() => decisionTriggerRef.current?.focus());
  };

  const handleDecisionSubmit = async () => {
    const { record, status, reason } = decisionModal;
    if (!record || !status) return;

    if (status === 'Reject' && !reason.trim()) {
      setDecisionError('Vui lòng nhập lý do để lưu dấu vết phê duyệt.');
      return;
    }

    if (!record.targetType || !record.targetId) {
      setDecisionError('Chứng từ chưa có thông tin đích hợp lệ để xử lý.');
      return;
    }

    try {
      await executeApprovalDecision({
        targetType: record.targetType,
        targetId: record.targetId,
        status,
        reason: reason.trim() || null,
        week: searchParams.get('week') ?? undefined,
      }).unwrap();
      
      setDecisionModal({ isOpen: false, record: null, status: null, reason: '' });
      setDecisionError(null);
      const completedLabel = status === 'Approve' ? 'Đã duyệt' : 'Đã từ chối';
      setDecisionAnnouncement(`${completedLabel} ${record.title.toLocaleLowerCase('vi-VN')}.`);
      window.setTimeout(() => queueFocusRef.current?.focus(), 0);
      toast({
        title: status === 'Approve' ? 'Đã duyệt chứng từ' : 'Đã từ chối chứng từ',
        description: 'Trạng thái và lịch sử phê duyệt đã được cập nhật.',
        variant: 'success',
      });
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      setDecisionError(`Chưa thể xử lý phê duyệt. ${message} Giữ nguyên ngữ cảnh và tải lại hàng đợi trước khi thử lại.`);
    }
  };

  const renderRecordActions = (record: ApprovalRecord) => (
    <>
      <Button
        variant="success"
        type="button"
        onClick={() => openDecisionModal(record, 'Approve')}
        disabled={isDeciding || !record.targetType || !record.targetId}
      >
        {getApprovalDecisionCopy(record.targetType, 'Approve').submitLabel}
      </Button>
      <Button
        variant="outline"
        type="button"
        onClick={() => openDecisionModal(record, 'Reject')}
        disabled={isDeciding || !record.targetType || !record.targetId}
      >
        {getApprovalDecisionCopy(record.targetType, 'Reject').submitLabel}
      </Button>
    </>
  );

  const modalCopy = decisionModal.record && decisionModal.status
    ? getApprovalDecisionCopy(decisionModal.record.targetType, decisionModal.status)
    : getApprovalDecisionCopy(undefined, 'Approve');

  return (
    <OperationalFrame
      command={
        <CommandBar
          actionsClassName="ipc-approval-actions"
          actions={
            <>
              <button
                className="ipc-button ipc-button-success"
                type="button"
                onClick={() => firstActionableRecord && openDecisionModal(firstActionableRecord, 'Approve')}
                disabled={Boolean(approvalAvailability.disabledReason)}
                aria-describedby={approvalAvailability.disabledReason ? 'approval-action-guidance' : undefined}
                title={approvalAvailability.disabledReason ?? undefined}
              >
                Duyệt
              </button>
              <button
                className="ipc-button ipc-button-ghost"
                type="button"
                onClick={() => firstActionableRecord && openDecisionModal(firstActionableRecord, 'Reject')}
                disabled={Boolean(approvalAvailability.disabledReason)}
                aria-describedby={approvalAvailability.disabledReason ? 'approval-action-guidance' : undefined}
                title={approvalAvailability.disabledReason ?? undefined}
              >
                Từ chối
              </button>
              <Link className="ipc-button ipc-button-primary" to={ROUTES.PURCHASING}>
                <FileCheck2 size={16} />
                Sang thu mua
              </Link>
              <Link className="ipc-button ipc-button-ghost" to={ROUTES.WAREHOUSE}>
                <RotateCcw size={16} />
                Kiểm tra kho
              </Link>
            </>
          }
        >
          <span className="ipc-command-meta">
            <ClipboardCheck size={16} />
            Nguồn: {workflowDocumentView.phase === 'ready' ? sourceDocument?.title ?? 'Chưa có chứng từ' : 'Chưa xác định'}
          </span>
          <span className="ipc-command-meta">Hạn duyệt gần nhất: {approvalView.phase === 'ready' ? nearestDeadline ?? 'Chưa có' : 'Chưa xác định'}</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Trạng thái chính', value: approvalAvailability.statusLabel, tone: approvalAvailability.statusTone },
            { label: 'Đơn mua', value: workflowDocumentView.phase === 'ready' ? `${purchaseDocuments.length} chứng từ` : '—', tone: 'neutral' },
            { label: 'Nhu cầu xuất', value: approvalView.phase === 'ready' ? `${approvalRecords.filter((record) => record.type === 'issue').length} phiếu` : '—', tone: approvalView.phase === 'ready' ? 'warning' : 'neutral' },
            { label: 'Người duyệt', value: 'Quản lí vận hành', tone: 'neutral' },
          ]}
        />
      }
    >
      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn duyệt vận hành"
        tabs={[
          { id: 'approval-queue', label: 'Cần duyệt' },
          { id: 'approval-history', label: 'Lịch sử' },
        ].filter((tab) => approvalTabIds.includes(tab.id.replace('approval-', '') as 'queue' | 'history'))}
        activeTab={`approval-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('approval-', '') as 'queue' | 'history')}
      />

      <div className="flex-1 min-h-0 flex flex-col">
        <KeepAliveTabPanel id="approval-queue" active={activeView === 'queue'}>
          <Suspense fallback={<div aria-hidden="true" className="min-h-12 rounded-md bg-slate-50 motion-reduce:animate-none" />}>
            <MenuAmendmentReconciliation />
          </Suspense>
          <SplitWorkbench
            detailLabel="Chứng từ"
            detailClassName="min-h-[16rem]"
            detail={<WorkflowDocumentsState view={workflowDocumentView} documents={purchaseDocuments} />}
          >
            <SectionPanel title="Danh sách cần duyệt" icon={<ClipboardCheck size={18} />}>
              <div className="mb-3 grid gap-2 border-b border-slate-200 pb-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label htmlFor="approval-inbox-search" className="grid gap-1 text-xs font-semibold text-slate-700">
                  Tìm chứng từ hoặc nguyên liệu
                  <Suspense fallback={<span aria-hidden="true" className="block h-9 rounded-md bg-slate-50" />}>
                    <ApprovalSearchField
                      value={approvalSearch}
                      onChange={(value) => {
                        setApprovalSearch(value);
                        setApprovalPagination({ scopeKey: '', cursors: [] });
                      }}
                    />
                  </Suspense>
                </label>
                <p className="text-xs text-slate-600 md:pb-2">Phạm vi: {approvalScopeLabel}</p>
              </div>
              <ApprovalQueueState
                view={approvalView}
                records={approvalRecords}
                disabledReason={approvalAvailability.disabledReason}
                decisionAnnouncement={decisionAnnouncement}
                requestedTargetType={requestedTargetType}
                requestedTargetId={requestedTargetId}
                requestedRecord={requestedRecord}
                queueFocusRef={queueFocusRef}
                actionForRecord={renderRecordActions}
                page={approvalPageNumber}
                onPrevious={goToPreviousApprovalPage}
                onNext={goToNextApprovalPage}
                paginationLabel="Phân trang hàng đợi duyệt"
              />
            </SectionPanel>
          </SplitWorkbench>
        </KeepAliveTabPanel>

        <KeepAliveTabPanel id="approval-history" active={activeView === 'history'}>
          <SplitWorkbench
            detailLabel="Tiến trình phê duyệt"
            detail={
              selectedPrId ? (
                <div className="p-5 space-y-5 relative">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-semibold text-slate-800">Lịch sử phê duyệt</h3>
                    <Button
                      onClick={() => setSelectedPrId(null)}
                      variant="outline"
                      size="xs"
                    >
                      Đóng
                    </Button>
                  </div>
                  {historyView.phase === 'forbidden' ? (
                    <InlineAlert title="Không có quyền xem lịch sử phê duyệt" variant="danger">
                      <span role="alert">{historyView.message}</span>
                    </InlineAlert>
                  ) : historyView.phase === 'error' ? (
                    <QueryErrorAlert
                      title="Không tải được lịch sử phê duyệt"
                      isRetrying={historyView.isRetrying}
                      onRetry={historyView.retry}
                    >
                      Kiểm tra kết nối rồi thử lại để xem các bước đã ghi nhận.
                    </QueryErrorAlert>
                  ) : historyView.phase === 'loading' ? (
                    <p role="status" className="text-sm text-slate-500 italic text-center py-4">
                      Đang tải lịch sử phê duyệt...
                    </p>
                  ) : historyView.phase === 'uninitialized' ? (
                    <p className="text-sm text-slate-500 italic text-center py-4">{historyView.instruction}</p>
                  ) : (
                    <>
                      {historyView.isRefreshing && (
                        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm border border-slate-200" role="status">
                          Đang cập nhật...
                        </span>
                      )}
                      {historyItems.length === 0 ? (
                        <EmptyState
                          title="Không tìm thấy bước duyệt nào."
                          className="!min-h-0 !p-4"
                        />
                      ) : (
                        <div className="space-y-6 relative pl-4 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                          {historyItems.map((item) => (
                            <div key={item.historyId} className="flex gap-4 relative pl-6">
                              <div className="absolute left-[-2px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-white flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span>{formatDateTime(item.actionAt)}</span>
                                  <span className="font-semibold text-slate-700">{item.actionByName}</span>
                                </div>
                                <div className="text-sm">
                                  <span className="font-semibold text-blue-700">{formatApprovalDecision(item.decision)}</span>
                                  {item.oldStatus && item.newStatus && (
                                    <span className="ml-2 text-xs text-slate-400">
                                      ({formatWorkflowStatus(item.oldStatus)} <ArrowRight className="inline size-3 mx-0.5" /> {formatWorkflowStatus(item.newStatus)})
                                    </span>
                                  )}
                                </div>
                                {item.reason && (
                                  <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded p-2 italic mt-1">
                                    "{item.reason}"
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center text-slate-400">
                  <div>
                    <Clock className="mx-auto size-8 text-slate-300 mb-2" />
                    <p className="text-sm">Chọn một đề xuất mua hàng ở bên trái để xem tiến trình duyệt</p>
                  </div>
                </div>
              )
            }
          >
            <SectionPanel title="Danh sách đề xuất mua hàng" icon={<ClipboardCheck size={18} />}>
              <PurchaseRequestHistoryState
                view={purchaseRequestView}
                selectedId={selectedPrId}
                currentPage={purchaseRequestPage}
                onSelect={setSelectedPrId}
                onPageChange={setPurchaseRequestPage}
              />
            </SectionPanel>
          </SplitWorkbench>
        </KeepAliveTabPanel>
      </div>

      {decisionModal.isOpen && decisionModal.status && (
        <Suspense fallback={<div aria-hidden="true" className="fixed inset-0 z-50 bg-black/20" />}>
          <ApprovalDecisionDialog
            open
            status={decisionModal.status}
            reason={decisionModal.reason}
            error={decisionError}
            isDeciding={isDeciding}
            copy={modalCopy}
            onReasonChange={(reason) => setDecisionModal((previous) => ({ ...previous, reason }))}
            onClose={closeDecisionModal}
            onSubmit={() => void handleDecisionSubmit()}
            onRetry={() => void approvalQuery.refetch()}
          />
        </Suspense>
      )}
    </OperationalFrame>
  );
}
