import { useMemo, useState } from 'react'
import type { CatalogDish } from '../../dishCatalogApi'
import type { WeeklyPlanRow } from '../model/types'
import { buildDishMaterialsPresentation, groupDishesByShift, resolveAnalyzedDish } from './dishMaterialsModel'

type Options = {
  scopeKey: string
  sourceLabel: string
  menuPrice: number
  catalogDishes: CatalogDish[]
  weeklyRowsWithBom: WeeklyPlanRow[]
  dishesById: Map<string, CatalogDish>
}

export function useDishMaterials({
  scopeKey,
  sourceLabel,
  menuPrice,
  catalogDishes,
  weeklyRowsWithBom,
  dishesById,
}: Options) {
  const [selection, setSelection] = useState({ scopeKey, dishId: '' })
  const selectedDishId = selection.scopeKey === scopeKey ? selection.dishId : ''
  const analyzedDish = resolveAnalyzedDish(catalogDishes, selectedDishId, weeklyRowsWithBom, dishesById)
  const presentation = useMemo(
    () => buildDishMaterialsPresentation(analyzedDish, menuPrice),
    [analyzedDish, menuPrice],
  )
  const dishesByShift = useMemo(() => groupDishesByShift(catalogDishes), [catalogDishes])
  const weeklyPlanCatalogDishIds = useMemo(
    () => new Set(weeklyRowsWithBom.map((row) => row.dishId)),
    [weeklyRowsWithBom],
  )

  return {
    state: { selectedDishId },
    actions: { selectDish: (dishId: string) => setSelection({ scopeKey, dishId }) },
    presentation: {
      ...presentation,
      analyzedDish,
      dishesByShift,
      weeklyPlanCatalogDishIds,
      sourceLabel,
      menuPrice,
      isCatalogEmpty: catalogDishes.length === 0,
    },
  }
}

export type DishMaterialsWorkflow = ReturnType<typeof useDishMaterials>
