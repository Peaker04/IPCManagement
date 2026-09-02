import type { ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";
import {
  CursorPaginationBar,
  DocumentRail,
  EmptyState,
  InlineAlert,
  PaginationBar,
  QueryErrorAlert,
  StatusBadge,
} from "@/components/common";
import { ApprovalQueue } from '@/components/common/ApprovalQueue';
import type {
  ApprovalInboxPage,
  PageNumberPage,
  PurchaseRequestResult,
} from "@/api/workflowApiTypes";
import type { QueryView } from "@/lib/queryView";
import { formatWorkflowStatus } from "@/lib/workflowConfig";
import type { ApprovalRecord, WorkflowDocument } from "@/types/workflow";
import { Button } from "@/components/ui/button";

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

function ApprovalQueueViewport({
  children,
  loading = false,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <div
      className={loading ? "min-h-[32rem]" : "min-w-0"}
      data-testid="approval-queue-viewport"
    >
      {children}
    </div>
  );
}

function ApprovalQueueLoadingEnvelope() {
  return (
    <div
      className="ipc-approval-queue"
      role="region"
      aria-label="Hàng đợi duyệt vận hành"
      aria-busy="true"
      data-testid="approval-queue-loading"
    >
      <p
        role="status"
        aria-live="polite"
        className="text-sm font-medium text-slate-600"
      >
        Đang tải hàng đợi phê duyệt…
      </p>
      <article className="ipc-approval-record is-neutral" aria-hidden="true">
        <div className="ipc-approval-zone-identity">
          <span className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
          <span className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
          <div className="ipc-approval-record-action">
            <span className="h-10 w-28 animate-pulse rounded bg-slate-200" />
            <span className="h-10 w-24 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
        <div className="ipc-approval-zone-status">
          <span className="h-6 w-20 animate-pulse rounded bg-slate-200" />
          <span className="h-5 w-full animate-pulse rounded bg-slate-200" />
        </div>
        <dl className="ipc-approval-zone-meta">
          {[0, 1, 2].map((line) => (
            <div key={line}>
              <span className="h-4 w-full animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </dl>
      </article>
      <div aria-hidden="true">
        <PaginationBar
          page={1}
          pageSize={1}
          totalItems={1}
          onPageChange={() => undefined}
        />
      </div>
    </div>
  );
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
  if (view.phase === "forbidden") {
    return (
      <InlineAlert
        title="Không có quyền xem hàng đợi phê duyệt"
        variant="danger"
      >
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === "error") {
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
  if (view.phase === "uninitialized") {
    return (
      <InlineAlert title="Chưa khởi tạo hàng đợi" variant="info">
        {view.instruction}
      </InlineAlert>
    );
  }
  if (view.phase === "loading") {
    return (
      <ApprovalQueueViewport loading>
        <ApprovalQueueLoadingEnvelope />
      </ApprovalQueueViewport>
    );
  }

  return (
    <ApprovalQueueViewport>
      {view.isRefreshing && (
        <InlineAlert title="Đang cập nhật hàng đợi" variant="info">
          Các chứng từ hiện tại vẫn được giữ trong khi đồng bộ bản mới.
        </InlineAlert>
      )}
      {disabledReason && (
        <InlineAlert
          title={
            records.length === 0
              ? "Không có chứng từ chờ duyệt"
              : "Tạm thời chưa thể xử lý"
          }
          variant="info"
        >
          <span id="approval-action-guidance">
            {disabledReason} Các chứng từ đã xử lý vẫn có thể xem trong tab Lịch
            sử.
          </span>
        </InlineAlert>
      )}
      {decisionAnnouncement && (
        <div role="status" aria-live="polite" className="sr-only">
          {decisionAnnouncement}
        </div>
      )}
      {requestedTargetType &&
        requestedTargetId &&
        !requestedRecord &&
        !view.isRefreshing && (
          <InlineAlert
            title="Không tìm thấy hồ sơ phê duyệt trong trang hiện tại"
            variant="warning"
          >
            Hồ sơ {requestedTargetId} có thể đã được xử lý hoặc nằm ở trang
            khác. Tuần, ngày phục vụ và phạm vi trong đường dẫn vẫn được giữ
            nguyên.
          </InlineAlert>
        )}
      <div
        ref={queueFocusRef}
        tabIndex={-1}
        aria-label="Hàng đợi duyệt đã cập nhật"
      >
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
    </ApprovalQueueViewport>
  );
}

interface WorkflowDocumentsStateProps {
  view: QueryView<WorkflowDocument[]>;
  documents: WorkflowDocument[];
}

export function WorkflowDocumentsState({
  view,
  documents,
}: WorkflowDocumentsStateProps) {
  if (view.phase === "forbidden") {
    return (
      <InlineAlert
        title="Không có quyền xem chứng từ workflow"
        variant="danger"
        className="min-h-[11.5rem]"
      >
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === "error") {
    return (
      <QueryErrorAlert
        title="Không tải được chứng từ workflow"
        className="min-h-[11.5rem]"
        isRetrying={view.isRetrying}
        onRetry={view.retry}
      >
        Kiểm tra kết nối rồi thử lại trước khi mở chứng từ.
      </QueryErrorAlert>
    );
  }
  if (view.phase === "loading") {
    return (
      <InlineAlert title="Đang tải chứng từ workflow" variant="info" className="min-h-[11.5rem]">
        Danh sách chứng từ đang được đồng bộ.
      </InlineAlert>
    );
  }
  if (view.phase === "uninitialized") {
    return (
      <InlineAlert title="Chưa khởi tạo chứng từ workflow" variant="info" className="min-h-[11.5rem]">
        {view.instruction}
      </InlineAlert>
    );
  }

  return (
    <DocumentRail
      documents={documents}
      title={null}
      className="min-h-[11.5rem]"
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
  if (view.phase === "forbidden") {
    return (
      <InlineAlert title="Không có quyền xem đề xuất mua hàng" variant="danger">
        <span role="alert">{view.message}</span>
      </InlineAlert>
    );
  }
  if (view.phase === "error") {
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
  if (view.phase === "loading") {
    return (
      <InlineAlert title="Đang tải đề xuất mua hàng" variant="info">
        Danh sách đề xuất mua đang được đồng bộ.
      </InlineAlert>
    );
  }
  if (view.phase === "uninitialized") {
    return (
      <InlineAlert title="Chưa khởi tạo đề xuất mua hàng" variant="info">
        {view.instruction}
      </InlineAlert>
    );
  }

  const purchaseRequests = view.phase === "ready" && view.data?.items ? view.data.items : [];

  return (
    <>
      {view.isRefreshing && (
        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm border border-slate-200" role="status">
          Đang cập nhật...
        </span>
      )}
      {purchaseRequests.length === 0 ? (
        <EmptyState
          title="Không có đề xuất mua hàng nào."
          className="!min-h-0 !p-4"
        />
      ) : (
        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {purchaseRequests.map((purchaseRequest) => (
            <Button
              key={purchaseRequest.purchaseRequestId}
              onClick={() => onSelect(purchaseRequest.purchaseRequestId)}
              variant="outline"
              textWrap="wrap"
              className={`w-full items-stretch justify-start p-3 text-left transition-colors flex flex-col gap-1 ${
                selectedId === purchaseRequest.purchaseRequestId
                  ? "bg-blue-50/50"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800 text-sm">
                  {purchaseRequest.purchaseRequestCode}
                </span>
                <StatusBadge
                  variant={
                    purchaseRequest.status === "APPROVED"
                      ? "success"
                      : purchaseRequest.status === "REJECTED"
                        ? "danger"
                        : "warning"
                  }
                >
                  {formatWorkflowStatus(purchaseRequest.status)}
                </StatusBadge>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-700">
                <span>
                  Ngày mua: {purchaseRequest.purchaseForDate}{" "}
                  {purchaseRequest.shiftName
                    ? `(${purchaseRequest.shiftName})`
                    : ""}
                </span>
                <span>{purchaseRequest.lines?.length ?? 0} dòng</span>
              </div>
            </Button>
          ))}
        </div>
      )}
      <PaginationBar
        page={view.phase === "ready" && view.data?.pageNumber ? view.data.pageNumber : currentPage}
        pageSize={view.phase === "ready" && view.data?.pageSize ? view.data.pageSize : 8}
        totalItems={view.phase === "ready" && view.data?.totalCount ? view.data.totalCount : 0}
        onPageChange={onPageChange}
      />
    </>
  );
}
