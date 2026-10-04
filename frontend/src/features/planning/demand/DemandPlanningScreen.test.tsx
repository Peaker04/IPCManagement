import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import type { MaterialDemandWorkflow } from '@/features/projects/weekly-menu/demand/useMaterialDemand'
import type { WeeklyScheduleEditorWorkflow } from '@/features/projects/weekly-menu/schedule/types'
import { DemandPlanningScreen } from './DemandPlanningScreen'

const sourceRow = { key: 'source', dayKey: 't2', serviceDate: '2026-09-21', shiftLabel: 'Ca Sáng', dishName: 'Thịt kho', portions: 100, hasCatalogBom: true }
const serving = { key: 'q1', dayLabel: 'Thứ Hai', shiftLabel: 'Ca Sáng', inputValue: '100', currentServings: 100, isCompleted: true, hasPlanLines: true }
const day = { key: 't2', label: 'Thứ Hai', date: '21/09/2026', rows: [sourceRow] }
const base = {
  scope: { customerId: 'customer', customerLabel: 'KH01 — Alpha', weekStartDate: '2026-09-21', menuPrice: 30000 },
  weeklyCommand: { dates: [
    { serviceDate: '2026-09-21', preflight: { hasExistingPlan: true, canRegenerate: true }, unavailable: false },
    { serviceDate: '2026-09-22', preflight: { hasExistingPlan: true, canRegenerate: false, regenerationBlockReason: 'Đã phát sinh đơn mua' }, unavailable: false },
  ], pendingServings: [], invalidTier: false, missingPortions: false },
  dataState: { phase: 'ready', data: null, isRefreshing: false },
  state: { feedback: null },
  status: { isGenerating: false, isSavingQuickServings: false, isFetchingAggregate: false, stalenessState: 'ready' },
  actions: { generate: vi.fn(async () => {}), selectDay: vi.fn(), retryDemand: vi.fn(), setAggregatePage: vi.fn() },
  presentation: {
    activeDay: day, activeDate: '2026-09-21', dayPages: [day, { key: 't3', label: 'Thứ Ba', date: '22/09/2026', rows: [{ ...sourceRow, serviceDate: '2026-09-22' }] }],
    activeRows: [sourceRow], activeQuickServingRows: [], missingBomRows: [],
    aggregateLines: [
      { id: 'rice', ingredientId: 'rice', unitId: 'kg', historicalAllocatedQty: 20, projectedPurchaseQty: 0, material: 'Gạo', unit: 'kg', source: 'Cơm', required: 20, issuedQty: 20, receivedByKitchenQty: 18, remainingToIssueQty: 0, pendingKitchenReceiptQty: 2, status: 'Chờ Bếp nhận' },
      { id: 'pork', ingredientId: 'pork', unitId: 'kg', historicalAllocatedQty: 0, projectedPurchaseQty: 12.345678, material: 'Thịt heo', unit: 'kg', source: 'Thịt kho', required: 12.345678, issuedQty: 8, receivedByKitchenQty: 8, remainingToIssueQty: 4.345678, pendingKitchenReceiptQty: 0, status: 'Chưa xuất' },
    ],
    demandApprovalStatus: { label: 'Đã duyệt' }, aggregatePage: { pageNumber: 1, pageSize: 12, totalCount: 29, items: [{ ingredientId: 'rice', unitId: 'kg', suggestedPurchaseQty: 0 }, { ingredientId: 'pork', unitId: 'kg', suggestedPurchaseQty: 12.345678 }] },
  },
} as unknown as MaterialDemandWorkflow
const schedule = {
  status: { isSavingQuickServings: false },
  presentation: { getQuickServingRow: () => serving },
  actions: { completeQuickServing: vi.fn(), changeQuickServing: vi.fn(), saveQuickServing: vi.fn(), discardQuickServing: vi.fn() },
} as unknown as WeeklyScheduleEditorWorkflow
const props = {
  workflow: base, scheduleWorkflow: schedule,
  coordinates: { customerId: 'customer', weekStartDate: '2026-09-21', customers: [{ customerId: 'customer', customerCode: 'KH01', customerName: 'Alpha' }] },
  pricing: { tier: 30000 as const }, inputPhase: 'ready' as const,
  onCustomerChange: vi.fn(), onWeekChange: vi.fn(), onRetryInputs: vi.fn(),
}
function mount(overrides: Partial<ComponentProps<typeof DemandPlanningScreen>> = {}, permissions = ['demand.generate', 'coordination.order.lock']) {
  return render(<Provider store={configureStore({ reducer: { auth: () => ({ user: { role: 'dieuphoi', permissions } }) } })}><MemoryRouter><DemandPlanningScreen {...props} {...overrides} /></MemoryRouter></Provider>)
}
beforeEach(() => vi.clearAllMocks())

describe('BE-backed DemandPlanningScreen', () => {
  it('discloses weekly update/locked dates and pending servings; cancel never submits', () => {
    mount({ workflow: { ...base, weeklyCommand: { ...base.weeklyCommand, pendingServings: [{ serviceDate: '2026-09-21', shiftLabel: 'Ca Sáng' }] } } as unknown as MaterialDemandWorkflow })
    fireEvent.click(screen.getByRole('button', { name: 'Tính lại nhu cầu tuần' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('21/09/2026')
    expect(dialog).toHaveTextContent('22/09/2026')
    expect(dialog).toHaveTextContent('Đã phát sinh đơn mua')
    expect(dialog).toHaveTextContent('lưu và hoàn tất 1 ca')
    expect(base.actions.generate).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(base.actions.generate).not.toHaveBeenCalled()
  })

  it('cancels an open confirmation on lost readiness and does not reopen it after recovery', () => {
    const store = configureStore({ reducer: { auth: () => ({ user: { role: 'dieuphoi', permissions: ['demand.generate'] } }) } })
    const { rerender } = render(<DemandPlanningScreen {...props} />, { wrapper: ({ children }) => <Provider store={store}><MemoryRouter>{children}</MemoryRouter></Provider> })
    fireEvent.click(screen.getByRole('button', { name: 'Tính lại nhu cầu tuần' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    rerender(<DemandPlanningScreen {...props} workflow={{ ...base, dataState: { ...base.dataState, phase: 'ready', isRefreshing: true } } as MaterialDemandWorkflow} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tính lại nhu cầu tuần' })).toBeDisabled()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByLabelText('Số suất Thứ Hai Ca Sáng')).not.toBeInTheDocument()
    rerender(<DemandPlanningScreen {...props} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tính lại nhu cầu tuần' }))
    rerender(<DemandPlanningScreen {...props} inputPhase="error" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<DemandPlanningScreen {...props} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(base.actions.generate).not.toHaveBeenCalled()
  })

  it('keeps committed day/page navigation mounted during target loading, then commits or fails closed', () => {
    const store = configureStore({ reducer: { auth: () => ({ user: { role: 'dieuphoi', permissions: ['demand.generate'] } }) } })
    const { rerender } = render(<DemandPlanningScreen {...props} />, { wrapper: ({ children }) => <Provider store={store}><MemoryRouter>{children}</MemoryRouter></Provider> })
    const rail = screen.getByRole('navigation', { name: 'Ngày xem nhu cầu' })
    const next = screen.getByRole('button', { name: /Trang sau/ })
    const rows = screen.getByRole('region', { name: 'Bảng nguyên liệu ngày' })
    rows.scrollTop = 80
    next.focus()
    fireEvent.click(next)
    const pending = { ...base, dataState: { phase: 'loading' }, state: { ...base.state, aggregatePageNumber: 2 }, status: { ...base.status, isFetchingAggregate: true }, presentation: { ...base.presentation, aggregateLines: [], aggregatePage: undefined } } as unknown as MaterialDemandWorkflow
    rerender(<DemandPlanningScreen {...props} workflow={pending} />)
    expect(screen.getByRole('navigation', { name: 'Ngày xem nhu cầu' })).toBe(rail)
    expect(screen.getByRole('button', { name: /Trang sau/ })).toBe(next)
    expect(screen.getByRole('table')).toHaveTextContent('Thịt heo')
    expect(screen.getByText('Trang 1/3')).toBeInTheDocument()
    expect(screen.getAllByText(/Đang tải.*21\/09\/2026.*trang 2/).length).toBeGreaterThan(0)
    expect(screen.getByText('Đã duyệt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tính lại nhu cầu tuần' })).toBeDisabled()
    for (const announcement of screen.getAllByText(/Đang tải.*21\/09\/2026.*trang 2/)) expect(announcement).toHaveClass('sr-only')
    expect(rows.scrollTop).toBe(80)
    expect(screen.queryByText(/Đang xem trang/)).not.toBeInTheDocument()
    const second = { ...base, presentation: { ...base.presentation, aggregatePage: { ...base.presentation.aggregatePage!, pageNumber: 2 } } }
    rerender(<DemandPlanningScreen {...props} workflow={second} />)
    expect(rows.scrollTop).toBe(0)
    rows.scrollTop = 40
    rerender(<DemandPlanningScreen {...props} workflow={{ ...second, dataState: { ...second.dataState, isRefreshing: true } } as MaterialDemandWorkflow} />)
    expect(rows.scrollTop).toBe(40)
    rerender(<DemandPlanningScreen {...props} workflow={second} />)
    expect(rows.scrollTop).toBe(40)
    expect(screen.getByText('Trang 2/3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Trang sau/ })).toBe(next)
    const targetDay = base.presentation.dayPages[1]
    const dayPending = { ...pending, state: { ...pending.state, aggregatePageNumber: 1 }, presentation: { ...pending.presentation, activeDay: targetDay, activeDate: '2026-09-22' } }
    const dayButton = within(rail).getByRole('button', { name: /Thứ Ba/ })
    dayButton.focus()
    fireEvent.click(dayButton)
    rerender(<DemandPlanningScreen {...props} workflow={dayPending} />)
    expect(dayButton).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'Thứ Hai · 21/09/2026' })).toBeInTheDocument()
    expect(screen.getByText('Trang 2/3')).toBeInTheDocument()
    expect(screen.getAllByText(/Đang tải.*22\/09\/2026.*trang 1/).length).toBeGreaterThan(0)
    const dayReady = { ...second, presentation: { ...second.presentation, activeDay: targetDay, activeDate: '2026-09-22', aggregatePage: base.presentation.aggregatePage } }
    rerender(<DemandPlanningScreen {...props} workflow={dayReady} />)
    expect(screen.getByRole('heading', { name: 'Thứ Ba · 22/09/2026' })).toBeInTheDocument()
    expect(dayButton).toHaveFocus()
    rerender(<DemandPlanningScreen {...props} workflow={{ ...dayPending, scope: { ...base.scope, customerId: 'other' } }} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    rerender(<DemandPlanningScreen {...props} workflow={dayReady} />)
    rerender(<DemandPlanningScreen {...props} workflow={{ ...dayPending, dataState: { phase: 'forbidden' } } as MaterialDemandWorkflow} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    rerender(<DemandPlanningScreen {...props} workflow={dayPending} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('submits the existing weekly owner once and prevents a duplicate while pending', async () => {
    let finish!: () => void
    const generate = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
    mount({ workflow: { ...base, actions: { ...base.actions, generate } } })
    fireEvent.click(screen.getByRole('button', { name: 'Tính lại nhu cầu tuần' }))
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận tính nhu cầu tuần' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy' })).toBeDisabled()
    await act(async () => { finish() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('retains generated quantities when servings change; attaches projected allocation and source to the selected ingredient', () => {
    mount({ scheduleWorkflow: { ...schedule, presentation: { ...schedule.presentation, getQuickServingRow: () => ({ ...serving, isCompleted: false }) } } as unknown as WeeklyScheduleEditorWorkflow })
    const table = screen.getByRole('table')
    const row = within(table).getByRole('button', { name: 'Thịt heo' })
    expect(within(row.closest('tr')!).getAllByText('12,345678')).toHaveLength(2)
    fireEvent.click(row)
    const detail = document.getElementById(row.getAttribute('aria-controls')!)!
    expect(detail).toHaveTextContent('Thịt kho')
    expect(detail).toHaveTextContent('Phân bổ tại lần tính')
    expect(detail).toHaveTextContent('Đề xuất mua tại lần tính')
    expect(within(table).queryByRole('columnheader', { name: 'Còn xuất kho' })).not.toBeInTheDocument()
    fireEvent.click(within(detail).getByRole('button', { name: 'Đóng chi tiết' }))
    expect(row).toHaveFocus()
    expect(row).toHaveAttribute('aria-expanded', 'false')
    vi.useFakeTimers()
    try {
      const search = screen.getByRole('searchbox', { name: 'Tìm trong trang' })
      fireEvent.change(search, { target: { value: 'Ga' } })
      expect(search).toHaveValue('Ga')
      act(() => vi.advanceTimersByTime(200))
      expect(within(table).getByRole('button', { name: 'Thịt heo' })).toBeInTheDocument()
      fireEvent.change(search, { target: { value: 'Gạo' } })
      act(() => vi.advanceTimersByTime(249))
      expect(within(table).getByRole('button', { name: 'Thịt heo' })).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      expect(within(table).queryByRole('button', { name: 'Thịt heo' })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
      expect(within(table).getByRole('button', { name: 'Thịt heo' })).toBeInTheDocument()
      const filter = screen.getByRole('combobox', { name: 'Phân bổ trong trang' })
      fireEvent.change(filter, { target: { value: 'allocation' } })
      act(() => vi.advanceTimersByTime(249))
      expect(within(table).getByRole('button', { name: 'Thịt heo' })).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(1))
      expect(within(table).queryByRole('button', { name: 'Thịt heo' })).not.toBeInTheDocument()
      fireEvent.change(search, { target: { value: 'không khớp' } })
      fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
      act(() => vi.advanceTimersByTime(300))
      expect(within(table).getByRole('button', { name: 'Thịt heo' })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
    const source = screen.getByRole('button', { name: 'Số suất và món nguồn' })
    fireEvent.click(source)
    expect(source).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('heading', { name: 'Số suất và món nguồn · Thứ Hai · 21/09/2026' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Trang 1/3')).not.toBeInTheDocument()
    expect(base.actions.selectDay).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('combobox', { name: 'Ngày xem nguồn' }), { target: { value: 't3' } })
    expect(base.actions.selectDay).toHaveBeenLastCalledWith('t3')
    expect(source).toHaveAttribute('aria-current', 'true')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Thứ Hai.*21\/09/ }))
    expect(source).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('table')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Trang sau/ }))
    expect(base.actions.setAggregatePage).toHaveBeenCalledWith(2)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Ngày xem nhu cầu' })).getByRole('button', { name: /Thứ Ba/ }))
    expect(base.actions.selectDay).toHaveBeenCalledWith('t3')
    expect(base.actions.generate).not.toHaveBeenCalled()
  })

  it.each(['loading', 'error', 'forbidden'] as const)('keeps source %s separate from a business empty state', phase => {
    mount({ inputPhase: phase })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('Ngày này chưa có dòng nhu cầu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tính lại nhu cầu tuần' })).toBeDisabled()
    if (phase === 'error') {
      fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
      expect(props.onRetryInputs).toHaveBeenCalledOnce()
    }
    if (phase === 'forbidden') expect(screen.queryByRole('navigation', { name: 'Ngày xem nhu cầu' })).not.toBeInTheDocument()
  })

  it.each([
    { customerId: '', weekStartDate: '', helper: 'Chọn khách hàng', target: 'Khách hàng' },
    { customerId: '', weekStartDate: '2026-09-21', helper: 'Chọn khách hàng', target: 'Khách hàng' },
    { customerId: 'customer', weekStartDate: '', helper: 'Chọn tuần bắt đầu', target: 'Tuần bắt đầu' },
  ])('focuses the missing coordinate without fabricating scope: $target ($customerId/$weekStartDate)', ({ customerId, weekStartDate, helper, target }) => {
    mount({ workflow: { ...base, scope: { ...base.scope, customerId, weekStartDate } }, coordinates: { ...props.coordinates, customerId, weekStartDate } })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText('30k')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: helper }))
    expect(screen.getByLabelText(target)).toHaveFocus()
    fireEvent.change(screen.getByRole('combobox', { name: 'Khách hàng' }), { target: { value: 'customer' } })
    expect(props.onCustomerChange).toHaveBeenCalledWith('customer')
  })

  it('keeps shift completion at shift grain and prevents missing-portion weekly calculation', () => {
    const incomplete = { ...serving, inputValue: '0', isCompleted: false }
    mount({ workflow: { ...base, weeklyCommand: { ...base.weeklyCommand, missingPortions: true }, presentation: { ...base.presentation, aggregateLines: [] } }, scheduleWorkflow: { ...schedule, presentation: { ...schedule.presentation, getQuickServingRow: () => incomplete } } as unknown as WeeklyScheduleEditorWorkflow })
    fireEvent.click(screen.getByRole('button', { name: 'Số suất và món nguồn' }))
    expect(screen.getByLabelText('Số suất Thứ Hai Ca Sáng')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Hoàn tất Ca Sáng' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tính lại nhu cầu tuần' })).toBeDisabled()
  })

  it('does not expose the weekly write command without its real permission', () => {
    mount({}, [])
    expect(screen.queryByRole('button', { name: 'Tính lại nhu cầu tuần' })).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Số suất và món nguồn' }))
    expect(screen.getByText('100 suất')).toBeInTheDocument()
    expect(screen.queryByLabelText('Số suất Thứ Hai Ca Sáng')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hoàn tất Ca/ })).not.toBeInTheDocument()
  })
})
