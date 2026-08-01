import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refetchCustomers: vi.fn(),
  rollbackImport: vi.fn(),
}))

const readyQuery = <T,>(data: T) => ({
  data,
  currentData: data,
  isUninitialized: false,
  isLoading: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  error: undefined,
  refetch: vi.fn(),
})

vi.mock('@/api/coordinationApi', () => ({
  useCommitWeeklyMenuImportMutation: () => [vi.fn(), { isLoading: false }],
  useCreateCustomerContractMutation: () => [vi.fn(), { isLoading: false }],
  useDownloadWeeklyMenuTemplateMutation: () => [vi.fn(), { isLoading: false }],
  useGetWeeklyMenuImportHistoryQuery: () => readyQuery({ data: [] }),
  usePreviewWeeklyMenuImportMutation: () => [vi.fn(), { isLoading: false }],
  useRollbackWeeklyMenuImportMutation: () => [mocks.rollbackImport, { isLoading: false }],
  useSaveCustomerImportMappingMutation: () => [vi.fn(), { isLoading: false }],
}))

import { WeeklyMenuImportDialog } from './WeeklyMenuImportDialog'
import { WeeklyMenuImportSetup } from './WeeklyMenuImportSetup'
import { useWeeklyMenuImport } from './useWeeklyMenuImport'

const customer = {
  customerId: 'customer-1',
  customerCode: 'ANV',
  customerName: 'Khách hàng ANV',
}

const makeOptions = (overrides: Record<string, unknown> = {}) => ({
  customers: [customer],
  isCustomerLoading: false,
  isCustomerError: false,
  refetchCustomers: mocks.refetchCustomers,
  customerId: customer.customerId,
  weekStartDate: '2026-07-27',
  menuPrice: 25000 as const,
  displayDays: [],
  todayIso: '2026-07-30',
  onCustomerCreated: vi.fn(),
  onMenuCommitted: vi.fn(),
  ...overrides,
})

describe('Weekly Menu Import setup feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rollbackImport.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) })
  })

  it('keeps missing customer and file validation beside both affected fields', () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions({ customers: [], customerId: '' })))

    act(() => result.current.actions.open())
    act(() => result.current.actions.addJob())

    expect(result.current.state.setupErrors).toEqual({
      customer: {
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn khách hàng và file Excel trước khi kiểm tra.',
      },
      file: {
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn khách hàng và file Excel trước khi kiểm tra.',
      },
    })
    expect(result.current.state.feedback).toBeNull()

    render(<WeeklyMenuImportSetup workflow={result.current} />)

    expect(screen.getByLabelText('Khách hàng')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Khách hàng')).toHaveAccessibleDescription()
    expect(document.getElementById('weekly-menu-import-file')).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById('weekly-menu-import-file')).toHaveAccessibleDescription()
  })

  it('keeps invalid-week validation beside the week field', () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions({ weekStartDate: '2026-07-28' })))

    act(() => result.current.actions.open())
    act(() => result.current.actions.selectFile(new File(['menu'], 'menu.xlsx')))
    act(() => result.current.actions.addJob())

    expect(result.current.state.setupErrors).toEqual({
      weekStartDate: {
        title: 'Ngày bắt đầu tuần không hợp lệ',
        message: 'Vui lòng chọn ngày thứ 2 để hệ thống đọc đúng các cột trong tuần.',
      },
    })
    expect(result.current.state.feedback).toBeNull()

    render(<WeeklyMenuImportSetup workflow={result.current} />)
    expect(screen.getByLabelText('Tuần bắt đầu')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Tuần bắt đầu')).toHaveAccessibleDescription()
  })

  it('keeps template-download validation beside the field that blocks it', async () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions({ customerId: '' })))

    act(() => result.current.actions.open())
    await act(() => result.current.actions.downloadWeeklyMenuTemplate())
    expect(result.current.state.setupErrors).toEqual({
      customer: {
        title: 'Chọn khách hàng',
        message: 'Vui lòng chọn hoặc tạo khách hàng trước khi tải mẫu thực đơn riêng.',
      },
    })

    act(() => {
      result.current.actions.selectDraftCustomer(customer.customerId)
      result.current.actions.selectWeek('2026-07-28')
    })
    await act(() => result.current.actions.downloadWeeklyMenuTemplate())
    expect(result.current.state.setupErrors).toEqual({
      weekStartDate: {
        title: 'Chọn tuần bắt đầu',
        message: 'Vui lòng chọn ngày thứ 2 trước khi tải mẫu để file có đúng cột ngày trong tuần.',
      },
    })
    expect(result.current.state.feedback).toBeNull()
  })

  it('offers a retry action when the customer query fails', () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions({ isCustomerError: true })))
    act(() => result.current.actions.open())

    render(<WeeklyMenuImportDialog workflow={result.current} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }))

    expect(mocks.refetchCustomers).toHaveBeenCalledOnce()
  })

  it('renders import job status through the canonical compact status contract', () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions()))
    act(() => {
      result.current.actions.open()
      result.current.actions.selectFile(new File(['menu'], 'menu.xlsx'))
    })
    act(() => result.current.actions.addJob())

    render(<WeeklyMenuImportDialog workflow={result.current} />)

    const statusLabels = screen.getAllByText('Chưa kiểm tra', { exact: true })
    expect(statusLabels).toHaveLength(2)
    statusLabels.forEach((label) => expect(label.closest('.ipc-status-badge')).toBeInTheDocument())
  })

  it('uses the simple confirmation contract for rollback', () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions()))
    act(() => {
      result.current.actions.open()
      result.current.actions.requestRollback('menu-version-1', 'ANV · tuần 27/07/2026')
    })

    render(<WeeklyMenuImportDialog workflow={result.current} />)

    expect(screen.getByRole('dialog', { name: 'Xác nhận hủy phiên import' })).toHaveTextContent('ANV · tuần 27/07/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
    expect(mocks.rollbackImport).toHaveBeenCalledWith('menu-version-1')
  })
})
