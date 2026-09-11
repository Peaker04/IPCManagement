import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ReconciliationLifecycleStrip } from './ReconciliationLifecycleStrip'

describe('ReconciliationLifecycleStrip', () => {
  it.each([
    ['TRANSFERRED', 'Mở danh sách cần xuất', '/warehouse?view=demand&batchId=batch-1'],
    ['IN_PROGRESS', 'Mở đối chiếu', '/reconciliation?batchId=batch-1'],
    ['COMPLETED', 'Mở kết quả', '/reconciliation?batchId=batch-1'],
  ] as const)('keeps %s status and primary route aligned', (status, label, href) => {
    render(<MemoryRouter><ReconciliationLifecycleStrip status={status} batchId="batch-1" /></MemoryRouter>)
    expect(screen.getByText(`Tiến độ lô · Bước ${status === 'TRANSFERRED' ? 3 : status === 'IN_PROGRESS' ? 4 : 5}/5`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    const currentLabel = status === 'TRANSFERRED' ? 'Chờ Kho xuất' : status === 'IN_PROGRESS' ? 'Đang đối chiếu' : 'Hoàn tất'
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent(currentLabel)
    expect(screen.getAllByRole('listitem', { name: `Bước hiện tại: ${currentLabel}` })).toHaveLength(1)
  })

  it('encodes completed, current, and future steps without relying on color alone', () => {
    render(<MemoryRouter><ReconciliationLifecycleStrip status="TRANSFERRED" batchId="batch-1" /></MemoryRouter>)
    expect(screen.getByRole('listitem', { name: 'Đã hoàn tất: Đang chuẩn bị' })).toHaveTextContent('✓1. Đang chuẩn bị')
    expect(screen.getByRole('listitem', { name: 'Đã hoàn tất: Đã khóa' })).toHaveTextContent('✓2. Đã khóa')
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveAccessibleName(/Bước hiện tại: Chờ Kho xuất/)
    expect(screen.getByText('4. Đang đối chiếu')).toHaveClass('text-slate-500')
    expect(screen.getByText('5. Hoàn tất')).toHaveClass('text-slate-500')
  })
})
