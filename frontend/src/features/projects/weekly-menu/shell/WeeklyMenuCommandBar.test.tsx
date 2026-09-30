import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { WeeklyMenuCommandBar } from './WeeklyMenuCommandBar'

const baseProps = {
  customers: [{ customerId: 'customer-1', customerCode: 'ANV', customerName: 'Nhà máy An Việt' }],
  selectedCustomerId: 'customer-1',
  weekStartDate: '2026-07-27',
  isCustomerLoading: false,
  onCustomerChange: vi.fn(),
  onWeekChange: vi.fn(),
}

it('shows the selected customer label instead of its id in the closed trigger', () => {
  render(<WeeklyMenuCommandBar {...baseProps} />)
  const trigger = screen.getByRole('combobox')
  expect(trigger).toHaveTextContent('ANV - Nhà máy An Việt')
  expect(trigger).not.toHaveTextContent('customer-1')
})

it('keeps the active week independent from customer selection', async () => {
  const user = userEvent.setup()
  const onCustomerChange = vi.fn()
  const onWeekChange = vi.fn()
  render(<WeeklyMenuCommandBar {...baseProps} selectedCustomerId="" weekStartDate="2026-08-10" onCustomerChange={onCustomerChange} onWeekChange={onWeekChange} />)

  await user.selectOptions(screen.getByRole('combobox'), 'customer-1')

  expect(onCustomerChange).toHaveBeenCalledWith('customer-1')
  expect(onWeekChange).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Tuần bắt đầu')).toHaveValue('10/08/2026')
})

it('keeps warehouse export in the legacy handover command bar', () => {
  const { rerender } = render(<WeeklyMenuCommandBar {...baseProps} onExport={undefined} />)
  expect(screen.queryByRole('button', { name: 'Xuất báo cáo gửi kho' })).not.toBeInTheDocument()

  rerender(<WeeklyMenuCommandBar {...baseProps} onExport={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Xuất báo cáo gửi kho' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nhập Excel' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Chỉnh sửa lịch tuần' })).not.toBeInTheDocument()
})
