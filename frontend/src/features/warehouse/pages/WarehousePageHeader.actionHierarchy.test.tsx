import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildWarehousePageHeader } from '@/features/warehouse/pages/WarehousePageHeader'

const primarySelector = '.ipc-button-primary, .ipc-button-success, .ipc-button-warning, [data-variant="default"], [data-variant="success"], [data-variant="warning"]'

describe('Warehouse command composition', () => {
  it('keeps the issue command and warehouse context geometry stable while candidates refresh', () => {
    const renderHeader = (isFetchingIssueCandidates: boolean, warehouseName: string) => buildWarehousePageHeader({
      warehouseName,
      showStockShortcut: true,
      canViewChef: true,
      canCreateIssue: true,
      isFetchingIssueCandidates,
      onOpenIssueDialog: () => undefined,
    })

    const { container, rerender } = render(<MemoryRouter>{renderHeader(false, 'Thủ kho').command}</MemoryRouter>)
    const initialButton = screen.getByRole('button', { name: 'Tạo phiếu xuất kho' })
    const warehouseContext = container.querySelector('.ipc-command-meta')
    expect(initialButton).toHaveAttribute('aria-busy', 'false')
    expect(warehouseContext).toHaveClass('w-44', 'min-w-44', 'truncate')

    rerender(<MemoryRouter>{renderHeader(true, 'Kho chia sẻ kiểm thử').command}</MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Tạo phiếu xuất kho' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('Đang kiểm tra nhu cầu')).not.toBeInTheDocument()
  })

  it('keeps one primary action without duplicating demand handoff facts above their canonical view', () => {
    const header = buildWarehousePageHeader({
      warehouseName: 'Kho mẫu',
      showStockShortcut: true,
      canViewChef: true,
      canCreateIssue: true,
      isFetchingIssueCandidates: false,
      onOpenIssueDialog: () => undefined,
    })
    const { container, rerender } = render(<MemoryRouter>{header.command}{header.context}</MemoryRouter>)
    expect(container.querySelectorAll(`.ipc-command-bar-actions ${primarySelector}`)).toHaveLength(1)
    expect(screen.queryByText('Chưa xuất')).toBeNull()
    expect(screen.queryByText('Bếp nhận')).toBeNull()
    expect(screen.queryByText('Phiếu nhập')).toBeNull()
    expect(screen.queryByText('Phiếu xuất')).toBeNull()
    expect(screen.queryByText('Dòng tồn kho')).toBeNull()
    expect(screen.getByRole('link', { name: 'Xem tồn kho' })).toHaveAttribute('href', '/warehouse?view=movement&movementTask=stock')
    expect(screen.getByRole('link', { name: 'Xem bàn giao tại Bếp' })).toHaveAttribute('href', '/chef-dashboard?view=production&task=materials')

    const stockHeader = buildWarehousePageHeader({
      warehouseName: 'Kho mẫu', showStockShortcut: false, canViewChef: false, canCreateIssue: true,
      isFetchingIssueCandidates: false, onOpenIssueDialog: () => undefined,
    })
    rerender(<MemoryRouter>{stockHeader.command}</MemoryRouter>)
    expect(screen.queryByRole('link', { name: 'Xem tồn kho' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Xem bàn giao tại Bếp' })).not.toBeInTheDocument()
  })
})
