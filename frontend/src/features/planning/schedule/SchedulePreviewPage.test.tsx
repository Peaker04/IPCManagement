import { act, fireEvent, render, screen } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { WeeklyScheduleFeedback } from '@/features/projects/weekly-menu/schedule/types'
import SchedulePreviewPage from './SchedulePreviewPage'

const fixture = vi.hoisted(() => ({ feedback: null as null | ((feedback: WeeklyScheduleFeedback) => void) }))
const emptyQuery = { data: { success: true, data: [] }, isSuccess: true, isLoading: false, isFetching: false, refetch: vi.fn() }
vi.mock('@/api/coordinationApi', () => {
  const query = () => ({ data: { success: true, data: [] }, isSuccess: true, isLoading: false, isFetching: false, refetch: vi.fn() })
  const committed = { ...query(), data: { success: true, data: { rows: [], importedWeeklyMenu: {} } } }
  return {
    useGetCommittedWeeklyMenuQuery: () => committed,
    useGetCustomerContractsQuery: query, useGetReconciliationWeeklyMenuQuery: query,
    useGetCoordinationCustomersQuery: () => ({ ...query(), data: { success: true, data: [{ customerId: 'customer', customerCode: 'KH01', customerName: 'Alpha' }] } }),
    useGetMealQuantityPlansQuery: query, useGetMenuSchedulesQuery: query,
    useUpdateMenuScheduleVersionMutation: () => [vi.fn(), { isLoading: false }],
  }
})
vi.mock('@/api/dishCatalogApi', () => ({ useGetDishesCatalogQuery: () => ({ ...emptyQuery, data: [] }) }))
vi.mock('@/lib/systemOperationContext', () => ({ useSystemOperation: () => null }))
vi.mock('@/features/projects/weekly-menu/import/useWeeklyMenuImport', () => ({ useWeeklyMenuImport: () => ({ state: { isOpen: false }, status: { isImporting: false }, actions: {} }) }))
vi.mock('@/features/projects/weekly-menu/schedule/useWeeklyScheduleEditor', () => ({ useWeeklyScheduleEditor: ({ onQuickServingFeedback }: { onQuickServingFeedback: (feedback: WeeklyScheduleFeedback) => void }) => {
  fixture.feedback = onQuickServingFeedback
  return { state: { isEditorOpen: false }, status: { isSavingQuickServings: false }, actions: {}, presentation: {
    pendingChangeCount: 0, getServiceDate: () => '', getSlotServingInfo: () => ({ portions: 100 }), getLinePricing: () => ({}), buildQuickServingRows: () => [], getQuickServingRow: () => undefined,
  } }
} }))
vi.mock('@/features/projects/weekly-menu/demand/useMaterialDemand', () => { const presentation = { dayPages: [], activeRows: [], activeQuickServingRows: [], missingBomRows: [], aggregateLines: [] }; return { useMaterialDemand: ({ scope }: { scope: object }) => ({
  scope, weeklyCommand: { dates: [], pendingServings: [], invalidTier: false, missingPortions: false }, dataState: { phase: 'ready' }, state: { feedback: null }, status: {}, actions: {},
  presentation,
}) } })

describe('SchedulePreviewPage serving feedback boundary', () => {
  it('announces failed serving saves, replaces feedback on recovery and clears it on scope change', () => {
    const auth = { user: { role: 'dieuphoi', permissions: ['demand.generate'] } }
    const coordination = { weeklyMenu: {}, orders: [], lockedShifts: {} }
    const store = configureStore({ reducer: {
      auth: () => auth,
      coordination: () => coordination,
    } })
    render(<Provider store={store}><MemoryRouter initialEntries={['/__kit/planning/demand?customerId=customer&weekStartDate=2026-09-21']}><SchedulePreviewPage /></MemoryRouter></Provider>)
    act(() => fixture.feedback!({ title: 'Chưa lưu được số suất', message: 'Vui lòng kiểm tra lại số suất.', variant: 'danger' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa lưu được số suất')
    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng kiểm tra lại số suất.')
    act(() => fixture.feedback!({ title: 'Đã lưu số suất', message: 'Đã cập nhật số suất dự kiến.', variant: 'info' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu số suất')
    fireEvent.change(screen.getByLabelText('Khách hàng'), { target: { value: '' } })
    expect(screen.queryByText('Đã lưu số suất')).not.toBeInTheDocument()
  })
})
