import { describe, expect, it } from 'vitest'
import type { CatalogDish } from '@/api/dishCatalogApi'
import type { KitchenIssueRow } from '@/api/workflowApi'
import { buildChefProductionPlan, filterKitchenIssues, mapDailyPlanLines } from './chefProductionModel'

const issue = (id: string, shiftName: string | null, issueDate = '2026-07-19'): KitchenIssueRow => ({
  id,
  issueId: `issue-${id}`,
  issueCode: `PX-${id}`,
  issueDate,
  shiftName: shiftName ?? undefined,
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
        planId: 'plan-1', planCode: 'KHSX-001', planDate: '2026-07-19', customerId: 'customer-1', customerName: 'Nhà máy A',
        sentToKitchenAt: '2026-07-19T06:00:00Z', lines: [{
          planLineId: 'line-1', dishId: 'dish-1', totalServings: 50, totalRequiredQty: 10,
          suggestedPurchaseQty: 2, hasKitchenIssue: true, isReceivedByKitchen: false,
        }],
      }],
    })[0]).toMatchObject({ planCode: 'KHSX-001', customerId: 'customer-1', customerName: 'Nhà máy A', planLineId: 'line-1' })
  })

  it('keeps only issues for the selected service date and shift', () => {
    const sourceScopedAfternoon = issue('source-afternoon', null)
    sourceScopedAfternoon.sourceShiftName = 'AFTERNOON'
    const rows = [
      issue('morning', 'MORNING'),
      issue('afternoon', 'AFTERNOON'),
      issue('full-day-null', null),
      issue('full-day-name', 'FULLDAY'),
      issue('previous-day', 'MORNING', '2026-07-18'),
      sourceScopedAfternoon,
    ]
    expect(filterKitchenIssues(rows, '2026-07-19', 'Ca Sáng').map((row) => row.id))
      .toEqual(['morning', 'full-day-null', 'full-day-name'])
    expect(filterKitchenIssues(rows, '2026-07-19', 'Ca Chiều').map((row) => row.id))
      .toEqual(['afternoon', 'source-afternoon'])
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
        priceTierAmount: 25000, bomScope: 'STANDARD', name: 'Gạo', unit: 'kg',
        grossQtyPerServing: 0.1, wasteRatePercent: 0, bomStatus: 'PUBLISHED',
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
        priceTierAmount: 25000, bomScope: 'STANDARD', name: 'Gạo', unit: 'kg',
        grossQtyPerServing: 0.1, wasteRatePercent: 0, bomStatus: 'PUBLISHED',
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
          priceTierAmount: 25000, bomScope: 'STANDARD', name: 'Muối', unit: 'kg',
          grossQtyPerServing: 1, wasteRatePercent: 0, bomStatus: 'PUBLISHED',
          bomStatusLabel: 'Đang dùng', referencePrice: 1000, effectiveFrom: '2026-01-01',
        },
        {
          bomId: 'bom-2', ingredientId: 'muoi-tinh', ingredientCode: 'MUOI-2', unitId: 'thung',
          priceTierAmount: 25000, bomScope: 'STANDARD', name: 'Muối', unit: 'thùng',
          grossQtyPerServing: 2, wasteRatePercent: 0, bomStatus: 'PUBLISHED',
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

  it('selects exactly one effective BOM tier instead of multiplying all three tiers', () => {
    const shared = {
      ingredientId: 'noodle', ingredientCode: 'BUN', unitId: 'kg', bomScope: 'GLOBAL',
      name: 'Bún', unit: 'kg', wasteRatePercent: 0, bomStatus: 'PUBLISHED',
      bomStatusLabel: 'Đang dùng', referencePrice: 10_000, effectiveFrom: '2026-01-01',
    }
    const dishes: CatalogDish[] = [{
      id: 'bun-moc', code: 'BUN-MOC', name: 'Bún mọc', isActive: true, menuSlots: [],
      ingredients: [
        { ...shared, bomId: 'bom-25', priceTierAmount: 25_000, grossQtyPerServing: 0.25 },
        { ...shared, bomId: 'bom-30', priceTierAmount: 30_000, grossQtyPerServing: 0.3 },
        { ...shared, bomId: 'bom-34', priceTierAmount: 34_000, grossQtyPerServing: 0.34 },
      ],
    }]

    const plan = buildChefProductionPlan({
      orders: [], catalogDishes: dishes, kitchenIssues: [], signedMaterials: {},
      activeDay: 't2', activeShift: 'Ca Sáng', isLocked: true, lossRate: 0,
      serviceDate: '2026-07-20', dailyTotalServings: 100,
      dailyPlanLines: [{
        planLineId: 'line-30', planCode: 'KHSX-30', dishId: 'bun-moc', totalServings: 100,
        priceTierAmount: 30_000, totalRequiredQty: 30, suggestedPurchaseQty: 0,
        hasKitchenIssue: false, isReceivedByKitchen: false,
      }],
    })

    expect(plan.activeDishes[0].ingredients).toEqual([{
      ingredientId: 'noodle', ingredientName: 'Bún', unitId: 'kg', unit: 'kg', grossQty: 30,
    }])
    expect(plan.plannedMaterials).toHaveLength(1)
    expect(plan.plannedMaterials[0].quantity).toBe(30)
  })

  it('keeps the selected BOMs for two customers as separate daily presentation grains', () => {
    const shared = {
      ingredientId: 'pork', ingredientCode: 'HEO', unitId: 'kg', name: 'Thịt heo', unit: 'kg',
      wasteRatePercent: 0, bomStatus: 'PUBLISHED', bomStatusLabel: 'Đang dùng',
      referencePrice: 80_000, effectiveFrom: '2026-01-01',
    }
    const dishes: CatalogDish[] = [{
      id: 'dish-1', code: 'MON-01', name: 'Món chung', isActive: true, menuSlots: [],
      ingredients: [
        { ...shared, bomId: 'global-25', customerId: null, priceTierAmount: 25_000, bomScope: 'GLOBAL', grossQtyPerServing: 0.1 },
        { ...shared, bomId: 'customer-30', customerId: 'customer-2', priceTierAmount: 30_000, bomScope: 'CUSTOMER', grossQtyPerServing: 0.2 },
      ],
    }]

    const plan = buildChefProductionPlan({
      orders: [], catalogDishes: dishes, kitchenIssues: [], signedMaterials: {},
      activeDay: 't2', activeShift: 'Ca Sáng', isLocked: true, lossRate: 0,
      serviceDate: '2026-07-20',
      dailyPlanLines: [
        { planLineId: 'line-1', planCode: 'KHSX-1', customerId: 'customer-1', customerName: 'Khách 25k', dishId: 'dish-1', totalServings: 100, priceTierAmount: 25_000, totalRequiredQty: 10, suggestedPurchaseQty: 0, hasKitchenIssue: false, isReceivedByKitchen: false },
        { planLineId: 'line-2', planCode: 'KHSX-2', customerId: 'customer-2', customerName: 'Khách 30k', dishId: 'dish-1', totalServings: 100, priceTierAmount: 30_000, totalRequiredQty: 20, suggestedPurchaseQty: 0, hasKitchenIssue: false, isReceivedByKitchen: false },
      ],
    })

    expect(plan.totalMeals).toBe(200)
    expect(plan.activeDishes).toHaveLength(2)
    expect(plan.activeDishes).toEqual(expect.arrayContaining([
      expect.objectContaining({ customerName: 'Khách 25k', priceTierAmount: 25_000, portions: 100 }),
      expect.objectContaining({ customerName: 'Khách 30k', priceTierAmount: 30_000, portions: 100 }),
    ]))
    expect(plan.activeDishes.map((dish) => dish.ingredients[0]?.grossQty).sort((a, b) => a - b)).toEqual([10, 20])
    expect(plan.plannedMaterials).toHaveLength(2)
  })
})
