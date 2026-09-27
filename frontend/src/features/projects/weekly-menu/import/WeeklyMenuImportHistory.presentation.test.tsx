import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WeeklyMenuImportHistory } from './WeeklyMenuImportHistory'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

const historyItem = {
  menuVersionId: 'menu-version-1',
  customerCode: 'ANV',
  customerName: 'Nhà máy ANV',
  weekStartDate: '2026-07-27',
  versionNo: 3,
  status: 'DRAFT',
  successRowCount: 120,
  errorRowCount: 0,
  warningRowCount: 2,
  createdByName: 'Điều phối viên',
  canRollback: true,
  cannotRollbackReason: null,
}

const buildWorkflow = (requestRollback = vi.fn()) => ({
  history: [historyItem],
  historyPage: 1,
  historyPageInfo: { pageSize: 10, totalCount: 1 },
  setHistoryPage: vi.fn(),
  historyDataState: { phase: 'ready', data: { data: { items: [historyItem], pageSize: 10, totalCount: 1 } } },
  status: { isRollingBack: false },
  actions: { requestRollback },
} as unknown as WeeklyMenuImportWorkflow)

describe('WeeklyMenuImportHistory presentation contract', () => {
  it('exposes the menu-version grain with scoped headers and numeric/date cells', () => {
    render(<WeeklyMenuImportHistory workflow={buildWorkflow()} />)

    const region = screen.getByRole('region', { name: 'Lịch sử import thực đơn tuần' })
    expect(region).toHaveAccessibleDescription('Mỗi dòng là một phiên bản thực đơn tuần đã import')
    expect(within(region).getAllByRole('columnheader')).toHaveLength(7)
    within(region).getAllByRole('columnheader').forEach((header) => expect(header).toHaveAttribute('scope', 'col'))
    expect(within(region).getByText('27/07/2026').closest('td')).toHaveAttribute('data-cell-role', 'numeric')
    expect(within(region).getByText('v3').closest('td')).toHaveAttribute('data-cell-role', 'numeric')
    expect(within(region).getByText(/120 thành công/).closest('td')).toHaveAttribute('data-cell-role', 'numeric')
  })

  it('keeps rollback eligibility and version identity on the existing action owner', () => {
    const requestRollback = vi.fn()
    render(<WeeklyMenuImportHistory workflow={buildWorkflow(requestRollback)} />)

    fireEvent.click(screen.getByRole('button', { name: 'Hủy phiên' }))
    expect(requestRollback).toHaveBeenCalledWith('menu-version-1', 'ANV - tuần 27/07/2026 (v3)')
  })
})
