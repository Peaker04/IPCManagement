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
import { SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { formatQuantity, formatUnit } from '@/lib/formatters'
import type { ChefMaterial } from '../chefDashboardTypes'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { typography } from '@/lib/typography'

interface MaterialChecklistProps {
  materials: ChefMaterial[]
  onMaterialSignoff?: (materialId: string, signed: boolean) => void
  pageLabel?: string
  totalSignedCount?: number
  totalSourceCount?: number
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

export function MaterialChecklist({ materials, onMaterialSignoff, pageLabel, totalSignedCount, totalSourceCount }: MaterialChecklistProps) {
  const [pendingMaterialId, setPendingMaterialId] = useState<string | null>(null)
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null)
  const pendingMaterial = materials.find((material) => material.id === pendingMaterialId)
  const materialGroups = useMemo(() => groupMaterialsByStableIdentity(materials), [materials])

  const signedCount = materials.filter((m) => m.signed).length
  return (
    <SectionPanel
      title="Checklist nhận nguyên liệu"
      description={pageLabel
        ? `${pageLabel}. Mỗi nguyên liệu một dòng tổng trong ngày/ca; mở dòng tổng để kiểm đếm và xác nhận từng phiếu xuất nguồn.`
        : 'Mỗi nguyên liệu một dòng tổng trong ngày/ca; mở dòng tổng để kiểm đếm và xác nhận từng phiếu xuất nguồn.'}
      badge={
        <span className="text-sm text-slate-500 font-medium">
          Đã nhận: {totalSignedCount ?? signedCount}/{totalSourceCount ?? materials.length} dòng nguồn
        </span>
      }
      className={cn(typography.body, 'ipc-chef-checklist-panel')}
    >
        <TableViewport ariaLabel="Checklist ký nhận nguyên liệu bếp" caption="Danh sách nguyên liệu cần ký nhận" className="ipc-chef-checklist-shell">
          <Table aria-label="Checklist ký nhận nguyên liệu bếp" className="ipc-chef-checklist-table text-xs">
            <TableHeader>
              <TableRow className="border-slate-200 hover:bg-transparent">
                <TableHead className="w-20 text-slate-600 font-semibold">Thao tác</TableHead>
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
                      <TableRow key={material.id} className={cn("border-slate-200 transition-colors duration-200 motion-reduce:transition-none", material.signed ? "bg-emerald-50/30 hover:bg-emerald-50/40" : "hover:bg-blue-50/40")}>
                        <TableCell>{material.signed ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Check className="size-3.5" />Đã nhận</span> : <Button type="button" size="xs" variant="outline" onClick={() => setPendingMaterialId(material.id)}>Nhận</Button>}</TableCell>
                        <TableCell className="font-medium text-slate-800">{material.name}</TableCell>
                        <TableCell className="text-slate-500">{material.issueCode ?? 'Theo kế hoạch'}</TableCell>
                        <TableCell className="text-slate-500 text-right">{formatUnit(material.unit)}</TableCell>
                        <TableCell className={cn(typography.numeric, 'text-right font-semibold text-slate-800')}>{formatQuantity(material.quantity)}</TableCell>
                        <TableCell><StatusBadge variant={material.signed ? 'success' : 'warning'}>{material.signed ? 'Đã nhận' : 'Chờ nhận'}</StatusBadge></TableCell>
                      </TableRow>
                    )]
                  }

                  const issueCount = new Set(group.lines.map((line) => line.issueCode ?? line.issueId ?? line.id)).size
                  const summary = (
                    <TableRow key={group.key} className="border-slate-200 bg-slate-50/70">
                      <TableCell className="text-center"><Button type="button" variant="outline" size="icon-xs" className="text-slate-600" aria-label={`${expanded ? 'Đóng' : 'Mở'} ${group.lines.length} dòng nguồn của ${group.name}`} aria-expanded={expanded} onClick={() => setExpandedGroupKey(expanded ? null : group.key)}><ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} /></Button></TableCell>
                      <TableCell><span className="block font-semibold text-slate-900">{group.name}</span><span className="text-xs text-slate-500">{group.lines.length} dòng nguồn</span></TableCell>
                      <TableCell className="text-slate-500">{issueCount} phiếu xuất</TableCell>
                      <TableCell className="text-right text-slate-500">{formatUnit(group.unit)}</TableCell>
                      <TableCell className={cn(typography.numeric, 'text-right font-semibold text-slate-900')}>{formatQuantity(group.quantity)}</TableCell>
                      <TableCell><StatusBadge variant={signedLines === group.lines.length ? 'success' : 'warning'}>{signedLines === group.lines.length ? 'Đã nhận đủ' : `Đã nhận ${signedLines}/${group.lines.length}`}</StatusBadge></TableCell>
                    </TableRow>
                  )
                  if (!expanded) return [summary]

                  return [summary, ...group.lines.map((material) => (
                    <TableRow key={material.id} className={cn('border-slate-200 bg-white', material.signed && 'bg-emerald-50/20')}>
                      <TableCell>{material.signed ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Check className="size-3.5" />Đã nhận</span> : <Button type="button" size="xs" variant="outline" aria-label={`Nhận ${material.name} từ ${material.issueCode ?? material.id}`} onClick={() => setPendingMaterialId(material.id)}>Nhận</Button>}</TableCell>
                      <TableCell className="pl-6 text-xs font-medium text-slate-700"><span className="inline-flex items-center gap-1"><span aria-hidden="true">↳</span><span>Dòng xuất nguồn</span></span></TableCell>
                      <TableCell className={cn(typography.code, 'text-xs text-slate-600')}>{material.issueCode ?? material.issueId ?? material.id}</TableCell>
                      <TableCell className="text-right text-slate-500">{formatUnit(material.unit)}</TableCell>
                      <TableCell className={cn(typography.numeric, 'text-right font-semibold text-slate-800')}>{formatQuantity(material.quantity)}</TableCell>
                      <TableCell><StatusBadge variant={material.signed ? 'success' : 'warning'}>{material.signed ? 'Đã nhận' : 'Chờ nhận'}</StatusBadge></TableCell>
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
