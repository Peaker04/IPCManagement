import { describe, expect, it } from 'vitest'
import { mapDemandAggregateLine } from './reportMappers'

describe('ingredient demand aggregate presentation', () => {
  it('keeps customer and price tier in the daily aggregate identity and source label', () => {
    const line = mapDemandAggregateLine({
      requestDate: '2026-07-29',
      customerId: 'customer-b',
      customerCode: 'B',
      customerName: 'Nhà máy B',
      priceTierAmount: 30_000,
      ingredientId: 'baking-powder',
      ingredientName: 'Bột nở',
      unitId: 'kg',
      unitName: 'kg',
      totalRequiredQty: 5.5233,
      currentStockQty: 10,
      suggestedPurchaseQty: 0,
      fulfilledQty: 5.5233,
      pendingKitchenReceiptQty: 0,
      unissuedQty: 0,
      outstandingQty: 0,
      fulfillmentStatus: 'FULFILLED',
      lineCount: 2,
      hasCancelledLine: false,
    })

    expect(line.id).toBe('aggregate-2026-07-29-customer-b-30000-baking-powder-kg')
    expect(line.priceTierAmount).toBe(30_000)
    expect(line.source).toBe('Nhà máy B · 30k · 2 dòng nhu cầu')
    expect(line.required).toBe(5.5233)
  })

  it('routes issued material awaiting receipt to the kitchen instead of calling it a shortage', () => {
    const line = mapDemandAggregateLine({
      requestDate: '2026-08-15',
      customerId: 'customer-anv',
      customerCode: 'ANV',
      customerName: 'AMANN',
      priceTierAmount: 25_000,
      ingredientId: 'minced-pork',
      ingredientName: 'Thịt bằm',
      unitId: 'kg',
      unitName: 'kg',
      totalRequiredQty: 5.21154,
      currentStockQty: 5,
      suggestedPurchaseQty: 2.21154,
      fulfilledQty: 2.21154,
      pendingKitchenReceiptQty: 3,
      unissuedQty: 0,
      outstandingQty: 3,
      fulfillmentStatus: 'IN_PROGRESS',
      lineCount: 4,
      hasCancelledLine: false,
    })

    expect(line.status).toBe('Chờ bếp xác nhận')
    expect(line.nextAction).toBe('Mở checklist nhận nguyên liệu')
    expect(line.actionHref).toBe('/chef-dashboard?date=2026-08-15')
    expect(line.tone).toBe('warning')
    expect(line.available).toBeCloseTo(5.21154, 6)
  })
})
