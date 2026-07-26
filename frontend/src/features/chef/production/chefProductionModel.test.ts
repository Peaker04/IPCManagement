import { describe, expect, it } from 'vitest'
import type { CatalogDish } from '@/features/projects/dishCatalogApi'
import type { KitchenIssueRow } from '@/features/workflow'
import { buildChefProductionPlan, filterKitchenIssues, mapDailyPlanLines } from './chefProductionModel'

const issue = (id: string, shiftName: string, issueDate = '2026-07-19'): KitchenIssueRow => ({
  id,
  issueId: `issue-${id}`,
  issueCode: `PX-${id}`,
  issueDate,
  shiftName,
  warehouseId: 'warehouse-1',
  warehouse: 'Kho chính',
  materialRequestId: 'material-request-1',
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

  it('keeps only issues for the selected service date and shift', () => {
    const rows = [
      issue('morning', 'MORNING'),
      issue('afternoon', 'AFTERNOON'),
      issue('previous-day', 'MORNING', '2026-07-18'),
    ]
    expect(filterKitchenIssues(rows, '2026-07-19', 'Ca Sáng').map((row) => row.id)).toEqual(['morning'])
  })

  it('returns no issues when the selected date and shift have no match', () => {
    expect(filterKitchenIssues([issue('night', 'NIGHT')], '2026-07-19', 'Ca Sáng')).toEqual([])
    expect(filterKitchenIssues([issue('other-day', 'MORNING', '2026-07-18')], '2026-07-19', 'Ca Sáng')).toEqual([])
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
      activeDay: 'sun', activeShift: 'Ca Sáng', isLocked: true, lossRate: 0,
      serviceDate: '2026-07-19',
    })
    expect(plan.totalMeals).toBe(8)
    expect(plan.activeDishes[0]).toMatchObject({ id: 'dish-1', name: 'Cơm' })
    expect(plan.receivedMaterials[0]).toMatchObject({ id: 'morning', quantity: 9, status: 'Chờ giao' })
    expect(plan.date).toBe('2026-07-19')
  })

  it('never reports planned quantities as materials the kitchen received', () => {
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
      kitchenIssues: [],
      signedMaterials: {},
      activeDay: 'sun', activeShift: 'Ca Sáng', isLocked: true, lossRate: 0,
      serviceDate: '2026-07-19',
    })

    expect(plan.receivedMaterials).toEqual([])
    expect(plan.plannedMaterials).toHaveLength(1)
    expect(plan.plannedMaterials[0]).toMatchObject({ name: 'Gạo', quantity: 0.8, status: 'Chờ giao' })
  })

  it('keeps the meal total at zero instead of substituting the material line count', () => {
    const plan = buildChefProductionPlan({
      orders: [],
      catalogDishes: [],
      kitchenIssues: [issue('morning', 'MORNING'), issue('morning-2', 'MORNING')],
      signedMaterials: {},
      activeDay: 'sun', activeShift: 'Ca Sáng', isLocked: true, lossRate: 0,
      serviceDate: '2026-07-19',
    })

    expect(plan.receivedMaterials).toHaveLength(2)
    expect(plan.totalMeals).toBe(0)
  })

  it('does not merge two ingredients that share a name but differ in id or unit', () => {
    const dishes: CatalogDish[] = [{
      id: 'dish-1', code: 'MON-01', name: 'Canh', isActive: true, menuSlots: [],
      ingredients: [
        {
          bomId: 'bom-1', ingredientId: 'muoi-hat', ingredientCode: 'MUOI-1', unitId: 'kg',
          priceTierAmount: 35000, bomScope: 'STANDARD', name: 'Muối', unit: 'kg',
          grossQtyPerServing: 1, wasteRatePercent: 0, bomStatus: 'ACTIVE',
          bomStatusLabel: 'Đang dùng', referencePrice: 1000, effectiveFrom: '2026-01-01',
        },
        {
          bomId: 'bom-2', ingredientId: 'muoi-tinh', ingredientCode: 'MUOI-2', unitId: 'thung',
          priceTierAmount: 35000, bomScope: 'STANDARD', name: 'Muối', unit: 'thùng',
          grossQtyPerServing: 2, wasteRatePercent: 0, bomStatus: 'ACTIVE',
          bomStatusLabel: 'Đang dùng', referencePrice: 5000, effectiveFrom: '2026-01-01',
        },
      ],
    }]
    const plan = buildChefProductionPlan({
      orders: [{ dayOfWeek: 'sun', shift: 'Ca Sáng', dishId: 'dish-1', forecastQuantity: 1, actualQuantity: 1 }],
      catalogDishes: dishes,
      kitchenIssues: [],
      signedMaterials: {},
      activeDay: 'sun', activeShift: 'Ca Sáng', isLocked: true, lossRate: 0,
      serviceDate: '2026-07-19',
    })

    expect(plan.plannedMaterials).toHaveLength(2)
    expect(plan.plannedMaterials.map((material) => `${material.quantity} ${material.unit}`).sort())
      .toEqual(['1 kg', '2 thùng'])
  })

  it('uses server daily-plan dishes and meal totals after a page reload', () => {
    const dishes: CatalogDish[] = [{
      id: 'dish-1', code: 'MON-01', name: 'Cơm', isActive: true, menuSlots: [], ingredients: [],
    }]
    const plan = buildChefProductionPlan({
      orders: [],
      catalogDishes: dishes,
      kitchenIssues: [],
      signedMaterials: {},
      activeDay: 't2',
      activeShift: 'Ca Sáng',
      isLocked: true,
      lossRate: 0,
      serviceDate: '2026-07-20',
      dailyTotalServings: 840,
      dailyPlanLines: [{
        planLineId: 'line-1',
        planCode: 'KHSX-001',
        dishId: 'dish-1',
        dishName: 'Cơm',
        shiftName: 'MORNING',
        totalServings: 840,
        totalRequiredQty: 10,
        suggestedPurchaseQty: 0,
        hasKitchenIssue: false,
        isReceivedByKitchen: true,
      }],
    })

    expect(plan.totalMeals).toBe(840)
    expect(plan.activeDishes).toHaveLength(1)
    expect(plan.activeDishes[0]).toMatchObject({ id: 'dish-1', name: 'Cơm' })
  })
})
