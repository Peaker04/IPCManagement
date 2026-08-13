import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/common'
import type { QueryView } from '@/lib/queryView'

vi.mock('@/components/common/ActionGuard', () => ({
  ActionGuard: ({ children }: { children?: ReactNode }) => children ?? null,
}))

import { MaterialDemandSection } from './MaterialDemandSection'
import type { MaterialDemandWorkflow } from './useMaterialDemand'
import type { WeeklyScheduleEditorWorkflow } from '../schedule/types'

const retryDemand = vi.fn()
const readyState = (overrides: Partial<Extract<QueryView<unknown>, { phase: 'ready' }>> = {}): QueryView<unknown> => ({
  phase: 'ready',
  data: null,
  isRefreshing: false,
  truncation: null,
  ...overrides,
})

type WorkflowOptions = {
  approvalStatus?: 'none' | 'not-created' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'terminal'
  activeStaleness?: {
    isStale: boolean
    canRegenerate: boolean
    reasons: string[]
  }
  generate?: () => void | Promise<void>
}

const buildWorkflow = (dataState: QueryView<unknown>, options: WorkflowOptions = {}) => ({
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
    isDemandError: dataState.phase === 'error' || dataState.phase === 'forbidden',
    isDemandRetrying: dataState.phase === 'error' && dataState.isRetrying,
    isApprovalHistoryError: false,
    stalenessState: 'ready',
    stalenessCompletedDateCount: 1,
    stalenessExpectedDateCount: 1,
  },
  actions: {
    selectDay: vi.fn(),
    retryDemand,
    setAggregatePage: vi.fn(),
    generate: options.generate ?? vi.fn(),
  },
  dataState,
  presentation: {
    sourceMenuValue: 'KH01',
    materialSummaryCount: 0,
    weeklyPlanRows: options.approvalStatus ? [{}] : [],
    missingBomRows: [],
    importDefaultRows: [],
    demandLines: [],
    aggregatedDemandLines: [],
    staleness: undefined,
    activeStaleness: options.activeStaleness,
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
    demandApprovalStatus: { status: options.approvalStatus ?? 'none', tone: 'neutral', label: 'Chưa trình duyệt', documentCode: undefined, reason: undefined, actionLabel: 'Mở phê duyệt', targetId: undefined },
    approvalHref: undefined,
  },
}) as unknown as MaterialDemandWorkflow

const scheduleWorkflow = {
  status: { isSavingQuickServings: false },
  presentation: { getQuickServingRow: () => undefined },
  actions: { completeQuickServing: vi.fn() },
} as unknown as WeeklyScheduleEditorWorkflow

const renderSection = (dataState: QueryView<unknown>, options?: WorkflowOptions) => render(
  <MemoryRouter>
    <ToastProvider>
      <MaterialDemandSection
        workflow={buildWorkflow(dataState, options)}
        scheduleWorkflow={scheduleWorkflow}
        servingFeedback={null}
      />
    </ToastProvider>
  </MemoryRouter>,
)

describe('MaterialDemandSection — lỗi API không được hoá trang thành empty state', () => {
  it('hiện cảnh báo lỗi kèm nút tải lại thay vì "Chưa tính nhu cầu nguyên liệu" khi API demand chết', () => {
    renderSection({
      phase: 'error',
      message: 'Không tải được nhu cầu nguyên liệu.',
      retry: retryDemand,
      isRetrying: false,
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được nhu cầu nguyên liệu')
    expect(screen.queryByText(/Chưa tính nhu cầu nguyên liệu/)).toBeNull()
    // Tóm tắt ngày cũng không được khẳng định "không thiếu gì" khi chưa biết.
    expect(screen.queryByText('Không có thiếu hụt')).toBeNull()
    expect(screen.getByText('Chưa xác định được')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(retryDemand).toHaveBeenCalledOnce()
  })

  it('giữ nguyên empty state nghiệp vụ khi API thành công nhưng chưa có dòng nhu cầu', () => {
    renderSection(readyState())

    expect(screen.getByText(/Chưa tính nhu cầu nguyên liệu/)).toBeInTheDocument()
    expect(screen.queryByText('Không tải được nhu cầu nguyên liệu')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull()
    expect(screen.getByText('Chưa có ngày')).toBeInTheDocument()
    expect(screen.getByText('Chưa có KHSX theo ngày')).toBeInTheDocument()
    expect(screen.queryByText('Không có thiếu hụt')).toBeNull()
  })

  it('hiện hướng dẫn thay vì empty state khi query chưa đủ điều kiện chạy', () => {
    renderSection({ phase: 'uninitialized', instruction: 'Chọn khách hàng để xem nhu cầu nguyên liệu.' })

    expect(screen.getByText('Chọn khách hàng để xem nhu cầu nguyên liệu.')).toBeInTheDocument()
    expect(screen.queryByText(/Chưa tính nhu cầu nguyên liệu/)).toBeNull()
  })

  it('hiện trạng thái tải đầu tiên trước khi có dữ liệu authoritative', () => {
    renderSection({ phase: 'loading' })

    expect(screen.getByText('Đang tải nhu cầu nguyên liệu...')).toHaveAttribute('role', 'status')
    expect(screen.queryByText(/Chưa tính nhu cầu nguyên liệu/)).toBeNull()
  })

  it('hiện forbidden không có nút thử lại', () => {
    renderSection({ phase: 'forbidden', message: 'Bạn không có quyền xem nhu cầu nguyên liệu của phạm vi này.' })

    expect(screen.getByText('Không có quyền xem nhu cầu nguyên liệu')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thử tải lại' })).toBeNull()
  })

  it('giữ empty data cũ và báo refreshing/partial khi view ready', () => {
    renderSection(readyState({
      isRefreshing: true,
      truncation: { shown: 100, total: 140 },
    }))

    expect(screen.getByText('Đang cập nhật nhu cầu nguyên liệu')).toBeInTheDocument()
    expect(screen.getByText(/Đang hiển thị 100\/140 dòng/)).toBeInTheDocument()
    expect(screen.getByText(/Chưa tính nhu cầu nguyên liệu/)).toBeInTheDocument()
  })
})

describe('MaterialDemandSection — xác nhận tính lại nhu cầu đã duyệt', () => {
  const approvedStaleOptions = (generate: WorkflowOptions['generate']): WorkflowOptions => ({
    approvalStatus: 'approved',
    activeStaleness: { isStale: true, canRegenerate: true, reasons: ['Số suất đã thay đổi'] },
    generate,
  })

  it('tạo trực tiếp khi trạng thái không yêu cầu xác nhận', () => {
    const generate = vi.fn()
    renderSection(readyState(), { approvalStatus: 'rejected', generate })

    fireEvent.click(screen.getByRole('button', { name: 'Tính lại nhu cầu' }))

    expect(generate).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('chờ xác nhận trước khi tính lại nhu cầu đã duyệt', () => {
    const generate = vi.fn()
    renderSection(readyState(), approvedStaleOptions(generate))

    fireEvent.click(screen.getByRole('button', { name: 'Tính lại nhu cầu' }))

    expect(generate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Tính lại nhu cầu đã duyệt?' })).toHaveTextContent(
      'Nhu cầu ngày đang xem đã được duyệt. Tính lại sẽ cập nhật dữ liệu nguồn cho quy trình thu mua. Bạn có muốn tiếp tục?',
    )
  })

  it('không tính lại khi hủy xác nhận', () => {
    const generate = vi.fn()
    renderSection(readyState(), approvedStaleOptions(generate))

    fireEvent.click(screen.getByRole('button', { name: 'Tính lại nhu cầu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))

    expect(generate).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('chỉ gửi một lần và khóa dialog trong lúc đang tính lại', async () => {
    let finishGenerate!: () => void
    const generate = vi.fn(() => new Promise<void>((resolve) => {
      finishGenerate = resolve
    }))
    renderSection(readyState(), approvedStaleOptions(generate))

    fireEvent.click(screen.getByRole('button', { name: 'Tính lại nhu cầu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tính lại' }))

    expect(generate).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Đang tính nhu cầu...' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Đang tính nhu cầu...' }))
    expect(generate).toHaveBeenCalledOnce()

    finishGenerate()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
