import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './dialog'

const Fixture = ({ onOpenChange = vi.fn(), onCloseRequest }: { onOpenChange?: (open: boolean, reason?: 'escape' | 'backdrop' | 'close-control') => void; onCloseRequest?: (reason: 'escape' | 'backdrop' | 'close-control') => boolean | undefined }) => <><button>Opener</button><Dialog open onOpenChange={onOpenChange} onCloseRequest={onCloseRequest}><DialogContent><DialogHeader><DialogTitle>Thao tác có xác nhận</DialogTitle></DialogHeader><button>Tiếp tục</button><DialogFooter><DialogClose>Đóng</DialogClose></DialogFooter></DialogContent></Dialog></>

function ToggleFixture() {
  const [open, setOpen] = useState(false)
  return <><button onClick={() => setOpen(true)}>Opener</button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>Thao tác có xác nhận</DialogTitle><button>Tiếp tục</button></DialogContent></Dialog></>
}

function ControlledInputFixture() {
  const [value, setValue] = useState('')
  return <Dialog open onOpenChange={() => undefined}><DialogContent><DialogTitle>Nhập số suất</DialogTitle><button>Đóng</button><input aria-label="Số suất" value={value} onChange={(event) => setValue(event.target.value)} /></DialogContent></Dialog>
}

function BodyScrollFixture() {
  return <Dialog open onOpenChange={() => undefined}><DialogContent scrollMode="body"><DialogHeader><DialogTitle>Luồng dài</DialogTitle></DialogHeader><DialogBody><div>Nội dung dài</div></DialogBody><DialogFooter><DialogClose>Đóng</DialogClose></DialogFooter></DialogContent></Dialog>
}

describe('shared dialog contract', () => {
  it('DIALOG-01 limits content to approved sizes and preserves fixed chrome while content scrolls', () => {
    render(<Fixture />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('data-size', 'md')
    expect(dialog).toHaveClass('max-h-[85vh]', 'overflow-y-auto')
    expect(screen.getByText('Thao tác có xác nhận').parentElement).toHaveClass('sticky', 'top-0')
    expect(screen.getByRole('button', { name: 'Đóng' }).parentElement).toHaveClass('sticky', 'bottom-0', 'flex-wrap')
  })
  it('DIALOG-07 keeps the positioning layer out of the vertical scroll chain', () => {
    render(<Fixture />)
    const outside = document.querySelector<HTMLElement>('[data-ipc-dialog-outside="true"]')
    expect(outside).toHaveClass('overflow-hidden')
    expect(outside).not.toHaveClass('overflow-y-auto')
  })
  it('DIALOG-08 gives long workflows one declared primary vertical scroll owner', () => {
    render(<BodyScrollFixture />)
    const dialog = screen.getByRole('dialog', { name: 'Luồng dài' })
    const body = dialog.querySelector<HTMLElement>('[data-slot="dialog-body"]')
    expect(dialog).toHaveAttribute('data-scroll-mode', 'body')
    expect(dialog).toHaveClass('h-[calc(100dvh-2rem)]', 'overflow-hidden')
    expect(dialog).not.toHaveClass('overflow-y-auto')
    expect(body).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto', 'overscroll-contain')
    expect(screen.getByText('Luồng dài').parentElement).toHaveClass('shrink-0')
    expect(screen.getByRole('button', { name: 'Đóng' }).parentElement).toHaveClass('shrink-0')
  })
  it('DIALOG-09 locks background scrolling without global wheel or touchmove interception', () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
    render(<Fixture />)
    expect(addEventListener.mock.calls.some(([type]) => type === 'wheel' || type === 'touchmove')).toBe(false)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body).toHaveClass('ipc-modal-open')
    addEventListener.mockRestore()
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
    await user.click(document.querySelector<HTMLElement>('[data-ipc-dialog-outside="true"]')!)
    expect(onCloseRequest).toHaveBeenLastCalledWith('backdrop')
    expect(onOpenChange).not.toHaveBeenCalled()
  })
  it('DIALOG-02 closes a clean dialog through Escape and backdrop', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    const user = userEvent.setup()
    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape')
    await user.click(document.querySelector<HTMLElement>('[data-ipc-dialog-outside="true"]')!)
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'backdrop')
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
  it('DIALOG-03 preserves the active input when controlled content rerenders', async () => {
    const user = userEvent.setup()
    render(<ControlledInputFixture />)
    const input = screen.getByLabelText('Số suất')
    await user.click(input)
    await user.type(input, '800')
    expect(input).toHaveValue('800')
    expect(input).toHaveFocus()
  })
  it('DIALOG-03 recovers background interaction when a portal is removed unexpectedly', async () => {
    render(<Fixture />)
    const opener = screen.getByRole('button', { name: 'Opener' })
    const appRoot = opener.parentElement
    const portal = document.querySelector<HTMLElement>('[data-ipc-dialog-portal="true"]')

    expect(appRoot).toHaveAttribute('inert')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body).toHaveClass('ipc-modal-open')
    portal?.remove()

    await waitFor(() => expect(appRoot).not.toHaveAttribute('inert'))
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(document.body).not.toHaveClass('ipc-modal-open')
    if (portal) document.body.append(portal)
  })

  it('DIALOG-04 derives the accessible dialog name from DialogTitle', () => {
    render(<Fixture />)
    expect(screen.getByRole('dialog', { name: 'Thao tác có xác nhận' })).toHaveAttribute('aria-labelledby')
  })
  it('DIALOG-05 locks body scroll when open and restores when closed', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ToggleFixture />)
    expect(document.body.style.overflow).not.toBe('hidden')
    const opener = screen.getByRole('button', { name: 'Opener' })
    await user.click(opener)
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(document.body.style.overflow).toBe('hidden')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(document.body.style.overflow).not.toBe('hidden')
    unmount()
  })

  it('DIALOG-06 promotes the surviving dialog when an orphaned top portal is removed', async () => {
    const user = userEvent.setup()
    function OrphanedNestedFixture() {
      const [firstOpen, setFirstOpen] = useState(true)
      const [secondOpen, setSecondOpen] = useState(true)
      return <>
        <Dialog open={firstOpen} onOpenChange={setFirstOpen}><DialogContent><DialogTitle>Dialog còn lại</DialogTitle><button>Tiếp tục</button></DialogContent></Dialog>
        <Dialog open={secondOpen} onOpenChange={setSecondOpen}><DialogContent><DialogTitle>Dialog bị gỡ</DialogTitle><button>Đóng</button></DialogContent></Dialog>
      </>
    }

    render(<OrphanedNestedFixture />)
    const surviving = await screen.findByRole('dialog', { name: 'Dialog còn lại' })
    const removed = await screen.findByRole('dialog', { name: 'Dialog bị gỡ' })
    const removedPortal = removed.closest('[data-ipc-dialog-portal="true"]')
    removedPortal?.remove()

    await waitFor(() => expect(surviving.closest('[data-ipc-dialog-portal="true"]')).not.toHaveAttribute('inert'))
    expect(document.body.style.overflow).toBe('hidden')
    if (removedPortal) document.body.append(removedPortal)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Dialog còn lại' })).not.toBeInTheDocument())
  })

  it('DIALOG-06 handles nested modal stacking with proper depth, inert isolation, and scoped Escape', async () => {
    const user = userEvent.setup()
    function NestedFixture() {
      const [dialog1Open, setDialog1Open] = useState(false)
      const [dialog2Open, setDialog2Open] = useState(false)
      return (
        <div>
          <button onClick={() => setDialog1Open(true)}>Open Modal 1</button>
          <Dialog open={dialog1Open} onOpenChange={setDialog1Open}>
            <DialogContent>
              <DialogTitle>Modal Lớp 1</DialogTitle>
              <button onClick={() => setDialog2Open(true)}>Open Modal 2</button>
            </DialogContent>
          </Dialog>
          <Dialog open={dialog2Open} onOpenChange={setDialog2Open}>
            <DialogContent>
              <DialogTitle>Modal Lớp 2</DialogTitle>
              <button onClick={() => setDialog2Open(false)}>Close Modal 2</button>
            </DialogContent>
          </Dialog>
        </div>
      )
    }

    render(<NestedFixture />)
    await user.click(screen.getByRole('button', { name: 'Open Modal 1' }))
    const modal1 = await screen.findByRole('dialog', { name: 'Modal Lớp 1' })
    expect(modal1).toHaveAttribute('data-depth', '1')
    expect(modal1.closest('[data-ipc-dialog-portal="true"]')).not.toHaveAttribute('inert')

    // Open nested modal
    await user.click(screen.getByRole('button', { name: 'Open Modal 2' }))
    const modal2 = await screen.findByRole('dialog', { name: 'Modal Lớp 2' })
    expect(modal2).toHaveAttribute('data-depth', '2')

    // Modal 1 portal must be inert and marked as under
    const modal1Portal = modal1.closest('[data-ipc-dialog-portal="true"]')
    expect(modal1Portal).toHaveAttribute('inert')
    expect(modal1Portal).toHaveAttribute('data-ipc-dialog-under', 'true')

    // Modal 2 portal must NOT be inert
    const modal2Portal = modal2.closest('[data-ipc-dialog-portal="true"]')
    expect(modal2Portal).not.toHaveAttribute('inert')

    // First Escape closes ONLY Modal 2
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Modal Lớp 2' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Modal Lớp 1' })).toBeInTheDocument()
    expect(modal1Portal).not.toHaveAttribute('inert')
    expect(modal1Portal).not.toHaveAttribute('data-ipc-dialog-under')

    // Second Escape closes Modal 1
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Modal Lớp 1' })).not.toBeInTheDocument())
  })
})
