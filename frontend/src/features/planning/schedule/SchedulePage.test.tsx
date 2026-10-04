import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SchedulePage } from './SchedulePage'
import type { SchedulePageModel } from './schedulePageModel'

const model: SchedulePageModel = {
  identity: { title: 'Kế hoạch tuần', customerLabel: 'ANV - AMANN', weekLabel: '21/09/2026', lifecycle: 'Đã xuất bản' },
  pricing: { tier: 30000, source: 'Hợp đồng' },
  scope: { customers: [{ customerId: 'customer-1', customerCode: 'ANV', customerName: 'AMANN' }], customerId: 'customer-1', weekStartDate: '2026-09-21' },
  commands: { canImport: true, canEdit: true, canPublish: false },
  state: { kind: 'ready', rows: [{ key: 'main', firstIndex: 0, sourceSection: 'MENU MẶN CA SÁNG', slot: 'main', slotLabel: 'Món mặn 1', cells: {} }] },
  matrix: { displayDays: [{ key: 'monday', label: 'Thứ Hai', date: '21/09/2026' }] },
}

it('renders one fact owner, one command locus, and no legacy readiness or tabs', () => {
  render(<SchedulePage model={model} onCustomerChange={vi.fn()} onWeekChange={vi.fn()} onImport={vi.fn()} onEdit={vi.fn()} onPublish={vi.fn()} onRetry={vi.fn()} />)

  const main = screen.getByRole('main')
  expect(within(main).getByRole('heading', { level: 1, name: 'Kế hoạch tuần' })).toBeInTheDocument()
  expect(within(main).getByText('Đã xuất bản')).toBeInTheDocument()
  expect(within(main).getByRole('combobox', { name: 'Khách hàng' })).toHaveValue('customer-1')
  expect(within(main).getByLabelText('Tuần bắt đầu')).toHaveValue('21/09/2026')
  expect(within(main).getByLabelText('Định mức thực đơn')).toHaveTextContent('30k · Hợp đồng')
  expect(within(main).queryByLabelText('Tóm tắt kế hoạch')).not.toBeInTheDocument()
  expect(within(main).getByRole('button', { name: 'Nhập Excel' })).toBeEnabled()
  expect(within(main).getByRole('button', { name: 'Chỉnh sửa' })).toBeEnabled()
  expect(within(main).queryByText('Bản xem trước FE mới')).not.toBeInTheDocument()
  expect(within(main).queryByText(/MỨC SẴN SÀNG/i)).not.toBeInTheDocument()
  expect(within(main).queryByRole('tablist')).not.toBeInTheDocument()
  expect(within(main).getAllByRole('table')).toHaveLength(4)
  for (const name of ['Trưa · Mặn', 'Trưa · Chay', 'Tối · Mặn', 'Tối · Chay']) expect(within(main).getByRole('region', { name })).toBeInTheDocument()
})

it('replaces the matrix with the prerequisite state', () => {
  render(<SchedulePage model={{ ...model, scope: { ...model.scope, customerId: '', weekStartDate: '' }, commands: { ...model.commands, canEdit: false }, state: { kind: 'prerequisite' } }} onCustomerChange={vi.fn()} onWeekChange={vi.fn()} onImport={vi.fn()} onEdit={vi.fn()} onPublish={vi.fn()} onRetry={vi.fn()} />)
  expect(screen.getByText('Chọn khách hàng và tuần để bắt đầu')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Nhập Excel' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Chỉnh sửa' })).toBeDisabled()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})
