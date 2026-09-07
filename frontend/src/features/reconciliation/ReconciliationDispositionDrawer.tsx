import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ReconciliationLine } from '@/api/reconciliationApi'
import { useListReconciliationDispositionCategoriesQuery, useSetReconciliationDispositionMutation } from '@/api/reconciliationApi'
import { describeReconciliationError } from './reconciliationErrors'

export function ReconciliationDispositionDrawer({ line, onClose, onRefetch }: { line: ReconciliationLine; onClose: () => void; onRefetch: () => void }) {
  const [category, setCategory] = useState(line.disposition?.category ?? '')
  const [reason, setReason] = useState(line.disposition?.reason ?? '')
  const [error, setError] = useState<{ message: string; canRefetch: boolean }>()
  const [reasonTouched, setReasonTouched] = useState(false)
  const [save, { isLoading }] = useSetReconciliationDispositionMutation()
  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useListReconciliationDispositionCategoriesQuery()
  const invalid = !category || !reason.trim() || categoriesError
  const selectedCategoryLabel = categories.find((option) => option.value === category)?.label

  return <Dialog open onOpenChange={(open) => { if (!open && !isLoading) onClose() }} onCloseRequest={() => !isLoading}>
    <DialogContent aria-label="Xử lý chênh lệch đối chiếu" size="md">
    <DialogHeader><DialogTitle>Xử lý chênh lệch</DialogTitle>
    <DialogDescription>Ghi nhận kết luận xử lý cho {line.ingredientName || 'nguyên liệu chưa đặt tên'}.</DialogDescription></DialogHeader>
    <div className="mt-4 text-sm"><span id="reconciliation-disposition-category-label">Nhóm xử lý</span>
      <Select value={category || null} onValueChange={(value) => { setCategory(value ?? ''); setError(undefined) }} disabled={categoriesLoading || categoriesError}>
        <SelectTrigger className="mt-1 w-full" aria-labelledby="reconciliation-disposition-category-label"><SelectValue placeholder={categoriesLoading ? 'Đang tải nhóm xử lý...' : 'Chọn nhóm xử lý'}>{selectedCategoryLabel}</SelectValue></SelectTrigger>
        <SelectContent>{categories.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
      {categoriesError && <p className="mt-2 text-sm text-red-700" role="alert">Không tải được nhóm xử lý. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetchCategories()}>Thử lại</Button></p>}
    </div>
    <label className="mt-3 block text-sm">Lý do<Textarea className="mt-1" value={reason} onBlur={() => setReasonTouched(true)} onChange={(event) => { setReason(event.target.value); setError(undefined) }} aria-invalid={reasonTouched && !reason.trim()} aria-describedby="reconciliation-disposition-help" /></label>
    <p id="reconciliation-disposition-help" className="mt-2 text-xs text-slate-500">Chọn nhóm xử lý và nhập lý do để xác nhận kết luận.</p>
    {error && <div className="mt-3 space-y-2" role="alert"><p className="text-sm text-red-700">{error.message}</p>{error.canRefetch && <Button type="button" variant="outline" size="sm" onClick={() => { onRefetch(); setError(undefined) }}>Tải lại dữ liệu</Button>}</div>}
    <DialogFooter className="mt-5">
      <Button type="button" variant="outline" disabled={isLoading} onClick={onClose}>Hủy</Button>
      <Button type="button" disabled={isLoading || invalid} onClick={async () => {
        setError(undefined)
        try {
          await save({ lineId: line.batchLineId, category: category.trim(), reason: reason.trim(), expectedVersion: line.disposition?.version }).unwrap()
          onRefetch()
          onClose()
        } catch (mutationError) {
          setError(describeReconciliationError(mutationError))
        }
      }}>{isLoading ? 'Đang lưu...' : line.disposition ? 'Lưu thay đổi' : 'Xác nhận xử lý'}</Button>
    </DialogFooter>
    </DialogContent>
  </Dialog>
}
