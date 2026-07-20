import { useMemo, useState } from 'react'
import type { CatalogDish } from '../../dishCatalogApi'
import type { WeeklyPlanRow } from '../model/types'
import type { WeeklyMenuScope } from '../schedule/types'
import { buildMenuCostPresentation, getDishUnitCost } from './costModel'

type Options = {
  scope: WeeklyMenuScope
  sourceLabel: string
  weeklyPlanRows: WeeklyPlanRow[]
  dishesById: Map<string, CatalogDish>
  dishesByName: Map<string, CatalogDish>
}

export function useMenuCost({ scope, sourceLabel, weeklyPlanRows, dishesById, dishesByName }: Options) {
  const scopeKey = `${scope.customerId}:${scope.weekStartDate}`
  const [selection, setSelection] = useState({ scopeKey, dayKey: null as string | null })
  const selectedDayKey = selection.scopeKey === scopeKey ? selection.dayKey : null
  const presentation = useMemo(
    () => buildMenuCostPresentation({
      displayDays: scope.displayDays,
      weeklyPlanRows,
      selectedDayKey,
      activeDayKey: scope.activeDayKey,
      dishesById,
      dishesByName,
    }),
    [dishesById, dishesByName, scope.activeDayKey, scope.displayDays, selectedDayKey, weeklyPlanRows],
  )

  return {
    scope,
    state: { selectedDayKey },
    actions: {
      selectDay: (dayKey: string | null) => setSelection({ scopeKey, dayKey }),
    },
    presentation: {
      ...presentation,
      sourceLabel,
      getDishUnitCost: (dishId: string, quantityFactor = 1) =>
        getDishUnitCost(dishesById.get(dishId), quantityFactor),
    },
  }
}

export type MenuCostWorkflow = ReturnType<typeof useMenuCost>
