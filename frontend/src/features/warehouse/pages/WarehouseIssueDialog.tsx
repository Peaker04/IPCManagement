import type { MaterialRequestCandidate } from '@/api/workflowApiTypes'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatIssueCandidateLabel, type WarehouseIssueAllocation } from '../warehouseIssueAllocation'

interface WarehouseIssueDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMaterialRequestId: string
  onMaterialRequestChange: (value: string) => void
  selectedIssueCandidate?: MaterialRequestCandidate
  issueCandidates: MaterialRequestCandidate[]
  issueCandidatePageNumber: number
  issueCandidatePageSize: number
  issueCandidateTotalItems: number
  onIssueCandidatePageChange: (page: number) => void
  isFetchingIssueCandidates: boolean
  isIssueCandidateError: boolean
  warehouseName?: string
  selectedWarehouseId: string
  warehouseErrorMessage?: string
  allocation: WarehouseIssueAllocation
  isAllocationSourceError: boolean
  isIssueAllocationRefreshing: boolean
  isCreatingIssue: boolean
  onConfirm: () => void
}

export default function WarehouseIssueDialog({
  open,
  onOpenChange,
  selectedMaterialRequestId,
  onMaterialRequestChange,
  selectedIssueCandidate,
  issueCandidates,
  issueCandidatePageNumber,
  issueCandidatePageSize,
  issueCandidateTotalItems,
  onIssueCandidatePageChange,
  isFetchingIssueCandidates,
  isIssueCandidateError,
  warehouseName,
  selectedWarehouseId,
  warehouseErrorMessage,
  allocation,
  isAllocationSourceError,
  isIssueAllocationRefreshing,
  isCreatingIssue,
  onConfirm,
}: WarehouseIssueDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-labelledby="warehouse-issue-title" aria-describedby="warehouse-issue-description">
        <DialogHeader>
          <DialogTitle id="warehouse-issue-title">Tạo phiếu xuất kho</DialogTitle>
          <DialogDescription id="warehouse-issue-description">Chọn nhu cầu nguyên liệu và kho xuất tương ứng để lập phiếu.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-800" htmlFor="warehouse-material-request">Nhu cầu nguyên liệu <span aria-hidden="true" className="text-red-600">*</span></label>
            <Select value={selectedMaterialRequestId} onValueChange={(value) => onMaterialRequestChange(value ?? '')}>
              <SelectTrigger id="warehouse-material-request" aria-label="Chọn nhu cầu nguyên liệu">
                <SelectValue placeholder="Chọn chứng từ cần xuất">{selectedIssueCandidate ? formatIssueCandidateLabel(selectedIssueCandidate) : 'Chọn chứng từ cần xuất'}</SelectValue>
              </SelectTrigger>
              <SelectContent>{issueCandidates.map((candidate) => <SelectItem key={candidate.materialRequestId} value={candidate.materialRequestId}>{formatIssueCandidateLabel(candidate)}</SelectItem>)}</SelectContent>
            </Select>
            <PaginationBar page={issueCandidatePageNumber} pageSize={issueCandidatePageSize} totalItems={issueCandidateTotalItems} onPageChange={onIssueCandidatePageChange} />
            {issueCandidates.length === 0 && (
              <p className={isIssueCandidateError && !isFetchingIssueCandidates ? 'text-xs font-semibold text-red-700' : 'text-xs text-amber-700'} role={isIssueCandidateError && !isFetchingIssueCandidates ? 'alert' : undefined}>
                {isFetchingIssueCandidates ? 'Đang tải nhu cầu nguyên liệu...' : isIssueCandidateError ? 'Không tải được nhu cầu nguyên liệu. Danh sách trống ở đây là do lỗi tải dữ liệu, không phải vì hết nhu cầu cần xuất.' : 'Chưa có nhu cầu nguyên liệu đủ điều kiện để xuất kho.'}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-medium text-slate-800">Kho vận hành</p>
            <p className="rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm">{warehouseName ?? 'Chưa xác định'}</p>
            {warehouseErrorMessage && <p className="text-xs font-semibold text-red-700" role="alert">{warehouseErrorMessage}</p>}
            {selectedWarehouseId && (
              <div className={`rounded-sm border px-3 py-2 text-xs ${isAllocationSourceError && !isIssueAllocationRefreshing ? 'border-red-200 bg-red-50 font-semibold text-red-800' : allocation.lines.length > 0 ? 'border-sky-200 bg-sky-50 text-slate-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`} role={isAllocationSourceError && !isIssueAllocationRefreshing ? 'alert' : 'status'}>
                {isIssueAllocationRefreshing ? 'Đang đối chiếu nhu cầu còn lại với tồn kho đã chọn...' : isAllocationSourceError ? 'Không đối chiếu được nhu cầu với tồn kho vì lỗi tải dữ liệu. Chưa thể kết luận kho này thiếu hàng; hãy tải lại trang trước khi xuất.' : allocation.lines.length > 0 ? `Kho có thể xuất ${allocation.lines.length}/${allocation.remainingLineCount} nhóm nguyên liệu còn lại; ${allocation.fullyCoveredLineCount} nhóm đủ toàn bộ số lượng.` : 'Kho này không có tồn phù hợp với nhu cầu còn lại. Chọn kho khác để tiếp tục.'}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button type="button" onClick={onConfirm} disabled={!selectedMaterialRequestId || !selectedWarehouseId || isIssueAllocationRefreshing || isAllocationSourceError || allocation.lines.length === 0 || isCreatingIssue}>
            {isCreatingIssue || isIssueAllocationRefreshing ? 'Đang đồng bộ số lượng...' : `Xác nhận xuất ${allocation.lines.length} dòng`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
