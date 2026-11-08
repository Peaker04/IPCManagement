import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ServiceRunReportPanel } from './ServiceRunReportPanel'

const mocks = vi.hoisted(() => ({ query: vi.fn() }))

vi.mock('@/api/chefApi', () => ({ useGetServiceRunPageQuery: mocks.query }))
vi.mock('@/lib/auth/authStorage', () => ({ readStoredAuthSnapshot: () => ({ user: { id: 'admin' } }) }))

describe('ServiceRunReportPanel initial loading geometry', () => {
  beforeEach(() => mocks.query.mockReturnValue({ data: undefined, isLoading: true, isFetching: true, isError: false, refetch: vi.fn() }))

  it('defers the expanding report section until its first page is ready', () => {
    render(<ServiceRunReportPanel dateFrom="" dateTo="" shiftName="" />)

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải Ca phục vụ')
    expect(screen.getByRole('status')).toHaveClass('sr-only')
    expect(screen.queryByRole('heading', { name: 'Ca phục vụ và chứng từ nguồn' })).toBeNull()
  })
})
