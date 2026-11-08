import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TableViewport } from './TableViewport'

describe('TableViewport scroll ownership', () => {
  it('keeps page-flow tables horizontal-only and reserves vertical ownership for weekly tables', () => {
    const view = render(<TableViewport ariaLabel="Bảng theo luồng trang"><table /></TableViewport>)
    const pageFlow = screen.getByRole('region', { name: 'Bảng theo luồng trang' })

    expect(pageFlow).toHaveClass('overflow-x-auto', 'overflow-y-visible')
    expect(pageFlow).not.toHaveClass('overflow-auto')
    expect(pageFlow).toHaveAttribute('data-vertical-scroll', 'page')

    view.rerender(<TableViewport ariaLabel="Bảng tuần có giới hạn" size="weekly"><table /></TableViewport>)
    const weekly = screen.getByRole('region', { name: 'Bảng tuần có giới hạn' })
    expect(weekly).toHaveClass('overflow-auto', 'h-[560px]', 'max-h-[560px]')
    expect(weekly).toHaveAttribute('data-vertical-scroll', 'bounded')
  })
})
