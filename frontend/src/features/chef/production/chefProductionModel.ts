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
  customerId?: string | null
  customerCode?: string | null
  customerName?: string | null
  status?: string | null
  sentToKitchenAt?: string | null
}

export function mapDailyPlanLines(plan?: DailyProductionPlan): DailyPlanLine[] {
  return (plan?.plans ?? []).flatMap((item) =>
    (item.lines ?? []).map((line) => ({
      ...line,
      planCode: item.planCode,
      customerId: item.customerId,
      customerCode: item.customerCode,
      customerName: item.customerName,
      status: item.status,
      sentToKitchenAt: item.sentToKitchenAt,
    })),
  )
}

export function filterKitchenIssues(rows: KitchenIssueRow[], serviceDate: string, shift: ShiftType): KitchenIssueRow[] {
  const normalizedShift = shift === 'Ca Sáng' ? 'MORNING' : 'AFTERNOON'
  return rows.filter((row) => {
    const rowShift = row.shiftName?.trim().toUpperCase()
    const isFullDay = !rowShift || rowShift === 'FULLDAY'
    return row.issueDate.slice(0, 10) === serviceDate
      && (rowShift === normalizedShift || row.shiftName === shift || (isFullDay && normalizedShift === 'MORNING'))
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

type ChefProductionSourceLine = {
  sourceId: string
  planCode?: string
  dishId: string
  portions: number
  customerId?: string | null
  customerCode?: string | null
  customerName?: string | null
  priceTierAmount: number
}

type ChefPlannedMaterial = ChefMaterial & {
  customerId?: string | null
  customerCode?: string | null
  customerName?: string | null
  priceTierAmount: number
}

const DEFAULT_BOM_PRICE_TIER = 25_000
const SUPPORTED_BOM_PRICE_TIERS = new Set([25_000, 30_000, 34_000])

const normalizeChefPriceTier = (value?: number | null) => {
  const normalized = Math.round(value ?? DEFAULT_BOM_PRICE_TIER)
  return SUPPORTED_BOM_PRICE_TIERS.has(normalized) ? normalized : DEFAULT_BOM_PRICE_TIER
}

const resolveChefBomLines = (
  dish: CatalogDish | undefined,
  source: ChefProductionSourceLine,
  serviceDate: string,
) => {
  if (!dish) return []

  const date = serviceDate.slice(0, 10)
  const effectiveLines = dish.ingredients.filter((ingredient) => {
    const effectiveFrom = ingredient.effectiveFrom.slice(0, 10)
    const effectiveTo = ingredient.effectiveTo?.slice(0, 10)
    return ingredient.bomStatus.trim().toUpperCase() === 'PUBLISHED'
      && ingredient.priceTierAmount === source.priceTierAmount
      && effectiveFrom <= date
      && (!effectiveTo || effectiveTo >= date)
  })
  const customerLines = source.customerId
    ? effectiveLines.filter((ingredient) => ingredient.customerId === source.customerId)
    : []

  return customerLines.length > 0
    ? customerLines
    : effectiveLines.filter((ingredient) => !ingredient.customerId)
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
  const productionSources: ChefProductionSourceLine[] = []
  let totalMeals = 0

  if (dailyPlanLines.length > 0) {
    const servingsByPlan = new Map<string, number>()
    dailyPlanLines.forEach((line) => {
      if (line.totalServings > 0) {
        const planKey = `${line.planCode}__${line.customerId ?? 'unknown-customer'}`
        servingsByPlan.set(planKey, Math.max(servingsByPlan.get(planKey) ?? 0, line.totalServings))
        productionSources.push({
          sourceId: line.planLineId,
          planCode: line.planCode,
          dishId: line.dishId,
          portions: line.totalServings,
          customerId: line.customerId,
          customerCode: line.customerCode,
          customerName: line.customerName,
          priceTierAmount: normalizeChefPriceTier(line.priceTierAmount),
        })
      }
    })
    totalMeals = dailyTotalServings && dailyTotalServings > 0
      ? dailyTotalServings
      : Array.from(servingsByPlan.values()).reduce((sum, servings) => sum + servings, 0)
  } else {
    selectedOrders.forEach((order, index) => {
      const quantity = isLocked ? order.actualQuantity : order.forecastQuantity
      totalMeals += quantity
      if (quantity > 0) {
        productionSources.push({
          sourceId: `coordination-${order.dishId}-${index}`,
          dishId: order.dishId,
          portions: quantity,
          priceTierAmount: DEFAULT_BOM_PRICE_TIER,
        })
      }
    })
  }

  const activeDishMap = new Map<string, {
    id: string
    dishId: string
    name: string
    code: string
    customerId?: string | null
    customerCode?: string | null
    customerName?: string | null
    priceTierAmount: number
    portions: number
    planCodes: Set<string>
    hasBom: boolean
    ingredients: Map<string, { ingredientId: string; ingredientName: string; unitId?: string; unit: string; grossQty: number }>
  }>()
  productionSources.forEach((source) => {
    const dish = dishesById.get(source.dishId)
    const customerKey = source.customerId ?? 'global'
    const grainKey = `${customerKey}__${source.priceTierAmount}__${source.dishId}`
    const displayId = source.customerId || source.priceTierAmount !== DEFAULT_BOM_PRICE_TIER
      ? grainKey
      : source.dishId
    const activeDish = activeDishMap.get(grainKey) ?? {
      id: displayId,
      dishId: source.dishId,
      name: dish?.name ?? 'Món ăn không rõ',
      code: dish?.code ?? source.dishId.slice(0, 8).toUpperCase(),
      customerId: source.customerId,
      customerCode: source.customerCode,
      customerName: source.customerName,
      priceTierAmount: source.priceTierAmount,
      portions: 0,
      planCodes: new Set<string>(),
      hasBom: false,
      ingredients: new Map(),
    }
    activeDishMap.set(grainKey, activeDish)
    activeDish.portions += source.portions
    if (source.planCode) activeDish.planCodes.add(source.planCode)

    const bomLines = resolveChefBomLines(dish, source, serviceDate)
    activeDish.hasBom ||= bomLines.length > 0
    bomLines.forEach((ingredient, index) => {
      const ingredientId = ingredient.ingredientId || `${source.dishId}-${index}`
      const key = `${ingredientId}__${ingredient.unitId || ingredient.unit}`
      const grouped = activeDish.ingredients.get(key) ?? {
        ingredientId,
        ingredientName: ingredient.name,
        unitId: ingredient.unitId,
        unit: ingredient.unit,
        grossQty: 0,
      }
      grouped.grossQty += ingredient.grossQtyPerServing * source.portions * (1 + lossRate / 100)
      activeDish.ingredients.set(key, grouped)
    })
  })
  const activeDishes = Array.from(activeDishMap.values()).map((dish) => ({
    id: dish.id,
    dishId: dish.dishId,
    name: dish.name,
    code: dish.code,
    customerId: dish.customerId,
    customerCode: dish.customerCode,
    customerName: dish.customerName,
    priceTierAmount: dish.priceTierAmount,
    portions: dish.portions,
    planCodes: Array.from(dish.planCodes),
    hasBom: dish.hasBom,
    ingredients: Array.from(dish.ingredients.values()).map((ingredient) => ({
      ...ingredient,
      grossQty: Number(ingredient.grossQty.toFixed(2)),
    })),
  }))

  // Khóa gộp phải là (nguyên liệu, đơn vị): tên nguyên liệu không có UNIQUE index nên gộp theo tên
  // sẽ cộng nhầm hai master khác nhau, còn bỏ đơn vị khỏi khóa thì cộng kg với thùng vào một số.
  const materialTotals: Record<string, {
    ingredientId: string
    unitId?: string
    name: string
    quantity: number
    unit: string
    customerId?: string | null
    customerCode?: string | null
    customerName?: string | null
    priceTierAmount: number
  }> = {}
  activeDishes.forEach((dish) => dish.ingredients.forEach((ingredient) => {
    const key = `${dish.customerId ?? 'global'}__${dish.priceTierAmount}__${ingredient.ingredientId}__${ingredient.unitId || ingredient.unit}`
    materialTotals[key] ??= {
      ingredientId: ingredient.ingredientId,
      unitId: ingredient.unitId,
      name: ingredient.ingredientName,
      quantity: 0,
      unit: ingredient.unit,
      customerId: dish.customerId,
      customerCode: dish.customerCode,
      customerName: dish.customerName,
      priceTierAmount: dish.priceTierAmount,
    }
    materialTotals[key].quantity += ingredient.grossQty
  }))

  const plannedMaterials: ChefPlannedMaterial[] = Object.entries(materialTotals).map(([key, item]) => ({
    id: `mat-${key}`,
    ingredientId: item.ingredientId,
    unitId: item.unitId,
    name: item.name,
    unit: item.unit,
    quantity: Number(item.quantity.toFixed(2)),
    status: 'Chờ giao',
    signed: Boolean(signedMaterials[`${serviceDate}-${activeShift}-${key}`]),
    customerId: item.customerId,
    customerCode: item.customerCode,
    customerName: item.customerName,
    priceTierAmount: item.priceTierAmount,
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
