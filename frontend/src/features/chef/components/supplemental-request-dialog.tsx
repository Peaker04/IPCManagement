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
import { Plus, AlertTriangle, Scale } from 'lucide-react'
import { formatQuantityWithUnit, formatUnit } from '@/lib/formatters'
import type { Ingredient, SupplementalRequest } from '@/lib/types'

interface SupplementalRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  materials: Ingredient[]
  onSubmit: (data: SupplementalRequest) => void
}

export function SupplementalRequestDialog({
  open,
  onOpenChange,
  materials,
  onSubmit,
}: SupplementalRequestDialogProps) {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [requestQty, setRequestQty] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [formError, setFormError] = useState<string>('')

  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId)

  const handleSubmit = () => {
    if (!selectedMaterial || !requestQty) {
      setFormError('Vui lòng chọn nguyên liệu và nhập số lượng yêu cầu.')
      return
    }
    setFormError('')

    onSubmit({
      ingredientId: selectedMaterialId,
      ingredientName: selectedMaterial.name,
      unit: selectedMaterial.unit,
      currentQty: selectedMaterial.quantity,
      requestedQty: parseFloat(requestQty),
      reason,
      requestedAt: new Date().toISOString(),
    })

    // Reset form
    setSelectedMaterialId('')
    setRequestQty('')
    setReason('')
    setFormError('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Gửi yêu cầu bổ sung" className="ipc-chef-dialog max-w-md rounded-xl border-slate-200 bg-white p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <DialogHeader className="flex flex-col items-center text-center sm:text-left sm:items-start pb-2 border-b border-slate-100 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3 border border-amber-100/60 shadow-inner">
            <Plus className="w-5 h-5" />
          </div>
          <DialogTitle className="text-base font-bold text-slate-900">Gửi yêu cầu bổ sung</DialogTitle>
          <DialogDescription className="text-xs text-slate-500 mt-1">
            Yêu cầu cấp thêm nguyên liệu khi bị thiếu hụt hoặc hao hụt đột xuất.
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
            <label id="supplemental-material-label" className="text-xs font-semibold tracking-wider text-slate-500">
              Chọn nguyên liệu <span className="text-amber-500 font-bold">*</span>
            </label>
            <Select value={selectedMaterialId} onValueChange={(val) => setSelectedMaterialId(val || '')}>
              <SelectTrigger aria-labelledby="supplemental-material-label" className="h-10 rounded-lg border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all">
                <SelectValue placeholder="Chọn nguyên liệu..." />
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
                <span className="text-xs font-medium text-slate-500">Số lượng hiện tại:</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                {formatQuantityWithUnit(selectedMaterial.quantity, selectedMaterial.unit)}
              </span>
            </div>
          )}

          {/* Request Quantity */}
          <div className="space-y-1.5">
            <label htmlFor="supplemental-request-qty" className="text-xs font-semibold tracking-wider text-slate-500">
              Số lượng yêu cầu <span className="text-amber-500 font-bold">*</span>
            </label>
            <div className="relative">
              <Input
                id="supplemental-request-qty"
                type="number"
                step="0.1"
                min="0"
                placeholder="Nhập số lượng bổ sung..."
                value={requestQty}
                onChange={(e) => setRequestQty(e.target.value)}
                className="h-10 rounded-lg border-slate-200 bg-white pr-16 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

          {/* Reason */}
          <div className="space-y-1.5">
            <label htmlFor="supplemental-reason" className="text-xs font-semibold tracking-wider text-slate-500">
              Lý do yêu cầu
            </label>
            <Textarea
              id="supplemental-reason"
              placeholder="Mô tả lý do (ví dụ: hao hụt trong chế biến hoặc phát sinh đột xuất)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[80px] h-20 resize-none rounded-lg border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
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
            className="rounded-lg bg-amber-600 text-white hover:bg-amber-700 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-amber-600/10"
          >
            Gửi yêu cầu bổ sung
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
