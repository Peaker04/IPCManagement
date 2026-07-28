import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './button'

describe('Button', () => {
  it('keeps long Vietnamese action labels on one line by default', () => {
    render(<Button>Xác nhận nhà cung cấp cho nguyên liệu</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('h-10', 'px-4', 'whitespace-nowrap', 'break-keep', '[overflow-wrap:normal]')
    expect(button).toHaveAttribute('data-text-wrap', 'nowrap')
    expect(button).not.toHaveClass('whitespace-normal')
  })

  it('provides an explicit wrapping contract for bounded card actions', () => {
    render(<Button textWrap="wrap">Hoàn tất nhu cầu nguyên liệu trong ngày</Button>)

    expect(screen.getByRole('button')).toHaveAttribute('data-text-wrap', 'wrap')
    expect(screen.getByRole('button')).toHaveClass(
      'h-auto',
      'min-h-10',
      'whitespace-normal',
      'break-normal',
    )
  })

  it('uses the canonical desktop control heights', () => {
    const { rerender } = render(<Button size="xs">XS</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-8')

    rerender(<Button size="sm">SM</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-9')

    rerender(<Button>Default</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-10')

    rerender(<Button size="lg">LG</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-11')
  })
})
