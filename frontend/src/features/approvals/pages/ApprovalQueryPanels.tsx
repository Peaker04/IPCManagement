import type { ReactNode, RefObject } from 'react';
import { Link } from 'react-router-dom';
import {
  ApprovalQueue,
  CursorPaginationBar,
  DocumentRail,
  InlineAlert,
  PaginationBar,
  QueryErrorAlert,
  StatusBadge,
} from '@/components/common';
import type {
  ApprovalInboxPage,
  PageNumberPage,
  PurchaseRequestResult,
} from '@/api/workflowApi';
import type { QueryView } from '@/lib/queryView';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import type { ApprovalRecord, WorkflowDocument } from '@/types/workflow';

interface ApprovalQueueStateProps {
  view: QueryView<ApprovalInboxPage>;
  records: ApprovalRecord[];
  disabledReason: string | null;
  decisionAnnouncement: string | null;
  requestedTargetType: string | null;
  requestedTargetId: string | null;
  requestedRecord?: ApprovalRecord;
  queueFocusRef: RefObject<HTMLDivElement | null>;
  actionForRecord: (record: ApprovalRecord) => ReactNode;
  page: number;
  onPrevious: () => void;
  onNext: () => void;
  paginationLabel: string;
}

export function ApprovalQueueState({
  view,
  records,
  disabledReason,
  decisionAnnouncement,
  requestedTargetType,
  requestedTargetId,
  requestedRecord,
  queueFocusRef,
  actionForRecord,
  page,
  onPrevious,
  onNext,
  paginationLabel,
}: ApprovalQueueStateProps) {
  if (view.phase === 'forbidden') {
    return (
      <InlineAlert title="Không có quyền xem hàng đợi phê duyệt" variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === 'error') {
    return (
      <QueryErrorAlert
        title="Không tải được hàng đợi phê duyệt"
        isRetrying={view.isRetrying}
        onRetry={view.retry}
      >
        Kiểm tra kết nối rồi thử lại. Ngữ cảnh đang chọn chưa bị thay đổi.
      </QueryErrorAlert>
    );
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title="Chưa khởi tạo hàng đợi" variant="info">{view.instruction}</InlineAlert>;
  }
  if (view.phase === 'loading') {
    return <InlineAlert title="Đang tải hàng đợi phê duyệt" variant="info">Dữ liệu đang được đồng bộ.</InlineAlert>;
  }

  return (
    <>
      {view.isRefreshing && (
        <InlineAlert title="Đang cập nhật hàng đợi" variant="info">
          Các chứng từ hiện tại vẫn được giữ trong khi đồng bộ bản mới.
        </InlineAlert>
      )}
      {disabledReason && (
        <InlineAlert title={records.length === 0 ? 'Không có chứng từ chờ duyệt' : 'Tạm thời chưa thể xử lý'} variant="info">
          <span id="approval-action-guidance">{disabledReason} Các chứng từ đã xử lý vẫn có thể xem trong tab Lịch sử.</span>
        </InlineAlert>
      )}
      {decisionAnnouncement && <div role="status" aria-live="polite" className="sr-only">{decisionAnnouncement}</div>}
      {requestedTargetType && requestedTargetId && !requestedRecord && !view.isRefreshing && (
        <InlineAlert title="Không tìm thấy hồ sơ phê duyệt trong trang hiện tại" variant="warning">
          Hồ sơ {requestedTargetId} có thể đã được xử lý hoặc nằm ở trang khác. Tuần, ngày phục vụ và phạm vi trong đường dẫn vẫn được giữ nguyên.
        </InlineAlert>
      )}
      <div ref={queueFocusRef} tabIndex={-1} aria-label="Hàng đợi duyệt đã cập nhật">
        <ApprovalQueue
          records={records}
          pageSize={Math.max(records.length, 1)}
          title={null}
          selectedRecordId={requestedRecord?.id}
          actionForRecord={actionForRecord}
        />
      </div>
      <CursorPaginationBar
        page={page}
        hasNext={view.data.hasNext}
        onPrevious={onPrevious}
        onNext={onNext}
        ariaLabel={paginationLabel}
      />
    </>
  );
}

interface WorkflowDocumentsStateProps {
  view: QueryView<WorkflowDocument[]>;
  documents: WorkflowDocument[];
}

export function WorkflowDocumentsState({ view, documents }: WorkflowDocumentsStateProps) {
  if (view.phase === 'forbidden') {
    return (
      <InlineAlert title="Không có quyền xem chứng từ workflow" variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === 'error') {
    return (
      <QueryErrorAlert
        title="Không tải được chứng từ workflow"
        isRetrying={view.isRetrying}
        onRetry={view.retry}
      >
        Kiểm tra kết nối rồi thử lại trước khi mở chứng từ.
      </QueryErrorAlert>
    );
  }
  if (view.phase === 'loading') {
    return <InlineAlert title="Đang tải chứng từ workflow" variant="info">Danh sách chứng từ đang được đồng bộ.</InlineAlert>;
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title="Chưa khởi tạo chứng từ workflow" variant="info">{view.instruction}</InlineAlert>;
  }

  return (
    <DocumentRail
      documents={documents}
      title={null}
      actionForDocument={(document) => (
        <Link className="ipc-button ipc-button-ghost" to={document.route}>
          Mở chứng từ
        </Link>
      )}
    />
  );
}

interface PurchaseRequestHistoryStateProps {
  view: QueryView<PageNumberPage<PurchaseRequestResult>>;
  selectedId: string | null;
  currentPage: number;
  onSelect: (purchaseRequestId: string) => void;
  onPageChange: (page: number) => void;
}

export function PurchaseRequestHistoryState({
  view,
  selectedId,
  currentPage,
  onSelect,
  onPageChange,
}: PurchaseRequestHistoryStateProps) {
  if (view.phase === 'forbidden') {
    return (
      <InlineAlert title="Không có quyền xem đề xuất mua hàng" variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === 'error') {
    return (
      <QueryErrorAlert
        title="Không tải được đề xuất mua hàng"
        isRetrying={view.isRetrying}
        onRetry={view.retry}
      >
        Danh sách lịch sử chưa thể hiển thị khi dữ liệu chưa tải xong.
      </QueryErrorAlert>
    );
  }
  if (view.phase === 'loading') {
    return <InlineAlert title="Đang tải đề xuất mua hàng" variant="info">Danh sách đề xuất mua đang được đồng bộ.</InlineAlert>;
  }
  if (view.phase === 'uninitialized') {
    return <InlineAlert title="Chưa khởi tạo đề xuất mua hàng" variant="info">{view.instruction}</InlineAlert>;
  }

  const purchaseRequests = view.data.items;

  return (
    <>
      {view.isRefreshing && (
        <InlineAlert title="Đang cập nhật đề xuất mua" variant="info">
          Danh sách hiện tại vẫn được giữ trong khi đồng bộ bản mới.
        </InlineAlert>
      )}
      {purchaseRequests.length === 0 ? (
        <p className="text-slate-500 italic p-4 text-center">Không có đề xuất mua hàng nào.</p>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {purchaseRequests.map((purchaseRequest) => (
            <button
              key={purchaseRequest.purchaseRequestId}
              onClick={() => onSelect(purchaseRequest.purchaseRequestId)}
              className={`w-full text-left p-3 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${
                selectedId === purchaseRequest.purchaseRequestId ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 text-sm">{purchaseRequest.purchaseRequestCode}</span>
                <StatusBadge variant={purchaseRequest.status === 'APPROVED' ? 'success' : purchaseRequest.status === 'REJECTED' ? 'danger' : 'warning'}>
                  {formatWorkflowStatus(purchaseRequest.status)}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Ngày mua: {purchaseRequest.purchaseForDate} {purchaseRequest.shiftName ? `(${purchaseRequest.shiftName})` : ''}</span>
                <span>{purchaseRequest.lines.length} dòng</span>
              </div>
            </button>
          ))}
        </div>
      )}
      <PaginationBar
        page={view.data.pageNumber ?? currentPage}
        pageSize={view.data.pageSize ?? 8}
        totalItems={view.data.totalCount ?? 0}
        onPageChange={onPageChange}
      />
    </>
  );
}
