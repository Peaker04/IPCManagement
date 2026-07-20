import { describe, expect, it } from 'vitest'
import type { DemandLine } from '@/features/workflow'
import { buildPurchaseSummaryPresentation, buildWarehouseCsv } from './purchaseSummaryModel'

describe('purchase summary model', () => {
  it('clamps client paging and reports shortages from backend demand', () => {
    const line = { required: 10, available: 4, reserved: 1 } as DemandLine
    const result = buildPurchaseSummaryPresentation({}, [line], [line], 99)
    expect(result.pageIndex).toBe(0)
    expect(result.shortageCount).toBe(1)
    expect(result.usesDemand).toBe(true)
  })

  it('creates an Excel-friendly warehouse CSV and escapes material names', () => {
    const csv = buildWarehouseCsv({ 'fish|kg': { ingredientId: 'fish', ingredientName: 'Cá "thu"', unitId: 'kg', theory: 1, actual: 1.2, unit: 'kg', referencePrice: 50_000, dishNames: [] } }, 'KH01', '2026-07-20')
    expect(csv?.startsWith('\uFEFFTuần,')).toBe(true)
    expect(csv).toContain('"Cá ""thu"""')
    expect(csv).toContain('"60000"')
  })
})
