import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const run = {
  serviceRunId: 'run-1', planId: 'plan-1', planCode: 'KHSX-01', serviceDate: '2026-08-12', shiftName: 'MORNING', status: 'RECONCILIATION_REQUIRED',
  currentVersion: 4,
  blockers: ['UNRESOLVED_VARIANCE'], canStartService: false, canRecordActualServings: false, canConfirmService: false,
  canWaiveServiceConfirmation: false, canResolveVariance: false, canResolveServingVariance: false, canClose: false, serviceConfirmationOutcome: 'PENDING',
  plannedServings: 40, actualServings: 39, materialRequestLineCount: 2, issueCount: 1, unreceivedIssueCount: 0, openSupplementalCount: 0,
  unreceivedReturnCount: 0, hasBomBlocker: false, adjustmentCount: 0,
  sourceLineOptions: [
    { sourceLineId: 'source-1', ingredientLabel: 'Gạo', requiredQuantity: 12, unitLabel: 'kg' },
    { sourceLineId: 'source-2', ingredientLabel: 'Cà rốt', requiredQuantity: 3, unitLabel: 'kg' },
  ],
  pendingVarianceDeclarations: [
    { declarationId: 'declaration-1', trackLabel: 'RECONCILIATION', reason: 'Đã đối chiếu', declaredByLabel: 'Bếp trưởng', declaredAt: '2026-08-13T10:00:00Z' },
  ],
}

const mocks = vi.hoisted(() => ({
  user: { role: 'quanly', isAdminFullAccess: false },
  persistedRun: null as unknown,
  open: vi.fn(),
  declare: vi.fn(),
  approve: vi.fn(),
  refetch: vi.fn(),
  scopeQueries: [] as unknown[],
}))

vi.mock('react-redux', () => ({ useSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: mocks.user } }) }))
vi.mock('../chefApi', () => {
  const idle = () => [vi.fn(), { isLoading: false }]
  return {
    useGetServiceRunByPlanQuery: () => ({ data: mocks.persistedRun, isFetching: false, isError: false, refetch: mocks.refetch }),
    useGetServiceRunByScopeQuery: (scope: unknown, options: { skip: boolean }) => {
      if (!options.skip) mocks.scopeQueries.push(scope)
      return { data: mocks.persistedRun, isFetching: false, isError: false, refetch: mocks.refetch }
    },
    useOpenServiceRunMutation: () => [mocks.open, { isLoading: false }], useStartServiceRunMutation: idle, useRecordServiceRunActualServingsMutation: idle,
    useConfirmServiceRunMutation: idle, useResolveServiceRunVarianceMutation: idle, useResolveServiceRunServingVarianceMutation: idle,
    useWaiveServiceRunConfirmationMutation: idle, useCloseServiceRunMutation: idle, useCreateServiceRunAdjustmentMutation: idle,
    useDeclareServiceRunVarianceMutation: () => [mocks.declare, { isLoading: false }],
    useApproveServiceRunVarianceWaiverMutation: () => [mocks.approve, { isLoading: false }],
  }
})

import { ServiceRunSection } from './ServiceRunSection'

const plans = [{ planId: 'plan-1', planCode: 'KHSX-01', lines: [{ shiftName: 'MORNING' }] }]
const exactScope = { customerId: 'customer-1', serviceDate: '2026-08-12', shiftName: 'MORNING', priceTierAmount: 25000 }
const resolved = () => ({ unwrap: () => Promise.resolve(run) })

describe('ServiceRun variance controls', () => {
  beforeEach(() => {
    mocks.user = { role: 'quanly', isAdminFullAccess: false }
    mocks.persistedRun = run
    mocks.open.mockReset().mockReturnValue(resolved())
    mocks.declare.mockReset().mockReturnValue(resolved())
    mocks.approve.mockReset().mockReturnValue(resolved())
    mocks.refetch.mockReset().mockResolvedValue({ data: run })
    mocks.scopeQueries = []
  })

  it('lets a Manager select user-labelled ingredients without typing technical source IDs', async () => {
    render(<ServiceRunSection plans={plans as never[]} shiftName="MORNING" />)
    expect(screen.getByRole('group', { name: 'Khai báo ngoại lệ Ca phục vụ' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Phê duyệt miễn xác nhận ngoại lệ' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi khai báo ngoại lệ' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Phạm vi ngoại lệ'), { target: { value: 'RECONCILIATION' } })
    expect(screen.queryByLabelText('Dòng chứng từ liên quan')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Gạo/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Cà rốt/ }))
    fireEvent.change(screen.getByLabelText('Lý do khai báo ngoại lệ'), { target: { value: 'Chênh lệch đã đối soát' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi khai báo ngoại lệ' }))

    await waitFor(() => expect(mocks.declare).toHaveBeenCalledWith({
      id: 'run-1', body: { commandId: expect.stringMatching(/^service-run-variance-/), expectedVersion: 4, track: 'RECONCILIATION', sourceLineIds: ['source-1', 'source-2'], reason: 'Chênh lệch đã đối soát' },
    }))
    expect(mocks.refetch).toHaveBeenCalled()
  })

  it('lets the canonical Bếp trưởng role declare only a service-execution discrepancy', () => {
    mocks.user = { role: 'beptruong', isAdminFullAccess: false }
    render(<ServiceRunSection plans={plans as never[]} shiftName="MORNING" />)

    const track = screen.getByLabelText('Phạm vi ngoại lệ')
    expect(track).toHaveTextContent('Thực hiện phục vụ')
    expect(track).not.toHaveTextContent('Kế hoạch')
    expect(track).not.toHaveTextContent('Vật tư và cấp phát')
    expect(track).not.toHaveTextContent('Đối soát')
    expect(screen.getByRole('region', { name: 'Ngoại lệ đang chờ xử lý' })).toHaveTextContent('Đã đối chiếu')
    expect(screen.getByRole('region', { name: 'Ngoại lệ đang chờ xử lý' })).not.toHaveTextContent('declaration-1')
  })

  it('shows Admin a user-labelled pending declaration instead of a technical identifier field', async () => {
    mocks.user = { role: 'admin', isAdminFullAccess: true }
    render(<ServiceRunSection plans={plans as never[]} shiftName="MORNING" />)
    expect(screen.queryByRole('group', { name: 'Khai báo ngoại lệ Ca phục vụ' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Phê duyệt miễn xác nhận ngoại lệ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Phê duyệt miễn xác nhận' })).toBeDisabled()

    expect(screen.queryByLabelText('Mã tham chiếu khai báo')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Khai báo chờ duyệt'), { target: { value: 'declaration-1' } })
    fireEvent.change(screen.getByLabelText('Lý do phê duyệt miễn xác nhận'), { target: { value: 'Admin waiver hợp lệ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Phê duyệt miễn xác nhận' }))

    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith({
      id: 'run-1', declarationId: 'declaration-1', body: { commandId: expect.stringMatching(/^service-run-waiver-/), expectedVersion: 4, reason: 'Admin waiver hợp lệ' },
    }))
  })

  it('explains that an unsent plan cannot open a service run and does not expose the action', () => {
    mocks.persistedRun = null
    render(<ServiceRunSection plans={[{ planId: 'plan-2', planCode: 'KHSX-CHUA-GUI', sentToKitchenAt: null, lines: [{ shiftName: 'MORNING' }] }] as never[]} shiftName="MORNING" scope={exactScope} />)

    expect(screen.getByText('Kế hoạch chưa gửi Bếp. Hoàn tất bước gửi kế hoạch trước khi mở Ca phục vụ.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở Ca phục vụ' })).not.toBeInTheDocument()
    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('fails closed without an exact customer and price-tier scope', () => {
    mocks.persistedRun = null
    render(<ServiceRunSection plans={[{ planId: 'plan-2', planCode: 'KHSX-DA-GUI', sentToKitchenAt: '2026-08-12T01:00:00Z', lines: [{ shiftName: 'MORNING' }] }] as never[]} shiftName="MORNING" />)

    expect(screen.getByText('Chọn khách hàng và tier giá chính xác trước khi mở Ca phục vụ.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở Ca phục vụ' })).not.toBeInTheDocument()
    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('derives a separate user-labelled exact scope from each customer plan', async () => {
    mocks.persistedRun = null
    const customerPlans = [
      {
        planId: 'plan-anv', planCode: 'KHSX-ANV', planDate: '2026-08-12',
        customerId: 'customer-anv', customerName: 'Công ty ANV', sentToKitchenAt: '2026-08-12T01:00:00Z',
        lines: [{ shiftName: 'MORNING', priceTierAmount: 25000 }],
      },
      {
        planId: 'plan-dav', planCode: 'KHSX-DAV', planDate: '2026-08-12',
        customerId: 'customer-dav', customerName: 'Công ty DAV', sentToKitchenAt: '2026-08-12T01:00:00Z',
        lines: [{ shiftName: 'MORNING', priceTierAmount: 25000 }],
      },
    ]

    render(<ServiceRunSection plans={customerPlans as never[]} shiftName="MORNING" />)

    expect(screen.getByText(/Công ty ANV · 12\/08\/2026 · Ca sáng · 25\.000/)).toBeInTheDocument()
    expect(screen.getByText(/Công ty DAV · 12\/08\/2026 · Ca sáng · 25\.000/)).toBeInTheDocument()
    expect(mocks.scopeQueries).toEqual(expect.arrayContaining([
      { customerId: 'customer-anv', serviceDate: '2026-08-12', shiftName: 'MORNING', priceTierAmount: 25000 },
      { customerId: 'customer-dav', serviceDate: '2026-08-12', shiftName: 'MORNING', priceTierAmount: 25000 },
    ]))

    fireEvent.click(screen.getAllByRole('button', { name: 'Mở Ca phục vụ' })[0])
    await waitFor(() => expect(mocks.open).toHaveBeenCalledWith({
      planId: 'plan-anv', shiftName: 'MORNING', customerId: 'customer-anv', priceTierAmount: 25000,
    }))
  })
})
