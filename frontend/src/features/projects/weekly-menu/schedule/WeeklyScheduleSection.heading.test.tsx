import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WeeklyScheduleSection } from './WeeklyScheduleSection'
import type { WeeklyMenuScope } from './types'

const activeScope: WeeklyMenuScope = {
  customerId: 'customer-1',
  customerLabel: 'Khách hàng A',
  weekStartDate: '2026-09-14',
  weekLabel: '14/09/2026',
  menuPrice: 25000 as const,
  fixedBomRatePercent: 100,
  activeServiceLabel: 'Thứ Hai - 14/09/2026',
  activeDayKey: 'monday',
  displayDays: [{ key: 'monday', label: 'Thứ Hai', date: '14/09/2026' }],
}

const renderSection = (scope = activeScope) => render(
  <WeeklyScheduleSection
    scope={scope}
    customerValue="Khách hàng A"
    weekValue="14/09/2026"
    hasCommittedWeek
    rows={[{
      key: 'main',
      firstIndex: 0,
      sourceSection: 'MENU MẶN CA SÁNG',
      slot: 'main',
      slotLabel: 'Món mặn 1',
      cells: {},
    }]}
  />,
)

describe('Weekly Menu schedule heading contract', () => {
  it('mounts the selected schedule work surface as h2 below the shell route heading', () => {
    renderSection()

    expect(screen.getByRole('heading', { level: 2, name: 'Bố cục menu theo file khách hàng' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: 'Bố cục menu theo file khách hàng' })).not.toBeInTheDocument()
  })

  it('keeps the active service discoverable in the populated matrix without a normal-success status', () => {
    renderSection()

    expect(screen.queryByText(/Đang thực hiện/)).not.toBeInTheDocument()
    expect(screen.getByText('Hôm nay')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Thứ Hai.*14\/09\/2026.*Hôm nay/ })).toBeInTheDocument()
  })

  it('keeps the missing-day prerequisite warning', () => {
    renderSection({ ...activeScope, activeDayKey: undefined, activeServiceLabel: 'Tuần 14/09/2026' })

    expect(screen.getByText('Tuần 14/09/2026')).toBeInTheDocument()
    expect(screen.queryByText('Hôm nay')).not.toBeInTheDocument()
  })
})
