import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ReconciliationLine } from './reconciliationApi'
import { useSetReconciliationActualMutation } from './reconciliationApi'

export function ReconciliationActualDrawer({ line, side, onClose }: { line: ReconciliationLine; side: 'purchased' | 'issued'; onClose: () => void }) {
  const current = side === 'purchased' ? line.purchasedQuantity : line.issuedQuantity
  const renderedVersion = side === 'purchased' ? line.purchasedVersion : line.issuedVersion
  const [value, setValue] = useState(current?.toString() ?? '')
  const [reason, setReason] = useState('')
  const [zeroConfirmed, setZeroConfirmed] = useState(false)
  const [save, { isLoading }] = useSetReconciliationActualMutation()
  const quantity = Number(value)
  const zeroNeedsConfirmation = quantity === 0 && !zeroConfirmed

  return <section role="dialog" aria-modal="true" aria-label="Cập nhật số liệu đối chiếu" className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-white p-5 shadow-xl">
    <h2 className="text-lg font-semibold">{side === 'purchased' ? 'Số lượng đã mua' : 'Số lượng đã xuất'}</h2>
    <p className="mt-1 text-sm text-slate-600">Đơn vị chuẩn · …{line.canonicalUnitId.slice(-8)}</p>
    <label className="mt-4 block text-sm">Số lượng<Input className="mt-1" type="number" min="0" step="0.000001" value={value} onChange={(event) => { setValue(event.target.value); setZeroConfirmed(false) }} /></label>
    {quantity === 0 && <label className="mt-3 flex items-center gap-2 text-sm"><Checkbox checked={zeroConfirmed} onCheckedChange={setZeroConfirmed} />Xác nhận nhập số lượng bằng 0</label>}
    {current != null && <label className="mt-3 block text-sm">Lý do điều chỉnh<Textarea className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} /></label>}
    <div className="mt-5 flex gap-2">
      <Button type="button" disabled={isLoading || !Number.isFinite(quantity) || quantity < 0 || zeroNeedsConfirmation} onClick={async () => {
        await save({ lineId: line.batchLineId, side, quantity, confirmZero: quantity === 0, expectedVersion: current == null ? undefined : renderedVersion ?? undefined, correctionReason: current == null ? undefined : reason }).unwrap()
        onClose()
      }}>Lưu</Button>
      <Button type="button" variant="outline" onClick={onClose}>Đóng</Button>
    </div>
  </section>
}
