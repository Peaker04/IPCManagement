import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ReconciliationLine } from '@/api/reconciliationApi'
import { useSetReconciliationActualMutation } from '@/api/reconciliationApi'
import { describeReconciliationError } from './reconciliationErrors'

export function ReconciliationActualDrawer({ line, side, onClose, onRefetch }: { line: ReconciliationLine; side: 'purchased' | 'issued'; onClose: () => void; onRefetch: () => void }) {
  const current = side === 'purchased' ? line.purchasedQuantity : line.issuedQuantity
  const renderedVersion = side === 'purchased' ? line.purchasedVersion : line.issuedVersion
  const [value, setValue] = useState(current?.toString() ?? '')
  const [reason, setReason] = useState('')
  const [zeroConfirmed, setZeroConfirmed] = useState(false)
  const [error, setError] = useState<{ message: string; canRefetch: boolean }>()
  const [save, { isLoading }] = useSetReconciliationActualMutation()
  const quantity = Number(value)
  const zeroNeedsConfirmation = quantity === 0 && !zeroConfirmed
  const correctionNeedsReason = current != null && !reason.trim()

  return <section role="dialog" aria-modal="true" aria-label="Cập nhật số liệu đối chiếu" className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-white p-5 shadow-xl">
    <h2 className="text-lg font-semibold">{side === 'purchased' ? 'Số lượng đã mua' : 'Số lượng đã xuất'}</h2>
    <p className="mt-1 text-sm text-slate-600">Đơn vị chuẩn · …{line.canonicalUnitId.slice(-8)}</p>
    <label className="mt-4 block text-sm">Số lượng<Input className="mt-1" type="number" min="0" step="0.000001" value={value} onChange={(event) => { setValue(event.target.value); setZeroConfirmed(false); setError(undefined) }} /></label>
    {quantity === 0 && <label className="mt-3 flex items-center gap-2 text-sm"><Checkbox checked={zeroConfirmed} onCheckedChange={(checked) => setZeroConfirmed(checked === true)} />Xác nhận nhập số lượng bằng 0</label>}
    {current != null && <label className="mt-3 block text-sm">Lý do điều chỉnh<Textarea className="mt-1" value={reason} onChange={(event) => { setReason(event.target.value); setError(undefined) }} aria-invalid={correctionNeedsReason} /></label>}
    {error && <div className="mt-3 space-y-2" role="alert"><p className="text-sm text-red-700">{error.message}</p>{error.canRefetch && <Button type="button" variant="outline" size="sm" onClick={() => { onRefetch(); setError(undefined) }}>Tải lại dữ liệu</Button>}</div>}
    <div className="mt-5 flex gap-2">
      <Button type="button" disabled={isLoading || !Number.isFinite(quantity) || quantity < 0 || zeroNeedsConfirmation || correctionNeedsReason} onClick={async () => {
        setError(undefined)
        try {
          await save({ lineId: line.batchLineId, side, quantity, confirmZero: quantity === 0, expectedVersion: current == null ? undefined : renderedVersion ?? undefined, correctionReason: current == null ? undefined : reason.trim() }).unwrap()
          onClose()
        } catch (mutationError) {
          setError(describeReconciliationError(mutationError))
        }
      }}>Lưu</Button>
      <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
    </div>
  </section>
}
