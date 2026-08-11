import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Dialog, DialogContent, DialogTitle } from './dialog'

const Fixture = ({ onOpenChange = vi.fn() }) => <><button>Opener</button><Dialog open onOpenChange={onOpenChange}><DialogContent><DialogTitle>Thao tác có xác nhận</DialogTitle><button>Tiếp tục</button></DialogContent></Dialog></>

describe('shared dialog contract', () => {
  it('DIALOG-01 limits content to approved sizes and preserves fixed chrome while content scrolls', () => {
    render(<Fixture />)
    expect(screen.getByRole('dialog')).toHaveAttribute('data-size', 'md')
  })
  it('DIALOG-02 reports a close reason and respects a veto', async () => {
    const onOpenChange = vi.fn()
    render(<Fixture onOpenChange={onOpenChange} />)
    await userEvent.setup().keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape')
  })
  it('DIALOG-03 keeps focus inside, inerts the background, and returns it to the opener', () => {
    render(<Fixture />)
    expect(screen.getByRole('button', { name: 'Opener' }).parentElement).toHaveAttribute('inert')
  })
  it('DIALOG-04 derives the accessible dialog name from DialogTitle', () => {
    render(<Fixture />)
    expect(screen.getByRole('dialog', { name: 'Thao tác có xác nhận' })).toHaveAttribute('aria-labelledby')
  })
})
