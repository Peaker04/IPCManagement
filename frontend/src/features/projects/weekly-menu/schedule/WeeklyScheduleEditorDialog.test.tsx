import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { WeeklyScheduleEditorDialog } from './WeeklyScheduleEditorDialog'
import type { WeeklyScheduleEditorWorkflow } from './types'

const changeQuickServing = vi.fn()
const saveQuickServing = vi.fn()
const completeQuickServing = vi.fn()

const workflow = {
  scope: { displayDays: [], customerId: 'customer', customerLabel: 'Khách hàng', weekStartDate: '2026-08-31', weekLabel: 'Tuần', menuPrice: 25000, fixedBomRatePercent: 100, activeServiceLabel: 'Tuần' },
  state: { isEditorOpen: true, draftMenu: {}, weeklyMenu: {}, quickServingInputs: {} },
  status: { isSavingMenu: false, isSavingQuickServings: false },
  actions: { openEditor: vi.fn(), closeEditor: vi.fn(), changeDish: vi.fn(), saveEditor: vi.fn(), changeQuickServing, discardQuickServing: vi.fn(), saveQuickServing, completeQuickServing },
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
