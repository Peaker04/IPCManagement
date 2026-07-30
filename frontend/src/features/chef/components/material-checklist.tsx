'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
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

type MaterialGroup = {
  key: string
  name: string
  unit: string
  quantity: number
  lines: ChefMaterial[]
}

const groupMaterialsByStableIdentity = (materials: ChefMaterial[]): MaterialGroup[] => {
  const groups = new Map<string, MaterialGroup>()
  materials.forEach((material) => {
    const hasStableIdentity = Boolean(material.ingredientId && material.unitId)
    const key = hasStableIdentity
      ? `${material.ingredientId}__${material.unitId}`
      : `source__${material.id}`
    const group = groups.get(key) ?? { key, name: material.name, unit: material.unit, quantity: 0, lines: [] }
    group.quantity += material.quantity
    group.lines.push(material)
    groups.set(key, group)
  })
  return Array.from(groups.values())
}

export function MaterialChecklist({ materials, onMaterialSignoff }: MaterialChecklistProps) {
  const [pendingMaterialId, setPendingMaterialId] = useState<string | null>(null)
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null)
  const pendingMaterial = materials.find((material) => material.id === pendingMaterialId)
  const materialGroups = useMemo(() => groupMaterialsByStableIdentity(materials), [materials])

  const signedCount = materials.filter((m) => m.signed).length
  const receivedCount = materials.filter((m) => m.status === 'Đã nhận').length

  return (
    <SectionPanel
      title="Checklist nhận nguyên liệu"
      description="Hiển thị một dòng tổng theo nguyên liệu và đơn vị trong ngày/ca; mở dòng tổng để kiểm đếm và ký đúng từng phiếu xuất nguồn."
      badge={
        <span className="text-sm text-slate-500 font-medium">
          Dòng nguồn đã ký: {signedCount}/{materials.length} | Đã nhận: {receivedCount}/{materials.length}
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
                materialGroups.flatMap((group) => {
                  const expanded = expandedGroupKey === group.key
                  const signedLines = group.lines.filter((line) => line.signed).length
                  if (group.lines.length === 1) {
                    const material = group.lines[0]
                    return [(
                      <TableRow key={material.id} className={cn("border-slate-200 transition-[background-color,color,opacity] duration-200 motion-reduce:transition-none", material.signed ? "bg-emerald-50/20 opacity-70 hover:bg-emerald-50/30" : "hover:bg-slate-50")}>
                        <TableCell className="text-center"><Checkbox aria-label={`Ký nhận ${material.name}`} checked={material.signed} onCheckedChange={(checked) => { if (checked === true && !material.signed) setPendingMaterialId(material.id) }} className="rounded-sm border-slate-300 bg-white" disabled={material.signed} /></TableCell>
                        <TableCell className={cn("text-slate-800 font-medium", material.signed && "line-through text-slate-400")}>{material.name}</TableCell>
                        <TableCell className="text-slate-500">{material.issueCode ?? 'Theo kế hoạch'}</TableCell>
                        <TableCell className="text-slate-500 text-right">{formatUnit(material.unit)}</TableCell>
                        <TableCell className="text-slate-800 font-semibold text-right">{formatQuantity(material.quantity)}</TableCell>
                        <TableCell><Badge variant="outline" className={material.status === 'Đã nhận' ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-amber-200 bg-amber-50 text-amber-800'}><span className="flex items-center gap-1">{material.status === 'Đã nhận' && <Check className="w-3 h-3" />}{material.status === 'Chờ giao' ? 'Chờ ký nhận' : material.status}</span></Badge></TableCell>
                      </TableRow>
                    )]
                  }

                  const issueCount = new Set(group.lines.map((line) => line.issueCode ?? line.issueId ?? line.id)).size
                  const summary = (
                    <TableRow key={group.key} className="border-slate-200 bg-slate-50/70">
                      <TableCell className="text-center"><button type="button" className="inline-flex size-8 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600" aria-label={`${expanded ? 'Đóng' : 'Mở'} ${group.lines.length} dòng nguồn của ${group.name}`} aria-expanded={expanded} onClick={() => setExpandedGroupKey(expanded ? null : group.key)}><ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} /></button></TableCell>
                      <TableCell><span className="block font-semibold text-slate-900">{group.name}</span><span className="text-xs text-slate-500">{group.lines.length} dòng nguồn</span></TableCell>
                      <TableCell className="text-slate-500">{issueCount} phiếu xuất</TableCell>
                      <TableCell className="text-right text-slate-500">{formatUnit(group.unit)}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">{formatQuantity(group.quantity)}</TableCell>
                      <TableCell><Badge variant="outline" className={signedLines === group.lines.length ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{signedLines}/{group.lines.length} dòng đã ký</Badge></TableCell>
                    </TableRow>
                  )
                  if (!expanded) return [summary]

                  return [summary, ...group.lines.map((material) => (
                    <TableRow key={material.id} className={cn('border-slate-200 bg-white', material.signed && 'opacity-70')}>
                      <TableCell className="text-center"><Checkbox aria-label={`Ký nhận ${material.name} từ ${material.issueCode ?? material.id}`} checked={material.signed} onCheckedChange={(checked) => { if (checked === true && !material.signed) setPendingMaterialId(material.id) }} className="rounded-sm border-slate-300 bg-white" disabled={material.signed} /></TableCell>
                      <TableCell className="pl-6 text-xs font-medium text-slate-700">↳ Dòng nguồn</TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">{material.issueCode ?? material.issueId ?? material.id}</TableCell>
                      <TableCell className="text-right text-slate-500">{formatUnit(material.unit)}</TableCell>
                      <TableCell className="text-right font-semibold text-slate-800">{formatQuantity(material.quantity)}</TableCell>
                      <TableCell><Badge variant="outline" className={material.status === 'Đã nhận' ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-amber-200 bg-amber-50 text-amber-800'}>{material.status === 'Chờ giao' ? 'Chờ ký nhận' : material.status}</Badge></TableCell>
                    </TableRow>
                  ))]
                })
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
