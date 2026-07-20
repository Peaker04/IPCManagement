import { describe, expect, it } from 'vitest'
import type { CatalogDish } from '@/features/projects/dishCatalogApi'
import type { KitchenIssueRow } from '@/features/workflow'
import { buildChefProductionPlan, filterKitchenIssues, mapDailyPlanLines } from './chefProductionModel'

const issue = (id: string, shiftName: string): KitchenIssueRow => ({
  id,
  issueId: `issue-${id}`,
  issueCode: `PX-${id}`,
  issueDate: '2026-07-19',
  shiftName,
  warehouseId: 'warehouse-1',
  warehouse: 'Kho chính',
  ingredientId: `ingredient-${id}`,
  ingredient: 'Gạo',
  unitId: 'kg',
  unit: 'kg',
  requestedQty: 10,
  issuedQty: 9,
  isReceivedByKitchen: false,
  receiptStatus: 'PENDING',
})

describe('chef production model', () => {
  it('maps API plans into stable table lines', () => {
    expect(mapDailyPlanLines({
      serviceDate: '2026-07-19', totalPlans: 1, sentPlans: 1, totalDishes: 1,
      totalServings: 50, totalRequiredQty: 10, suggestedPurchaseQty: 2, warnings: [],
      plans: [{
        planId: 'plan-1', planCode: 'KHSX-001', planDate: '2026-07-19', customerName: 'Nhà máy A',
        sentToKitchenAt: '2026-07-19T06:00:00Z', lines: [{
          planLineId: 'line-1', dishId: 'dish-1', totalServings: 50, totalRequiredQty: 10,
          suggestedPurchaseQty: 2, hasKitchenIssue: true, isReceivedByKitchen: false,
        }],
      }],
    })[0]).toMatchObject({ planCode: 'KHSX-001', customerName: 'Nhà máy A', planLineId: 'line-1' })
  })

  it('uses selected-shift issues and falls back to all rows when no shift matches', () => {
    const rows = [issue('morning', 'MORNING'), issue('afternoon', 'AFTERNOON')]
    expect(filterKitchenIssues(rows, 'Ca Sáng').map((row) => row.id)).toEqual(['morning'])
    expect(filterKitchenIssues([issue('night', 'NIGHT')], 'Ca Sáng').map((row) => row.id)).toEqual(['night'])
  })

  it('prefers live issue materials while preserving dish and meal mapping', () => {
    const dishes: CatalogDish[] = [{
      id: 'dish-1', code: 'MON-01', name: 'Cơm', isActive: true, menuSlots: [],
      ingredients: [{
        bomId: 'bom-1', ingredientId: 'rice', ingredientCode: 'GAO', unitId: 'kg',
        priceTierAmount: 35000, bomScope: 'STANDARD', name: 'Gạo', unit: 'kg',
        grossQtyPerServing: 0.1, wasteRatePercent: 0, bomStatus: 'ACTIVE',
        bomStatusLabel: 'Đang dùng', referencePrice: 10000, effectiveFrom: '2026-01-01',
      }],
    }]
    const plan = buildChefProductionPlan({
      orders: [{ dayOfWeek: 'sun', shift: 'Ca Sáng', dishId: 'dish-1', forecastQuantity: 10, actualQuantity: 8 }],
      catalogDishes: dishes,
      kitchenIssues: [issue('morning', 'MORNING')],
      signedMaterials: {},
      activeDay: 'sun', activeShift: 'Ca Sáng', isLocked: true, menuPrice: 35000, lossRate: 0,
    })
    expect(plan.totalMeals).toBe(8)
    expect(plan.activeDishes[0]).toMatchObject({ id: 'dish-1', name: 'Cơm' })
    expect(plan.receivedMaterials[0]).toMatchObject({ id: 'morning', quantity: 9, status: 'Đã nhận' })
  })
})
