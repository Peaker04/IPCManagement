import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  execute: vi.fn(),
  decisionQuery: { data: undefined as unknown, isError: false, isLoading: false, refetch: vi.fn() },
}))

vi.mock('@/api/coordinationApi', () => ({
  useGetCoordinationCustomersQuery: () => ({ data: { data: [{ customerId: 'anv', customerName: 'ANV' }, { customerId: 'dav', customerName: 'DAV' }] } }),
  useGetMenuAmendmentDecisionPageQuery: () => mocks.decisionQuery,
  useExecuteMenuAmendmentDecisionMutation: () => [mocks.execute, { isLoading: false }],
}))

import { MenuAmendmentInbox } from './MenuAmendmentInbox'

const item = {
  decisionItemId: 'decision-1', menuAmendmentId: 'amendment-1', customerId: 'anv', customerName: 'ANV', serviceDate: '2026-08-17', shiftName: 'MORNING', priceTierAmount: 35000,
  documentIds: ['PO-01'], sourceLineIds: ['source-01'], reason: 'Đã phát sinh PO', accountableRole: 'Quản trị', dueAt: '2026-08-18T09:00:00Z', status: 'OPEN', version: 0, allowedActions: ['APPEND_CORRECTION'],
}

describe('MenuAmendmentInbox', () => {
  beforeEach(() => {
    mocks.refetch.mockReset()
    mocks.execute.mockReset()
    mocks.decisionQuery = { data: undefined, isError: false, isLoading: false, refetch: mocks.refetch }
  })

  it('does not present a failed amendment query as an empty inbox', () => {
    mocks.decisionQuery = { data: undefined, isError: true, isLoading: false, refetch: mocks.refetch }
    render(<MenuAmendmentInbox />)
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể kết luận hàng đợi đang trống.')
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(mocks.refetch).toHaveBeenCalledOnce()
  })

  it('keeps scope columns in All customers and never asks for a ServiceRun ID', () => {
    mocks.decisionQuery = { data: { data: { items: [item], page: 1, pageSize: 20, totalCount: 1 } }, isError: false, isLoading: false, refetch: mocks.refetch }
    render(<MenuAmendmentInbox />)
    fireEvent.click(screen.getByRole('button', { name: 'Tất cả khách hàng' }))
    expect(screen.getByRole('columnheader', { name: 'Khách hàng / phạm vi' })).toBeInTheDocument()
    expect(screen.getByText('ANV')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Ca phục vụ đã đóng/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xem bằng chứng' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('PO-01')
  })

  it('sends only the returned append-only action token with the decision version', async () => {
    mocks.execute.mockReturnValue({ unwrap: () => Promise.resolve({}) })
    mocks.decisionQuery = { data: { data: { items: [item], page: 1, pageSize: 20, totalCount: 1 } }, isError: false, isLoading: false, refetch: mocks.refetch }
    render(<MenuAmendmentInbox />)

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả khách hàng' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xem bằng chứng' }))
    fireEvent.change(screen.getByLabelText('Lý do correction append-only'), { target: { value: 'Đối soát đã xác nhận.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ghi correction append-only' }))

    await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ decisionItemId: 'decision-1', action: 'APPEND_CORRECTION', expectedVersion: 0, reason: 'Đối soát đã xác nhận.' })))
  })
})
