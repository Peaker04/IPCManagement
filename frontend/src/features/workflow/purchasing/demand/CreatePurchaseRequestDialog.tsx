import { PaginationBar } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { usePurchaseDemand } from './usePurchaseDemand';

type PurchaseDemandWorkflow = ReturnType<typeof usePurchaseDemand>;

export function CreatePurchaseRequestDialog({ dialog }: { dialog: PurchaseDemandWorkflow['dialog'] }) {
  return (
    <Dialog open={dialog.open} onOpenChange={dialog.setOpen}>
      <DialogContent aria-labelledby="create-purchase-request-title" aria-describedby="create-purchase-request-description">
        <DialogHeader>
          <DialogTitle id="create-purchase-request-title">Tạo đề xuất mua từ nhu cầu thiếu</DialogTitle>
          <DialogDescription id="create-purchase-request-description">
            Chọn đúng chứng từ nhu cầu. Hệ thống chỉ tạo các dòng còn thiếu sau khi đối chiếu tồn kho.
          </DialogDescription>
        </DialogHeader>
        {dialog.candidates.length > 0 ? (
          <div className="grid gap-2">
            <label id="purchase-demand-request-label" className="text-sm font-medium text-slate-700">
              Chứng từ nhu cầu nguyên liệu
            </label>
            <Select value={dialog.selectedMaterialRequestId} onValueChange={(value) => dialog.setSelectedMaterialRequestId(value ?? '')}>
              <SelectTrigger aria-labelledby="purchase-demand-request-label" className="w-full">
                <SelectValue placeholder="Chọn chứng từ nhu cầu">
                  {dialog.selectedCandidate ? dialog.formatCandidate(dialog.selectedCandidate) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {dialog.candidates.map((candidate) => (
                  <SelectItem key={candidate.materialRequestId} value={candidate.materialRequestId}>
                    {dialog.formatCandidate(candidate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <PaginationBar
              page={dialog.page}
              pageSize={dialog.candidateResponse?.pageSize ?? 8}
              totalItems={dialog.candidateResponse?.totalCount ?? 0}
              onPageChange={dialog.setPage}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-600">
            {dialog.isFetching ? 'Đang tải chứng từ nhu cầu...' : 'Không có chứng từ nhu cầu hợp lệ để tạo đề xuất mua.'}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => dialog.setOpen(false)} disabled={dialog.isCreating}>Hủy</Button>
          <Button
            type="button"
            onClick={() => void dialog.create()}
            disabled={!dialog.selectedMaterialRequestId || dialog.isCreating}
          >
            {dialog.isCreating ? 'Đang tạo...' : 'Tạo đề xuất'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
