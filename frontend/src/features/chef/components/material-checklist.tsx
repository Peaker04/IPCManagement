'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { DataTableShell, SectionPanel } from '@/components/common'
import type { Ingredient } from '@/lib/types'

interface MaterialChecklistProps {
  materials: Ingredient[]
  onMaterialSignoff?: (materialId: string, signed: boolean) => void
}

export function MaterialChecklist({ materials, onMaterialSignoff }: MaterialChecklistProps) {
  const handleCheckboxChange = (materialId: string, checked: boolean) => {
    onMaterialSignoff?.(materialId, checked)
  }

  const signedCount = materials.filter((m) => m.signed).length
  const receivedCount = materials.filter((m) => m.status === 'Đã nhận').length

  return (
    <SectionPanel
      title="Checklist nhận nguyên liệu"
      badge={
        <span className="text-[13px] text-slate-500 font-medium">
          Ký nhận: {signedCount}/{materials.length} | Đã nhận: {receivedCount}/{materials.length}
        </span>
      }
      className="ipc-chef-checklist-panel"
    >
        <DataTableShell ariaLabel="Checklist ký nhận nguyên liệu bếp" className="ipc-chef-checklist-shell">
          <Table className="ipc-chef-checklist-table text-xs">
            <TableHeader>
              <TableRow className="border-slate-200 hover:bg-transparent">
                <TableHead className="w-10 text-slate-600 font-semibold">
                  <span className="sr-only">Ký nhận</span>
                </TableHead>
                <TableHead className="text-slate-600 font-semibold">Nguyên Liệu</TableHead>
                <TableHead className="text-slate-600 font-semibold text-right">Đơn Vị</TableHead>
                <TableHead className="text-slate-600 font-semibold text-right">Số Lượng</TableHead>
                <TableHead className="text-slate-600 font-semibold">Trạng Thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.length === 0 ? (
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                    Chưa có nguyên liệu nào được giao
                  </TableCell>
                </TableRow>
              ) : (
                materials.map((material) => (
                  <TableRow
                    key={material.id}
                    className={cn(
                      "border-slate-200 transition-all duration-200",
                      material.signed
                        ? "bg-emerald-50/20 opacity-70 hover:bg-emerald-50/30"
                        : "hover:bg-slate-50"
                    )}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        aria-label={`Ký nhận ${material.name}`}
                        checked={material.signed}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange(material.id, checked === true)
                        }
                        className="rounded-sm border-slate-300 bg-white"
                        disabled={material.status !== 'Đã nhận'}
                      />
                    </TableCell>
                    <TableCell className={cn("text-slate-800 font-medium", material.signed && "line-through text-slate-400")}>
                      {material.name}
                    </TableCell>
                    <TableCell className="text-slate-500 text-right">{material.unit}</TableCell>
                    <TableCell className="text-slate-800 font-semibold text-right">{material.quantity}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          material.status === 'Đã nhận'
                            ? 'border-teal-200 bg-teal-50 text-teal-800'
                            : 'border-amber-200 bg-amber-50 text-amber-800'
                        }
                      >
                        <span className="flex items-center gap-1">
                          {material.status === 'Đã nhận' && <Check className="w-3 h-3" />}
                          {material.status}
                        </span>
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </DataTableShell>
    </SectionPanel>
  )
}
