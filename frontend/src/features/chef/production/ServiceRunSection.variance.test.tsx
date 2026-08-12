import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const run = {
  serviceRunId: 'run-1', planId: 'plan-1', planCode: 'KHSX-01', serviceDate: '2026-08-12', shiftName: 'MORNING', status: 'RECONCILIATION_REQUIRED',
  blockers: ['UNRESOLVED_VARIANCE'], canStartService: false, canRecordActualServings: false, canConfirmService: false,
  canWaiveServiceConfirmation: false, canResolveVariance: false, canResolveServingVariance: false, canClose: false, serviceConfirmationOutcome: 'PENDING',
  plannedServings: 40, actualServings: 39, materialRequestLineCount: 2, issueCount: 1, unreceivedIssueCount: 0, openSupplementalCount: 0,
  unreceivedReturnCount: 0, hasBomBlocker: false, adjustmentCount: 0,
}

const mocks = vi.hoisted(() => ({
  user: { role: 'quanly', isAdminFullAccess: false },
  persistedRun: null as unknown,
  open: vi.fn(),
  declare: vi.fn(),
  approve: vi.fn(),
  refetch: vi.fn(),
}))

vi.mock('react-redux', () => ({ useSelector: (selector: (state: unknown) => unknown) => selector({ auth: { user: mocks.user } }) }))
vi.mock('../chefApi', () => {
  const idle = () => [vi.fn(), { isLoading: false }]
  return {
    useGetServiceRunByPlanQuery: () => ({ data: mocks.persistedRun, isFetching: false, isError: false, refetch: mocks.refetch }),
    useOpenServiceRunMutation: () => [mocks.open, { isLoading: false }], useStartServiceRunMutation: idle, useRecordServiceRunActualServingsMutation: idle,
    useConfirmServiceRunMutation: idle, useResolveServiceRunVarianceMutation: idle, useResolveServiceRunServingVarianceMutation: idle,
    useWaiveServiceRunConfirmationMutation: idle, useCloseServiceRunMutation: idle, useCreateServiceRunAdjustmentMutation: idle,
    useDeclareServiceRunVarianceMutation: () => [mocks.declare, { isLoading: false }],
    useApproveServiceRunVarianceWaiverMutation: () => [mocks.approve, { isLoading: false }],
  }
})

import { ServiceRunSection } from './ServiceRunSection'

const plans = [{ planId: 'plan-1', planCode: 'KHSX-01', lines: [{ shiftName: 'MORNING' }] }]
const resolved = () => ({ unwrap: () => Promise.resolve(run) })

describe('ServiceRun variance controls', () => {
  beforeEach(() => {
    mocks.user = { role: 'quanly', isAdminFullAccess: false }
    mocks.persistedRun = run
    mocks.open.mockReset().mockReturnValue(resolved())
    mocks.declare.mockReset().mockReturnValue(resolved())
    mocks.approve.mockReset().mockReturnValue(resolved())
    mocks.refetch.mockReset().mockResolvedValue({ data: run })
  })

  it('requires Manager scope, document references and reason before wiring a declaration then refetching', async () => {
    render(<ServiceRunSection plans={plans as never[]} shiftName="MORNING" />)
    expect(screen.getByRole('group', { name: 'Khai báo ngoại lệ Ca phục vụ' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Phê duyệt waiver ngoại lệ' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi khai báo ngoại lệ' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Phạm vi ngoại lệ'), { target: { value: 'RECONCILIATION' } })
    fireEvent.change(screen.getByLabelText('Dòng chứng từ liên quan'), { target: { value: 'source-1, source-2' } })
    fireEvent.change(screen.getByLabelText('Lý do khai báo ngoại lệ'), { target: { value: 'Chênh lệch đã đối soát' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi khai báo ngoại lệ' }))

    await waitFor(() => expect(mocks.declare).toHaveBeenCalledWith({
      id: 'run-1', body: { track: 'RECONCILIATION', sourceLineIds: ['source-1', 'source-2'], reason: 'Chênh lệch đã đối soát' },
    }))
    expect(mocks.refetch).toHaveBeenCalled()
  })

  it('shows Admin only the waiver control and requires a different declaration identifier plus reason', async () => {
    mocks.user = { role: 'admin', isAdminFullAccess: true }
    render(<ServiceRunSection plans={plans as never[]} shiftName="MORNING" />)
    expect(screen.queryByRole('group', { name: 'Khai báo ngoại lệ Ca phục vụ' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Phê duyệt waiver ngoại lệ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Phê duyệt waiver' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Mã tham chiếu khai báo'), { target: { value: 'declaration-1' } })
    fireEvent.change(screen.getByLabelText('Lý do phê duyệt miễn xác nhận'), { target: { value: 'Admin waiver hợp lệ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Phê duyệt waiver' }))

    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith({
      id: 'run-1', declarationId: 'declaration-1', body: { reason: 'Admin waiver hợp lệ' },
    }))
  })

  it('explains that an unsent plan cannot open a service run and does not expose the action', () => {
    mocks.persistedRun = null
    render(<ServiceRunSection plans={[{ planId: 'plan-2', planCode: 'KHSX-CHUA-GUI', sentToKitchenAt: null, lines: [{ shiftName: 'MORNING' }] }] as never[]} shiftName="MORNING" />)

    expect(screen.getByText('Kế hoạch chưa gửi Bếp. Hoàn tất bước gửi kế hoạch trước khi mở Ca phục vụ.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở Ca phục vụ' })).not.toBeInTheDocument()
    expect(mocks.open).not.toHaveBeenCalled()
  })
})
