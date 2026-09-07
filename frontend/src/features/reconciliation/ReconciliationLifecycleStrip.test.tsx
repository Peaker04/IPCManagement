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
    expect(screen.getByText(`Bước ${status === 'TRANSFERRED' ? 3 : status === 'IN_PROGRESS' ? 4 : 5}/5 · ${status === 'TRANSFERRED' ? 'Kho nguyên liệu' : 'Đối chiếu nguyên liệu'}`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent(status === 'TRANSFERRED' ? 'Chờ Kho xuất' : status === 'IN_PROGRESS' ? 'Đang đối chiếu' : 'Hoàn tất')
  })
})
