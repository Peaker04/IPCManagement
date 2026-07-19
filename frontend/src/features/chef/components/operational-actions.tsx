'use client'

import { useState } from 'react'
import { RotateCcw, Check } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { ExcessMaterialDialog } from './excess-material-dialog'
import { SectionPanel } from '@/components/common'
import type { ExcessMaterial, Ingredient } from '@/lib/types'


interface OperationalActionsProps {
  materials: Ingredient[]
  onExcessMaterialReturn?: (data: ExcessMaterial) => void
}

export function OperationalActions({
  materials,
  onExcessMaterialReturn,
}: OperationalActionsProps) {
  const [excessOpen, setExcessOpen] = useState(false)

  return (
    <SectionPanel title="Luồng ngoại lệ ca" description="Ghi nhận nguyên liệu thừa, trả kho hoặc hao hụt thực tế." className="ipc-chef-actions-panel sticky top-5 h-fit">
      <div className="space-y-4">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={excessOpen}
          onClick={() => setExcessOpen(true)}
          className="group relative flex w-full items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/20 hover:shadow-md hover:shadow-blue-100/30 active:scale-[0.98] cursor-pointer"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors duration-300 group-hover:bg-blue-100 group-hover:text-blue-700">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-slate-800 transition-colors duration-300 group-hover:text-blue-900 text-[14px]">
              Ghi nhận nguyên liệu thừa
            </h4>
            <p className="text-xs text-slate-500 leading-normal">
              Hoàn trả nguyên liệu sạch, chưa chế biến sau ca làm việc.
            </p>
          </div>
        </button>

        <Separator className="bg-slate-200 my-4" />

        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all duration-300 hover:bg-slate-50">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-indigo-500" />
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Check className="w-3.5 h-3.5" />
            </div>
            <p className="text-xs font-semibold text-slate-800 tracking-wider">
              Hướng dẫn nhanh
            </p>
          </div>
          <ul className="space-y-2 text-xs text-slate-600 pl-1">
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 select-none">•</span>
              <span>Trả lại các nguyên liệu còn dư về kho cuối ca.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-indigo-400 select-none">•</span>
              <span>Cung cấp lý do cụ thể để phục vụ việc đối chiếu kho.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Excess Material Return Dialog */}
      <ExcessMaterialDialog
        open={excessOpen}
        onOpenChange={setExcessOpen}
        materials={materials}
        onSubmit={(data) => {
          onExcessMaterialReturn?.(data)
          setExcessOpen(false)
        }}
      />
    </SectionPanel>
  )
}
