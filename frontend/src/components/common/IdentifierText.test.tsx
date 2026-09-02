import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IdentifierText } from './IdentifierText'

describe('IdentifierText', () => {
  it('keeps a technical identifier atomic while exposing its complete value', () => {
    const value = 'RCP-SAMPLE-20260521-C130BD1FF6-2'
    render(<IdentifierText value={value} />)

    const identifier = screen.getByText(value)
    expect(identifier).toHaveAttribute('title', value)
    expect(identifier).toHaveClass('whitespace-nowrap', 'text-ellipsis', 'overflow-hidden')
    expect(identifier).not.toHaveClass('break-all')
  })

  it('renders a visible fallback for missing identifiers', () => {
    render(<IdentifierText value={null} fallback="Chưa có mã" />)
    expect(screen.getByText('Chưa có mã')).toBeInTheDocument()
  })
})
