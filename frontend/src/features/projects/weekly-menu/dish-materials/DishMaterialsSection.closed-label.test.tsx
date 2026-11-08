import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DishMaterialsSection from './DishMaterialsSection'

describe('DishMaterialsSection select labels', () => {
  it('shows the selected dish label instead of its id in the closed trigger', () => {
    render(
      <DishMaterialsSection
        workflow={{
          actions: { selectDish: vi.fn() },
          presentation: {
            analyzedDish: { id: 'dish-1', name: 'Cá kho tộ' },
            foodCostPercent: 40,
            ingredients: [],
            totalTrayCost: 0,
            grossProfit: 0,
            serviceDate: '2026-07-27',
            isCatalogEmpty: false,
            dishesByShift: {
              morning: [{ id: 'dish-1', name: 'Cá kho tộ' }],
              afternoon: [],
            },
            weeklyPlanCatalogDishIds: new Set(['dish-1']),
            sourceLabel: 'Catalog',
            menuPrice: 30000,
          },
        } as never}
      />,
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('Cá kho tộ - trong KH tuần')
    expect(trigger).not.toHaveTextContent('dish-1')
  })

  it('filters dish choices by the entered name', async () => {
    render(
      <DishMaterialsSection
        workflow={{
          actions: { selectDish: vi.fn() },
          presentation: {
            analyzedDish: { id: 'dish-1', name: 'Ca kho' },
            foodCostPercent: 40,
            ingredients: [],
            totalTrayCost: 0,
            grossProfit: 0,
            serviceDate: '2026-07-27',
            isCatalogEmpty: false,
            dishesByShift: {
              morning: [{ id: 'dish-1', name: 'Ca kho' }, { id: 'dish-2', name: 'Dau khuon' }],
              afternoon: [{ id: 'dish-3', name: 'Tom rim' }],
            },
            weeklyPlanCatalogDishIds: new Set(['dish-1']),
            sourceLabel: 'Catalog',
            menuPrice: 30000,
          },
        } as never}
      />,
    )

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'dau' } })
    fireEvent.click(screen.getByRole('combobox'))

    expect(await screen.findByRole('option', { name: 'Dau khuon' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Ca kho/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Tom rim' })).not.toBeInTheDocument()
  })
})
