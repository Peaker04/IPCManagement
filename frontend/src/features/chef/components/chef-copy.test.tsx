import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActiveDishesGrid } from './active-dishes-grid';
import { ChefHeader } from './chef-header';
import { MaterialChecklist } from './material-checklist';
import { OperationalActions } from './operational-actions';

describe('Chef operational copy', () => {
  it('uses sentence-case labels in the summary cards', () => {
    render(
      <ChefHeader
        productionPlan={{
          date: '2026-07-18',
          shift: 'Ca Sáng',
          kitchenAssignment: {
            kitchenName: 'Bếp trung tâm',
            kitchenCode: 'KITCHEN-1',
            responsibleChefs: [{ name: 'Nguyễn An', shortName: 'An' }],
          },
          totalMeals: 120,
          activeDishes: [],
          receivedMaterials: [],
        }}
      />,
    );

    for (const label of ['Ngày làm việc', 'Ca làm việc', 'Cụm bếp', 'Tổng suất ăn']) {
      const element = screen.getByText(label, { exact: true });
      expect(element).toBeInTheDocument();
      expect(element).not.toHaveClass('uppercase');
    }
  });

  it('uses sentence-case headers in the expanded ingredient table', () => {
    render(
      <ActiveDishesGrid
        dishes={[{
          id: 'dish-copy',
          name: 'Món mẫu',
          code: 'DISH-COPY',
          ingredients: [{ ingredientId: 'ing-copy', ingredientName: 'Sườn heo', unit: 'kg', grossQty: 2 }],
        }]}
        expandedDishId="dish-copy"
        onDishExpand={vi.fn()}
      />,
    );

    expect(screen.getByText('Nguyên liệu')).toBeInTheDocument();
    expect(screen.getByText('Đơn vị')).toBeInTheDocument();
    expect(screen.getByText('Số lượng cần')).toBeInTheDocument();
    expect(screen.queryByText('Nguyên Liệu')).not.toBeInTheDocument();
  });

  it('uses sentence-case headers in the material checklist', () => {
    render(<MaterialChecklist materials={[]} />);

    for (const label of ['Nguyên liệu', 'Đơn vị', 'Số lượng', 'Trạng thái']) {
      expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    }

    for (const label of ['Nguyên Liệu', 'Đơn Vị', 'Số Lượng', 'Trạng Thái']) {
      expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument();
    }
  });

  it('does not force the quick-guide heading into uppercase styling', () => {
    render(<OperationalActions materials={[]} />);

    expect(screen.getByText('Hướng dẫn nhanh')).not.toHaveClass('uppercase');
  });
});
