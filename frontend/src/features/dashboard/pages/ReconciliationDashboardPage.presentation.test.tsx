import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ReconciliationBatch } from '@/api/reconciliationApi'
import { ReconciliationDashboardPage } from './ReconciliationDashboardPage'

const mocks = vi.hoisted(() => ({
  listBatches: vi.fn(),
}))

vi.mock('@/api/reconciliationApi', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/reconciliationApi')>(),
  useListReconciliationBatchesQuery: mocks.listBatches,
}))

const batch = (batchId: string, status: ReconciliationBatch['status']): ReconciliationBatch => ({
  batchId,
  menuVersionId: `menu-${batchId}`,
  quantityImportBatchId: `import-${batchId}`,
  status,
  version: 1,
  createdAt: '2026-09-14T08:00:00Z',
  lines: [],
  customerId: 'customer-1',
  customerName: 'Khách hàng A',
  customerCode: 'KH-A',
})

describe('ReconciliationDashboardPage workflow presentation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    mocks.listBatches.mockReturnValue({
      data: [
        batch('ready', 'READY'),
        batch('transferred', 'TRANSFERRED'),
        batch('in-progress', 'IN_PROGRESS'),
        batch('completed', 'COMPLETED'),
      ],
    })
  })

  it('retires the repeated mode pill while preserving the four-step workflow and batch lifecycle links', () => {
    render(<MemoryRouter><ReconciliationDashboardPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Quy trình 4 bước' })).toBeInTheDocument()
    expect(screen.queryByText('Chế độ đối chiếu')).toBeNull()

    expect(screen.getByRole('link', { name: /BƯỚC 01 Kế hoạch tuần/ })).toHaveAttribute('href', '/weekly-menu')
    expect(screen.getByRole('link', { name: /BƯỚC 02 Định lượng xuất kho/ })).toHaveAttribute('href', '/weekly-menu?view=demand')
    expect(screen.getByRole('link', { name: /BƯỚC 03 Kho xuất thực tế/ })).toHaveAttribute('href', '/warehouse')
    expect(screen.getByRole('link', { name: /BƯỚC 04 Đối chiếu/ })).toHaveAttribute('href', '/reconciliation')

    expect(screen.getByText('Đã khóa')).toBeInTheDocument()
    expect(screen.getAllByText('Chờ Kho xuất')).not.toHaveLength(0)
    expect(screen.getAllByText('Đang đối chiếu')).not.toHaveLength(0)
    expect(screen.getByText('Hoàn tất')).toBeInTheDocument()
    expect(screen.getAllByText('Mở xử lý')).toHaveLength(4)
  })
})
