import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChefProductionSection } from './ChefProductionSection'

const line = {
  planLineId: 'line-1',
  planCode: 'KHSX-001',
  customerName: 'Khách A',
  dishName: 'Cơm gà',
  shiftName: 'MORNING',
  totalServings: 120,
  priceTierAmount: 25000,
  bomScope: 'customer',
  suggestedPurchaseQty: 12,
  sentToKitchenAt: '2026-09-17T01:00:00Z',
} as never

describe('ChefProductionSection composition', () => {
  it('composes plan/customer and dish/shift into six decision columns', () => {
    render(<ChefProductionSection lines={[line]} isLoading={false} isError={false} totalPlans={1} sentPlans={1} />)

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader')).toHaveLength(6)
    expect(within(table).getByRole('columnheader', { name: 'Kế hoạch / khách hàng' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Món / ca' })).toBeInTheDocument()
    expect(within(table).getByText('KHSX-001')).toBeInTheDocument()
    expect(within(table).getByText('Khách A')).toBeInTheDocument()
    expect(within(table).getByText('Cơm gà')).toBeInTheDocument()
    expect(within(table).getByText('Ca sáng')).toBeInTheDocument()
    expect(within(table).getByText('120')).toBeInTheDocument()
  })
})
