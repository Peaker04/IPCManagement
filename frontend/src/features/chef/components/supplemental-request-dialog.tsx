import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatQuantityWithUnit } from '@/lib/formatters'
import type { Ingredient, SupplementalRequest } from '@/lib/types'

interface SupplementalRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  materials: Ingredient[]
  isSubmitting: boolean
  onSubmit: (data: SupplementalRequest) => Promise<boolean>
}

export function SupplementalRequestDialog({
  open,
  onOpenChange,
  materials,
  isSubmitting,
  onSubmit,
}: SupplementalRequestDialogProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [requestQty, setRequestQty] = useState('')
  const [reason, setReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ material?: string; quantity?: string }>({})
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId)

  const resetForm = () => {
    setSelectedMaterialId('')
    setRequestQty('')
    setReason('')
    setFieldErrors({})
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const handleSubmit = async () => {
    const quantity = Number(requestQty)
    const nextErrors = {
      ...(!selectedMaterial ? { material: 'Chọn nguyên liệu cần bổ sung.' } : {}),
      ...(!Number.isFinite(quantity) || quantity <= 0 ? { quantity: 'Nhập số lượng bổ sung lớn hơn 0.' } : {}),
    }
    setFieldErrors(nextErrors)
    if (!selectedMaterial || !Number.isFinite(quantity) || quantity <= 0) {
      return
    }

    setFieldErrors({})
    const persisted = await onSubmit({
      ingredientId: selectedMaterial.id,
      ingredientName: selectedMaterial.name,
      unit: selectedMaterial.unit,
      requestedQty: quantity,
      reason: reason.trim() || undefined,
    })
    if (persisted) {
      resetForm()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-labelledby="supplemental-request-title" aria-describedby="supplemental-request-description" className="max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
            <Plus size={20} />
          </div>
          <DialogTitle id="supplemental-request-title">Gửi yêu cầu bổ sung</DialogTitle>
          <DialogDescription id="supplemental-request-description">
            Yêu cầu được lưu và chuyển tới kho ở trạng thái chờ xử lý; thao tác này chưa xuất thêm tồn kho.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label id="supplemental-material-label" className="text-sm font-medium text-slate-800">
              Nguyên liệu cần bổ sung <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <Select value={selectedMaterialId} onValueChange={(value) => {
              setSelectedMaterialId(value ?? '')
              setFieldErrors((current) => ({ ...current, material: undefined }))
            }} disabled={isSubmitting}>
              <SelectTrigger aria-labelledby="supplemental-material-label" aria-invalid={Boolean(fieldErrors.material) || undefined} aria-describedby={fieldErrors.material ? 'supplemental-material-error' : undefined}>
                <SelectValue placeholder="Chọn từ phiếu xuất đã nhận">
                  {selectedMaterial
                    ? `${selectedMaterial.name} · đã nhận ${formatQuantityWithUnit(selectedMaterial.quantity, selectedMaterial.unit)}`
                    : 'Chọn từ phiếu xuất đã nhận'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.name} · đã nhận {formatQuantityWithUnit(material.quantity, material.unit)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.material && <p id="supplemental-material-error" className="text-xs text-red-700">{fieldErrors.material}</p>}
          </div>
          <div className="grid gap-2">
            <label htmlFor="supplemental-request-qty" className="text-sm font-medium text-slate-800">
              Số lượng cần thêm <span aria-hidden="true" className="text-red-600">*</span>
            </label>
            <Input id="supplemental-request-qty" type="number" min="0.000001" step="0.1" value={requestQty} onChange={(event) => {
              setRequestQty(event.target.value)
              setFieldErrors((current) => ({ ...current, quantity: undefined }))
            }} aria-invalid={Boolean(fieldErrors.quantity) || undefined} aria-describedby={fieldErrors.quantity ? 'supplemental-request-qty-error' : undefined} disabled={isSubmitting} />
            {fieldErrors.quantity && <p id="supplemental-request-qty-error" className="text-xs text-red-700">{fieldErrors.quantity}</p>}
          </div>
          <div className="grid gap-2">
            <label htmlFor="supplemental-reason" className="text-sm font-medium text-slate-800">Lý do</label>
            <Textarea id="supplemental-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: hao hụt trong sơ chế hoặc phát sinh thêm suất" disabled={isSubmitting} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>Hủy</Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || materials.length === 0}>
            {isSubmitting ? 'Đang gửi...' : 'Gửi tới kho'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
