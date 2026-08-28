import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ReconciliationLine } from './reconciliationApi'
import { useListReconciliationDispositionCategoriesQuery, useSetReconciliationDispositionMutation } from './reconciliationApi'
import { describeReconciliationError } from './reconciliationErrors'

export function ReconciliationDispositionDrawer({ line, onClose, onRefetch }: { line: ReconciliationLine; onClose: () => void; onRefetch: () => void }) {
  const [category, setCategory] = useState(line.disposition?.category ?? '')
  const [reason, setReason] = useState(line.disposition?.reason ?? '')
  const [error, setError] = useState<{ message: string; canRefetch: boolean }>()
  const [save, { isLoading }] = useSetReconciliationDispositionMutation()
  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useListReconciliationDispositionCategoriesQuery()
  const invalid = !category || !reason.trim() || categoriesError

  return <Dialog open onOpenChange={(open) => { if (!open && !isLoading) onClose() }} onCloseRequest={() => !isLoading}>
    <DialogContent aria-label="Xử lý chênh lệch đối chiếu" className="ml-auto mr-0 min-h-[60vh] max-w-md rounded-none">
    <DialogHeader><DialogTitle>Xử lý chênh lệch</DialogTitle>
    <DialogDescription>Ghi nhận hoặc sửa kết luận cho {line.ingredientName || 'nguyên liệu chưa đặt tên'}{line.ingredientCode ? ` · mã ${line.ingredientCode}` : ''}.</DialogDescription></DialogHeader>
    <div className="mt-4 text-sm"><span id="reconciliation-disposition-category-label">Nhóm xử lý</span>
      <Select value={category || null} onValueChange={(value) => { setCategory(value ?? ''); setError(undefined) }} disabled={categoriesLoading || categoriesError}>
        <SelectTrigger className="mt-1 w-full" aria-labelledby="reconciliation-disposition-category-label" aria-invalid={!category}><SelectValue placeholder={categoriesLoading ? 'Đang tải nhóm xử lý...' : 'Chọn nhóm xử lý'} /></SelectTrigger>
        <SelectContent>{categories.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
      {categoriesError && <p className="mt-2 text-sm text-red-700" role="alert">Không tải được nhóm xử lý. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetchCategories()}>Thử lại</Button></p>}
    </div>
    <label className="mt-3 block text-sm">Lý do<Textarea className="mt-1" value={reason} onChange={(event) => { setReason(event.target.value); setError(undefined) }} aria-invalid={!reason.trim()} /></label>
    {line.disposition && <p className="mt-2 text-xs text-slate-500">Phiên bản đang xem: {line.disposition.version}</p>}
    {error && <div className="mt-3 space-y-2" role="alert"><p className="text-sm text-red-700">{error.message}</p>{error.canRefetch && <Button type="button" variant="outline" size="sm" onClick={() => { onRefetch(); setError(undefined) }}>Tải lại dữ liệu</Button>}</div>}
    <DialogFooter className="mt-5 gap-2">
      <Button type="button" disabled={isLoading || invalid} onClick={async () => {
        setError(undefined)
        try {
          await save({ lineId: line.batchLineId, category: category.trim(), reason: reason.trim(), expectedVersion: line.disposition?.version }).unwrap()
          onClose()
        } catch (mutationError) {
          setError(describeReconciliationError(mutationError))
        }
      }}>{line.disposition ? 'Lưu điều chỉnh' : 'Ghi nhận xử lý'}</Button>
      <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
    </DialogFooter>
    </DialogContent>
  </Dialog>
}
