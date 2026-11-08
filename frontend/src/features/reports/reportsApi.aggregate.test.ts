import { describe, expect, it } from 'vitest'
import { mapDemandAggregateLine } from '@/api/reportMappers'

describe('ingredient demand aggregate presentation', () => {
  it.each([
    [0, 0, 200, 'Chưa xuất'],
    [80, 0, 120, 'Chưa xuất'],
    [80, 30, 120, 'Chưa xuất'],
    [200, 0, 0, 'Chờ bếp xác nhận'],
    [200, 200, 0, 'Bếp đã nhận'],
  ])('uses gross issue %s / ack %s instead of historical allocation', (issued, received, remaining, status) => {
    const line = mapDemandAggregateLine({
      requestDate: '2026-08-15', customerId: 'customer-a', priceTierAmount: 25000,
      ingredientId: 'rice', unitId: 'kg', totalRequiredQty: 200,
      currentStockQty: 200, suggestedPurchaseQty: 0, fulfilledQty: 200,
      unissuedQty: 0, pendingKitchenReceiptQty: 0, outstandingQty: 0,
      fulfillmentStatus: 'FULFILLED', lineCount: 2, hasCancelledLine: false,
      issuedQty: issued, receivedByKitchenQty: received, remainingToIssueQty: remaining,
    })
    expect(line.available).toBe(issued)
    expect(line.unissuedQty).toBe(remaining)
    expect(line.pendingKitchenReceiptQty).toBe(issued - received)
    expect(line.status).toBe(status)
    expect(line.actionHref).toBeUndefined()
    expect(line.nextAction).not.toMatch(/mua|hoàn tất/i)
    if (remaining > 0 || issued > received) expect(line.tone).not.toBe('success')
  })

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
      issuedQty: 5.5233,
      receivedByKitchenQty: 5.5233,
      remainingToIssueQty: 0,
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

  it('hands issued material to the kitchen actor without inventing a permitted destination', () => {
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
      issuedQty: 5.21154,
      receivedByKitchenQty: 2.21154,
      remainingToIssueQty: 0,
      fulfilledQty: 2.21154,
      pendingKitchenReceiptQty: 3,
      unissuedQty: 0,
      outstandingQty: 3,
      fulfillmentStatus: 'IN_PROGRESS',
      lineCount: 4,
      hasCancelledLine: false,
    })

    expect(line.status).toBe('Chờ bếp xác nhận')
    expect(line.nextAction).toBe('Bếp xác nhận nhận')
    expect(line.actionHref).toBeUndefined()
    expect(line.tone).toBe('warning')
    expect(line.available).toBeCloseTo(5.21154, 6)
  })
})
