import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ApprovalDecisionDialog } from './ApprovalDecisionDialog'

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
    ['backdrop', async (user: ReturnType<typeof userEvent.setup>) => user.click(document.querySelector<HTMLElement>('[data-ipc-dialog-portal="true"] [aria-hidden="true"]')!)],
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

  it('keeps rejection disabled until a nonblank reason exists', () => {
    renderDialog({ status: 'Reject', reason: '   ' })
    expect(screen.getByRole('button', { name: copy.submitLabel })).toBeDisabled()
  })

  it('vetoes Escape, backdrop, close and submit while mutation is loading', async () => {
    const user = userEvent.setup()
    const props = renderDialog({ isDeciding: true })
    expect(screen.getByRole('button', { name: 'Đang xử lý...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: copy.safeLabel })).toBeDisabled()
    await user.keyboard('{Escape}')
    await user.click(document.querySelector<HTMLElement>('[data-ipc-dialog-portal="true"] [aria-hidden="true"]')!)
    expect(props.onClose).not.toHaveBeenCalled()
    expect(props.onSubmit).not.toHaveBeenCalled()
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
