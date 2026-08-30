import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SystemOperationModeSettings } from './SystemOperationModeSettings'

const changeMutation = vi.fn()
let modeData = {
  mode: 'DEFAULT',
  label: 'Mặc định',
  version: 1,
  reasonRequired: false,
}

vi.mock('@/features/system-operation/systemOperationApi', () => ({
  useGetSystemOperationModeQuery: () => ({
    data: modeData,
    isError: false,
    refetch: vi.fn(),
  }),
  useChangeSystemOperationModeMutation: () => [changeMutation, { isLoading: false }],
}))

describe('SystemOperationModeSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    modeData = {
      mode: 'DEFAULT',
      label: 'Mặc định',
      version: 1,
      reasonRequired: false,
    }
  })

  it('renders current mode and opens ConfirmDialog on toggle click', async () => {
    changeMutation.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
    render(<SystemOperationModeSettings />)

    expect(screen.getByText('Mặc định')).toBeInTheDocument()
    expect(screen.getByText('Phiên bản cấu hình: 1')).toBeInTheDocument()

    const toggleButton = screen.getByRole('button', { name: 'Chuyển sang chế độ Đối chiếu nguyên liệu' })
    fireEvent.click(toggleButton)

    // Confirm dialog should appear
    expect(screen.getByRole('dialog', { name: /Xác nhận chuyển sang chế độ/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xác nhận chuyển chế độ' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển chế độ' }))
    await waitFor(() =>
      expect(changeMutation).toHaveBeenCalledWith({
        mode: 'MATERIAL_RECONCILIATION',
        expectedVersion: 1,
        confirmed: true,
        reason: 'Quản trị viên chuyển sang chế độ Đối chiếu nguyên liệu',
      })
    )
  })

  it('requires reason when reasonRequired is true (WIP in progress)', async () => {
    modeData = {
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 2,
      reasonRequired: true,
    }
    changeMutation.mockReturnValue({ unwrap: () => Promise.resolve({ success: true }) })
    render(<SystemOperationModeSettings />)

    const toggleButton = screen.getByRole('button', { name: 'Chuyển sang chế độ Mặc định' })
    fireEvent.click(toggleButton)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Nhập lý do chuyển chế độ vận hành/i)).toBeInTheDocument()

    // Try submitting without reason -> should be blocked
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển chế độ' }))
    expect(changeMutation).not.toHaveBeenCalled()

    // Enter reason and submit
    fireEvent.change(screen.getByPlaceholderText(/Nhập lý do chuyển chế độ vận hành/i), {
      target: { value: 'Bắt buộc chuyển chế độ theo yêu cầu quản lý ca' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển chế độ' }))
    await waitFor(() =>
      expect(changeMutation).toHaveBeenCalledWith({
        mode: 'DEFAULT',
        expectedVersion: 2,
        confirmed: true,
        reason: 'Bắt buộc chuyển chế độ theo yêu cầu quản lý ca',
      })
    )
  })
})
