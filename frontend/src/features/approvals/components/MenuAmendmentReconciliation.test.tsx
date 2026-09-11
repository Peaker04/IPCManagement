import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  execute: vi.fn(),
  decisionHook: vi.fn(),
  decisionQuery: { data: undefined as unknown, isError: false, isLoading: false, refetch: vi.fn() },
}))

vi.mock('@/api/coordinationApi', () => ({
  useGetCoordinationCustomersQuery: () => ({ data: { data: [{ customerId: 'anv', customerCode: 'ANV', customerName: 'Công ty ANV' }, { customerId: 'dav', customerCode: 'DAV', customerName: 'Công ty DAV' }] } }),
  useGetMenuAmendmentDecisionPageQuery: (...args: unknown[]) => { mocks.decisionHook(...args); return mocks.decisionQuery },
  useExecuteMenuAmendmentDecisionMutation: () => [mocks.execute, { isLoading: false }],
}))

import { MenuAmendmentReconciliation } from './MenuAmendmentReconciliation'

const item = {
  decisionItemId: 'decision-1', menuAmendmentId: 'amendment-1', customerId: 'anv', customerName: 'ANV', serviceDate: '2026-08-17', shiftName: 'MORNING', priceTierAmount: 35000,
  documentIds: ['PO-01'], sourceLineIds: ['source-01'], reason: 'Đã phát sinh đơn mua', accountableRole: 'Quản trị', dueAt: '2026-08-18T09:00:00Z', status: 'OPEN', version: 0, allowedActions: ['APPEND_CORRECTION'],
}

describe('MenuAmendmentReconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.decisionQuery = { data: undefined, isError: false, isLoading: false, refetch: mocks.refetch }
  })

  it('waits for a customer scope and uses one compact dropdown', () => {
    render(<MenuAmendmentReconciliation />)

    expect(mocks.decisionHook).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: undefined, allCustomers: false }),
      { skip: true },
    )
    expect(screen.getByLabelText('Khách hàng')).toHaveDisplayValue('Chọn khách hàng')
    expect(screen.getByText('Chọn khách hàng để xem yêu cầu cần xử lý.')).toBeInTheDocument()
    expect(screen.queryByText('Cần quyết định')).not.toBeInTheDocument()
  })

  it('filters by customer and presents domain language only', () => {
    mocks.decisionQuery = { data: { data: { items: [item], page: 1, pageSize: 20, totalCount: 1 } }, isError: false, isLoading: false, refetch: mocks.refetch }
    render(<MenuAmendmentReconciliation />)

    fireEvent.change(screen.getByLabelText('Khách hàng'), { target: { value: 'anv' } })
    expect(mocks.decisionHook).toHaveBeenLastCalledWith(expect.objectContaining({ customerId: 'anv', allCustomers: false }), { skip: false })
    expect(screen.getByText(/35.000/)).toBeInTheDocument()
    expect(screen.getByText('1 dòng chứng từ')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent(/tier|source-line|append-only/i)
  })

  it('keeps the server action token internal while showing a human action label', async () => {
    mocks.execute.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    mocks.decisionQuery = { data: { data: { items: [item], page: 1, pageSize: 20, totalCount: 1 } }, isError: false, isLoading: false, refetch: mocks.refetch }
    render(<MenuAmendmentReconciliation />)

    fireEvent.change(screen.getByLabelText('Khách hàng'), { target: { value: 'anv' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }))
    fireEvent.change(screen.getByLabelText('Lý do điều chỉnh'), { target: { value: 'Đã đối soát.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận điều chỉnh' }))

    await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ action: 'APPEND_CORRECTION', reason: 'Đã đối soát.' })))
  })
})
