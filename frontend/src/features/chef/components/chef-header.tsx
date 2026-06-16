'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ProductionPlan } from '@/lib/types'

interface ChefHeaderProps {
  productionPlan: ProductionPlan
}

export function ChefHeader({ productionPlan }: ChefHeaderProps) {
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  const chefNames = productionPlan.kitchenAssignment.responsibleChefs
    .map((c) => c.shortName)
    .join(', ')

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {/* Date Card */}
      <Card className="rounded-md border-slate-200 bg-white">
        <CardContent className="pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ngày Làm Việc</p>
          <p className="text-lg font-semibold text-slate-900">{formatDate(productionPlan.date)}</p>
        </CardContent>
      </Card>

      {/* Shift Card */}
      <Card className="rounded-md border-slate-200 bg-white">
        <CardContent className="pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ca Làm Việc</p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-md border-slate-200 bg-white text-slate-700">
              {productionPlan.shift}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Kitchen Assignment Card */}
      <Card className="rounded-md border-slate-200 bg-white md:col-span-2 lg:col-span-1">
        <CardContent className="pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Cụm Bếp</p>
          <p className="text-sm font-semibold text-slate-900 leading-tight">
            {productionPlan.kitchenAssignment.kitchenName}
          </p>
          <p className="text-xs text-slate-500 mt-1">Phụ trách: {chefNames}</p>
        </CardContent>
      </Card>

      {/* Total Meals Card */}
      <Card className="rounded-md border-slate-200 bg-white shadow-sm">
        <CardContent className="pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tổng Suất Ăn</p>
          <div className="flex items-baseline gap-1.5 mt-2">
            <span className="text-4xl font-black text-amber-600 tracking-tight leading-none">
              {productionPlan.totalMeals}
            </span>
            <span className="text-xs font-semibold text-slate-500">phần</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
