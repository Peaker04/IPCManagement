import type { CatalogDish } from '../../dishCatalogApi'
import { buildPlanRowsMaterialSummary, calculateTotalMaterialCost } from '../model/scope'
import type { WeeklyPlanRow } from '../model/types'
import type { WeeklyScheduleDay } from '../schedule/types'

export type CostDayPage = WeeklyScheduleDay & { rows: WeeklyPlanRow[] }

export const getDishUnitCost = (
  dish: CatalogDish | undefined,
  quantityFactor = 1,
) => {
  if (!dish?.ingredients.length) return 0
  return Math.round(dish.ingredients.reduce(
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
}: {
  displayDays: WeeklyScheduleDay[]
  weeklyPlanRows: WeeklyPlanRow[]
  selectedDayKey: string | null
  activeDayKey?: string
  dishesById: Map<string, CatalogDish>
  dishesByName: Map<string, CatalogDish>
}) => {
  const dayPages = buildCostDayPages(displayDays, weeklyPlanRows)
  const dayIndex = resolveCostDayIndex(dayPages, selectedDayKey, activeDayKey)
  const activeDay = dayPages[dayIndex]
  const rows = activeDay?.rows ?? []
  const rowsWithBom = rows.filter((row) => row.hasCatalogBom)
  const rowsMissingBom = rows.filter((row) => !row.hasCatalogBom)
  const total = rowsWithBom.reduce(
    (sum, row) => sum + getDishUnitCost(dishesById.get(row.dishId), row.quantityFactor) * row.portions,
    0,
  )
  const materialSummary = buildPlanRowsMaterialSummary(rows, dishesById, dishesByName)

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
