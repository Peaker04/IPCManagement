import type { CatalogDish } from '@/api/dishCatalogApi'
import type { DailyProductionPlan, KitchenIssueRow, ProductionPlanLine } from '@/api/workflowApi'
import type { ProductionPlan } from '@/lib/types'
import type { ShiftType } from '@/types/coordination'
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

export function filterKitchenIssues(rows: KitchenIssueRow[], serviceDate: string, shift: ShiftType): KitchenIssueRow[] {
  const normalizedShift = shift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON'
  return rows.filter((row) => {
    const rowShift = row.shiftName?.toUpperCase()
    return row.issueDate.slice(0, 10) === serviceDate
      && (rowShift === normalizedShift || row.shiftName === shift)
  })
}

type BuildChefProductionPlanOptions = {
  orders: ChefOrder[]
  catalogDishes: CatalogDish[]
  kitchenIssues: KitchenIssueRow[]
  signedMaterials: Record<string, boolean>
  activeDay: string
  activeShift: ShiftType
  isLocked: boolean
  lossRate: number
  serviceDate: string
  dailyPlanLines?: DailyPlanLine[]
  dailyTotalServings?: number
}

export function buildChefProductionPlan({
  orders,
  catalogDishes,
  kitchenIssues,
  signedMaterials,
  activeDay,
  activeShift,
  isLocked,
  lossRate,
  serviceDate,
  dailyPlanLines = [],
  dailyTotalServings,
}: BuildChefProductionPlanOptions): ProductionPlan {
  const dishesById = new Map(catalogDishes.map((dish) => [dish.id, dish]))
  const selectedOrders = orders.filter((order) => order.dayOfWeek === activeDay && order.shift === activeShift)
  const portionsByDishId: Record<string, number> = {}
  let totalMeals = 0

  if (dailyPlanLines.length > 0) {
    dailyPlanLines.forEach((line) => {
      if (line.totalServings > 0) {
        portionsByDishId[line.dishId] = (portionsByDishId[line.dishId] ?? 0) + line.totalServings
      }
    })
    totalMeals = dailyTotalServings && dailyTotalServings > 0
      ? dailyTotalServings
      : Math.max(...dailyPlanLines.map((line) => line.totalServings), 0)
  } else {
    selectedOrders.forEach((order) => {
      const quantity = isLocked ? order.actualQuantity : order.forecastQuantity
      totalMeals += quantity
      if (quantity > 0) portionsByDishId[order.dishId] = (portionsByDishId[order.dishId] ?? 0) + quantity
    })
  }

  const activeDishes = Object.entries(portionsByDishId).map(([dishId, portions]) => {
    const dish = dishesById.get(dishId)
    return {
      id: dishId,
      name: dish?.name ?? 'Món ăn không rõ',
      code: dish?.code ?? dishId.slice(0, 8).toUpperCase(),
      ingredients: (dish?.ingredients ?? []).map((ingredient, index) => ({
        ingredientId: ingredient.ingredientId || `${dishId}-${index}`,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        grossQty: Number((ingredient.grossQtyPerServing * portions * (1 + lossRate / 100)).toFixed(2)),
      })),
    }
  })

  // Khóa gộp phải là (nguyên liệu, đơn vị): tên nguyên liệu không có UNIQUE index nên gộp theo tên
  // sẽ cộng nhầm hai master khác nhau, còn bỏ đơn vị khỏi khóa thì cộng kg với thùng vào một số.
  const materialTotals: Record<string, { name: string; quantity: number; unit: string }> = {}
  activeDishes.forEach((dish) => dish.ingredients.forEach((ingredient) => {
    const key = `${ingredient.ingredientId}__${ingredient.unit}`
    materialTotals[key] ??= { name: ingredient.ingredientName, quantity: 0, unit: ingredient.unit }
    materialTotals[key].quantity += ingredient.grossQty
  }))

  const plannedMaterials: ChefMaterial[] = Object.entries(materialTotals).map(([key, item]) => ({
    id: `mat-${key}`,
    name: item.name,
    unit: item.unit,
    quantity: Number(item.quantity.toFixed(2)),
    status: 'Chờ giao',
    signed: Boolean(signedMaterials[`${serviceDate}-${activeShift}-${key}`]),
  }))
  const liveMaterials: ChefMaterial[] = kitchenIssues.map((row) => ({
    id: row.id,
    name: row.ingredient,
    unit: row.unit,
    quantity: row.issuedQty,
    status: row.isReceivedByKitchen ? 'Đã nhận' : 'Chờ giao',
    signed: row.isReceivedByKitchen || Boolean(signedMaterials[`${serviceDate}-${activeShift}-${row.issueId}-${row.id}`]),
    issueId: row.issueId,
    issueCode: row.issueCode,
    warehouseId: row.warehouseId,
    ingredientId: row.ingredientId,
    unitId: row.unitId,
    isReceivedByKitchen: row.isReceivedByKitchen,
  }))

  return {
    date: serviceDate,
    shift: activeShift,
    kitchenAssignment: {
      kitchenName: 'Bếp Cảnh',
      kitchenCode: 'KC01',
      responsibleChefs: [
        { name: 'Đặng Ánh Vàng', shortName: 'DAV' },
        { name: 'Võ Công Việt', shortName: 'VCV' },
      ],
    },
    totalMeals,
    activeDishes,
    // Chỉ dòng từ phiếu xuất kho mới được coi là "đã nhận". Trước đây khi chưa có phiếu xuất,
    // định lượng kế hoạch bị đổ vào đúng ô này nên bếp đọc số kế hoạch như số thực nhận.
    receivedMaterials: liveMaterials,
    plannedMaterials,
  }
}
