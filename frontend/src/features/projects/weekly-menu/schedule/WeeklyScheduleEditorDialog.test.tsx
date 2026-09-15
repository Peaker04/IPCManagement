import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { WeeklyScheduleEditorDialog } from './WeeklyScheduleEditorDialog'
import type { WeeklyScheduleEditorWorkflow } from './types'

const changeQuickServing = vi.fn()
const saveQuickServing = vi.fn()
const completeQuickServing = vi.fn()
const completeAllQuickServings = vi.fn()

const workflow = {
  scope: { displayDays: [], customerId: 'customer', customerLabel: 'Khách hàng', weekStartDate: '2026-08-31', weekLabel: 'Tuần', menuPrice: 25000, fixedBomRatePercent: 100, activeServiceLabel: 'Tuần' },
  state: { isEditorOpen: true, draftMenu: {}, weeklyMenu: {}, quickServingInputs: {} },
  status: { isSavingMenu: false, isSavingQuickServings: false },
  actions: { openEditor: vi.fn(), closeEditor: vi.fn(), changeDish: vi.fn(), saveEditor: vi.fn(), changeQuickServing, discardQuickServing: vi.fn(), saveQuickServing, completeQuickServing, completeAllQuickServings },
  presentation: { pendingChangeCount: 0, sections: [], getDishName: vi.fn(), isLocked: vi.fn(), getServiceDate: vi.fn(), getSlotServingInfo: vi.fn(), getLinePricing: vi.fn(), buildQuickServingRows: vi.fn(), getQuickServingRow: vi.fn() },
} as unknown as WeeklyScheduleEditorWorkflow

it('allows a completed day/shift serving count to be corrected before source freeze', () => {
  const { rerender } = render(<WeeklyScheduleEditorDialog workflow={workflow} servingRows={[{
    key: 'mon-morning', dayKey: 'mon', dayLabel: 'Thứ Hai', date: '31/08/2026', serviceDate: '2026-08-31', shiftName: 'MORNING', shiftLabel: 'Ca Sáng', quantityPlanIds: ['plan'], lines: [], currentServings: 800, importedServings: 800, inputValue: '800', hasPlanLines: true, hasDraftChange: false, isConfirmed: true, isCompleted: true, statusLabel: 'Đã hoàn tất',
  }]} />)

  const input = screen.getByRole('spinbutton', { name: 'Số suất Thứ Hai Ca Sáng' })
  expect(input).toBeEnabled()
  fireEvent.change(input, { target: { value: '820' } })
  expect(changeQuickServing).toHaveBeenCalledWith('mon-morning', '820')

  rerender(<WeeklyScheduleEditorDialog workflow={workflow} servingRows={[{
    key: 'mon-morning', dayKey: 'mon', dayLabel: 'Thứ Hai', date: '31/08/2026', serviceDate: '2026-08-31', shiftName: 'MORNING', shiftLabel: 'Ca Sáng', quantityPlanIds: ['plan'], lines: [], currentServings: 800, importedServings: 800, inputValue: '820', hasPlanLines: true, hasDraftChange: true, isConfirmed: true, isCompleted: true, statusLabel: 'Đã hoàn tất',
  }]} />)
  expect(screen.getByRole('button', { name: 'Hoàn tất' })).toBeEnabled()
})

it('uses Save all to complete draft servings and keeps the editor open', () => {
  completeAllQuickServings.mockClear()
  const closeEditor = vi.fn()
  const rows = [{
    key: 'mon-morning', dayKey: 'mon', dayLabel: 'Thứ Hai', date: '31/08/2026', serviceDate: '2026-08-31', shiftName: 'MORNING' as const, shiftLabel: 'Ca Sáng' as const, quantityPlanIds: ['plan'], lines: [], currentServings: 800, importedServings: 800, inputValue: '840', hasPlanLines: true, hasDraftChange: true, isConfirmed: false, isCompleted: false, statusLabel: 'Nháp',
  }]
  render(<WeeklyScheduleEditorDialog workflow={{ ...workflow, actions: { ...workflow.actions, closeEditor } }} servingRows={rows} />)
  fireEvent.click(screen.getByRole('button', { name: 'Lưu tất cả thay đổi' }))
  expect(completeAllQuickServings).toHaveBeenCalledWith(rows)
  expect(screen.queryByRole('button', { name: 'Hoàn tất tất cả số suất' })).not.toBeInTheDocument()
  expect(screen.getByText(/Dùng “Lưu tất cả thay đổi”/)).toBeInTheDocument()
  expect(closeEditor).not.toHaveBeenCalled()
})

it('renders the unified matrix view with dishes and servings and supports cancel confirmation', () => {
  const closeEditor = vi.fn()
  const workflowWithSections = {
    ...workflow,
    scope: { ...workflow.scope, displayDays: [{ key: 'mon', label: 'Thứ Hai', date: '31/08/2026' }] },
    presentation: {
      ...workflow.presentation,
      pendingChangeCount: 0,
      sections: [
        { label: 'MENU MẶN CA SÁNG', slotType: 'morningSavory' as const, dishes: [{ id: 'dish-1', name: 'Thịt kho', code: 'MON-01', bomReady: true }], defaultDishId: 'dish-1' },
        { label: 'MENU CHAY CA SÁNG', slotType: 'morningVegetarian' as const, dishes: [{ id: 'dish-2', name: 'Đậu hũ sốt', code: 'MON-02', bomReady: true }], defaultDishId: 'dish-2' },
      ],
    },
    actions: {
      ...workflow.actions,
      closeEditor,
    },
  } as unknown as WeeklyScheduleEditorWorkflow

  const { rerender } = render(<WeeklyScheduleEditorDialog workflow={workflowWithSections} servingRows={[{
    key: 'mon-morning', dayKey: 'mon', dayLabel: 'Thứ Hai', date: '31/08/2026', serviceDate: '2026-08-31', shiftName: 'MORNING', shiftLabel: 'Ca Sáng', quantityPlanIds: ['plan'], lines: [], currentServings: 800, importedServings: 800, inputValue: '800', hasPlanLines: true, hasDraftChange: false, isConfirmed: true, isCompleted: true, statusLabel: 'Đã hoàn tất',
  }]} />)

  // Unified matrix view displays CA SÁNG, dishes and servings in one screen without tabs
  expect(screen.getByText('CA SÁNG')).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: /Tìm món cho Thứ Hai.*MẶN/i })).toBeInTheDocument()

  // When no pending changes, clicking cancel closes editor directly
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
  expect(closeEditor).toHaveBeenCalledTimes(1)

  // With pending draft serving changes, clicking cancel asks for confirmation
  rerender(<WeeklyScheduleEditorDialog workflow={workflowWithSections} servingRows={[{
    key: 'mon-morning', dayKey: 'mon', dayLabel: 'Thứ Hai', date: '31/08/2026', serviceDate: '2026-08-31', shiftName: 'MORNING', shiftLabel: 'Ca Sáng', quantityPlanIds: ['plan'], lines: [], currentServings: 800, importedServings: 800, inputValue: '850', hasPlanLines: true, hasDraftChange: true, isConfirmed: true, isCompleted: true, statusLabel: 'Đã hoàn tất',
  }]} />)

  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
  expect(screen.getByText('Bỏ các thay đổi chưa lưu?')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }))
  expect(closeEditor).toHaveBeenCalledTimes(2)
})
