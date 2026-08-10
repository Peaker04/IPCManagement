import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('opens the customer options returned by the query', async () => {
    const user = userEvent.setup()
    render(
      <WeeklyMenuCommandBar
        customers={[{ customerId: 'customer-1', customerCode: 'ANV', customerName: 'AMANN' }]}
        selectedCustomerId=""
        weekStartDate=""
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
    await user.click(trigger)
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'))

    expect(await screen.findByRole('option', { name: 'ANV - AMANN' })).toBeVisible()
  })
})

it('offers a guarded publish action for a draft weekly menu', async () => {
  const user = userEvent.setup()
  const onPublish = vi.fn()

  render(
    <WeeklyMenuCommandBar
      customers={[{ customerId: 'customer-1', customerCode: 'ANV', customerName: 'Nhà máy An Việt' }]}
      selectedCustomerId="customer-1"
      weekStartDate="2026-08-03"
      isCustomerLoading={false}
      isImporting={false}
      canPublish
      onPublish={onPublish}
      onEdit={vi.fn()}
      onImport={vi.fn()}
      onExport={vi.fn()}
      onCustomerChange={vi.fn()}
      onWeekChange={vi.fn()}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Xuất bản tuần' }))
  expect(onPublish).toHaveBeenCalledTimes(1)
})
