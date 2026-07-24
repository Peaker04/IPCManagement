import { useMemo, useState } from 'react'
import type { CatalogDish } from '../../dishCatalogApi'
import type { WeeklyPlanRow } from '../model/types'
import { buildDishMaterialsPresentation, groupDishesByShift, resolveAnalyzedDish } from './dishMaterialsModel'

type Options = {
  scopeKey: string
  sourceLabel: string
  menuPrice: number
  customerId: string
  serviceDate: string
  catalogDishes: CatalogDish[]
  weeklyRowsWithBom: WeeklyPlanRow[]
  dishesById: Map<string, CatalogDish>
}

export function useDishMaterials({
  scopeKey,
  sourceLabel,
  menuPrice,
  customerId,
  serviceDate,
  catalogDishes,
  weeklyRowsWithBom,
  dishesById,
}: Options) {
  const [selection, setSelection] = useState({ scopeKey, dishId: '' })
  const selectedDishId = selection.scopeKey === scopeKey ? selection.dishId : ''
  const analyzedDish = resolveAnalyzedDish(catalogDishes, selectedDishId, weeklyRowsWithBom, dishesById)
  const presentation = useMemo(
    () => buildDishMaterialsPresentation(analyzedDish, menuPrice, {
      customerId,
      priceTier: menuPrice,
      serviceDate,
    }),
    [analyzedDish, customerId, menuPrice, serviceDate],
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
      serviceDate,
      isCatalogEmpty: catalogDishes.length === 0,
    },
  }
}

export type DishMaterialsWorkflow = ReturnType<typeof useDishMaterials>
