import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/common/ToastProvider'
import type { StockMovement } from '@/types/workflow'
import { AdminInventoryPanel } from './AdminInventoryPanel'
import type { AdminDataPageModel } from './useAdminDataPageModel'

const ready = <T,>(data: T) => ({ phase: 'ready', data, isRefreshing: false, truncation: null }) as const

const adjustment: StockMovement = {
  id: 'movement-1',
  type: 'adjustment',
  documentNo: 'inventoryadjustment-20260924-001',
  material: 'Gạo tẻ',
  quantity: 5,
  beforeQty: 20,
  afterQty: 25,
  unit: 'kilogram',
  owner: 'Thủ kho',
  status: 'COMPLETED',
  nextAction: 'Đã ghi sổ',
  tone: 'success',
}

const model = ({ currentStockRows = [], adjustmentMovements = [adjustment], inventoryMovementSearch = '' }: { currentStockRows?: Array<Record<string, unknown>>; adjustmentMovements?: StockMovement[]; inventoryMovementSearch?: string } = {}) => ({
  adjustmentMovements,
  currentStockPage: 1,
  currentStockPageSize: 8,
  currentStockPageResponse: { pageNumber: 1, pageSize: 8, totalCount: currentStockRows.length, items: currentStockRows },
  currentStockRows,
  effectiveActiveView: 'inventory',
  inventoryMovementSearch,
  queryViews: {
    currentStock: ready({}),
    stockMovements: ready({}),
  },
  setCurrentStockPage: vi.fn(),
  setCurrentStockPageSize: vi.fn(),
  setInventoryMovementSearch: vi.fn(),
  setStockMovementCursors: vi.fn(),
  stockMovementCursors: [],
  stockMovementResult: { data: { hasNext: false }, isFetching: false },
}) as unknown as AdminDataPageModel

const renderPanel = (value = model()) => render(
  <ToastProvider>
    <AdminInventoryPanel model={value} />
  </ToastProvider>,
)

describe('AdminInventoryPanel IPC design grammar', () => {
  it('names each data surface by its business grain and exposes scoped headers', () => {
    renderPanel(model({ currentStockRows: [{ warehouseId: 'w1', ingredientId: 'i1', warehouse: 'Kho chính', ingredient: 'Gạo tẻ', currentQty: 25, unit: 'kilogram', lastUpdated: '2026-09-24T08:00:00Z' }] }))

    expect(screen.getByRole('region', { name: 'Tồn kho hiện tại theo kho và nguyên liệu' })).toBeInTheDocument()
    expect(screen.getByText('Snapshot hiện tại theo kho và nguyên liệu; lịch sử bút toán được theo dõi riêng bên dưới.')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Lịch sử điều chỉnh tồn kho' })).toBeInTheDocument()

    for (const table of screen.getAllByRole('table')) {
      expect(within(table).getAllByRole('columnheader').every((header) => header.getAttribute('scope') === 'col')).toBe(true)
    }
    expect(screen.getByText('25 kg').closest('td')).toHaveAttribute('data-cell-role', 'numeric')
  })

  it('uses truthful inventory-specific empty copy and the canonical search appearance', () => {
    const view = renderPanel(model({ adjustmentMovements: [] }))

    expect(screen.getByText('Chưa có snapshot tồn kho hiện tại. Dữ liệu sẽ xuất hiện sau khi Kho phát sinh nhập, xuất hoặc điều chỉnh.')).toBeVisible()
    expect(screen.getByText('Chưa phát sinh bút toán điều chỉnh tồn kho.')).toBeVisible()
    expect(screen.getByRole('searchbox', { name: 'Tìm bút toán điều chỉnh tồn' })).not.toHaveClass('bg-slate-50', 'focus:bg-white')
    view.rerender(<ToastProvider><AdminInventoryPanel model={model({ adjustmentMovements: [], inventoryMovementSearch: 'không-khớp' })} /></ToastProvider>)
    expect(screen.getByText('Không có bút toán điều chỉnh tồn khớp bộ lọc.')).toBeVisible()
  })
})
