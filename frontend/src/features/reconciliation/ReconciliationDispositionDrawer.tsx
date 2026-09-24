import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ReconciliationLine } from '@/api/reconciliationApi'
import { useListReconciliationDispositionCategoriesQuery, useSetReconciliationDispositionMutation } from '@/api/reconciliationApi'
import { describeReconciliationError } from './reconciliationErrors'

export function ReconciliationDispositionDrawer({ line, lines, onClose, onRefetch }: { line?: ReconciliationLine; lines?: ReconciliationLine[]; onClose: () => void; onRefetch: () => void }) {
  const targetLines = lines?.length ? lines : line ? [line] : []
  const firstLine = targetLines[0]
  const isBulk = targetLines.length > 1
  const [category, setCategory] = useState(firstLine?.disposition?.category ?? '')
  const [reason, setReason] = useState(firstLine?.disposition?.reason ?? '')
  const [error, setError] = useState<{ message: string; canRefetch: boolean }>()
  const [reasonTouched, setReasonTouched] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ category?: string; reason?: string }>({})
  const [save, { isLoading }] = useSetReconciliationDispositionMutation()
  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useListReconciliationDispositionCategoriesQuery()
  const selectedCategoryLabel = categories.find((option) => option.value === category)?.label
  const validate = () => {
    const next = {
      ...(!category ? { category: 'Chọn nhóm xử lý.' } : {}),
      ...(!reason.trim() ? { reason: 'Nhập lý do xử lý.' } : {}),
    }
    setFieldErrors(next)
    setReasonTouched(true)
    if (Object.keys(next).length) requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-disposition-error="true"]')?.focus())
    return Object.keys(next).length === 0
  }
  if (!firstLine) return null

  return <Dialog open onOpenChange={(open) => { if (!open && !isLoading) onClose() }} onCloseRequest={() => !isLoading}>
    <DialogContent aria-label="Xử lý chênh lệch đối chiếu" size="md">
    <DialogHeader><DialogTitle>{isBulk ? `Xử lý hàng loạt (${targetLines.length})` : 'Xử lý chênh lệch'}</DialogTitle>
    <DialogDescription>{isBulk ? `Áp dụng cùng một kết luận cho ${targetLines.length} nguyên liệu đang cần kiểm tra.` : `Ghi nhận kết luận xử lý cho ${firstLine.ingredientName || 'nguyên liệu chưa đặt tên'}.`}</DialogDescription></DialogHeader>
    <div className="mt-4 text-sm"><span id="reconciliation-disposition-category-label">Nhóm xử lý</span>
      <Select value={category || null} onValueChange={(value) => { setCategory(value ?? ''); setFieldErrors((current) => ({ ...current, category: undefined })); setError(undefined) }} disabled={categoriesLoading || categoriesError}>
        <SelectTrigger className="mt-1 w-full" aria-labelledby="reconciliation-disposition-category-label" aria-invalid={Boolean(fieldErrors.category) || undefined} aria-describedby={fieldErrors.category ? 'reconciliation-disposition-category-error' : undefined}><SelectValue placeholder={categoriesLoading ? 'Đang tải nhóm xử lý...' : 'Chọn nhóm xử lý'}>{selectedCategoryLabel}</SelectValue></SelectTrigger>
        <SelectContent>{categories.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
      {fieldErrors.category && <p id="reconciliation-disposition-category-error" tabIndex={-1} data-disposition-error="true" className="mt-1 text-xs text-red-700">{fieldErrors.category}</p>}
      {categoriesError && <p className="mt-2 text-sm text-red-700" role="alert">Không tải được nhóm xử lý. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetchCategories()}>Thử lại</Button></p>}
    </div>
    <label className="mt-3 block text-sm">Lý do<Textarea className="mt-1" value={reason} onBlur={() => setReasonTouched(true)} onChange={(event) => { setReason(event.target.value); setFieldErrors((current) => ({ ...current, reason: undefined })); setError(undefined) }} aria-invalid={Boolean(fieldErrors.reason) || reasonTouched && !reason.trim()} aria-describedby={fieldErrors.reason ? 'reconciliation-disposition-reason-error reconciliation-disposition-help' : 'reconciliation-disposition-help'} /></label>
    {fieldErrors.reason && <p id="reconciliation-disposition-reason-error" tabIndex={-1} data-disposition-error="true" className="mt-1 text-xs text-red-700">{fieldErrors.reason}</p>}
    <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Gợi ý lý do xử lý">
      {[
        'Chấp nhận hao hụt thực tế',
        'Điều chỉnh định lượng BOM kỳ tới',
        'Đã xuất bù thực tế trong ca',
        'Sai số đo lường lúc xuất kho',
      ].map((preset) => (
        <Button
          key={preset}
          type="button"
          variant="outline"
          size="xs"
          onClick={() => { setReason(preset); setFieldErrors((current) => ({ ...current, reason: undefined })); setError(undefined); setReasonTouched(true) }}
        >
          {preset}
        </Button>
      ))}
    </div>
    <p id="reconciliation-disposition-help" className="mt-2 text-xs text-slate-500">Chọn nhóm xử lý và nhập lý do để xác nhận kết luận.</p>
    {error && <div className="mt-3 space-y-2" role="alert"><p className="text-sm text-red-700">{error.message}</p>{error.canRefetch && <Button type="button" variant="outline" size="sm" onClick={() => { onRefetch(); setError(undefined) }}>Tải lại dữ liệu</Button>}</div>}
    <DialogFooter>
      <Button type="button" variant="outline" disabled={isLoading} onClick={onClose}>Hủy</Button>
      <Button type="button" disabled={isLoading || categoriesLoading || categoriesError} onClick={async () => {
        if (!validate()) return
        setError(undefined)
        try {
          for (const targetLine of targetLines) {
            await save({ lineId: targetLine.batchLineId, category: category.trim(), reason: reason.trim(), expectedVersion: targetLine.disposition?.version }).unwrap()
          }
          onRefetch()
          onClose()
        } catch (mutationError) {
          setError(describeReconciliationError(mutationError))
        }
      }}>{isLoading ? 'Đang lưu...' : isBulk ? `Xác nhận ${targetLines.length} nguyên liệu` : firstLine.disposition ? 'Lưu thay đổi' : 'Xác nhận xử lý'}</Button>
    </DialogFooter>
    </DialogContent>
  </Dialog>
}
