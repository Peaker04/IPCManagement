import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, FileCheck2, RotateCcw, Clock, ArrowRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ApprovalQueue,
  CommandBar,
  ContextStrip,
  CursorPaginationBar,
  DocumentRail,
  InlineAlert,
  OperationalFrame,
  PaginationBar,
  SectionPanel,
  SplitWorkbench,
  StatusBadge,
  useToast,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useExecuteApprovalDecisionMutation,
  useGetApprovalRecordsQuery,
  useGetWorkflowDocumentsQuery,
  useGetPurchaseRequestsPageQuery,
  useGetApprovalHistoryQuery,
} from '@/features/workflow';
import type { ApprovalRecord } from '@/features/workflow';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatWorkflowStatus } from '../workflowConfig';
import { formatApprovalDecision, getApprovalDecisionCopy } from './approvalCopy';

export default function ApprovalPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const queueFocusRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'queue' | 'role' | 'history'>('queue');
  const [selectedPrId, setSelectedPrId] = useState<string | null>(null);
  const [approvalCursors, setApprovalCursors] = useState<string[]>([]);
  const [purchaseRequestPage, setPurchaseRequestPage] = useState(1);
  
  const approvalCursor = approvalCursors.at(-1);
  const {
    data: approvalPage = { items: [], limit: 20, hasNext: false, nextCursor: null },
    isFetching: isFetchingApprovals,
    isError: isApprovalLoadError,
    refetch: refetchApprovals,
  } = useGetApprovalRecordsQuery({
    limit: 20,
    cursor: approvalCursor,
  });
  const approvalRecords = approvalPage.items;
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 20 });
  const { data: purchaseRequestsPageResponse } = useGetPurchaseRequestsPageQuery({
    pageNumber: purchaseRequestPage,
    pageSize: 8,
  });
  const purchaseRequests = purchaseRequestsPageResponse?.items ?? [];

  const approvalPageNumber = approvalCursors.length + 1;
  const goToPreviousApprovalPage = () => {
    setApprovalCursors((current) => current.slice(0, -1));
  };
  const goToNextApprovalPage = () => {
    if (approvalPage.hasNext && approvalPage.nextCursor) {
      setApprovalCursors((current) => [...current, approvalPage.nextCursor!]);
    }
  };

  const { data: historyResponse } = useGetApprovalHistoryQuery(
    { documentType: 'purchaserequest', documentId: selectedPrId ?? '' },
    { skip: !selectedPrId }
  );
  const historyItems = historyResponse?.data ?? [];

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
  const sourceDocument = workflowDocuments.find((document) => document.type === 'KHSX')
    ?? purchaseDocuments[0]
    ?? workflowDocuments[0];
  const nearestDeadline = approvalRecords.find((record) => record.deadline)?.deadline;
  const firstActionableRecord = approvalRecords.find((record) => record.targetType && record.targetId) ?? approvalRecords[0];
  const requestedTargetType = searchParams.get('target') ?? searchParams.get('targetType');
  const requestedTargetId = searchParams.get('id') ?? searchParams.get('targetId');
  const requestedRecord = approvalRecords.find((record) =>
    record.targetType === requestedTargetType && record.targetId === requestedTargetId);

  useEffect(() => {
    if (!requestedRecord) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`approval-record-${requestedRecord.id}`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedRecord]);

  const openDecisionModal = (record: ApprovalRecord, status: 'Approve' | 'Reject') => {
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
      <button
        className="ipc-button ipc-button-success"
        type="button"
        onClick={() => openDecisionModal(record, 'Approve')}
        disabled={isDeciding || !record.targetType || !record.targetId}
      >
        {getApprovalDecisionCopy(record.targetType, 'Approve').submitLabel}
      </button>
      <button
        className="ipc-button ipc-button-ghost"
        type="button"
        onClick={() => openDecisionModal(record, 'Reject')}
        disabled={isDeciding || !record.targetType || !record.targetId}
      >
        {getApprovalDecisionCopy(record.targetType, 'Reject').submitLabel}
      </button>
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
                disabled={!firstActionableRecord?.targetType || !firstActionableRecord.targetId || isDeciding}
              >
                Duyệt
              </button>
              <button
                className="ipc-button ipc-button-ghost"
                type="button"
                onClick={() => firstActionableRecord && openDecisionModal(firstActionableRecord, 'Reject')}
                disabled={!firstActionableRecord?.targetType || !firstActionableRecord.targetId || isDeciding}
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
            Nguồn: {sourceDocument?.title ?? 'Chưa có chứng từ'}
          </span>
          <span className="ipc-command-meta">Hạn duyệt gần nhất: {nearestDeadline ?? 'Chưa có'}</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Trạng thái chính', value: 'Chờ duyệt', tone: 'warning' },
            { label: 'Đơn mua', value: `${purchaseDocuments.length} chứng từ`, tone: purchaseDocuments.length ? 'danger' : 'neutral' },
            { label: 'Nhu cầu xuất', value: `${approvalRecords.filter((record) => record.type === 'issue').length} phiếu`, tone: 'warning' },
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
          { id: 'approval-role', label: 'Theo vai trò' },
          { id: 'approval-history', label: 'Lịch sử' },
        ]}
        activeTab={`approval-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('approval-', '') as 'queue' | 'role' | 'history')}
      />

      {activeView === 'queue' && (
        <div id="approval-queue-panel" role="tabpanel" aria-labelledby="approval-queue-tab">
          <SplitWorkbench
            detailLabel="Chứng từ"
            detail={
              <DocumentRail
                documents={purchaseDocuments}
                title={null}
                actionForDocument={(document) => (
                  <Link className="ipc-button ipc-button-ghost" to={document.route}>
                    Mở chứng từ
                  </Link>
                )}
              />
            }
          >
            <SectionPanel title="Danh sách cần duyệt" icon={<ClipboardCheck size={18} />}>
              {decisionAnnouncement && <div role="status" aria-live="polite" className="sr-only">{decisionAnnouncement}</div>}
              {requestedTargetType && requestedTargetId && !requestedRecord && !isFetchingApprovals && !isApprovalLoadError && (
                <InlineAlert title="Không tìm thấy hồ sơ phê duyệt trong trang hiện tại" variant="warning">
                  Hồ sơ {requestedTargetId} có thể đã được xử lý hoặc nằm ở trang khác. Tuần, ngày phục vụ và phạm vi trong đường dẫn vẫn được giữ nguyên.
                </InlineAlert>
              )}
              {isApprovalLoadError && (
                <InlineAlert title="Không tải được hàng đợi phê duyệt" variant="danger">
                  Kiểm tra kết nối rồi thử lại. Ngữ cảnh đang chọn chưa bị thay đổi.
                  <button className="ipc-button ipc-button-ghost ml-2" type="button" onClick={() => void refetchApprovals()}>Thử lại</button>
                </InlineAlert>
              )}
              <div ref={queueFocusRef} tabIndex={-1} aria-label="Hàng đợi duyệt đã cập nhật">
              <ApprovalQueue
                records={approvalRecords}
                pageSize={Math.max(approvalRecords.length, 1)}
                title={null}
                selectedRecordId={requestedRecord?.id}
                actionForRecord={renderRecordActions}
              />
              </div>
              <CursorPaginationBar
                page={approvalPageNumber}
                hasNext={approvalPage.hasNext}
                onPrevious={goToPreviousApprovalPage}
                onNext={goToNextApprovalPage}
                ariaLabel="Phân trang hàng đợi duyệt"
              />
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'role' && (
        <SectionPanel title="Việc đang chờ quản lí" icon={<ClipboardCheck size={18} />}>
          <div id="approval-role-panel" role="tabpanel" aria-labelledby="approval-role-tab">
            <div>
              <ApprovalQueue
                records={approvalRecords}
                pageSize={Math.max(approvalRecords.length, 1)}
                title={null}
                selectedRecordId={requestedRecord?.id}
                actionForRecord={renderRecordActions}
              />
              <CursorPaginationBar
                page={approvalPageNumber}
                hasNext={approvalPage.hasNext}
                onPrevious={goToPreviousApprovalPage}
                onNext={goToNextApprovalPage}
                ariaLabel="Phân trang việc đang chờ quản lí"
              />
            </div>
          </div>
        </SectionPanel>
      )}

      {activeView === 'history' && (
        <div id="approval-history-panel" role="tabpanel" aria-labelledby="approval-history-tab">
          <SplitWorkbench
            detailLabel="Tiến trình phê duyệt"
            detail={
              selectedPrId ? (
                <div className="p-5 space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-semibold text-slate-800">Lịch sử phê duyệt</h3>
                    <button
                      onClick={() => setSelectedPrId(null)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Đóng
                    </button>
                  </div>
                  {historyItems.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-4">Không tìm thấy bước duyệt nào.</p>
                  ) : (
                    <div className="space-y-6 relative pl-4 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {historyItems.map((item) => (
                        <div key={item.historyId} className="flex gap-4 relative pl-6">
                          <div className="absolute left-[-2px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-white flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                              <span>{new Date(item.actionAt).toLocaleString('vi-VN')}</span>
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
              {purchaseRequests.length === 0 ? (
                <p className="text-slate-500 italic p-4 text-center">Không có đề xuất mua hàng nào.</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                  {purchaseRequests.map((pr) => (
                    <button
                      key={pr.purchaseRequestId}
                      onClick={() => setSelectedPrId(pr.purchaseRequestId)}
                      className={`w-full text-left p-3 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${
                        selectedPrId === pr.purchaseRequestId ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 text-sm">{pr.purchaseRequestCode}</span>
                        <StatusBadge variant={pr.status === 'APPROVED' ? 'success' : pr.status === 'REJECTED' ? 'danger' : 'warning'}>
                          {formatWorkflowStatus(pr.status)}
                        </StatusBadge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>Ngày mua: {pr.purchaseForDate} {pr.shiftName ? `(${pr.shiftName})` : ''}</span>
                        <span>{pr.lines.length} dòng</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <PaginationBar
                page={purchaseRequestsPageResponse?.pageNumber ?? purchaseRequestPage}
                pageSize={purchaseRequestsPageResponse?.pageSize ?? 8}
                totalItems={purchaseRequestsPageResponse?.totalCount ?? 0}
                onPageChange={setPurchaseRequestPage}
              />
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {/* Confirmation Dialog for Approvals / Rejections */}
      <Dialog
        open={decisionModal.isOpen}
        onOpenChange={(open) => {
          if (!open) closeDecisionModal();
        }}
      >
        <DialogContent
          aria-label={modalCopy.title}
          className="max-w-md"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            closeDecisionModal();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {modalCopy.title}
            </DialogTitle>
            <DialogDescription>
              {modalCopy.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label htmlFor="decision-reason" className="text-sm font-semibold text-slate-700">
              {decisionModal.status === 'Approve' ? 'Ghi chú duyệt (tùy chọn)' : 'Lý do từ chối'}
            </label>
            <Textarea
              id="decision-reason"
              value={decisionModal.reason}
              onChange={(e) => setDecisionModal((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder={decisionModal.status === 'Approve' ? 'Ví dụ: Đồng ý duyệt...' : 'Nhập lý do từ chối bắt buộc...'}
              className="min-h-[100px] resize-none"
              aria-invalid={Boolean(decisionError)}
              aria-describedby={decisionError ? 'decision-error' : undefined}
              disabled={isDeciding}
            />
          </div>

          {decisionError && (
            <div id="decision-error" role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p>{decisionError}</p>
              <Button type="button" variant="outline" className="mt-2" onClick={() => void refetchApprovals()} disabled={isDeciding}>
                Tải lại hàng đợi
              </Button>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeDecisionModal}
              disabled={isDeciding}
              autoFocus
            >
              {modalCopy.safeLabel}
            </Button>
            <Button
              type="button"
              variant={decisionModal.status === 'Reject' ? 'destructive' : 'default'}
              onClick={handleDecisionSubmit}
              disabled={isDeciding || (decisionModal.status === 'Reject' && !decisionModal.reason.trim())}
            >
              {isDeciding ? 'Đang xử lý...' : modalCopy.submitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OperationalFrame>
  );
}
