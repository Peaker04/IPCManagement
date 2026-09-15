import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
    expect(screen.getByRole('searchbox', { name: 'Tìm nguyên liệu trong tuần của khách hàng đang chọn' })).toBeDisabled()
    expect(screen.getByText('Khách hàng ANV').closest('[aria-hidden="true"]')).toHaveAttribute('inert')
    const retainedEmptyState = screen.getByText('Chưa có nguyên liệu tổng hợp. Kiểm tra thực đơn tuần và định lượng món ăn.').closest('[aria-hidden="true"]')
    expect(retainedEmptyState).toHaveAttribute('inert')
    expect(retainedEmptyState).toHaveClass('invisible')
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

    expect(screen.getByRole('heading', { name: 'Bàn giao nguyên liệu' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xem hướng dẫn' }))
    expect(screen.getByText('Theo dõi lượng đã xuất, chờ Bếp nhận và đã nhận theo ngày.')).toBeInTheDocument()
    expect(screen.queryByText('Tổng hợp nhu cầu nguyên liệu')).toBeNull()
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

  it('presents concise status labels and clean action links without overflow', () => {
    const workflow = {
      actions: { retry: vi.fn(), setPage: vi.fn(), setSearch: vi.fn() },
      presentation: {
        customerLabel: 'Khách hàng ANV', weekLabel: '27/07/2026 - 02/08/2026', usesDemand: true,
        totalItems: 3, materialCount: 0, shortageCount: 1, totalCost: 0, pageIndex: 0,
        demandRows: [
          { id: 'line-1', serviceDate: '2026-07-27', material: 'Bầu', source: 'Canh', required: 50, available: 10, reserved: 0, unit: 'kg', tone: 'danger', status: 'Còn thiếu nguyên liệu', nextAction: 'Mở thu mua', actionHref: '/purchasing?date=2026-07-27' },
          { id: 'line-2', serviceDate: '2026-07-27', material: 'Cà chua', source: 'Xào', required: 30, available: 30, reserved: 0, unit: 'kg', tone: 'success', status: 'Đã đáp ứng đủ', nextAction: 'Đã hoàn tất' },
          { id: 'line-3', serviceDate: '2026-07-27', material: 'Thịt bằm', source: 'Kho', required: 20, available: 10, reserved: 0, unit: 'kg', tone: 'warning', status: 'Chờ bếp xác nhận', nextAction: 'Mở nhận hàng', actionHref: '/chef-dashboard?date=2026-07-27' },
        ],
        materialRows: [],
      },
      state: { search: '', pageIndex: 0, feedback: null },
      queryView: { phase: 'ready', data: {}, isRefreshing: false, truncation: null },
    } as unknown as PurchaseSummaryWorkflow

    render(
      <MemoryRouter>
        <PurchaseSummarySection workflow={workflow} />
      </MemoryRouter>
    )

    // Nhãn dài được rút gọn súc tích
    expect(screen.getByText('Thiếu hàng')).toBeInTheDocument()
    expect(screen.queryByText('Còn thiếu nguyên liệu')).not.toBeInTheDocument()
    expect(screen.getByText('Đủ hàng')).toBeInTheDocument()
    expect(screen.getByText('Chờ nhận')).toBeInTheDocument()

    // Action links render gọn gàng
    const purchaseLink = screen.getByRole('link', { name: /Mở thu mua/ })
    expect(purchaseLink).toHaveAttribute('href', '/purchasing?date=2026-07-27')
    expect(purchaseLink).not.toHaveClass('ipc-button-primary')

    const finishedSpan = screen.getByText('Đã hoàn tất')
    expect(finishedSpan.tagName).toBe('SPAN')
  })
})
