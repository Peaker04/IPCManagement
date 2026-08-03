import { describe, expect, it } from 'vitest'
import { buildWeeklyMenuImportBatchFormData } from '@/api/coordinationApi'

describe('weekly menu atomic batch form data', () => {
  it('keeps every positional field aligned with its workbook', () => {
    const first = new File(['first'], 'first.xlsx')
    const second = new File(['second'], 'second.xlsx')

    const form = buildWeeklyMenuImportBatchFormData([
      {
        file: first,
        customerId: 'customer-1',
        weekStartDate: '2026-08-03',
        priceTierAmount: 25_000,
        previewToken: 'token-1',
      },
      {
        file: second,
        customerId: 'customer-2',
        weekStartDate: '2026-08-10',
        priceTierAmount: 30_000,
        previewToken: 'token-2',
      },
    ])

    expect(form.getAll('files')).toEqual([first, second])
    expect(form.getAll('customerIds')).toEqual(['customer-1', 'customer-2'])
    expect(form.getAll('weekStartDates')).toEqual(['2026-08-03', '2026-08-10'])
    expect(form.getAll('priceTierAmounts')).toEqual(['25000', '30000'])
    expect(form.getAll('previewTokens')).toEqual(['token-1', 'token-2'])
  })
})
