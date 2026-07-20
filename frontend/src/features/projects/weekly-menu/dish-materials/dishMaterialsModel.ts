import type { CatalogDish } from '../../dishCatalogApi'
import { matchesShift } from '../model/scope'
import type { WeeklyPlanRow } from '../model/types'

export const resolveAnalyzedDish = (
  catalogDishes: CatalogDish[],
  selectedDishId: string,
  weeklyRowsWithBom: WeeklyPlanRow[],
  dishesById: Map<string, CatalogDish>,
) => catalogDishes.find((dish) => dish.id === selectedDishId)
  ?? weeklyRowsWithBom.map((row) => dishesById.get(row.dishId)).find(Boolean)
  ?? catalogDishes[0]

export const buildDishMaterialsPresentation = (
  analyzedDish: CatalogDish | undefined,
  menuPrice: number,
) => {
  const ingredients = analyzedDish?.ingredients.map((ingredient) => ({
    name: ingredient.name,
    unit: ingredient.unit,
    theoryQty: ingredient.grossQtyPerServing,
    actualQty: ingredient.grossQtyPerServing,
    supplierPrice: ingredient.referencePrice,
    cost: ingredient.grossQtyPerServing * ingredient.referencePrice,
  })) ?? []
  const totalTrayCost = ingredients.reduce((sum, ingredient) => sum + ingredient.cost, 0)
  const foodCostPercent = menuPrice <= 0 ? 0 : (totalTrayCost / menuPrice) * 100
  return { ingredients, totalTrayCost, foodCostPercent, grossProfit: menuPrice - totalTrayCost }
}

export const groupDishesByShift = (catalogDishes: CatalogDish[]) => ({
  morning: catalogDishes.filter((dish) => matchesShift(dish, 'morning')),
  afternoon: catalogDishes.filter((dish) => matchesShift(dish, 'afternoon')),
})
