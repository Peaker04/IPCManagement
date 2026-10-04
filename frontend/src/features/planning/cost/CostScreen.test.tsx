import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { CatalogDish } from '@/api/dishCatalogApi'
import type { WeeklyPlanRow } from '@/features/projects/weekly-menu/model/types'
import { CostScreen } from './CostScreen'

it('attaches exact BOM explanation to its dish and keeps rounded-once daily cost and keyboard return', () => {
  const dish: CatalogDish = { id: 'dish', code: 'MON', name: 'Thịt kho', isActive: true, menuSlots: [], ingredients: [{ bomId: 'bom', ingredientId: 'pork', ingredientCode: 'THIT', unitId: 'kg', priceTierAmount: 30000, bomScope: 'CUSTOMER', customerId: 'customer', name: 'Thịt heo', unit: 'kg', grossQtyPerServing: 0.064777, wasteRatePercent: 0, bomStatus: 'PUBLISHED', bomStatusLabel: 'Đang dùng', referencePrice: 12000, effectiveFrom: '2026-01-01' }] }
  const row: WeeklyPlanRow = { key: 'row', dayKey: 't2', dayLabel: 'Thứ Hai', date: '21/09/2026', serviceDate: '2026-09-21', sectionLabel: 'Trưa · Mặn', shiftLabel: 'Ca Sáng', menuTypeLabel: 'Mặn', slotLabel: 'Món chính', dishId: 'dish', dishName: dish.name, portions: 425, importedPortions: 425, servingsStatus: 'confirmed', servingsStatusLabel: 'Đã chốt', hasConfirmedServings: true, hasCatalogBom: true, menuPrice: 30000, bomRatePercent: 100, quantityFactor: 1 }
  render(<CostScreen scope={{ customerId: 'customer', customerLabel: 'Khách hàng', weekStartDate: '2026-09-21', weekLabel: 'Tuần', menuPrice: 30000, fixedBomRatePercent: 100, activeServiceLabel: 'Tuần', displayDays: [{ key: 't2', label: 'Thứ Hai', date: row.date }] }} sourceLabel="BOM hiệu lực" weeklyPlanRows={[row]} dishesById={new Map([[dish.id, dish]])} dishesByName={new Map()} />)
  const trigger = screen.getByRole('button', { name: dish.name })
  const master = trigger.closest('tr')!
  expect(within(master).getByText('777 ₫')).toBeInTheDocument()
  expect(within(master).getByText('330.225 ₫')).toBeInTheDocument()
  fireEvent.click(trigger)
  const detail = document.getElementById(trigger.getAttribute('aria-controls')!)!
  expect(master.nextElementSibling).toBe(detail)
  expect(within(detail).getByText('0,064777')).toBeInTheDocument()
  expect(detail).toHaveTextContent('Thịt heo')
  fireEvent.keyDown(detail, { key: 'Escape' })
  expect(trigger).toHaveFocus()
  expect(trigger).toHaveAttribute('aria-expanded', 'false')
})
