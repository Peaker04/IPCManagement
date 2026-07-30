import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PurchaseSummarySection from './PurchaseSummarySection'
import type { PurchaseSummaryWorkflow } from './usePurchaseSummary'

describe('PurchaseSummarySection query feedback', () => {
  it('uses the canonical retryable query alert without changing the retry action', () => {
    const retry = vi.fn()
    const workflow = {
      actions: { retry, setPage: vi.fn(), setSearch: vi.fn() },
      presentation: {
        customerLabel: 'Khách hàng ANV',
        weekLabel: '27/07/2026 - 02/08/2026',
        usesDemand: true,
        totalItems: 0,
        materialCount: 0,
        shortageCount: 0,
        totalCost: 0,
        pageIndex: 0,
        demandRows: [],
        materialRows: [],
      },
      state: { search: '', pageIndex: 0, feedback: null },
      status: { isError: true, isLoading: false, isFetching: false },
    } as unknown as PurchaseSummaryWorkflow

    render(<PurchaseSummarySection workflow={workflow} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByText('Không tải được tổng hợp mua của tuần')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
