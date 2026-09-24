import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/common'
import type { QueryView } from '@/lib/queryView'

vi.mock('@/components/common/ActionGuard', () => ({
  ActionGuard: ({ children }: { children?: ReactNode }) => children ?? null,
}))

import { MaterialDemandSection } from './MaterialDemandSection'
import type { MaterialDemandWorkflow } from './useMaterialDemand'
import type { WeeklyPlanRow } from '../model/types'
import type { WeeklyScheduleEditorWorkflow } from '../schedule/types'
import { getDemandInventoryStatus, partitionDemandLines } from './demandModel'
import { mapDemandAggregateLine } from '@/api/reportMappers'
import type { IngredientDemandAggregateReportDto } from '@/api/workflowApiTypes'

const readyState = <T,>(data: T): QueryView<T> => ({
  phase: 'ready',
  data,
  isRefreshing: false,
  truncation: null,
})

const weeklyRow = (overrides: Partial<WeeklyPlanRow> = {}): WeeklyPlanRow => ({
  key: 'r1', dayKey: 't2', dayLabel: 'Thứ 2', date: '20/07/2026', serviceDate: '2026-07-20',
  sectionLabel: 'Bữa trưa', shiftLabel: 'Ca trưa', menuTypeLabel: 'Món chính', slotLabel: 'Món 1',
  dishId: 'dish-1', dishName: 'Thịt kho', portions: 100, importedPortions: 100,
  servingsStatus: 'confirmed', servingsStatusLabel: 'Đã chốt', hasConfirmedServings: true, hasCatalogBom: true,
  menuPrice: 25000, bomRatePercent: 40, quantityFactor: 1,
  ...overrides,
})

const makeWorkflow = ({
  dataState,
  aggregateDtos = [],
  activeDate = '2026-07-20',
  activeDay = { key: 't2', label: 'Thứ 2', date: '20/07/2026' },
  dayPages = [{ key: 't2', label: 'Thứ 2', date: '20/07/2026', rows: [weeklyRow({ serviceDate: activeDate })] }],
  activeRows = [weeklyRow()],
  hasAggregatePage = true,
  demandApprovalStatus = { status: 'approved', tone: 'success', label: 'Đã duyệt', documentCode: 'MR-20260720', actionLabel: 'Mở thu mua', targetId: 'mr-1' },
}: {
  dataState: QueryView<unknown>
  aggregateDtos?: IngredientDemandAggregateReportDto[]
  activeDate?: string
  activeDay?: { key: string; label: string; date: string } | null
  dayPages?: MaterialDemandWorkflow['presentation']['dayPages']
  activeRows?: MaterialDemandWorkflow['presentation']['activeRows']
  hasAggregatePage?: boolean
  demandApprovalStatus?: MaterialDemandWorkflow['presentation']['demandApprovalStatus']
}) => {
  const aggregateLines = aggregateDtos.map(mapDemandAggregateLine)
  const remainingCount = aggregateLines.filter((l) => (l.remainingToIssueQty ?? 0) > 0).length
  const pendingCount = aggregateLines.filter((l) => (l.pendingKitchenReceiptQty ?? 0) > 0).length
  const totalCount = aggregateLines.length

  const aggregatePage = hasAggregatePage
    ? {
        pageNumber: 1,
        pageSize: 100,
        totalCount,
        remainingToIssueCount: remainingCount,
        pendingKitchenReceiptCount: pendingCount,
        items: aggregateDtos,
      }
    : undefined

  const inventoryStatus = getDemandInventoryStatus(
    aggregateLines,
    aggregatePage?.totalCount ?? 0,
    undefined,
    aggregatePage,
  )
  const inventoryGroups = partitionDemandLines(aggregateLines)

  const base = {
    scope: {
      customerId: 'cust-1',
      customerLabel: 'Khách hàng Alpha',
      weekStartDate: '2026-07-20',
      weekLabel: '20/07/2026 - 26/07/2026',
      menuPrice: 30000,
      fixedBomRatePercent: 100,
      activeServiceLabel: 'Thứ 2 - 20/07/2026',
      activeDayKey: 't2',
      displayDays: [{ key: 't2', label: 'Thứ 2', date: '20/07/2026' }],
    },
    state: { selectedDayKey: 't2', aggregatePageNumber: 1, feedback: null },
    status: {
      isGenerating: false,
      isSavingQuickServings: false,
      isFetchingAggregate: false,
      isDemandError: dataState.phase === 'error' || dataState.phase === 'forbidden',
      isDemandRetrying: false,
      isApprovalHistoryError: false,
      stalenessState: 'ready',
      stalenessCompletedDateCount: 1,
      stalenessExpectedDateCount: 1,
    },
    actions: {
      selectDay: vi.fn(),
      retryDemand: vi.fn(),
      setAggregatePage: vi.fn(),
      generate: vi.fn(),
    },
    dataState,
    presentation: {
      sourceMenuValue: 'cust-1',
      materialSummaryCount: 0,
      weeklyPlanRows: [{ serviceDate: activeDate, hasCatalogBom: true, portions: 100 }],
      missingBomRows: [],
      importDefaultRows: [],
      demandLines: [],
      aggregatedDemandLines: [],
      staleness: undefined,
      activeStaleness: undefined,
      dayPages,
      dayIndex: 0,
      activeDay,
      activeDate,
      activeRows,
      activeQuickServingRows: [],
      aggregatePage,
      aggregateLines,
      inventoryStatus,
      inventoryGroups,
      documents: [],
      weeklyDocuments: [],
      demandApprovalStatus,
      approvalHref: undefined,
    },
  } as unknown as MaterialDemandWorkflow

  return { workflow: base, aggregateLines }
}

const scheduleWorkflow = {
  status: { isSavingQuickServings: false },
  presentation: { getQuickServingRow: () => undefined },
  actions: { completeQuickServing: vi.fn() },
} as unknown as WeeklyScheduleEditorWorkflow

describe('MaterialDemandSection IA-12 canonical handoff presentation', () => {
  it('renders one canonical handoff checkpoint and preserves both warehouse and kitchen blockers when counts overlap', () => {
    // 4 items with overlap:
    // Item 1: remaining 50, pending 0 (Kho chưa xuất)
    // Item 2: remaining 0, pending 20 (Bếp chờ nhận)
    // Item 3: remaining 10, pending 15 (Chưa xuất 10, đồng thời chờ Bếp nhận 15)
    // Item 4: remaining 0, pending 0 (Hoàn tất)
    const dtos: IngredientDemandAggregateReportDto[] = [
      {
        requestDate: '2026-07-20', customerId: 'cust-1', priceTierAmount: 30000,
        ingredientId: 'ing-1', ingredientName: 'Thịt heo ba rọi', unitId: 'kg', unitName: 'kg',
        totalRequiredQty: 50, currentStockQty: 50, suggestedPurchaseQty: 0, fulfilledQty: 50,
        unissuedQty: 50, pendingKitchenReceiptQty: 0, outstandingQty: 0,
        fulfillmentStatus: 'FULFILLED', lineCount: 1, hasCancelledLine: false,
        issuedQty: 0, receivedByKitchenQty: 0, remainingToIssueQty: 50,
      },
      {
        requestDate: '2026-07-20', customerId: 'cust-1', priceTierAmount: 30000,
        ingredientId: 'ing-2', ingredientName: 'Thịt gà', unitId: 'kg', unitName: 'kg',
        totalRequiredQty: 20, currentStockQty: 20, suggestedPurchaseQty: 0, fulfilledQty: 20,
        unissuedQty: 0, pendingKitchenReceiptQty: 20, outstandingQty: 0,
        fulfillmentStatus: 'FULFILLED', lineCount: 1, hasCancelledLine: false,
        issuedQty: 20, receivedByKitchenQty: 0, remainingToIssueQty: 0,
      },
      {
        requestDate: '2026-07-20', customerId: 'cust-1', priceTierAmount: 30000,
        ingredientId: 'ing-3', ingredientName: 'Cà rốt', unitId: 'kg', unitName: 'kg',
        totalRequiredQty: 25, currentStockQty: 25, suggestedPurchaseQty: 0, fulfilledQty: 25,
        unissuedQty: 10, pendingKitchenReceiptQty: 15, outstandingQty: 0,
        fulfillmentStatus: 'FULFILLED', lineCount: 1, hasCancelledLine: false,
        issuedQty: 15, receivedByKitchenQty: 0, remainingToIssueQty: 10,
      },
      {
        requestDate: '2026-07-20', customerId: 'cust-1', priceTierAmount: 30000,
        ingredientId: 'ing-4', ingredientName: 'Gia vị', unitId: 'kg', unitName: 'kg',
        totalRequiredQty: 5, currentStockQty: 5, suggestedPurchaseQty: 0, fulfilledQty: 5,
        unissuedQty: 0, pendingKitchenReceiptQty: 0, outstandingQty: 0,
        fulfillmentStatus: 'FULFILLED', lineCount: 1, hasCancelledLine: false,
        issuedQty: 5, receivedByKitchenQty: 5, remainingToIssueQty: 0,
      },
    ]

    const { workflow, aggregateLines } = makeWorkflow({
      dataState: readyState(null),
      aggregateDtos: dtos,
    })

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <MaterialDemandSection workflow={workflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={null} />
        </ToastProvider>
      </MemoryRouter>
    )

    // Checkpoints: exactly 3 dt elements
    const checkpointDts = container.querySelectorAll('.ipc-demand-day-checkpoints dt')
    expect(checkpointDts).toHaveLength(3)
    expect(checkpointDts[0].textContent).toBe('KHSX trong ngày')
    expect(checkpointDts[1].textContent).toBe('Số suất theo ca')
    expect(checkpointDts[2].textContent).toBe('Bàn giao nguyên liệu')

    // Third checkpoint dd text preserves both warehouse and kitchen blockers
    const checkpointDds = container.querySelectorAll('.ipc-demand-day-checkpoints dd')
    expect(checkpointDds[2].textContent).toBe('Kho còn xuất 2 · Bếp còn nhận 2')

    // Exception block: heading preserves 3 unique items
    const exceptionHeading = screen.getByText('3 nguyên liệu cần xử lý trước')
    expect(exceptionHeading).toBeDefined()

    // Worklist retains 3 unique exception rows (Item 1, Item 2, Item 3)
    const exceptionRows = container.querySelectorAll('.ipc-demand-exception-block tbody tr')
    expect(exceptionRows).toHaveLength(3)

    // Section header: retired global status badge, replaced by neutral scope count
    const inventorySection = screen.getByLabelText('Phạm vi ngày đang xem: tổng hợp nguyên liệu')
    const headerRow = inventorySection.firstElementChild as HTMLElement
    expect(within(headerRow).queryByText('Chưa xuất')).toBeNull()
    expect(within(headerRow).getByText('4 nguyên liệu')).toBeDefined()

    // Row status and nextAction preserved unchanged
    expect(aggregateLines[0].status).toBe('Chưa xuất')
    expect(aggregateLines[0].nextAction).toBe('Kho xử lý xuất')
    expect(aggregateLines[1].status).toBe('Chờ bếp xác nhận')
    expect(aggregateLines[1].nextAction).toBe('Bếp xác nhận nhận')
    expect(aggregateLines[2].status).toBe('Chưa xuất')
    expect(aggregateLines[2].nextAction).toBe('Kho xử lý xuất')
  })

  it.each([
    {
      name: 'all complete',
      dtos: [
        {
          requestDate: '2026-07-20', customerId: 'cust-1', priceTierAmount: 30000,
          ingredientId: 'ing-1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg',
          totalRequiredQty: 50, currentStockQty: 50, suggestedPurchaseQty: 0, fulfilledQty: 50,
          unissuedQty: 0, pendingKitchenReceiptQty: 0, outstandingQty: 0,
          fulfillmentStatus: 'FULFILLED', lineCount: 1, hasCancelledLine: false,
          issuedQty: 50, receivedByKitchenQty: 50, remainingToIssueQty: 0,
        },
      ],
      dataState: readyState(null),
      expectedHandoffText: 'Bếp đã nhận đủ',
    },
    {
      name: 'API error',
      dtos: [],
      dataState: {
        phase: 'error' as const,
        message: 'Không tải được nhu cầu nguyên liệu.',
        retry: vi.fn(),
        isRetrying: false,
      },
      expectedHandoffText: 'Chưa xác định',
    },
  ])('completion and error safety: $name', ({ dtos, dataState, expectedHandoffText }) => {
    const { workflow } = makeWorkflow({ dataState, aggregateDtos: dtos })

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <MaterialDemandSection workflow={workflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={null} />
        </ToastProvider>
      </MemoryRouter>
    )

    const checkpointDts = container.querySelectorAll('.ipc-demand-day-checkpoints dt')
    expect(checkpointDts).toHaveLength(3)
    expect(checkpointDts[2].textContent).toBe('Bàn giao nguyên liệu')

    const checkpointDds = container.querySelectorAll('.ipc-demand-day-checkpoints dd')
    expect(checkpointDds[2].textContent).toBe(expectedHandoffText)
  })

  it('does not present an empty material scope as completed handoff', () => {
    const { workflow } = makeWorkflow({
      dataState: readyState(null),
      aggregateDtos: [],
    })

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <MaterialDemandSection workflow={workflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={null} />
        </ToastProvider>
      </MemoryRouter>
    )

    const checkpointDts = container.querySelectorAll('.ipc-demand-day-checkpoints dt')
    expect(checkpointDts).toHaveLength(3)
    expect(checkpointDts[2].textContent).toBe('Bàn giao nguyên liệu')

    const checkpointDds = container.querySelectorAll('.ipc-demand-day-checkpoints dd')
    expect(checkpointDds[2].textContent).toBe('Chưa có nguyên liệu')
    expect(screen.queryByText('Bếp đã nhận đủ')).toBeNull()

    const handoffCard = checkpointDts[2].parentElement
    expect(handoffCard?.classList.contains('is-complete')).toBe(false)

    const inventorySection = screen.getByLabelText('Phạm vi ngày đang xem: tổng hợp nguyên liệu')
    expect(within(inventorySection).getByText('Chưa có nguyên liệu')).toBeDefined()

    expect(container.querySelectorAll('.ipc-demand-exception-block')).toHaveLength(0)
  })

  it.each([
    {
      phase: 'loading',
      dataState: { phase: 'loading' as const },
      dtos: [],
      expectedText: 'Đang tải',
      expectedIsComplete: false,
    },
    {
      phase: 'forbidden',
      dataState: { phase: 'forbidden' as const, message: 'Không có quyền truy cập.' },
      dtos: [],
      expectedText: 'Chưa xác định',
      expectedIsComplete: false,
    },
    {
      phase: 'error',
      dataState: { phase: 'error' as const, message: 'Lỗi API', retry: vi.fn(), isRetrying: false },
      dtos: [],
      expectedText: 'Chưa xác định',
      expectedIsComplete: false,
    },
    {
      phase: 'ready-empty',
      dataState: readyState(null),
      dtos: [],
      expectedText: 'Chưa có nguyên liệu',
      expectedIsComplete: false,
    },
    {
      phase: 'ready-complete',
      dataState: readyState(null),
      dtos: [
        {
          requestDate: '2026-07-20', customerId: 'cust-1', priceTierAmount: 30000,
          ingredientId: 'ing-1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg',
          totalRequiredQty: 50, currentStockQty: 50, suggestedPurchaseQty: 0, fulfilledQty: 50,
          unissuedQty: 0, pendingKitchenReceiptQty: 0, outstandingQty: 0,
          fulfillmentStatus: 'FULFILLED', lineCount: 1, hasCancelledLine: false,
          issuedQty: 50, receivedByKitchenQty: 50, remainingToIssueQty: 0,
        },
      ],
      expectedText: 'Bếp đã nhận đủ',
      expectedIsComplete: true,
    },
  ])('handoff checkpoint phase behavior: $phase', ({ dataState, dtos, expectedText, expectedIsComplete }) => {
    const { workflow } = makeWorkflow({ dataState, aggregateDtos: dtos })

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <MaterialDemandSection workflow={workflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={null} />
        </ToastProvider>
      </MemoryRouter>
    )

    const checkpointDts = container.querySelectorAll('.ipc-demand-day-checkpoints dt')
    expect(checkpointDts).toHaveLength(3)
    expect(checkpointDts[2].textContent).toBe('Bàn giao nguyên liệu')

    const checkpointDds = container.querySelectorAll('.ipc-demand-day-checkpoints dd')
    expect(checkpointDds[2].textContent).toBe(expectedText)

    const handoffCard = checkpointDts[2].parentElement
    expect(handoffCard?.classList.contains('is-complete')).toBe(expectedIsComplete)
  })

  it('retires pre-scope operational workspace when demand is uninitialized', () => {
    const { workflow } = makeWorkflow({
      dataState: { phase: 'uninitialized', instruction: 'Chọn khách hàng để xem nhu cầu.' },
      activeDay: null,
      dayPages: [],
      activeRows: [],
      hasAggregatePage: false,
      demandApprovalStatus: { status: 'pending', tone: 'neutral', label: 'Chưa tạo', documentCode: undefined, actionLabel: 'Mở hàng đợi duyệt', targetId: undefined },
    })

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <MaterialDemandSection workflow={workflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={null} />
        </ToastProvider>
      </MemoryRouter>
    )

    // Pre-scope operational surfaces are retired
    expect(container.querySelector('.ipc-demand-day-command')).toBeNull()
    expect(container.querySelector('.ipc-demand-day-checkpoints')).toBeNull()
    expect(container.querySelector('.ipc-demand-khsx-disclosure')).toBeNull()
    expect(container.querySelector('.ipc-material-demand-table')).toBeNull()
    expect(container.querySelector('.ipc-demand-inventory-section')).toBeNull()
    expect(container.querySelector('.ipc-demand-document-lineage')).toBeNull()

    // No dead navigation controls or fabricated counts
    expect(screen.queryByText('Ngày trước')).toBeNull()
    expect(screen.queryByText('Ngày sau')).toBeNull()
    expect(screen.queryByText('0 dòng')).toBeNull()
    expect(screen.queryByText('0/0 ca hoàn tất')).toBeNull()

    // Approval badge with 'Chưa tạo' is not rendered
    expect(screen.queryByText('Chưa tạo')).toBeNull()

    // Compact pre-scope guidance is rendered
    expect(screen.getByText('Chọn khách hàng và tuần để xem KHSX và tiến độ bàn giao nguyên liệu.')).toBeDefined()
  })

  it('keeps authoritative KHSX visible while material demand is loading', () => {
    const { workflow } = makeWorkflow({
      dataState: { phase: 'loading' },
      activeRows: [weeklyRow()],
    })

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <MaterialDemandSection workflow={workflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={null} />
        </ToastProvider>
      </MemoryRouter>
    )

    // Operational workspace stays visible
    expect(container.querySelector('.ipc-demand-day-command')).not.toBeNull()
    expect(container.querySelector('.ipc-demand-day-checkpoints')).not.toBeNull()
    expect(container.querySelector('.ipc-demand-khsx-disclosure')).not.toBeNull()
    expect(container.querySelector('.ipc-material-demand-table')).not.toBeNull()

    // Authoritative KHSX metrics
    expect(screen.getByText('1 dòng')).toBeDefined()
    expect(screen.getByText('1/1 ca hoàn tất')).toBeDefined()

    // Handoff checkpoint shows loading
    const checkpointDds = container.querySelectorAll('.ipc-demand-day-checkpoints dd')
    expect(checkpointDds[2].textContent).toBe('Đang tải')
  })

  it('keeps KHSX context and retry/error owner when material demand fails', () => {
    const retryFn = vi.fn()
    const { workflow } = makeWorkflow({
      dataState: { phase: 'error', message: 'Không tải được nhu cầu nguyên liệu.', retry: retryFn, isRetrying: false },
      activeRows: [weeklyRow()],
    })

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <MaterialDemandSection workflow={workflow} scheduleWorkflow={scheduleWorkflow} servingFeedback={null} />
        </ToastProvider>
      </MemoryRouter>
    )

    // KHSX row exists
    expect(screen.getByText('Thịt kho')).toBeDefined()

    // Handoff checkpoint fails closed
    const checkpointDds = container.querySelectorAll('.ipc-demand-day-checkpoints dd')
    expect(checkpointDds[2].textContent).toBe('Chưa xác định')

    // Canonical retry/error surface exists
    expect(screen.getByText('Không tải được nhu cầu nguyên liệu')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Thử tải lại' })).toBeDefined()
  })
})
