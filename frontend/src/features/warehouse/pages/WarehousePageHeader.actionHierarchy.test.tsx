import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildWarehousePageHeader } from '@/features/warehouse/pages/WarehousePageHeader'

const primarySelector = '.ipc-button-primary, .ipc-button-success, .ipc-button-warning, [data-variant="default"], [data-variant="success"], [data-variant="warning"]'

describe('Warehouse command composition', () => {
  it('keeps one primary action without duplicating demand handoff facts above their canonical view', () => {
    const header = buildWarehousePageHeader({
      warehouseName: 'Kho mẫu',
      canCreateIssue: true,
      isFetchingIssueCandidates: false,
      onOpenIssueDialog: () => undefined,
    })
    const { container } = render(<MemoryRouter>{header.command}{header.context}</MemoryRouter>)
    expect(container.querySelectorAll(`.ipc-command-bar-actions ${primarySelector}`)).toHaveLength(1)
    expect(screen.queryByText('Chưa xuất')).toBeNull()
    expect(screen.queryByText('Bếp nhận')).toBeNull()
    expect(screen.queryByText('Phiếu nhập')).toBeNull()
    expect(screen.queryByText('Phiếu xuất')).toBeNull()
    expect(screen.queryByText('Dòng tồn kho')).toBeNull()
  })
})
