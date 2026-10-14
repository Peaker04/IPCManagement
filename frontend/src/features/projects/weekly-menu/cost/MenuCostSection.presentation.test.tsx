import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import MenuCostSection from './MenuCostSection'
import type { MenuCostWorkflow } from './useMenuCost'

const mockRow = {
  key: 'row-1',
  shiftLabel: 'Ca trưa',
  slotLabel: 'Món chính',
  dishName: 'Thịt kho trứng',
  portions: 120,
  unitCost: 15000,
  hasCatalogBom: true,
  ingredients: [
    {
      ingredientId: 'ing-1',
      ingredientName: 'Thịt ba chỉ',
      unitName: 'kg',
      grossQtyPerServing: 0.1,
      standardPrice: 120000,
      costPerServing: 12000,
      totalQuantity: 12,
      totalCost: 1440000,
    },
  ],
}

const buildWorkflow = (overrides: Partial<MenuCostWorkflow['presentation']> = {}): MenuCostWorkflow => {
  const rows = overrides.rows ?? [mockRow]
  return {
    scope: {
      customerId: 'cust-1',
      weekStartDate: '2026-10-12',
      displayDays: [],
      activeDayKey: '2026-10-14',
      menuPrice: 30000,
      pricingMode: 'DEFAULT',
      tierOptions: [],
      availablePriceTiers: [],
      priceTier: 30000,
      customerTierLocked: true,
      mealPricingCount: 1,
      effectiveRange: null,
    },
    state: { selectedDayKey: null },
    actions: {
      selectDay: vi.fn(),
    },
    presentation: {
      activeDay: { label: 'Thứ Tư', date: '14/10/2026' },
      dayIndex: 2,
      dayPages: [
        { key: '2026-10-12', label: 'Thứ Hai' },
        { key: '2026-10-13', label: 'Thứ Ba' },
        { key: '2026-10-14', label: 'Thứ Tư' },
      ],
      rows,
      rowsWithBom: rows.filter((r) => r.hasCatalogBom),
      rowsMissingBom: rows.filter((r) => !r.hasCatalogBom),
      materialSummary: {
        'ing-1': {
          theory: 12,
          actual: 12,
          unit: 'kg',
          ingredientName: 'Thịt ba chỉ',
          dishNames: ['Thịt kho trứng'],
          referencePrice: 120000,
          totalCost: 1440000,
        },
      },
      total: 1800000,
      sourceLabel: 'Kế hoạch sản xuất tuần',
      ...overrides,
    },
  } as unknown as MenuCostWorkflow
}

describe('MenuCostSection presentation and interaction contract', () => {
  it('renders daily cost rows with tabular figures, units and semantic column headers', () => {
    const workflow = buildWorkflow()
    render(<MenuCostSection workflow={workflow} />)

    expect(screen.getByRole('heading', { level: 2, name: 'Giá vốn theo ngày từ kế hoạch tuần' })).toBeInTheDocument()

    const region = screen.getByRole('region', { name: 'Bảng món kế hoạch tuần liên kết giá vốn' })
    expect(region).toBeInTheDocument()

    const headers = screen.getAllByRole('columnheader')
    expect(headers.map((h) => h.getAttribute('scope'))).toContain('col')

    expect(screen.getAllByText('Thịt kho trứng').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Ca trưa')).toBeInTheDocument()
    expect(screen.getByText('Món chính')).toBeInTheDocument()

    expect(screen.getByRole('complementary', { name: 'Bóc tách định mức BOM của Thịt kho trứng' })).toBeInTheDocument()
    expect(screen.getByText('Thịt ba chỉ')).toBeInTheDocument()
  })

  it('renders an empty table state when no day plan rows exist', () => {
    const workflow = buildWorkflow({ rows: [], rowsWithBom: [], rowsMissingBom: [], materialSummary: {}, total: 0 })
    render(<MenuCostSection workflow={workflow} />)

    expect(screen.getByText('Chưa có kế hoạch ngày để liên kết giá vốn.')).toBeInTheDocument()
  })

  it('navigates days when clicking day stepper buttons', () => {
    const workflow = buildWorkflow()
    render(<MenuCostSection workflow={workflow} />)

    const prevDayBtn = screen.getByRole('button', { name: 'Ngày trước' })
    const nextDayBtn = screen.getByRole('button', { name: 'Ngày sau' })
    expect(prevDayBtn).toBeEnabled()
    expect(nextDayBtn).toBeDisabled() // dayIndex is 2 of 3 (last day)

    fireEvent.click(prevDayBtn)
    expect(workflow.actions.selectDay).toHaveBeenCalledWith('2026-10-13')
  })
})
