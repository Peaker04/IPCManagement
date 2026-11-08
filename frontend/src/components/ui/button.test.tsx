import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button variant contract', () => {
  it('exposes the semantic variant for shared stylesheet ownership', () => {
    render(<Button variant="default">Thao tác chính</Button>)

    expect(screen.getByRole('button', { name: 'Thao tác chính' })).toHaveAttribute('data-variant', 'default')
  })
})
