import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from './drawer'

function Fixture({ onBackground = vi.fn() }: { onBackground?: () => void }) {
  const [open, setOpen] = useState(true)
  return <>
    <button type="button" onClick={onBackground}>Nền vẫn thao tác được</button>
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Chi tiết đọc</DrawerTitle></DrawerHeader>
        <DrawerBody><button type="button">Thao tác trong drawer</button></DrawerBody>
        <DrawerFooter><button type="button" onClick={() => setOpen(false)}>Đóng</button></DrawerFooter>
      </DrawerContent>
    </Drawer>
  </>
}

describe('shared drawer contract', () => {
  it('keeps the background available and does not claim modal isolation', async () => {
    const onBackground = vi.fn()
    const user = userEvent.setup()
    const view = render(<Fixture onBackground={onBackground} />)
    const drawer = screen.getByRole('dialog', { name: 'Chi tiết đọc' })

    expect(drawer).toHaveAttribute('aria-modal', 'false')
    expect(view.container).not.toHaveAttribute('inert')
    expect(document.body.style.overflow).not.toBe('hidden')
    await user.click(screen.getByRole('button', { name: 'Nền vẫn thao tác được' }))
    expect(onBackground).toHaveBeenCalledOnce()
  })

  it('owns one body scroller with fixed header and footer', () => {
    render(<Fixture />)
    const drawer = screen.getByRole('dialog', { name: 'Chi tiết đọc' })
    const body = drawer.querySelector<HTMLElement>('[class*="overflow-y-auto"]')
    expect(body).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto')
    expect(screen.getByText('Chi tiết đọc').parentElement).toHaveClass('shrink-0')
    expect(screen.getByRole('button', { name: 'Đóng' }).parentElement).toHaveClass('shrink-0')
    expect(drawer.querySelectorAll('.overflow-y-auto')).toHaveLength(1)
  })

  it('closes through Escape without trapping background focus', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Chi tiết đọc' })).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Nền vẫn thao tác được' }).focus()
    expect(screen.getByRole('button', { name: 'Nền vẫn thao tác được' })).toHaveFocus()
  })
})
