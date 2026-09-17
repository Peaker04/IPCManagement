import { useEffect, useRef } from 'react'
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  refetchCustomers: vi.fn(),
  rollbackImport: vi.fn(),
  historyQuery: vi.fn(),
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
  useCommitWeeklyMenuImportBatchMutation: () => [vi.fn(), { isLoading: false }],
  useCommitWeeklyMenuImportMutation: () => [vi.fn(), { isLoading: false }],
  useCreateCustomerContractMutation: () => [vi.fn(), { isLoading: false }],
  useDownloadWeeklyMenuTemplateMutation: () => [vi.fn(), { isLoading: false }],
  useGetWeeklyMenuImportHistoryQuery: (...args: unknown[]) => {
    mocks.historyQuery(...args)
    return readyQuery({ data: [] })
  },
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
    mocks.historyQuery.mockClear()
    mocks.rollbackImport.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) })
  })

  it('scopes import history to the active customer and resets its page when scope changes', () => {
    const { result, rerender } = renderHook(
      (options: Parameters<typeof useWeeklyMenuImport>[0]) => useWeeklyMenuImport(options),
      { initialProps: makeOptions() as Parameters<typeof useWeeklyMenuImport>[0] },
    )

    expect(mocks.historyQuery).toHaveBeenLastCalledWith(
      { customerId: 'customer-1', pageNumber: 1, pageSize: 10 },
      { skip: true },
    )
    act(() => result.current.setHistoryPage(3))
    expect(result.current.historyPage).toBe(3)
    rerender(makeOptions({ customerId: 'customer-2' }) as Parameters<typeof useWeeklyMenuImport>[0])
    expect(result.current.historyPage).toBe(1)
    expect(mocks.historyQuery).toHaveBeenLastCalledWith(
      { customerId: 'customer-2', pageNumber: 1, pageSize: 10 },
      { skip: true },
    )
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
    expect(document.getElementById('weekly-menu-import-file')).toHaveAttribute(
      'aria-describedby',
      'weekly-menu-import-file-error weekly-menu-import-file-meta',
    )
    expect(document.getElementById('weekly-menu-import-file')).toHaveAccessibleDescription(
      /Vui lòng chọn khách hàng và file Excel trước khi kiểm tra\./,
    )
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    expect(screen.getByText('File Excel').closest('label')).toHaveAttribute('for', 'weekly-menu-import-file')
  })

  it('keeps invalid-week validation beside the week field', async () => {
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
    expect(await screen.findByLabelText('Tuần bắt đầu')).toHaveAttribute('aria-invalid', 'true')
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

  it('keeps quick-customer submit enabled and diagnoses the first missing field', async () => {
    function Harness() {
      const workflow = useWeeklyMenuImport(makeOptions())
      const initialized = useRef(false)
      useEffect(() => {
        if (initialized.current) return
        initialized.current = true
        workflow.actions.open()
        workflow.actions.toggleQuickCustomer()
      }, [workflow.actions])
      return <WeeklyMenuImportSetup workflow={workflow} />
    }

    render(<Harness />)
    const createButton = await screen.findByRole('button', { name: 'Tạo và chọn' })
    expect(createButton).toBeEnabled()
    fireEvent.click(createButton)

    const code = screen.getByRole('textbox', { name: 'Mã khách hàng' })
    await waitFor(() => expect(code).toHaveFocus())
    expect(code).toHaveAttribute('aria-invalid', 'true')
    expect(code).toHaveAccessibleDescription('Mã khách hàng là bắt buộc.')
  })

  it('gives quick-customer inputs programmatic names from their visible labels', () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions()))
    act(() => result.current.actions.open())
    act(() => result.current.actions.toggleQuickCustomer())

    render(<WeeklyMenuImportSetup workflow={result.current} />)

    expect(screen.getByRole('textbox', { name: 'Mã khách hàng' })).toHaveAttribute('id', 'weekly-menu-import-quick-customer-code')
    expect(screen.getByRole('textbox', { name: 'Mã khách hàng' })).toBeRequired()
    expect(screen.getByText('Mã khách hàng').closest('label')).toHaveAttribute('for', 'weekly-menu-import-quick-customer-code')
    expect(screen.getByText('Mã khách hàng').closest('label')).toHaveTextContent('*')
    expect(screen.getByRole('textbox', { name: 'Tên khách hàng' })).toHaveAttribute('id', 'weekly-menu-import-quick-customer-name')
    expect(screen.getByRole('textbox', { name: 'Tên khách hàng' })).toBeRequired()
    expect(screen.getByText('Tên khách hàng', { selector: 'span' }).closest('label')).toHaveAttribute('for', 'weekly-menu-import-quick-customer-name')
    expect(screen.getByText('Tên khách hàng', { selector: 'span' }).closest('label')).toHaveTextContent('*')
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

  it('composes import file parsing details into six decision columns', () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions()))
    act(() => result.current.actions.open())
    render(<WeeklyMenuImportDialog workflow={result.current} />)

    const jobsRegion = screen.getByRole('region', { name: 'Danh sách file thực đơn chờ kiểm tra' })
    expect(within(jobsRegion).getAllByRole('columnheader')).toHaveLength(6)
    expect(within(jobsRegion).getByRole('columnheader', { name: 'Tuần / định mức' })).toBeInTheDocument()
    expect(within(jobsRegion).getByRole('columnheader', { name: 'Kết quả đọc' })).toBeInTheDocument()
  })

  it('keeps rollback confirmation inside the retained import page surface', () => {
    const { result } = renderHook(() => useWeeklyMenuImport(makeOptions()))
    act(() => {
      result.current.actions.open()
      result.current.setHistoryPage(3)
      result.current.actions.requestRollback('menu-version-1', 'ANV · tuần 27/07/2026')
    })

    render(<WeeklyMenuImportDialog workflow={result.current} surface="page" />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Nhập thực đơn từ Excel' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('ANV · tuần 27/07/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy' }))
    expect(mocks.rollbackImport).toHaveBeenCalledWith('menu-version-1')
    expect(result.current.historyPage).toBe(3)
  })
})
