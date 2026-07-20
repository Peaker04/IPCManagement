import type { CatalogDish } from '@/features/projects/dishCatalogApi'
import type { DailyProductionPlan, KitchenIssueRow, ProductionPlanLine } from '@/features/workflow'
import type { ProductionPlan } from '@/lib/types'
import { format } from 'date-fns'
import type { ShiftType } from '../../coordination/types'
import type { ChefMaterial } from '../chefDashboardTypes'

type ChefOrder = {
  dayOfWeek: string
  shift: ShiftType
  dishId: string
  forecastQuantity: number
  actualQuantity: number
}

export type DailyPlanLine = ProductionPlanLine & {
  planCode: string
  customerName?: string | null
  status?: string | null
  sentToKitchenAt?: string | null
}

export function mapDailyPlanLines(plan?: DailyProductionPlan): DailyPlanLine[] {
  return (plan?.plans ?? []).flatMap((item) =>
    (item.lines ?? []).map((line) => ({
      ...line,
      planCode: item.planCode,
      customerName: item.customerName,
      status: item.status,
      sentToKitchenAt: item.sentToKitchenAt,
    })),
  )
}

export function filterKitchenIssues(rows: KitchenIssueRow[], shift: ShiftType): KitchenIssueRow[] {
  const normalizedShift = shift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON'
  const matchingRows = rows.filter((row) => {
    const rowShift = row.shiftName?.toUpperCase()
    return !rowShift || rowShift === 'FULLDAY' || rowShift === normalizedShift || row.shiftName === shift
  })
  return matchingRows.length > 0 ? matchingRows : rows
}

type BuildChefProductionPlanOptions = {
  orders: ChefOrder[]
  catalogDishes: CatalogDish[]
  kitchenIssues: KitchenIssueRow[]
  signedMaterials: Record<string, boolean>
  activeDay: string
  activeShift: ShiftType
  isLocked: boolean
  menuPrice: number
  lossRate: number
}

export function buildChefProductionPlan({
  orders,
  catalogDishes,
  kitchenIssues,
  signedMaterials,
  activeDay,
  activeShift,
  isLocked,
  menuPrice,
  lossRate,
}: BuildChefProductionPlanOptions): ProductionPlan {
  const dishesById = new Map(catalogDishes.map((dish) => [dish.id, dish]))
  const selectedOrders = orders.filter((order) => order.dayOfWeek === activeDay && order.shift === activeShift)
  const portionsByDishId: Record<string, number> = {}
  let totalMeals = 0

  selectedOrders.forEach((order) => {
    const quantity = isLocked ? order.actualQuantity : order.forecastQuantity
    totalMeals += quantity
    if (quantity > 0) portionsByDishId[order.dishId] = (portionsByDishId[order.dishId] ?? 0) + quantity
  })

  const activeDishes = Object.entries(portionsByDishId).map(([dishId, portions]) => {
    const dish = dishesById.get(dishId)
    const priceRatio = Math.max(0.1, Math.min(1.5, menuPrice / 35000))
    return {
      id: dishId,
      name: dish?.name ?? 'Món ăn không rõ',
      code: dish?.code ?? dishId.slice(0, 8).toUpperCase(),
      ingredients: (dish?.ingredients ?? []).map((ingredient, index) => ({
        ingredientId: ingredient.ingredientId || `${dishId}-${index}`,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        grossQty: Number((ingredient.grossQtyPerServing * portions * priceRatio * (1 + lossRate / 100)).toFixed(2)),
      })),
    }
  })

  const materialTotals: Record<string, { quantity: number; unit: string }> = {}
  activeDishes.forEach((dish) => dish.ingredients.forEach((ingredient) => {
    materialTotals[ingredient.ingredientName] ??= { quantity: 0, unit: ingredient.unit }
    materialTotals[ingredient.ingredientName].quantity += ingredient.grossQty
  }))

  const plannedMaterials: ChefMaterial[] = Object.entries(materialTotals).map(([name, item], index) => ({
    id: `mat-${index}`,
    name,
    unit: item.unit,
    quantity: Number(item.quantity.toFixed(2)),
    status: isLocked ? 'Đã nhận' : 'Chờ giao',
    signed: Boolean(signedMaterials[`${activeDay}-${activeShift}-${name}`]),
  }))
  const liveMaterials: ChefMaterial[] = kitchenIssues.map((row) => ({
    id: row.id,
    name: row.ingredient,
    unit: row.unit,
    quantity: row.issuedQty,
    status: 'Đã nhận',
    signed: row.isReceivedByKitchen || Boolean(signedMaterials[`${activeDay}-${activeShift}-${row.issueId}-${row.id}`]),
    issueId: row.issueId,
    issueCode: row.issueCode,
    warehouseId: row.warehouseId,
    ingredientId: row.ingredientId,
    unitId: row.unitId,
    isReceivedByKitchen: row.isReceivedByKitchen,
  }))

  return {
    date: format(new Date(), 'yyyy-MM-dd'),
    shift: activeShift,
    kitchenAssignment: {
      kitchenName: 'Bếp Cảnh',
      kitchenCode: 'KC01',
      responsibleChefs: [
        { name: 'Đặng Ánh Vàng', shortName: 'DAV' },
        { name: 'Võ Công Việt', shortName: 'VCV' },
      ],
    },
    totalMeals: totalMeals || liveMaterials.length,
    activeDishes,
    receivedMaterials: liveMaterials.length > 0 ? liveMaterials : plannedMaterials,
  }
}
