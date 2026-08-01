import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WeeklyMenuCommandBar } from './WeeklyMenuCommandBar'

describe('WeeklyMenuCommandBar select labels', () => {
  it('shows the selected customer label instead of its id in the closed trigger', () => {
    render(
      <WeeklyMenuCommandBar
        customers={[{ customerId: 'customer-1', customerCode: 'ANV', customerName: 'Nhà máy An Việt' }]}
        selectedCustomerId="customer-1"
        weekStartDate="2026-07-27"
        isCustomerLoading={false}
        isImporting={false}
        onEdit={vi.fn()}
        onImport={vi.fn()}
        onExport={vi.fn()}
        onCustomerChange={vi.fn()}
        onWeekChange={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('ANV - Nhà máy An Việt')
    expect(trigger).not.toHaveTextContent('customer-1')
  })
})
