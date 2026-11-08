import { lazy, Suspense, useDeferredValue, useEffect, useRef, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { KeepAliveTabPanel } from '@/components/common/KeepAliveTabPanel';
import { OperationalFrame } from '@/components/common/OperationalFrame';
import { SectionPanel } from '@/components/common/SectionPanel';
import { useToast } from '@/components/common/useToast';
import { ViewSwitcher } from '@/components/common/ViewSwitcher';
import { TabContentSkeleton } from '@/components/common/TabContentSkeleton';
import { toQueryView } from '@/lib/queryView';
import { useExecuteApprovalDecisionMutation, useGetApprovalRecordsQuery, useGetApprovalHistoryQuery } from '@/api/approvalsApi';
import { useGetPurchaseRequestsPageQuery } from '@/api/purchasingApi'; import { useGetInventoryReceiptByIdQuery } from '@/api/warehouseApi';
import type { ApprovalRecord } from '@/types/workflow';
import { Button } from '@/components/ui/button';
import { formatDateOnly } from '@/lib/formatters';
import { getApprovalDecisionCopy } from './approvalCopy';
import { resolveApprovalAvailability } from '@/lib/actionEligibility';
import { visibleTabIds } from '@/lib/navigationPreferences';

const ApprovalDecisionDialog = lazy(() => import('./ApprovalDecisionDialog').then(({ ApprovalDecisionDialog: component }) => ({ default: component })))
const ApprovalSearchField = lazy(() => import('./ApprovalSearchField').then(({ ApprovalSearchField: component }) => ({ default: component })))
const ApprovalQueueState = lazy(() => import('./ApprovalQueryPanels').then(({ ApprovalQueueState: component }) => ({ default: component })))
const ApprovalHistoryTab = lazy(() => import('./ApprovalHistoryTab'))
const MenuAmendmentInbox = lazy(() => import('../components/MenuAmendmentInbox').then(({ MenuAmendmentInbox: component }) => ({ default: component })))
const MenuAmendmentReconciliation = lazy(() => import('../components/MenuAmendmentReconciliation').then(({ MenuAmendmentReconciliation: component }) => ({ default: component })))

export default function ApprovalPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const queueFocusRef = useRef<HTMLDivElement>(null);
  const decisionTriggerRef = useRef<HTMLElement | null>(null);
  const approvalTabIds = visibleTabIds('approvals') as Array<'queue' | 'history'>;
  type ApprovalView = 'amendments' | 'queue' | 'history';
  const requestedView = searchParams.get('view');
  const activeView: ApprovalView = requestedView === 'history' && approvalTabIds.includes('history')
    ? 'history'
    : requestedView === 'queue' && approvalTabIds.includes('queue')
      ? 'queue'
      : requestedView === 'amendments'
        ? 'amendments'
        : approvalTabIds.includes('queue') ? 'queue' : approvalTabIds.includes('history') ? 'history' : 'amendments';
  const selectView = (view: ApprovalView) => {
    const next = new URLSearchParams(searchParams);
    next.set('view', view);
    setSearchParams(next);
  };
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [approvalPagination, setApprovalPagination] = useState<{ scopeKey: string; cursors: string[] }>({ scopeKey: '', cursors: [] });
  const [purchaseRequestPage, setPurchaseRequestPage] = useState(1);
  const [purchaseRequestPageSize, setPurchaseRequestPageSize] = useState(8);
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

  const purchaseRequestQuery = useGetPurchaseRequestsPageQuery({
    pageNumber: purchaseRequestPage,
    pageSize: purchaseRequestPageSize,
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

  const approvalAvailability = resolveApprovalAvailability(approvalRecords, {
    isFetching: isFetchingApprovals,
    isError: isApprovalLoadError,
    isDeciding,
  });
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
        aria-label={`${getApprovalDecisionCopy(record.targetType, 'Approve').submitLabel}: ${record.title}`}
        onClick={() => openDecisionModal(record, 'Approve')}
        disabled={isDeciding || !record.targetType || !record.targetId}
      >
        Duyệt
      </Button>
      <Button
        variant="outline"
        type="button"
        aria-label={`${getApprovalDecisionCopy(record.targetType, 'Reject').submitLabel}: ${record.title}`}
        onClick={() => openDecisionModal(record, 'Reject')}
        disabled={isDeciding || !record.targetType || !record.targetId}
      >
        Từ chối
      </Button>
    </>
  );

  const modalCopy = decisionModal.record && decisionModal.status
    ? getApprovalDecisionCopy(decisionModal.record.targetType, decisionModal.status)
    : getApprovalDecisionCopy(undefined, 'Approve');
  const decisionReceiptId = decisionModal.record?.targetType === 'inventory-receipt'
    ? decisionModal.record.targetId
    : undefined;
  const decisionReceiptQuery = useGetInventoryReceiptByIdQuery(decisionReceiptId!, { skip: !decisionReceiptId });

  return (
    <OperationalFrame>
      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn duyệt vận hành"
        tabs={[
          { id: 'approval-amendments', label: 'Điều chỉnh thực đơn' },
          ...(approvalTabIds.includes('queue') ? [{ id: 'approval-queue', label: 'Duyệt chứng từ' }] : []),
          ...(approvalTabIds.includes('history') ? [{ id: 'approval-history', label: 'Lịch sử đề xuất mua' }] : []),
        ]}
        activeTab={`approval-${activeView}`}
        onTabChange={(id) => selectView(id.replace('approval-', '') as ApprovalView)}
      />

      <div className="flex-1 min-h-0 flex flex-col">
        <KeepAliveTabPanel
          id="approval-amendments"
          active={activeView === 'amendments'}
          fallback={<TabContentSkeleton variant="table" geometry="table" message="Đang tải điều chỉnh thực đơn..." />}
        >
          <Suspense fallback={<div aria-hidden="true" className="min-h-12 rounded-md bg-slate-50 motion-reduce:animate-none" />}>
            <div className="space-y-3">
              <MenuAmendmentInbox />
              <MenuAmendmentReconciliation />
            </div>
          </Suspense>
        </KeepAliveTabPanel>

        <KeepAliveTabPanel
          id="approval-queue"
          active={activeView === 'queue'}
          fallback={<TabContentSkeleton variant="split" geometry="workspace" message="Đang tải hàng chờ duyệt..." />}
        >
          <SectionPanel
              title="Danh sách cần duyệt"
              icon={<ClipboardCheck size={18} />}
              description="Các đề xuất và chứng từ đang chờ quản lý vận hành phê duyệt."
              actions={
                <div className="flex max-w-full flex-wrap items-center gap-3 sm:flex-nowrap">
                  <span className="hidden whitespace-nowrap text-xs text-slate-500 md:inline">Phạm vi: {approvalScopeLabel}</span>
                  <div className="w-64 max-w-full">
                    <Suspense fallback={<span aria-hidden="true" className="block h-9 rounded-md bg-slate-50" />}>
                      <ApprovalSearchField
                        value={approvalSearch}
                        onChange={(value) => {
                          setApprovalSearch(value);
                          setApprovalPagination({ scopeKey: '', cursors: [] });
                        }}
                      />
                    </Suspense>
                  </div>
                </div>
              }
            >
              <Suspense fallback={<TabContentSkeleton variant="table" geometry="table" message="Đang tải hàng chờ duyệt..." />}>
                <ApprovalQueueState
                view={approvalView}
                records={approvalRecords}
                disabledReason={approvalAvailability.disabledReason}
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
              </Suspense>
          </SectionPanel>
        </KeepAliveTabPanel>

        <KeepAliveTabPanel
          id="approval-history"
          active={activeView === 'history'}
          fallback={<TabContentSkeleton variant="split" geometry="workspace" message="Đang tải lịch sử duyệt..." />}
        >
          <Suspense fallback={<TabContentSkeleton variant="split" geometry="workspace" message="Đang tải lịch sử duyệt..." />}>
            <ApprovalHistoryTab
              selectedPrId={selectedPrId}
              setSelectedPrId={setSelectedPrId}
              purchaseRequestView={purchaseRequestView}
              purchaseRequestPage={purchaseRequestPage}
              purchaseRequestPageSize={purchaseRequestPageSize}
              setPurchaseRequestPage={setPurchaseRequestPage}
              setPurchaseRequestPageSize={setPurchaseRequestPageSize}
              historyView={historyView}
              historyItems={historyItems}
            />
          </Suspense>
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
            onRetry={() => void Promise.all([approvalQuery.refetch(), decisionReceiptId ? decisionReceiptQuery.refetch() : Promise.resolve()])}
            receipt={decisionReceiptQuery.data}
            isReceiptLoading={Boolean(decisionReceiptId && decisionReceiptQuery.isFetching)}
            isReceiptError={Boolean(decisionReceiptId && decisionReceiptQuery.isError)}
          />
        </Suspense>
      )}
    </OperationalFrame>
  );
}
