import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProductionPlanSection } from './ProductionPlanSection'
import type { WeeklyProductionPlanWorkflow } from './useWeeklyProductionPlan'

const retry = vi.fn()

const buildWorkflow = (isError: boolean) => ({
  scope: {
    customerId: 'customer-1',
    customerLabel: 'KH01 - Khách hàng A',
    weekStartDate: '2026-07-20',
    weekLabel: '20/07/2026 - 26/07/2026',
    menuPrice: 30000,
    fixedBomRatePercent: 100,
    activeServiceLabel: 'Thứ 2 - 20/07/2026',
    activeDayKey: 't2',
    displayDays: [{ key: 't2', label: 'Thứ 2', date: '20/07/2026' }],
  },
  state: { selectedDayKey: null, selectedServiceDate: undefined, pageIndex: 0 },
  status: { isLoading: false, isError, isRetrying: false },
  actions: { selectDay: vi.fn(), retry, setPage: vi.fn() },
  presentation: { pages: [], activePage: undefined },
}) as unknown as WeeklyProductionPlanWorkflow

describe('ProductionPlanSection — rỗng thật vs lỗi tải', () => {
  it('báo lỗi tải kèm nút thử lại thay vì "Chưa có kế hoạch sản xuất nào."', () => {
    render(<ProductionPlanSection workflow={buildWorkflow(true)} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được kế hoạch sản xuất')
    expect(screen.queryByText('Chưa có kế hoạch sản xuất nào.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('vẫn báo rỗng nghiệp vụ khi query thành công mà không có kế hoạch', () => {
    render(<ProductionPlanSection workflow={buildWorkflow(false)} />)

    expect(screen.getByText('Chưa có kế hoạch sản xuất nào.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('names and scopes the plan-line table without losing its plan and line identities', () => {
    const plan = { planId: 'plan-1', planCode: 'KHSX-01', planDate: '2026-07-20', customerName: 'Khách A', customerCode: 'KHA', lines: [{ planLineId: 'line-1', shiftName: 'MORNING', dishName: 'Cơm gà', totalServings: 120 }] }
    const page = { label: 'Thứ 2', dateLabel: '20/07/2026', plans: [plan], totalLines: 1, totalServings: 120 }
    const workflow = { ...buildWorkflow(false), presentation: { pages: [page], activePage: page } } as unknown as WeeklyProductionPlanWorkflow
    render(<ProductionPlanSection workflow={workflow} />)
    const region = screen.getByRole('region', { name: 'Bảng chi tiết kế hoạch sản xuất' })
    expect(region).toHaveAccessibleDescription('Dòng món của từng KHSX theo ngày phục vụ, ca và số suất')
    expect(screen.getAllByRole('columnheader').map((header) => header.getAttribute('scope'))).toEqual(['col', 'col', 'col'])
    expect(within(region).getByText('120 suất').closest('td')).toHaveAttribute('data-cell-role', 'numeric')
    expect(screen.getByText('KHSX-01')).toBeInTheDocument()
  })
})
