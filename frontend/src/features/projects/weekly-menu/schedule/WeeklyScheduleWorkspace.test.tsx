import { render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { WeeklyScheduleWorkspace } from './WeeklyScheduleWorkspace'

vi.mock('../import/WeeklyMenuImportDialog', () => ({ WeeklyMenuImportDialog: () => null }))
vi.mock('./WeeklyScheduleEditorDialog', () => ({ WeeklyScheduleEditorDialog: () => null }))

const scope = {
  customerId: 'customer-1',
  customerLabel: 'ANV - AMANN',
  weekStartDate: '2026-09-21',
  weekLabel: '21/09/2026 - 26/09/2026',
  menuPrice: 25000,
  fixedBomRatePercent: 100,
  activeServiceLabel: 'Thứ Hai - 21/09/2026',
  activeDayKey: 'monday',
  displayDays: [{ key: 'monday', label: 'Thứ Hai', date: '21/09/2026' }],
}

const renderWorkspace = (overrides: Record<string, unknown> = {}) => render(<WeeklyScheduleWorkspace
  description="ANV - AMANN · Tuần 21/09/2026 · Đã xuất bản"
  customers={[]}
  selectedCustomerId="customer-1"
  weekStartDate="2026-09-21"
  selectedWeekLabel="21/09/2026"
  isCustomerLoading={false}
  isImporting={false}
  canPublish={false}
  isPublishing={false}
  onEdit={vi.fn()}
  onImport={vi.fn()}
  onPublish={vi.fn()}
  onCustomerChange={vi.fn()}
  onWeekChange={vi.fn()}
  navigation={null}
  queries={[]}
  readiness={{} as never}
  showReadiness={false}
  alerts={null}
  importWorkflow={{} as never}
  scheduleWorkflow={{} as never}
  showImportDialog={false}
  showEditorDialog={false}
  servingRows={[]}
  layoutRows={[]}
  isDialogLoading={false}
  pendingCloseKind={null}
  onPendingCloseChange={vi.fn()}
  onConfirmPendingClose={vi.fn()}
  scope={scope as never}
  hasCommittedWeek={false}
  dishNamesById={new Map()}
  isViewPending={false}
  {...overrides}
/>)

it('owns the Kit empty surface instead of delegating to the retired Schedule section', () => {
  renderWorkspace()

  expect(screen.getByRole('heading', { level: 2, name: 'Ma trận thực đơn tuần' })).toBeInTheDocument()
  expect(screen.getByText('Chưa có thực đơn cho tuần đã chọn')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

it('owns the populated fixed-header matrix with the selected scope visible', () => {
  renderWorkspace({
    hasCommittedWeek: true,
    layoutRows: [{ key: 'main', firstIndex: 0, sourceSection: 'MENU MẶN CA SÁNG', slot: 'main', slotLabel: 'Món mặn 1', cells: {} }],
  })

  const surface = screen.getByRole('heading', { level: 2, name: 'Ma trận thực đơn tuần' }).closest('section')!
  const surfaceHeader = within(surface.querySelector('header')!)
  expect(surfaceHeader.getByText('ANV - AMANN')).toBeInTheDocument()
  expect(surfaceHeader.getByText('21/09/2026')).toBeInTheDocument()
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(screen.getByRole('region', { name: 'Bố cục thực đơn theo file khách hàng' })).toHaveAttribute('data-sticky-header', 'false')
  expect(screen.getByRole('columnheader', { name: /Thứ Hai.*21\/09\/2026.*Hôm nay/ })).toBeInTheDocument()
})

it('keeps the missing-active-day warning on a populated new surface', () => {
  renderWorkspace({
    scope: { ...scope, activeDayKey: undefined, activeServiceLabel: 'Tuần 21/09/2026' },
    layoutRows: [{ key: 'main', firstIndex: 0, sourceSection: 'MENU MẶN CA SÁNG', slot: 'main', slotLabel: 'Món mặn 1', cells: {} }],
  })
  expect(screen.getByText('Tuần 21/09/2026')).toBeInTheDocument()
})
