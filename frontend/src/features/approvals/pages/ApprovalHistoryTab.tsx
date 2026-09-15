import { Clock, ArrowRight, ClipboardCheck } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState, InlineAlert, QueryErrorAlert, RefreshStatus, SectionPanel, StatusBadge } from '@/components/common'
import { PaginationBar } from '@/components/common/PaginationBar'
import { SplitWorkbench } from '@/components/common/SplitWorkbench'
import type { ApprovalHistoryItem, PageNumberPage, PurchaseRequestResult } from '@/api/workflowApiTypes'
import type { ApiResponse } from '@/types/api'
import type { QueryView } from '@/lib/queryView'
import { formatDateTime } from '@/lib/formatters'
import { formatWorkflowStatus } from '@/lib/workflowConfig'
import { formatApprovalDecision } from './approvalCopy'

interface ApprovalHistoryTabProps {
  selectedPrId: string | null
  setSelectedPrId: Dispatch<SetStateAction<string | null>>
  purchaseRequestView: QueryView<PageNumberPage<PurchaseRequestResult>>
  purchaseRequestPage: number
  setPurchaseRequestPage: Dispatch<SetStateAction<number>>
  historyView: QueryView<ApiResponse<ApprovalHistoryItem[]>>
  historyItems: ApprovalHistoryItem[]
}

export default function ApprovalHistoryTab({
  selectedPrId,
  setSelectedPrId,
  purchaseRequestView,
  purchaseRequestPage,
  setPurchaseRequestPage,
  historyView,
  historyItems,
}: ApprovalHistoryTabProps) {
  const purchaseRequests = purchaseRequestView.phase === 'ready' ? purchaseRequestView.data.items : []

  return (
    <SplitWorkbench
      detailLabel="Tiến trình phê duyệt"
      detailClassName="border-0 bg-transparent p-0"
      detail={selectedPrId ? (
        <div className="p-5 space-y-5 relative">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="font-semibold text-slate-800">Lịch sử phê duyệt</h3>
            <Button onClick={() => setSelectedPrId(null)} variant="outline" size="xs">Đóng</Button>
          </div>
          {historyView.phase === 'forbidden' ? (
            <InlineAlert title="Không có quyền xem lịch sử phê duyệt" variant="danger"><span role="alert">{historyView.message}</span></InlineAlert>
          ) : historyView.phase === 'error' ? (
            <QueryErrorAlert title="Không tải được lịch sử phê duyệt" isRetrying={historyView.isRetrying} onRetry={historyView.retry}>Kiểm tra kết nối rồi thử lại để xem các bước đã ghi nhận.</QueryErrorAlert>
          ) : historyView.phase === 'loading' ? (
            <p role="status" className="text-sm text-slate-500 italic text-center py-4">Đang tải lịch sử phê duyệt...</p>
          ) : historyView.phase === 'uninitialized' ? (
            <p className="text-sm text-slate-500 italic text-center py-4">{historyView.instruction}</p>
          ) : (
            <>
              {historyView.isRefreshing && <RefreshStatus>Đang cập nhật...</RefreshStatus>}
              {historyItems.length === 0 ? (
                <EmptyState title="Không tìm thấy bước duyệt nào." className="!min-h-0 !p-4" />
              ) : (
                <div className="space-y-6 relative pl-4 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {historyItems.map((item) => (
                    <div key={item.historyId} className="flex gap-4 relative pl-6">
                      <div className="absolute left-[-2px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-white flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /></div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-500"><span>{formatDateTime(item.actionAt)}</span><span className="font-semibold text-slate-700">{item.actionByName}</span></div>
                        <div className="text-sm">
                          <span className="font-semibold text-blue-700">{formatApprovalDecision(item.decision)}</span>
                          {item.oldStatus && item.newStatus && <span className="ml-2 text-xs text-slate-600">({formatWorkflowStatus(item.oldStatus)} <ArrowRight className="inline size-3 mx-0.5" /> {formatWorkflowStatus(item.newStatus)})</span>}
                        </div>
                        {item.reason && <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded p-2 italic mt-1">"{item.reason}"</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex h-full items-center justify-center p-8 text-center text-slate-600"><div><Clock className="mx-auto size-8 text-slate-300 mb-2" /><p className="text-sm">Chọn một đề xuất mua hàng ở bên trái để xem tiến trình duyệt</p></div></div>
      )}
    >
      <SectionPanel title="Danh sách đề xuất mua hàng" icon={<ClipboardCheck size={18} />}>
        {purchaseRequestView.phase === 'forbidden' ? (
          <InlineAlert title="Không có quyền xem đề xuất mua hàng" variant="danger"><span role="alert">{purchaseRequestView.message}</span></InlineAlert>
        ) : purchaseRequestView.phase === 'error' ? (
          <QueryErrorAlert title="Không tải được đề xuất mua hàng" isRetrying={purchaseRequestView.isRetrying} onRetry={purchaseRequestView.retry}>Danh sách lịch sử chưa thể hiển thị khi dữ liệu chưa tải xong.</QueryErrorAlert>
        ) : purchaseRequestView.phase === 'loading' ? (
          <InlineAlert title="Đang tải đề xuất mua hàng" variant="info">Danh sách đề xuất mua đang được đồng bộ.</InlineAlert>
        ) : purchaseRequestView.phase === 'uninitialized' ? (
          <InlineAlert title="Chưa khởi tạo đề xuất mua hàng" variant="info">{purchaseRequestView.instruction}</InlineAlert>
        ) : (
          <>
            {purchaseRequestView.isRefreshing && <RefreshStatus>Đang cập nhật...</RefreshStatus>}
            {purchaseRequests.length === 0 ? <EmptyState title="Không có đề xuất mua hàng nào." className="!min-h-0 !p-4" /> : (
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {purchaseRequests.map((request) => (
                  <Button key={request.purchaseRequestId} onClick={() => setSelectedPrId(request.purchaseRequestId)} variant="outline" textWrap="wrap" className={`w-full items-stretch justify-start p-3 text-left transition-colors flex flex-col gap-1 ${selectedPrId === request.purchaseRequestId ? 'bg-blue-50/50' : ''}`}>
                    <div className="flex items-center justify-between"><span className="font-semibold text-slate-800 text-sm">{request.purchaseRequestCode}</span><StatusBadge status={request.status} domain="purchase" /></div>
                    <div className="flex items-center justify-between text-xs text-slate-700"><span>Ngày mua: {request.purchaseForDate} {request.shiftName ? `(${request.shiftName})` : ''}</span><span>{request.lines?.length ?? 0} dòng</span></div>
                  </Button>
                ))}
              </div>
            )}
            <PaginationBar page={purchaseRequestView.data.pageNumber || purchaseRequestPage} pageSize={purchaseRequestView.data.pageSize || 8} totalItems={purchaseRequestView.data.totalCount || 0} onPageChange={setPurchaseRequestPage} />
          </>
        )}
      </SectionPanel>
    </SplitWorkbench>
  )
}
