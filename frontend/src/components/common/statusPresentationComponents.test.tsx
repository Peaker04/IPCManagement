import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContextStrip } from './ContextStrip'
import { StatusBadge } from './StatusBadge'

describe('shared status presentation components', () => {
  it('renders informational status badges through the shared primitive', () => {
    render(<StatusBadge variant="info">Đang đồng bộ</StatusBadge>)
    expect(screen.getByText('Đang đồng bộ').closest('.ipc-status-badge')).toHaveClass('is-info')
  })

  it('keeps successful metrics quiet by default', () => {
    render(<ContextStrip items={[{ label: 'Cảnh báo', value: '0', tone: 'success' }]} />)
    expect(screen.getByText('0').closest('.ipc-context-badge')).toHaveClass('is-success', 'is-quiet')
  })

  it('allows a true status signal to opt into strong emphasis', () => {
    render(<ContextStrip items={[{ label: 'Trạng thái', value: 'Sẵn sàng', tone: 'success', emphasis: 'strong' }]} />)
    expect(screen.getByText('Sẵn sàng').closest('.ipc-context-badge')).toHaveClass('is-success')
    expect(screen.getByText('Sẵn sàng').closest('.ipc-context-badge')).not.toHaveClass('is-quiet')
  })
})
