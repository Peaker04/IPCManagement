import { useEffect } from 'react'
import type { OrderRow } from '../types'
import { getMenuDishSlotLabel, groupMenuDishes, type MenuDishRole } from '../dishRole'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLazyGetMenuSchedulesQuery } from '@/api/coordinationApi'
import { toLabeledQueryView } from '@/lib/labeledQueryView'
import { QueryViewBoundary } from '@/components/common/QueryViewBoundary'

interface DishDetailDialogProps {
  order: OrderRow
  onClose: () => void
}

const dishRoleStyles: Record<MenuDishRole, { header: string; badge: string }> = {
  main: { header: 'border-blue-200 bg-blue-50 text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  side: { header: 'border-violet-200 bg-violet-50 text-violet-800', badge: 'bg-violet-100 text-violet-700' },
  vegetable: { header: 'border-emerald-200 bg-emerald-50 text-emerald-800', badge: 'bg-emerald-100 text-emerald-700' },
  soup: { header: 'border-cyan-200 bg-cyan-50 text-cyan-800', badge: 'bg-cyan-100 text-cyan-700' },
  fruit: { header: 'border-orange-200 bg-orange-50 text-orange-800', badge: 'bg-orange-100 text-orange-700' },
  dessert: { header: 'border-pink-200 bg-pink-50 text-pink-800', badge: 'bg-pink-100 text-pink-700' },
  other: { header: 'border-slate-200 bg-slate-50 text-slate-700', badge: 'bg-slate-200 text-slate-700' },
}

export function DishDetailDialog({ order, onClose }: DishDetailDialogProps) {
  const needsMenuMetadata = (order.dishes ?? []).some(
    (dish) => !dish.dishSlot && !dish.dishGroup && !dish.dishType,
  )
  const [loadMenuSchedules, menuSchedulesQuery] = useLazyGetMenuSchedulesQuery()

  useEffect(() => {
    if (!needsMenuMetadata) return
    void loadMenuSchedules({
      serviceDate: order.serviceDate,
      dayOfWeek: order.dayOfWeek,
      shiftName: order.shiftName,
      customerId: order.customerId,
    }, true)
  }, [loadMenuSchedules, needsMenuMetadata, order.customerId, order.dayOfWeek, order.serviceDate, order.shiftName])

  const menuSchedulesView = toLabeledQueryView(menuSchedulesQuery, 'cấu trúc món từ thực đơn', {
    instruction: 'Mở chi tiết món để tải cấu trúc thực đơn.',
    retry: () => loadMenuSchedules({
      serviceDate: order.serviceDate,
      dayOfWeek: order.dayOfWeek,
      shiftName: order.shiftName,
      customerId: order.customerId,
    }, false),
  })
  const menuSchedules = menuSchedulesView.phase === 'ready' ? menuSchedulesView.data.data ?? [] : []
  const matchingSchedule = menuSchedules.find(
    (schedule) => schedule.menuScheduleId === order.menuScheduleId || schedule.menuId === order.menuId,
  ) ?? menuSchedules[0]
  const scheduleDishes = new Map<string, NonNullable<typeof matchingSchedule>['dishes'][number]>()
  for (const dish of matchingSchedule?.dishes ?? []) {
    if (!scheduleDishes.has(dish.dishId)) scheduleDishes.set(dish.dishId, dish)
  }

  const dishes = Array.from(new Map((order.dishes ?? []).map((dish) => [dish.dishId, dish])).values())
    .map((dish) => {
      const menuDish = scheduleDishes.get(dish.dishId)
      return {
        ...dish,
        dishGroup: dish.dishGroup ?? menuDish?.dishGroup,
        dishType: dish.dishType ?? menuDish?.dishType,
        displayOrder: dish.displayOrder ?? menuDish?.displayOrder,
      }
    })
  const groups = groupMenuDishes(dishes)
  const preserveMenuFallback = dishes.length > 0
    && (menuSchedulesView.phase === 'error' || menuSchedulesView.phase === 'forbidden')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-label="Chi tiết thực đơn" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chi tiết thực đơn</DialogTitle>
          <DialogDescription>{order.customerName} · {order.menuName || order.mealType}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <section aria-labelledby="coordination-dish-list-title">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 id="coordination-dish-list-title" className="text-sm font-semibold text-slate-800">
                Cơ cấu món theo thực đơn
              </h3>
              <span className="text-xs font-medium text-slate-500">{dishes.length} món · {groups.length} nhóm</span>
            </div>
            <QueryViewBoundary
              preserveFallback={preserveMenuFallback}
              queries={needsMenuMetadata ? [{ label: 'cấu trúc món từ thực đơn', view: menuSchedulesView }] : []}
              refreshLabel="Đang cập nhật cấu trúc món"
            >
              {dishes.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {groups.map((group) => {
                    const style = dishRoleStyles[group.key]
                    const headingId = `coordination-dish-group-${group.key}`
                    return (
                      <section key={group.key} className="overflow-hidden rounded-md border border-slate-200 bg-white" aria-labelledby={headingId}>
                        <div className={`flex items-center gap-2 border-b px-3 py-2 ${style.header}`}>
                          <h4 id={headingId} className="text-sm font-semibold">{group.label}</h4>
                          <span className={`ml-auto inline-flex min-w-5 justify-center rounded-full px-1.5 py-0.5 text-xs font-bold ${style.badge}`}>
                            {group.dishes.length}
                          </span>
                        </div>
                        <ul className="divide-y divide-slate-200">
                          {group.dishes.map((dish) => {
                            const slotLabel = getMenuDishSlotLabel(dish)
                            return (
                              <li key={dish.dishId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                <span className="text-sm font-medium text-slate-800">{dish.dishName}</span>
                                {slotLabel !== group.label && (
                                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{slotLabel}</span>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Chưa có món trong thực đơn.</p>
              )}
            </QueryViewBoundary>
          </section>
          {order.specialNotes && (
            <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú phục vụ</h3>
              <p className="text-sm leading-5 text-slate-700">{order.specialNotes}</p>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
