'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { RotateCcw, Scale, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react'
import { formatNumber, formatQuantityWithUnit, formatUnit } from '@/lib/formatters'
import { formatShiftName } from '@/lib/workflowConfig'
import type { ExcessMaterial, Ingredient } from '@/lib/types'

type ExcessMaterialOption = Ingredient & {
  sourceCustomerName?: string
  sourceShiftName?: string
  sourcePriceTierAmount?: number
}

const materialLabel = (material: ExcessMaterialOption) => [
  `${material.name} (${formatUnit(material.unit)})`,
  material.sourceCustomerName,
  material.sourceShiftName ? formatShiftName(material.sourceShiftName) : undefined,
  typeof material.sourcePriceTierAmount === 'number' ? `${formatNumber(material.sourcePriceTierAmount)}đ` : undefined,
].filter(Boolean).join(' · ')

interface ExcessMaterialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  materials: ExcessMaterialOption[]
  onSubmit: (data: ExcessMaterial) => void
}

export function ExcessMaterialDialog({
  open,
  onOpenChange,
  materials,
  onSubmit,
}: ExcessMaterialDialogProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [returnedQty, setReturnedQty] = useState<string>('')
  const [condition, setCondition] = useState<NonNullable<ExcessMaterial['condition']>[]>(['intact'])
  const [notes, setNotes] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<{ material?: string; quantity?: string }>({})

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId)
  const isMaterialCondition = (value: string): value is NonNullable<ExcessMaterial['condition']> =>
    value === 'intact' || value === 'partially_used' || value === 'damaged'

  const handleSubmit = () => {
    const nextErrors = {
      ...(!selectedMaterial ? { material: 'Vui lòng chọn nguyên liệu.' } : {}),
      ...(!returnedQty ? { quantity: 'Vui lòng nhập số lượng trả lại.' } : {}),
    }
    setFieldErrors(nextErrors)
    if (!selectedMaterial || !returnedQty) {
      return
    }

    onSubmit({
      ingredientId: selectedMaterialId,
      ingredientName: selectedMaterial.name,
      unit: selectedMaterial.unit,
      returnedQty: parseFloat(returnedQty),
      condition: condition[0] || 'intact',
      notes,
      returnedAt: new Date().toISOString(),
    })

    // Reset form
    setSelectedMaterialId('')
    setReturnedQty('')
    setCondition(['intact'])
    setNotes('')
    setFieldErrors({})
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Ghi nhận nguyên liệu thừa" className="ipc-chef-dialog max-w-md gap-0 rounded-xl border-slate-200 bg-white p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <DialogHeader className="flex flex-col items-center text-center sm:text-left sm:items-start pb-2 border-b border-slate-100 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3 border border-blue-100/60 shadow-inner">
            <RotateCcw className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold text-slate-900">Ghi nhận nguyên liệu thừa</DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            Ghi lại nguyên liệu chưa sử dụng để trả lại kho cuối ca.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Material Selection */}
          <div className="space-y-1.5">
            <label id="excess-material-label" className="text-sm font-medium text-slate-700">
              Chọn nguyên liệu <span className="text-red-600 font-semibold" aria-hidden="true">*</span>
            </label>
            <Select value={selectedMaterialId} onValueChange={(val) => {
              setSelectedMaterialId(val || '')
              setFieldErrors((current) => ({ ...current, material: undefined }))
            }}>
              <SelectTrigger aria-labelledby="excess-material-label" aria-invalid={Boolean(fieldErrors.material) || undefined} aria-describedby={fieldErrors.material ? 'excess-material-error' : undefined} className="w-full">
                <SelectValue className={selectedMaterial ? 'text-slate-900' : 'text-slate-400'}>
                  {selectedMaterial ? materialLabel(selectedMaterial) : 'Nhấp để chọn nguyên liệu...'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    <span>{materialLabel(material)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.material && <p id="excess-material-error" role="alert" className="text-xs font-medium text-red-700">{fieldErrors.material}</p>}
          </div>

          {/* Current Quantity Display */}
          {selectedMaterial && (
            <div className="flex items-center justify-between rounded-sm border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded bg-white border border-slate-200 text-slate-500">
                  <Scale className="size-3.5" />
                </div>
                <span className="text-xs font-medium text-slate-600">Tổng nhận được:</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-800 tabular-nums">
                {formatQuantityWithUnit(selectedMaterial.quantity, selectedMaterial.unit)}
              </span>
            </div>
          )}

          {/* Return Quantity */}
          <div className="space-y-1.5">
            <label htmlFor="excess-returned-qty" className="text-sm font-medium text-slate-700">
              Số lượng trả lại <span className="text-red-600 font-semibold" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <Input
                id="excess-returned-qty"
                type="number"
                step="0.1"
                min="0"
                placeholder="Nhập số lượng hoàn trả..."
                value={returnedQty}
                onChange={(e) => {
                  setReturnedQty(e.target.value)
                  setFieldErrors((current) => ({ ...current, quantity: undefined }))
                }}
                aria-invalid={Boolean(fieldErrors.quantity) || undefined}
                aria-describedby={fieldErrors.quantity ? 'excess-returned-qty-error' : undefined}
                className="pr-16 tabular-nums"
              />
              {selectedMaterial && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-caption text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {formatUnit(selectedMaterial.unit)}
                  </span>
                </div>
              )}
            </div>
            {fieldErrors.quantity && <p id="excess-returned-qty-error" role="alert" className="text-xs font-medium text-red-700">{fieldErrors.quantity}</p>}
          </div>

          {/* Condition */}
          <div className="space-y-1.5">
            <label id="excess-condition-label" className="text-sm font-medium text-slate-700">
              Tình trạng nguyên liệu
            </label>
            <ToggleGroup
              aria-labelledby="excess-condition-label"
              value={condition}
              onValueChange={(value) => {
                if (value && value.length > 0) {
                  const nextValue = value[value.length - 1]
                  if (isMaterialCondition(nextValue)) {
                    setCondition([nextValue])
                  }
                }
              }}
              className="ipc-excess-condition-group grid grid-cols-1 gap-2 w-full sm:grid-cols-3"
            >
              <ToggleGroupItem
                value="intact"
                className="flex items-center justify-center gap-1.5 h-8 rounded-sm border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer data-[state=on]:border-emerald-300 data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-800"
              >
                <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                <span>Nguyên vẹn</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="partially_used"
                className="flex items-center justify-center gap-1.5 h-8 rounded-sm border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer data-[state=on]:border-amber-300 data-[state=on]:bg-amber-50 data-[state=on]:text-amber-800"
              >
                <HelpCircle className="size-3.5 text-amber-600 shrink-0" />
                <span>Đã sử dụng</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="damaged"
                className="flex items-center justify-center gap-1.5 h-8 rounded-sm border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer data-[state=on]:border-red-300 data-[state=on]:bg-red-50 data-[state=on]:text-red-800"
              >
                <AlertCircle className="size-3.5 text-red-600 shrink-0" />
                <span>Hư hỏng</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="excess-notes" className="text-sm font-medium text-slate-700">
              Ghi chú bổ sung
            </label>
            <Textarea
              id="excess-notes"
              placeholder="Mô tả chi tiết về tình trạng hoặc nguyên nhân hoàn trả..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-16 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0 pt-3 border-t border-slate-100 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={handleSubmit}
          >
            Ghi nhận nguyên liệu thừa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
