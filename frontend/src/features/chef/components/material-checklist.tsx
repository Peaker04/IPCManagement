'use client'

import { useState } from 'react'
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
import { SectionPanel, TableViewport } from '@/components/common'
import { formatQuantity, formatUnit } from '@/lib/formatters'
import type { ChefMaterial } from '../chefDashboardTypes'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface MaterialChecklistProps {
  materials: ChefMaterial[]
  onMaterialSignoff?: (materialId: string, signed: boolean) => void
}

export function MaterialChecklist({ materials, onMaterialSignoff }: MaterialChecklistProps) {
  const [pendingMaterialId, setPendingMaterialId] = useState<string | null>(null)
  const pendingMaterial = materials.find((material) => material.id === pendingMaterialId)

  const signedCount = materials.filter((m) => m.signed).length
  const receivedCount = materials.filter((m) => m.status === 'Đã nhận').length

  return (
    <SectionPanel
      title="Checklist nhận nguyên liệu"
      badge={
        <span className="text-sm text-slate-500 font-medium">
          Ký nhận: {signedCount}/{materials.length} | Đã nhận: {receivedCount}/{materials.length}
        </span>
      }
      className="ipc-chef-checklist-panel"
    >
        <TableViewport ariaLabel="Checklist ký nhận nguyên liệu bếp" caption="Danh sách nguyên liệu cần ký nhận" className="ipc-chef-checklist-shell">
          <Table className="ipc-chef-checklist-table text-xs">
            <TableHeader>
              <TableRow className="border-slate-200 hover:bg-transparent">
                <TableHead className="w-10 text-slate-600 font-semibold">
                  <span className="sr-only">Ký nhận</span>
                </TableHead>
                <TableHead className="text-slate-600 font-semibold">Nguyên liệu</TableHead>
                <TableHead className="text-slate-600 font-semibold">Phiếu xuất</TableHead>
                <TableHead className="text-slate-600 font-semibold text-right">Đơn vị</TableHead>
                <TableHead className="text-slate-600 font-semibold text-right">Số lượng</TableHead>
                <TableHead className="text-slate-600 font-semibold">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.length === 0 ? (
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                    Chưa có nguyên liệu nào được giao
                  </TableCell>
                </TableRow>
              ) : (
                materials.map((material) => (
                  <TableRow
                    key={material.id}
                    className={cn(
                      "border-slate-200 transition-[background-color,color,opacity] duration-200 motion-reduce:transition-none",
                      material.signed
                        ? "bg-emerald-50/20 opacity-70 hover:bg-emerald-50/30"
                        : "hover:bg-slate-50"
                    )}
                  >
                    <TableCell className="text-center">
                      <Checkbox
                        aria-label={`Ký nhận ${material.name}`}
                        checked={material.signed}
                        onCheckedChange={(checked) => { if (checked === true && !material.signed) setPendingMaterialId(material.id) }}
                        className="rounded-sm border-slate-300 bg-white"
                        disabled={material.signed}
                      />
                    </TableCell>
                    <TableCell className={cn("text-slate-800 font-medium", material.signed && "line-through text-slate-400")}>
                      {material.name}
                    </TableCell>
                    <TableCell className="text-slate-500">{material.issueCode ?? 'Theo kế hoạch'}</TableCell>
                    <TableCell className="text-slate-500 text-right">{formatUnit(material.unit)}</TableCell>
                    <TableCell className="text-slate-800 font-semibold text-right">{formatQuantity(material.quantity)}</TableCell>
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
                          {material.status === 'Chờ giao' ? 'Chờ ký nhận' : material.status}
                        </span>
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableViewport>
        <Dialog open={Boolean(pendingMaterial)} onOpenChange={(open) => { if (!open) setPendingMaterialId(null) }}>
          <DialogContent aria-label="Xác nhận đã nhận nguyên liệu" className="max-w-md">
            <DialogHeader>
              <DialogTitle>Xác nhận đã nhận nguyên liệu?</DialogTitle>
              <DialogDescription>
                Chỉ xác nhận sau khi đã kiểm đếm thực tế {pendingMaterial?.name} từ phiếu {pendingMaterial?.issueCode ?? 'xuất kho'}.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {pendingMaterial ? `${formatQuantity(pendingMaterial.quantity)} ${formatUnit(pendingMaterial.unit)}` : ''}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPendingMaterialId(null)}>Chưa nhận</Button>
              <Button type="button" onClick={() => {
                if (pendingMaterial) onMaterialSignoff?.(pendingMaterial.id, true)
                setPendingMaterialId(null)
              }}>Đã kiểm đếm và nhận</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </SectionPanel>
  )
}
