import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SupplementalRequestDialog } from './supplemental-request-dialog'

describe('SupplementalRequestDialog validation contract', () => {
  it('keeps the received-material label in the closed trigger', async () => {
    const user = userEvent.setup()
    render(
      <SupplementalRequestDialog
        open
        onOpenChange={vi.fn()}
        materials={[{ id: 'issue-line-1', name: 'Gạo', unit: 'kg', quantity: 5, status: 'Đã nhận', signed: true }]}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: /Nguyên liệu cần bổ sung/ }))
    await user.click(await screen.findByRole('option', { name: /Gạo/ }))

    const trigger = screen.getByRole('combobox', { name: /Nguyên liệu cần bổ sung/ })
    expect(trigger).toHaveTextContent('Gạo · đã nhận 5 kg')
    expect(trigger).not.toHaveTextContent('issue-line-1')
  })

  it('distinguishes same-name source lines with customer, shift and tier labels', async () => {
    const user = userEvent.setup()
    render(
      <SupplementalRequestDialog
        open
        onOpenChange={vi.fn()}
        materials={[
          { id: 'anv-line', name: 'Cá hố', unit: 'kg', quantity: 5, status: 'Đã nhận', signed: true, sourceCustomerName: 'AMANN (ANV)', sourceShiftName: 'AFTERNOON', sourcePriceTierAmount: 25000 },
          { id: 'dav-line', name: 'Cá hố', unit: 'kg', quantity: 5, status: 'Đã nhận', signed: true, sourceCustomerName: 'Draxlmaier (DAV)', sourceShiftName: 'AFTERNOON', sourcePriceTierAmount: 25000 },
        ]}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('combobox', { name: /Nguyên liệu cần bổ sung/ }))
    expect(await screen.findByRole('option', { name: /Cá hố · AMANN \(ANV\) · Ca chiều · 25\.000/ })).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: /Cá hố · Draxlmaier \(DAV\) · Ca chiều · 25\.000/ })).toBeInTheDocument()
  })

  it('associates invalid submit feedback with both affected fields', async () => {
    const user = userEvent.setup()
    render(
      <SupplementalRequestDialog
        open
        onOpenChange={vi.fn()}
        materials={[{ id: 'issue-line-1', name: 'Gạo', unit: 'kg', quantity: 5, status: 'Đã nhận', signed: true }]}
        isSubmitting={false}
        onSubmit={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Gửi tới kho' }))

    expect(screen.getByRole('combobox', { name: /Nguyên liệu cần bổ sung/ })).toHaveAccessibleDescription('Chọn nguyên liệu cần bổ sung.')
    expect(screen.getByLabelText('Số lượng cần thêm *')).toHaveAccessibleDescription('Nhập số lượng bổ sung lớn hơn 0.')
  })
})
