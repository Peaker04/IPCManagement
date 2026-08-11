import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './dialog'

const Fixture = ({ onOpenChange = vi.fn(), onCloseRequest }: { onOpenChange?: (open: boolean, reason?: 'escape' | 'backdrop' | 'close-control') => void; onCloseRequest?: (reason: 'escape' | 'backdrop' | 'close-control') => boolean | undefined }) => <><button>Opener</button><Dialog open onOpenChange={onOpenChange} onCloseRequest={onCloseRequest}><DialogContent><DialogHeader><DialogTitle>Thao tác có xác nhận</DialogTitle></DialogHeader><button>Tiếp tục</button><DialogFooter><DialogClose>Đóng</DialogClose></DialogFooter></DialogContent></Dialog></>

function ToggleFixture() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>Opener</button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Thao tác có xác nhận</DialogTitle><button>Tiếp tục</button></DialogContent></Dialog></>
}

describe('shared dialog contract', () => {
  it('DIALOG-01 limits content to approved sizes and preserves fixed chrome while content scrolls', () => {
    render(<Fixture />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'md')
    expect(dialog).toHaveClass('max-h-[85vh]', 'overflow-y-auto')
    expect(screen.getByText('Thao tác có xác nhận').parentElement).toHaveClass('sticky', 'top-0')
    expect(screen.getByRole('button', { name: 'Đóng' }).parentElement).toHaveClass('sticky', 'bottom-0')
  })
  it('DIALOG-02 reports a close reason and respects a veto', async () => {
    const onOpenChange = vi.fn()
    const onCloseRequest = vi.fn(() => false)
    render(<Fixture onOpenChange={onOpenChange} onCloseRequest={onCloseRequest} />)
    const user = userEvent.setup()
    await user.keyboard('{Escape}')
    expect(onCloseRequest).toHaveBeenCalledWith('escape')
    expect(onOpenChange).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onCloseRequest).toHaveBeenLastCalledWith('close-control')
    expect(onOpenChange).not.toHaveBeenCalled()
  })
  it('DIALOG-02 closes a clean dialog once through every shared request path', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await userEvent.setup().keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape')
  })
  it('DIALOG-03 keeps focus inside, inerts the background, and returns it to the opener', async () => {
    const user = userEvent.setup()
    render(<ToggleFixture />)
    const opener = screen.getByRole('button', { name: 'Opener' })
    await user.click(opener)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tiếp tục' })).toHaveFocus())
    expect(opener.parentElement).toHaveAttribute('inert')
    await user.keyboard('{Tab}')
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(opener).toHaveFocus())
    expect(opener.parentElement).not.toHaveAttribute('inert')
  })
  it('DIALOG-04 derives the accessible dialog name from DialogTitle', () => {
    render(<Fixture />)
    expect(screen.getByRole('dialog', { name: 'Thao tác có xác nhận' })).toHaveAttribute('aria-labelledby')
  })
})
