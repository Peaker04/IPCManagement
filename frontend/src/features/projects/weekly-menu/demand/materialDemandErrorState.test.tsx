import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/common'

vi.mock('@/app/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: null } }),
}))

import { MaterialDemandSection } from './MaterialDemandSection'
import type { MaterialDemandWorkflow } from './useMaterialDemand'
import type { WeeklyScheduleEditorWorkflow } from '../schedule/types'

const retryDemand = vi.fn()

const buildWorkflow = (isDemandError: boolean) => ({
  scope: {
    customerId: 'customer-1',
    customerLabel: 'KH01 - Khách hàng A',
    weekStartDate: '2026-07-20',
    weekLabel: '20/07/2026 - 26/07/2026',
    menuPrice: 30000,
    fixedBomRatePercent: 100,
    activeServiceLabel: 'Thứ 2 - 20/07/2026',
    activeDayKey: 't2',
    displayDays: [],
  },
  state: { selectedDayKey: null, aggregatePageNumber: 1, feedback: null },
  status: {
    isGenerating: false,
    isSavingQuickServings: false,
    isFetchingAggregate: false,
    isDemandError,
    isDemandRetrying: false,
    isApprovalHistoryError: false,
    stalenessState: 'ready',
    stalenessCompletedDateCount: 1,
    stalenessExpectedDateCount: 1,
  },
  actions: {
    selectDay: vi.fn(),
    retryDemand,
    setAggregatePage: vi.fn(),
    generate: vi.fn(),
  },
  presentation: {
    sourceMenuValue: 'KH01',
    materialSummaryCount: 0,
    weeklyPlanRows: [],
    missingBomRows: [],
    importDefaultRows: [],
    demandLines: [],
    aggregatedDemandLines: [],
    staleness: undefined,
    activeStaleness: undefined,
    dayPages: [],
    dayIndex: 0,
    activeDay: undefined,
    activeDate: '2026-07-20',
    activeRows: [],
    activeQuickServingRows: [],
    aggregatePage: undefined,
    aggregateLines: [],
    inventoryStatus: { totalCount: 0, shortageCount: 0, enoughCount: 0, staleCount: 0, tone: 'success', label: 'Đủ hàng' },
    inventoryGroups: { exceptionLines: [], sufficientLines: [] },
    documents: [],
    weeklyDocuments: [],
    demandApprovalStatus: { status: 'none', tone: 'neutral', label: 'Chưa trình duyệt', documentCode: undefined, reason: undefined, actionLabel: 'Mở phê duyệt', targetId: undefined },
    approvalHref: undefined,
  },
}) as unknown as MaterialDemandWorkflow

const scheduleWorkflow = {
  status: { isSavingQuickServings: false },
  presentation: { getQuickServingRow: () => undefined },
  actions: { completeQuickServing: vi.fn() },
} as unknown as WeeklyScheduleEditorWorkflow

const renderSection = (isDemandError: boolean) => render(
  <MemoryRouter>
    <ToastProvider>
      <MaterialDemandSection
        workflow={buildWorkflow(isDemandError)}
        scheduleWorkflow={scheduleWorkflow}
        servingFeedback={null}
      />
    </ToastProvider>
  </MemoryRouter>,
)

describe('MaterialDemandSection — lỗi API không được hoá trang thành empty state', () => {
  it('hiện cảnh báo lỗi kèm nút tải lại thay vì "Chưa tính nhu cầu nguyên liệu" khi API demand chết', () => {
    renderSection(true)

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được nhu cầu nguyên liệu')
    expect(screen.queryByText(/Chưa tính nhu cầu nguyên liệu/)).toBeNull()
    // Tóm tắt ngày cũng không được khẳng định "không thiếu gì" khi chưa biết.
    expect(screen.queryByText('Không có thiếu hụt')).toBeNull()
    expect(screen.getByText('Chưa xác định được')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(retryDemand).toHaveBeenCalledOnce()
  })

  it('giữ nguyên empty state nghiệp vụ khi API thành công nhưng chưa có dòng nhu cầu', () => {
    renderSection(false)

    expect(screen.getByText(/Chưa tính nhu cầu nguyên liệu/)).toBeInTheDocument()
    expect(screen.queryByText('Không tải được nhu cầu nguyên liệu')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull()
    expect(screen.getByText('Không có thiếu hụt')).toBeInTheDocument()
  })
})
