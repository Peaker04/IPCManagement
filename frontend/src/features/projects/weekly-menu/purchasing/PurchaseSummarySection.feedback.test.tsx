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
      queryView: { phase: 'error', message: 'Không tải được tổng hợp mua của tuần.', retry, isRetrying: false },
    } as unknown as PurchaseSummaryWorkflow

    render(<PurchaseSummarySection workflow={workflow} />)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'assertive')
    expect(screen.getByText('Không tải được tổng hợp mua của tuần')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('does not render a false empty table while the aggregate is loading', () => {
    const workflow = {
      actions: { retry: vi.fn(), setPage: vi.fn(), setSearch: vi.fn() },
      presentation: {
        customerLabel: 'Khách hàng ANV', weekLabel: '27/07/2026 - 02/08/2026', usesDemand: false,
        totalItems: 0, materialCount: 0, shortageCount: 0, totalCost: 0, pageIndex: 0, demandRows: [], materialRows: [],
      },
      state: { search: '', pageIndex: 0, feedback: null },
      queryView: { phase: 'loading' },
    } as unknown as PurchaseSummaryWorkflow

    render(<PurchaseSummarySection workflow={workflow} />)

    expect(screen.getByText('Đang tải tổng hợp mua của tuần')).toBeInTheDocument()
    expect(screen.queryByText('Chưa có nguyên liệu tổng hợp. Kiểm tra thực đơn tuần và định lượng món ăn.')).not.toBeInTheDocument()
  })

  it('does not reserve the weekly table height when the aggregate is empty', () => {
    const workflow = {
      actions: { retry: vi.fn(), setPage: vi.fn(), setSearch: vi.fn() },
      presentation: {
        customerLabel: 'Khách hàng ANV', weekLabel: '27/07/2026 - 02/08/2026', usesDemand: false,
        totalItems: 0, materialCount: 0, shortageCount: 0, totalCost: 0, pageIndex: 0, demandRows: [], materialRows: [],
      },
      state: { search: '', pageIndex: 0, feedback: null },
      queryView: { phase: 'ready', data: {}, isRefreshing: false, truncation: null },
    } as unknown as PurchaseSummaryWorkflow

    render(<PurchaseSummarySection workflow={workflow} />)

    expect(screen.getByRole('region', { name: 'Bảng BOM dự kiến tổng cả tuần' })).not.toHaveClass('h-[560px]')
  })

  it('keeps current rows visible with passive feedback while refreshing', () => {
    const workflow = {
      actions: { retry: vi.fn(), setPage: vi.fn(), setSearch: vi.fn() },
      presentation: {
        customerLabel: 'Khách hàng ANV', weekLabel: '27/07/2026 - 02/08/2026', usesDemand: true,
        totalItems: 1, materialCount: 0, shortageCount: 1, totalCost: 0, pageIndex: 0,
        demandRows: [{ id: 'line-1', serviceDate: '2026-07-27', material: 'Gạo', source: 'Cơm', required: 10, available: 2, reserved: 0, unit: 'kg', tone: 'danger', status: 'Thiếu', nextAction: 'Mua' }],
        materialRows: [],
      },
      state: { search: '', pageIndex: 0, feedback: null },
      queryView: { phase: 'ready', data: {}, isRefreshing: true, truncation: null },
    } as unknown as PurchaseSummaryWorkflow

    render(<PurchaseSummarySection workflow={workflow} />)

    expect(screen.getByText('Đang cập nhật tổng hợp tuần')).toHaveAttribute('role', 'status')
    expect(screen.getByText('Gạo')).toBeInTheDocument()
  })
})
