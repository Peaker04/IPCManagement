import type { CatalogDish } from '@/api/dishCatalogApi'
import { buildPlanRowsMaterialSummary, calculateTotalMaterialCost, resolveDishIngredients, type BomResolutionContext } from '../model/scope'
import type { WeeklyPlanRow } from '../model/types'
import type { WeeklyScheduleDay } from '../schedule/types'
import { normalizeDishMatchKey } from '../model/formatters'

export type CostDayPage = WeeklyScheduleDay & { rows: WeeklyPlanRow[] }

export const getDishUnitCost = (
  dish: CatalogDish | undefined,
  quantityFactor = 1,
  bomContext?: BomResolutionContext,
) => {
  const ingredients = resolveDishIngredients(dish, bomContext)
  if (ingredients.length === 0) return 0
  return Math.round(ingredients.reduce(
    (sum, ingredient) => sum + ingredient.grossQtyPerServing * quantityFactor * ingredient.referencePrice,
    0,
  ))
}

export const buildCostDayPages = (
  displayDays: WeeklyScheduleDay[],
  weeklyPlanRows: WeeklyPlanRow[],
): CostDayPage[] => displayDays
  .map((day) => ({ ...day, rows: weeklyPlanRows.filter((row) => row.dayKey === day.key) }))
  .filter((day) => day.rows.length > 0)

export const resolveCostDayIndex = (
  pages: CostDayPage[],
  selectedDayKey: string | null,
  activeDayKey?: string,
) => {
  if (pages.length === 0) return 0
  const selectedIndex = selectedDayKey ? pages.findIndex((day) => day.key === selectedDayKey) : -1
  if (selectedIndex >= 0) return selectedIndex
  const activeIndex = activeDayKey ? pages.findIndex((day) => day.key === activeDayKey) : -1
  return activeIndex >= 0 ? activeIndex : 0
}

export const buildMenuCostPresentation = ({
  displayDays,
  weeklyPlanRows,
  selectedDayKey,
  activeDayKey,
  dishesById,
  dishesByName,
  customerId,
  priceTier,
}: {
  displayDays: WeeklyScheduleDay[]
  weeklyPlanRows: WeeklyPlanRow[]
  selectedDayKey: string | null
  activeDayKey?: string
  dishesById: Map<string, CatalogDish>
  dishesByName: Map<string, CatalogDish>
  customerId: string
  priceTier: number
}) => {
  const dayPages = buildCostDayPages(displayDays, weeklyPlanRows)
  const dayIndex = resolveCostDayIndex(dayPages, selectedDayKey, activeDayKey)
  const activeDay = dayPages[dayIndex]
  const rows = (activeDay?.rows ?? []).map((row) => {
    const dish = dishesById.get(row.dishId) ?? dishesByName.get(normalizeDishMatchKey(row.dishName))
    const bomContext = { customerId, priceTier, serviceDate: row.serviceDate }
    const ingredients = resolveDishIngredients(dish, bomContext)
    return {
      ...row,
      hasCatalogBom: ingredients.length > 0,
      unitCost: getDishUnitCost(dish, row.quantityFactor, bomContext),
    }
  })
  const rowsWithBom = rows.filter((row) => row.hasCatalogBom)
  const rowsMissingBom = rows.filter((row) => !row.hasCatalogBom)
  const total = rowsWithBom.reduce(
    (sum, row) => sum + row.unitCost * row.portions,
    0,
  )
  const materialSummary = buildPlanRowsMaterialSummary(rows, dishesById, dishesByName, { customerId, priceTier })

  return {
    dayPages,
    dayIndex,
    activeDay,
    rows,
    rowsWithBom,
    rowsMissingBom,
    total,
    materialSummary,
    materialTotal: calculateTotalMaterialCost(materialSummary),
  }
}
