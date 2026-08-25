import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ReconciliationLine } from './reconciliationApi'
import { useSetReconciliationDispositionMutation } from './reconciliationApi'
import { describeReconciliationError } from './reconciliationErrors'

export function ReconciliationDispositionDrawer({ line, onClose, onRefetch }: { line: ReconciliationLine; onClose: () => void; onRefetch: () => void }) {
  const [category, setCategory] = useState(line.disposition?.category ?? '')
  const [reason, setReason] = useState(line.disposition?.reason ?? '')
  const [error, setError] = useState<{ message: string; canRefetch: boolean }>()
  const [save, { isLoading }] = useSetReconciliationDispositionMutation()
  const invalid = !category.trim() || !reason.trim()

  return <section role="dialog" aria-modal="true" aria-label="Xử lý chênh lệch đối chiếu" className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-white p-5 shadow-xl">
    <h2 className="text-lg font-semibold">Xử lý chênh lệch</h2>
    <p className="mt-1 text-sm text-slate-600">Ghi nhận hoặc sửa kết luận cho dòng …{line.ingredientId.slice(-8)}.</p>
    <label className="mt-4 block text-sm">Nhóm xử lý<Input className="mt-1" value={category} onChange={(event) => { setCategory(event.target.value); setError(undefined) }} aria-invalid={!category.trim()} /></label>
    <label className="mt-3 block text-sm">Lý do<Textarea className="mt-1" value={reason} onChange={(event) => { setReason(event.target.value); setError(undefined) }} aria-invalid={!reason.trim()} /></label>
    {line.disposition && <p className="mt-2 text-xs text-slate-500">Phiên bản đang xem: {line.disposition.version}</p>}
    {error && <div className="mt-3 space-y-2" role="alert"><p className="text-sm text-red-700">{error.message}</p>{error.canRefetch && <Button type="button" variant="outline" size="sm" onClick={() => { onRefetch(); setError(undefined) }}>Tải lại dữ liệu</Button>}</div>}
    <div className="mt-5 flex gap-2">
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
    </div>
  </section>
}
