import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  role: 'quanly',
  review: vi.fn(),
  execute: vi.fn(),
}))

vi.mock('@/lib/useHasRole', () => ({
  useHasRole: (roles: string[]) => roles.includes(mocks.role),
}))
vi.mock('@/api/coordinationApi', () => ({
  useGetMenuAmendmentsQuery: () => ({
    data: { data: [{ menuAmendmentId: 'amend-1', customerName: 'Công ty ANV', weekStartDate: '2026-09-14', createdAt: '2026-09-12T08:00:00Z', status: mocks.role === 'admin' ? 'APPROVED_FOR_EXECUTION' : 'PENDING_REVIEW', reason: 'Đổi món theo yêu cầu khách hàng', requiresReconciliation: false, affectedDemandCount: 2, affectedPurchaseRequestCount: 1 }] },
    isLoading: false, isError: false, refetch: vi.fn(),
  }),
  useReviewMenuAmendmentMutation: () => [mocks.review, { isLoading: false }],
  useExecuteMenuAmendmentMutation: () => [mocks.execute, { isLoading: false }],
}))

import { MenuAmendmentInbox } from './MenuAmendmentInbox'

describe('MenuAmendmentInbox actor ownership', () => {
  beforeEach(() => {
    mocks.role = 'quanly'
    mocks.review.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
    mocks.execute.mockReset().mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
  })

  it('lets Manager review but does not expose Admin execution', () => {
    render(<MenuAmendmentInbox />)
    fireEvent.click(screen.getByRole('button', { name: 'Xử lý' }))
    expect(screen.getByRole('button', { name: 'Duyệt' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thực thi' })).toBeNull()
  })

  it('keeps reject available and focuses its field-local validation', async () => {
    render(<MenuAmendmentInbox />)
    fireEvent.click(screen.getByRole('button', { name: 'Xử lý' }))
    const reject = screen.getByRole('button', { name: 'Từ chối' })
    expect(reject).toBeEnabled()
    fireEvent.click(reject)
    expect(await screen.findByText('Nhập lý do từ chối.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('textbox', { name: /Lý do khi từ chối/ })).toHaveFocus())
    expect(mocks.review).not.toHaveBeenCalled()
  })

  it('lets Admin execute an approved amendment but does not review it', () => {
    mocks.role = 'admin'
    render(<MenuAmendmentInbox />)
    fireEvent.click(screen.getByRole('button', { name: 'Xử lý' }))
    expect(screen.getByRole('button', { name: 'Thực thi' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull()
  })
})
