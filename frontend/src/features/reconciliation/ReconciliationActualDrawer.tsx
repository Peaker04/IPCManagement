import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ReconciliationLine } from './reconciliationApi'
import { useSetReconciliationActualMutation } from './reconciliationApi'
import { describeReconciliationError } from './reconciliationErrors'

export function ReconciliationActualDrawer({
  line,
  side,
  onClose,
  onRefetch,
}: {
  line: ReconciliationLine
  side: 'purchased' | 'issued'
  onClose: () => void
  onRefetch: () => void
}) {
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
  const titleText = side === 'purchased' ? 'Số lượng đã mua' : 'Số lượng đã xuất'
  const sideLabel = side === 'purchased' ? 'đã mua' : 'đã xuất'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer */}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reconciliation-actual-drawer-title"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-slate-200 bg-white p-5 shadow-xl flex flex-col justify-between overflow-y-auto"
      >
        <div className="space-y-4">
          <div>
            <h2 id="reconciliation-actual-drawer-title" className="text-lg font-semibold text-slate-900">
              {titleText}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Nguyên liệu: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">…{line.ingredientId.slice(-8)}</code>
            </p>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Số lượng {sideLabel}
            <Input
              className="mt-1"
              type="number"
              min="0"
              step="0.000001"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setZeroConfirmed(false)
                setError(undefined)
              }}
              autoFocus
            />
          </label>

          {quantity === 0 && (
            <label className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
              <Checkbox
                checked={zeroConfirmed}
                onCheckedChange={(checked) => setZeroConfirmed(checked === true)}
              />
              <span>Xác nhận nhập số lượng bằng 0</span>
            </label>
          )}

          {current != null && (
            <label className="block text-sm font-medium text-slate-700">
              Lý do điều chỉnh <span className="text-red-500">*</span>
              <Textarea
                className="mt-1"
                placeholder="Nhập lý do điều chỉnh số liệu thực tế..."
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                  setError(undefined)
                }}
                aria-invalid={correctionNeedsReason}
              />
            </label>
          )}

          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 space-y-2" role="alert">
              <p className="text-sm text-red-700">{error.message}</p>
              {error.canRefetch && (
                <Button type="button" variant="outline" size="sm" onClick={() => { onRefetch(); setError(undefined) }}>
                  Tải lại dữ liệu
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button
            type="button"
            disabled={isLoading || !Number.isFinite(quantity) || quantity < 0 || zeroNeedsConfirmation || correctionNeedsReason}
            onClick={async () => {
              setError(undefined)
              try {
                await save({
                  lineId: line.batchLineId,
                  side,
                  quantity,
                  confirmZero: quantity === 0,
                  expectedVersion: current == null ? undefined : renderedVersion ?? undefined,
                  correctionReason: current == null ? undefined : reason.trim(),
                }).unwrap()
                onClose()
              } catch (mutationError) {
                setError(describeReconciliationError(mutationError))
              }
            }}
          >
            {isLoading ? 'Đang lưu...' : 'Lưu số lượng'}
          </Button>
        </div>
      </section>
    </>
  )
}
