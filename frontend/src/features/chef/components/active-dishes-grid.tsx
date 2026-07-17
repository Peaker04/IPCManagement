'use client'

import { ChevronDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { SectionPanel, TableViewport } from '@/components/common'
import { formatQuantity, formatUnit } from '@/lib/formatters'
import type { Dish } from '@/lib/types'

interface ActiveDishesGridProps {
  dishes: Dish[]
  expandedDishId: string | null
  onDishExpand: (dishId: string | null) => void
}

export function ActiveDishesGrid({ dishes, expandedDishId, onDishExpand }: ActiveDishesGridProps) {
  return (
    <SectionPanel
      title="Bảng món đang nấu"
      description={`${dishes.length} món trong lệnh sản xuất. Mở từng món để xem định lượng nguyên liệu.`}
      className="ipc-chef-dishes-panel"
    >
      <div className="space-y-2">
        {dishes.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-slate-500 text-sm">Không có món ăn nào được lên lịch hôm nay</p>
          </div>
        ) : (
          <div className="ipc-chef-dish-list">
            {dishes.map((dish) => (
              <div key={dish.id} className="ipc-chef-dish-card">
                <button
                  type="button"
                  aria-expanded={expandedDishId === dish.id}
                  aria-controls={`dish-bom-${dish.id}`}
                  onClick={() =>
                    onDishExpand(expandedDishId === dish.id ? null : dish.id)
                  }
                  className="ipc-chef-dish-toggle"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="h-3 w-3 flex-shrink-0 rounded-sm bg-teal-500"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-slate-900 truncate">{dish.name}</h4>
                      {dish.code && (
                        <p className="text-xs text-slate-500">{dish.code}</p>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 text-slate-500 transition-transform ${
                      expandedDishId === dish.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Expanded BOM Table */}
                {expandedDishId === dish.id && (
                  <>
                    <Separator className="bg-slate-200" />
                    <TableViewport
                      ariaLabel={`Định lượng nguyên liệu cho ${dish.name}`}
                      caption={`Danh sách nguyên liệu cho ${dish.name}`}
                      className="ipc-chef-bom-shell"
                    >
                      <div id={`dish-bom-${dish.id}`} role="region" aria-label={`Định lượng ${dish.name}`}>
                      <Table className="ipc-chef-bom-table text-xs">
                        <TableHeader>
                          <TableRow className="border-slate-200 hover:bg-transparent">
                            <TableHead className="text-slate-600 font-semibold">Nguyên Liệu</TableHead>
                            <TableHead className="text-slate-600 font-semibold text-right">Đơn Vị</TableHead>
                            <TableHead className="text-slate-600 font-semibold text-right">Số Lượng Cần</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dish.ingredients.map((ing, idx) => (
                            <TableRow
                              key={idx}
                              className="border-slate-200 hover:bg-slate-50"
                            >
                              <TableCell className="text-slate-800 font-medium">{ing.ingredientName}</TableCell>
                              <TableCell className="text-slate-500 text-right">{formatUnit(ing.unit)}</TableCell>
                              <TableCell className="text-slate-800 font-semibold text-right">
                                {formatQuantity(ing.grossQty)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {dish.ingredients.length === 0 && (
                        <p className="py-4 text-center text-xs text-slate-500">Không có thông tin nguyên liệu</p>
                      )}
                      </div>
                    </TableViewport>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionPanel>
  )
}
