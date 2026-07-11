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
import { RotateCcw, AlertTriangle, Scale, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react'
import { formatQuantityWithUnit, formatUnit } from '@/lib/formatters'
import type { ExcessMaterial, Ingredient } from '@/lib/types'

interface ExcessMaterialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  materials: Ingredient[]
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
  const [formError, setFormError] = useState<string>('')

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId)
  const isMaterialCondition = (value: string): value is NonNullable<ExcessMaterial['condition']> =>
    value === 'intact' || value === 'partially_used' || value === 'damaged'

  const handleSubmit = () => {
    if (!selectedMaterial || !returnedQty) {
      setFormError('Vui lòng chọn nguyên liệu và nhập số lượng trả lại.')
      return
    }
    setFormError('')

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
    setFormError('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Ghi nhận nguyên liệu thừa" className="ipc-chef-dialog max-w-md rounded-xl border-slate-200 bg-white p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200">
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
          {formError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs font-medium text-red-800 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Material Selection */}
          <div className="space-y-1.5">
            <label id="excess-material-label" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Chọn Nguyên Liệu <span className="text-blue-500 font-bold">*</span>
            </label>
            <Select value={selectedMaterialId} onValueChange={(val) => setSelectedMaterialId(val || '')}>
              <SelectTrigger aria-labelledby="excess-material-label" className="h-10 rounded-lg border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                <SelectValue placeholder="Nhấp để chọn nguyên liệu..." />
              </SelectTrigger>
              <SelectContent className="rounded-lg border border-slate-200 bg-white shadow-lg max-h-60">
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id} className="cursor-pointer hover:bg-slate-50 focus:bg-slate-50 py-2.5">
                    <span className="text-slate-800 font-medium">
                      {material.name}
                    </span>
                    <span className="text-xs text-slate-400 ml-1.5">({formatUnit(material.unit)})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Current Quantity Display */}
          {selectedMaterial && (
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 transition-all duration-300">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200/60 text-slate-500">
                  <Scale className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-slate-500">Tổng nhận được:</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                {formatQuantityWithUnit(selectedMaterial.quantity, selectedMaterial.unit)}
              </span>
            </div>
          )}

          {/* Return Quantity */}
          <div className="space-y-1.5">
            <label htmlFor="excess-returned-qty" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Số Lượng Trả Lại <span className="text-blue-500 font-bold">*</span>
            </label>
            <div className="relative">
              <Input
                id="excess-returned-qty"
                type="number"
                step="0.1"
                min="0"
                placeholder="Nhập số lượng hoàn trả..."
                value={returnedQty}
                onChange={(e) => setReturnedQty(e.target.value)}
                className="h-10 rounded-lg border-slate-200 bg-white pr-16 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {selectedMaterial && (
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                    {formatUnit(selectedMaterial.unit)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Condition */}
          <div className="space-y-1.5">
            <label id="excess-condition-label" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tình Trạng Nguyên Liệu
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
              className="grid grid-cols-3 gap-2 w-full"
            >
              <ToggleGroupItem
                value="intact"
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 cursor-pointer data-[state=on]:border-emerald-200 data-[state=on]:bg-emerald-50 data-[state=on]:text-emerald-800 data-[state=on]:shadow-sm data-[state=on]:shadow-emerald-100/30"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Nguyên Vẹn</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="partially_used"
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 cursor-pointer data-[state=on]:border-amber-200 data-[state=on]:bg-amber-50 data-[state=on]:text-amber-800 data-[state=on]:shadow-sm data-[state=on]:shadow-amber-100/30"
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Đã Sử Dụng</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="damaged"
                className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-slate-50 cursor-pointer data-[state=on]:border-red-200 data-[state=on]:bg-red-50 data-[state=on]:text-red-800 data-[state=on]:shadow-sm data-[state=on]:shadow-red-100/30"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>Hư Hỏng</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="excess-notes" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ghi Chú Bổ Sung
            </label>
            <Textarea
              id="excess-notes"
              placeholder="Mô tả chi tiết về tình trạng hoặc nguyên nhân hoàn trả..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px] h-20 resize-none rounded-lg border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0 pt-3 border-t border-slate-100 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-all font-medium"
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-blue-600/10"
          >
            Ghi nhận nguyên liệu thừa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
