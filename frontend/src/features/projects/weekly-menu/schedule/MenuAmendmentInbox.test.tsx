import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
}))

vi.mock('@/api/coordinationApi', () => ({
  useGetMenuAmendmentsQuery: () => ({ data: undefined, isError: true, isLoading: false, refetch: mocks.refetch }),
  useReviewMenuAmendmentMutation: () => [vi.fn(), { isLoading: false }],
  useExecuteMenuAmendmentMutation: () => [vi.fn(), { isLoading: false }],
  useBreakGlassExecuteMenuAmendmentMutation: () => [vi.fn(), { isLoading: false }],
}))

import { MenuAmendmentInbox } from './MenuAmendmentInbox'

describe('MenuAmendmentInbox', () => {
  beforeEach(() => mocks.refetch.mockReset())

  it('does not present a failed amendment query as an empty inbox', () => {
    render(<MenuAmendmentInbox />)

    expect(screen.getByRole('alert')).toHaveTextContent('Không thể kết luận chưa có yêu cầu thay đổi.')
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(mocks.refetch).toHaveBeenCalledOnce()
  })
})
