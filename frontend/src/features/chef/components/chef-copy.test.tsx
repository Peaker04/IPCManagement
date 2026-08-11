import { fireEvent, render, screen } from '@testing-library/react';
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
          plannedMaterials: [],
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

  it('shows customer and price tier on each daily dish grain', () => {
    render(
      <ActiveDishesGrid
        dishes={[{
          id: 'customer-2__30000__dish-copy',
          name: 'Món mẫu',
          code: 'DISH-COPY',
          customerName: 'Nhà máy B',
          priceTierAmount: 30_000,
          portions: 120,
          hasBom: true,
          ingredients: [],
        }]}
        expandedDishId={null}
        onDishExpand={vi.fn()}
      />,
    );

    expect(screen.getByText('Khách: Nhà máy B')).toBeInTheDocument();
    expect(screen.getByText('Đơn giá: 30k')).toBeInTheDocument();
    expect(screen.getByText('120 suất')).toBeInTheDocument();
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

  it('requires explicit confirmation before signing a received issue', () => {
    const onMaterialSignoff = vi.fn();
    render(<MaterialChecklist materials={[{
      id: 'issue-line-1',
      name: 'Bầu',
      unit: 'kg',
      quantity: 2,
      status: 'Chờ giao',
      signed: false,
      issueId: 'issue-1',
      issueCode: 'ISS-SUP-001',
    }]} onMaterialSignoff={onMaterialSignoff} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ký nhận Bầu' }));

    expect(onMaterialSignoff).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Xác nhận đã nhận nguyên liệu?' })).toBeInTheDocument();
    expect(screen.getByText('ISS-SUP-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đã kiểm đếm và nhận' }));
    expect(onMaterialSignoff).toHaveBeenCalledWith('issue-line-1', true);
  });

  it('renders material state through the canonical compact status contract', () => {
    render(<MaterialChecklist materials={[{
      id: 'issue-line-status',
      name: 'Bầu',
      unit: 'kg',
      quantity: 2,
      status: 'Chờ giao',
      signed: false,
    }]} />);

    expect(screen.getByText('Chờ ký nhận').closest('.ipc-status-badge')).toBeInTheDocument();
  });

  it('groups repeated material presentation but keeps source-line signoff ids', () => {
    const onMaterialSignoff = vi.fn();
    render(<MaterialChecklist materials={[
      { id: 'line-a', ingredientId: 'bot-no', unitId: 'kg', name: 'Bột nở', unit: 'kg', quantity: 2.7132, status: 'Chờ giao', signed: false, issueCode: 'ISS-A' },
      { id: 'line-b', ingredientId: 'bot-no', unitId: 'kg', name: 'Bột nở', unit: 'kg', quantity: 2.8101, status: 'Chờ giao', signed: false, issueCode: 'ISS-B' },
    ]} onMaterialSignoff={onMaterialSignoff} />);

    expect(screen.getByText('Bột nở', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('5,523')).toBeInTheDocument();
    expect(screen.getByText('2 dòng nguồn')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mở 2 dòng nguồn của Bột nở' }));
    expect(screen.getByText('ISS-A')).toBeInTheDocument();
    expect(screen.getByText('ISS-B')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Ký nhận Bột nở từ ISS-A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đã kiểm đếm và nhận' }));
    expect(onMaterialSignoff).toHaveBeenCalledWith('line-a', true);
  });

  it('does not force the quick-guide heading into uppercase styling', () => {
    render(<OperationalActions materials={[]} />);

    expect(screen.getByText('Hướng dẫn nhanh')).not.toHaveClass('uppercase');
  });

  it('explains that a supplemental request is persisted but does not issue stock immediately', () => {
    render(<OperationalActions materials={[]} onSupplementalRequest={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /yêu cầu cấp bổ sung/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/được lưu và chuyển tới kho ở trạng thái chờ xử lý/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gửi tới kho' })).toBeDisabled();
  });
});
