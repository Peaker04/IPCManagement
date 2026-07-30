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
      lineCount: 2,
      hasCancelledLine: false,
    })

    expect(line.id).toBe('aggregate-2026-07-29-customer-b-30000-baking-powder-kg')
    expect(line.priceTierAmount).toBe(30_000)
    expect(line.source).toBe('Nhà máy B · 30k · 2 dòng nhu cầu')
    expect(line.required).toBe(5.5233)
  })
})
