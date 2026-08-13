import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { WeeklyMenuImportRow } from '@/api/coordinationApi'
import { ImportedLayoutMatrix, type ImportedLayoutRow } from './ImportedLayoutMatrix'

const days = [
  { key: 't2', label: 'Thứ Hai', date: '17/08/2026' },
  { key: 't3', label: 'Thứ Ba', date: '18/08/2026' },
  { key: 't4', label: 'Thứ Tư', date: '19/08/2026' },
  { key: 't5', label: 'Thứ Năm', date: '20/08/2026' },
  { key: 't6', label: 'Thứ Sáu', date: '21/08/2026' },
  { key: 't7', label: 'Thứ Bảy', date: '22/08/2026' },
]

const makeCell = (dayKey: string, dishId: string, dishName: string) => ({
  dayKey, dishId, dishName, sourceSection: 'MENU MẶN CA SÁNG', dbShiftName: 'MORNING', variant: 'Mặn',
  sourceRowNumber: 1, rowSpan: 1, isMergedContinuation: false,
} as WeeklyMenuImportRow)

describe('ImportedLayoutMatrix', () => {
  it('uses canonical slot labels, catalog names and one merged dessert cell', () => {
    const slots = [
      ['main', 'Món mặn 1'], ['sub1', 'Món mặn 2'], ['rau', 'Rau'], ['canh', 'Canh'], ['dessert', 'Tráng miệng'],
    ] as const
    const rows: ImportedLayoutRow[] = slots.map(([slot, slotLabel], index) => ({
      key: slot,
      firstIndex: index,
      sourceSection: 'MENU MẶN CA SÁNG',
      slot,
      slotLabel,
      cells: Object.fromEntries(days.map((day) => [day.key, makeCell(day.key, `dish-${slot}`, `${slot} ngày 1 25k`)])),
    }))

    render(<ImportedLayoutMatrix rows={rows} displayDays={days} dishNamesById={new Map(slots.map(([slot, label]) => [`dish-${slot}`, `${label} chuẩn`]))} />)

    slots.forEach(([, label]) => expect(screen.getByText(label)).toBeInTheDocument())
    expect(screen.queryByText(/ngày 1 25k/i)).not.toBeInTheDocument()
    const dessertRow = screen.getByText('Tráng miệng').closest('tr')
    if (!dessertRow) throw new Error('Expected dessert row')
    expect(within(dessertRow).getAllByRole('cell')).toHaveLength(2)
    expect(within(dessertRow).getByText('Tráng miệng chuẩn').closest('td')).toHaveAttribute('colspan', '6')
  })
})
