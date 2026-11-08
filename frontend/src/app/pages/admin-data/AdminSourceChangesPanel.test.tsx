import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReconciliationBatch } from '@/api/reconciliationApi'
import { clearReconciliationSelection } from '@/lib/navigationPreferences'
import { AdminSourceChangesPanel } from './AdminSourceChangesPanel'

const { queryState } = vi.hoisted(() => ({
  queryState: { batches: [] as ReconciliationBatch[] },
}))

const batch: ReconciliationBatch = {
  batchId: 'batch-1',
  menuVersionId: 'menu-1',
  quantityImportBatchId: 'import-1',
  status: 'IN_PROGRESS',
  version: 1,
  createdAt: '2026-09-05T08:00:00Z',
  lines: [],
  customerId: 'customer-1',
  customerName: 'Khách hàng An Bình',
  customerCode: 'AB',
}

const ready = <T,>(data: T) => ({
  data,
  currentData: data,
  isLoading: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
  isUninitialized: false,
  refetch: vi.fn(),
})

vi.mock('@/api/reconciliationApi', () => ({
  useListReconciliationBatchesQuery: () => ready(queryState.batches),
  useListReconciliationSourceChangesQuery: () => ready([]),
}))

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/admin-data?view=source-changes&batchId=batch-1']}>
      <AdminSourceChangesPanel model={{ effectiveActiveView: 'source-changes' }} />
    </MemoryRouter>,
  )
}

describe('Admin source-change route-primary heading states', () => {
  beforeEach(() => {
    clearReconciliationSelection()
    queryState.batches = [batch]
  })

  it('renders the selected batch source history as the route-primary h2', () => {
    renderPanel()

    expect(screen.getByRole('heading', { level: 2, name: 'Lịch sử thay đổi nguồn' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Lịch sử thay đổi nguồn' })).not.toBeInTheDocument()
  })

  it('renders the no-batches ready state as the route-primary h2', () => {
    queryState.batches = []
    renderPanel()

    expect(screen.getByRole('heading', { level: 2, name: 'Chưa có lô đối chiếu' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Chưa có lô đối chiếu' })).not.toBeInTheDocument()
  })

  it('renders the filtered no-match state as the route-primary h2', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('combobox', { name: 'Lọc theo trạng thái' }))
    await user.click(screen.getByRole('option', { name: 'Đã hoàn tất' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Không có lô phù hợp với bộ lọc' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Không có lô phù hợp với bộ lọc' })).not.toBeInTheDocument()
  })
})
