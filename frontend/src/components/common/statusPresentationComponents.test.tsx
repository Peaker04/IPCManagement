import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ContextStrip } from './ContextStrip'
import { StatusBadge } from './StatusBadge'

describe('shared status presentation components', () => {
  it('renders informational status badges through the shared primitive', () => {
    render(<StatusBadge variant="info">Đang đồng bộ</StatusBadge>)
    expect(screen.getByRole('status', { name: 'Đang đồng bộ' })).toHaveClass('is-info')
  })

  it('keeps long text readable to assistive technology without wrapping the visual label', () => {
    render(<StatusBadge>Đang đồng bộ dữ liệu vận hành trong ca phục vụ</StatusBadge>)
    const status = screen.getByRole('status', { name: 'Đang đồng bộ dữ liệu vận hành trong ca phục vụ' })
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('title', 'Đang đồng bộ dữ liệu vận hành trong ca phục vụ')
    expect(status).toHaveAttribute('data-size', 'default')
    expect(status).toHaveClass('cell-status')
    expect(status.querySelector('.ipc-status-badge-label')).toHaveClass('whitespace-nowrap')
    expect(status.querySelector('.ipc-status-badge-label')).not.toHaveClass('truncate', 'overflow-hidden')
  })

  it('uses an explicit accessible label when the visual status is not text', () => {
    render(<StatusBadge fullLabel="Đang đồng bộ"><span aria-hidden="true">…</span></StatusBadge>)
    expect(screen.getByRole('status', { name: 'Đang đồng bộ' })).toBeInTheDocument()
  })

  it.each(['sm', 'default', 'lg'] as const)('supports the approved %s status size', (size) => {
    render(<StatusBadge size={size}>Sẵn sàng</StatusBadge>)
    expect(screen.getByRole('status', { name: 'Sẵn sàng' })).toHaveAttribute('data-size', size)
  })

  it('keeps one stable geometry owner while status text changes', () => {
    const { rerender } = render(<StatusBadge variant="warning">Đang xử lý</StatusBadge>)
    const status = screen.getByRole('status', { name: 'Đang xử lý' })
    expect(status).toHaveAttribute('data-layout-owner', 'status-badge')
    expect(status).toHaveClass('min-h-5')

    rerender(<StatusBadge variant="success">Đã hoàn tất</StatusBadge>)
    expect(screen.getByRole('status', { name: 'Đã hoàn tất' })).toBe(status)
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
