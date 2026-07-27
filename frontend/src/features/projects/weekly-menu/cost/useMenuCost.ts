import { useMemo, useState } from 'react'
import type { CatalogDish } from '@/api/dishCatalogApi'
import type { WeeklyPlanRow } from '../model/types'
import type { WeeklyMenuScope } from '../schedule/types'
import { buildMenuCostPresentation } from './costModel'

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
      customerId: scope.customerId,
      priceTier: scope.menuPrice,
    }),
    [dishesById, dishesByName, scope.activeDayKey, scope.customerId, scope.displayDays, scope.menuPrice, selectedDayKey, weeklyPlanRows],
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
    },
  }
}

export type MenuCostWorkflow = ReturnType<typeof useMenuCost>
