import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MaterialDemandWorkflow } from '@/features/projects/weekly-menu/demand/useMaterialDemand'
import type { WeeklyScheduleEditorWorkflow } from '@/features/projects/weekly-menu/schedule/types'
import { MaterialDemandWorkspacePage } from './MaterialDemandWorkspacePage'

const line = (id: string, status: string, remaining = 0) => ({ id, material: id === 'short' ? 'Thịt heo' : 'Gạo', unit: 'kg', source: 'Món nguồn', required: 12.345678, issuedQty: 8, receivedByKitchenQty: 8, remainingToIssueQty: remaining, pendingKitchenReceiptQty: 0, status })
const base = {
  scope: { customerLabel: 'KH01 - Alpha', weekStartDate: '2026-09-21', menuPrice: 30000 },
  dataState: { phase: 'ready', data: null, isRefreshing: false, truncation: null },
  state: { feedback: null },
  status: { isGenerating: false, isSavingQuickServings: false, isFetchingAggregate: false, stalenessState: 'ready' },
  actions: { generate: vi.fn(), selectDay: vi.fn(), retryDemand: vi.fn(), setAggregatePage: vi.fn() },
  presentation: {
    activeDay: { key: 't2', label: 'Thứ Hai', date: '21/09/2026' }, dayPages: [{ key: 't2', label: 'Thứ Hai', date: '21/09/2026' }], dayIndex: 0,
    activeRows: [{ key: 'r1', shiftLabel: 'Ca Sáng', dishName: 'Thịt kho', portions: 100, hasCatalogBom: true, menuTypeLabel: 'Mặn', slotLabel: 'Món chính' }],
    activeQuickServingRows: [], missingBomRows: [], aggregateLines: [line('enough', 'Hoàn tất'), line('short', 'Chưa xuất', 4.345678)],
    inventoryGroups: { exceptionLines: [line('short', 'Chưa xuất', 4.345678)], sufficientLines: [line('enough', 'Hoàn tất')] },
    inventoryStatus: { label: 'Thiếu hàng', tone: 'warning' }, demandApprovalStatus: { status: 'approved' },
    aggregatePage: { pageNumber: 1, pageSize: 12, totalCount: 29 },
  },
} as unknown as MaterialDemandWorkflow

const completedSchedule = {
  status: { isSavingQuickServings: false },
  presentation: { getQuickServingRow: () => ({ key: 'q1', dayLabel: 'Thứ Hai', shiftLabel: 'Ca Sáng', inputValue: '100', isCompleted: true, hasDraftChange: false, hasPlanLines: true, statusLabel: 'Đã chốt' }) },
  actions: { completeQuickServing: vi.fn(), changeQuickServing: vi.fn(), saveQuickServing: vi.fn(), discardQuickServing: vi.fn() },
} as unknown as WeeklyScheduleEditorWorkflow

describe('MaterialDemandWorkspacePage', () => {
  it('uses quiet rows, bounded table grammar and status-only escalation', () => {
    const { container } = render(<MaterialDemandWorkspacePage workflow={base} scheduleWorkflow={completedSchedule} />)
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5)
    const shortageRow = within(table).getByText('Thịt heo').closest('tr')!
    expect(shortageRow).not.toHaveClass('bg-amber-50/50')
    expect(within(shortageRow).getByText('Chưa xuất')).toHaveClass('bg-amber-50')
    expect(container.querySelector('.max-h-\\[min\\(62vh\\,620px\\)\\]')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Phân trang danh sách' })).toHaveTextContent('29')
  })

  it('leads with the shift-grain serving workbench and blocks calculation when a shift is incomplete', () => {
    const incompleteSchedule = { ...completedSchedule, presentation: { getQuickServingRow: () => ({ key: 'q1', dayLabel: 'Thứ Hai', shiftLabel: 'Ca Sáng', inputValue: '0', isCompleted: false, hasDraftChange: false, hasPlanLines: true, statusLabel: 'Chưa chốt' }) } } as unknown as WeeklyScheduleEditorWorkflow
    render(<MaterialDemandWorkspacePage workflow={{ ...base, presentation: { ...base.presentation, aggregateLines: [], inventoryGroups: { exceptionLines: [], sufficientLines: [] }, demandApprovalStatus: { status: 'not-created', label: 'Chưa tạo', tone: 'neutral', actionLabel: 'Tạo nhu cầu từ KHSX' } } } as unknown as MaterialDemandWorkflow} scheduleWorkflow={incompleteSchedule} />)
    expect(screen.getByRole('heading', { name: 'Chốt số suất trước khi tính nhu cầu' })).toBeInTheDocument()
    expect(screen.getByLabelText('Số suất Thứ Hai Ca Sáng')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hoàn tất Ca Sáng' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tính nhu cầu' })).toBeDisabled()
  })
})
