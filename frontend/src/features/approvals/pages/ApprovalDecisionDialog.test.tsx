import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApprovalDecisionDialog } from './ApprovalDecisionDialog'
import type { InventoryReceipt } from '@/api/workflowApiTypes'

const copy = { title: 'Duyệt đề xuất mua?', description: 'Kiểm tra trước khi duyệt.', safeLabel: 'Giữ đề xuất mua', submitLabel: 'Duyệt chứng từ' }

const renderDialog = (overrides: Partial<ComponentProps<typeof ApprovalDecisionDialog>> = {}) => {
  const props: ComponentProps<typeof ApprovalDecisionDialog> = {
    open: true,
    status: 'Approve',
    reason: '',
    error: null,
    isDeciding: false,
    copy,
    onReasonChange: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
  render(<ApprovalDecisionDialog {...props} />)
  return props
}

describe('ApprovalDecisionDialog controlled lazy contract', () => {
  it.each([
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    ['backdrop', async (user: ReturnType<typeof userEvent.setup>) => user.click(document.querySelector<HTMLElement>('[data-ipc-dialog-outside="true"]')!)],
    ['safe button', async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: copy.safeLabel }))],
  ])('closes without submitting through %s', async (_name, close) => {
    const user = userEvent.setup()
    const props = renderDialog()
    await close(user)
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('submits approval through Enter and the explicit submit button', async () => {
    const user = userEvent.setup()
    const props = renderDialog()
    const submit = screen.getByRole('button', { name: copy.submitLabel })
    submit.focus()
    await user.keyboard('{Enter}')
    await user.click(submit)
    expect(props.onSubmit).toHaveBeenCalledTimes(2)
  })

  it('allows blank rejection submit so validation can identify and focus the required field', async () => {
    const user = userEvent.setup()
    const props = renderDialog({ status: 'Reject', reason: '   ' })

    await user.click(screen.getByRole('button', { name: copy.submitLabel }))

    expect(props.onSubmit).toHaveBeenCalledOnce()
  })

  it('traps keyboard focus inside the dialog', async () => {
    const user = userEvent.setup()
    render(<button type="button">Outside</button>)
    renderDialog()

    screen.getByRole('button', { name: copy.submitLabel }).focus()
    await user.tab()

    expect(screen.getByLabelText('Ghi chú duyệt (tùy chọn)')).toHaveFocus()
  })

  it('asks before discarding a dirty reason and closes only after confirmation', async () => {
    const user = userEvent.setup()
    const props = renderDialog({ status: 'Reject', reason: 'Sai số lượng' })

    await user.keyboard('{Escape}')

    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Bỏ lý do đang nhập?')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }))
    expect(screen.getByLabelText('Lý do từ chối')).toHaveValue('Sai số lượng')
    expect(screen.getByRole('button', { name: copy.safeLabel })).toHaveFocus()

    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Bỏ thay đổi' }))
    expect(props.onClose).toHaveBeenCalledOnce()
  })

  it('vetoes Escape, backdrop, close and submit while mutation is loading', async () => {
    const user = userEvent.setup()
    const props = renderDialog({ isDeciding: true })
    expect(screen.getByRole('button', { name: 'Đang xử lý...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: copy.safeLabel })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(document.querySelector<HTMLElement>('[data-ipc-dialog-outside="true"]')!)
    expect(props.onClose).not.toHaveBeenCalled()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })

  it('shows receipt quality evidence before a manager decides', () => {
    renderDialog({
      receipt: {
        receiptId: 'receipt-1', receiptCode: 'RCP-001', qualityCheckedAt: '2026-09-12T02:00:00Z',
        lines: [{ receiptLineId: 'line-1', ingredientId: 'ingredient-1', ingredientName: 'Gạo', unitName: 'kg', quantity: 10, acceptedQuantity: 8, rejectedQuantity: 2, qualityReason: 'Bao rách' }],
      } as InventoryReceipt,
    })

    expect(screen.getByRole('region', { name: 'Bằng chứng kiểm tra phiếu nhập' })).toHaveTextContent('Đạt 8 kg · Không đạt 2 kg')
    expect(screen.getByText('Lý do: Bao rách')).toBeVisible()
  })

  it('blocks a receipt decision when quality evidence cannot be loaded', () => {
    renderDialog({ isReceiptError: true })
    expect(screen.getByRole('alert')).toHaveTextContent('quyết định đang bị chặn')
    expect(screen.getByRole('button', { name: copy.submitLabel })).toBeDisabled()
  })

  it('preserves dirty reason while exposing mutation error and retry', async () => {
    const user = userEvent.setup()
    const props = renderDialog({ status: 'Reject', reason: 'Sai số lượng', error: 'Không thể lưu quyết định.' })
    expect(screen.getByLabelText('Lý do từ chối')).toHaveValue('Sai số lượng')
    expect(screen.getByRole('alert')).toHaveTextContent('Không thể lưu quyết định.')
    await user.click(screen.getByRole('button', { name: 'Tải lại hàng đợi' }))
    expect(props.onRetry).toHaveBeenCalledOnce()
    expect(props.onSubmit).not.toHaveBeenCalled()
  })
})
