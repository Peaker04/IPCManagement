import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExcessMaterialDialog } from './excess-material-dialog';

describe('ExcessMaterialDialog responsive contract', () => {
  it('keeps condition choices in a mobile-first layout', () => {
    render(
      <ExcessMaterialDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        materials={[]}
      />,
    );

    const conditionLabel = screen.getByText('Tình trạng nguyên liệu', { exact: true });
    const conditionGroup = conditionLabel.parentElement?.querySelector('.ipc-excess-condition-group');
    expect(conditionGroup).not.toBeNull();
    expect(conditionGroup).toHaveClass('grid-cols-1', 'sm:grid-cols-3');
    expect(screen.getByText('Nguyên vẹn')).toBeInTheDocument();
    expect(screen.getByText('Đã sử dụng')).toBeInTheDocument();
    expect(screen.getByText('Hư hỏng')).toBeInTheDocument();
    expect(conditionLabel).not.toHaveClass('uppercase');
    expect(screen.queryByText('Tình Trạng Nguyên Liệu')).not.toBeInTheDocument();
  });

  it('shows the selected material label instead of its source-line id', async () => {
    const user = userEvent.setup();
    render(
      <ExcessMaterialDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        materials={[{
          id: 'issue-line-guid', name: 'Lá lốt', unit: 'kg', quantity: 5.186,
          status: 'Đã nhận', signed: true,
        }]}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: /Chọn nguyên liệu/ }));
    await user.click(await screen.findByRole('option', { name: /Lá lốt/ }));

    const trigger = screen.getByRole('combobox', { name: /Chọn nguyên liệu/ });
    expect(trigger).toHaveTextContent('Lá lốt (kg)');
    expect(trigger).not.toHaveTextContent('issue-line-guid');
  });

  it('associates missing values with both affected fields', async () => {
    const user = userEvent.setup();
    render(<ExcessMaterialDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} materials={[]} />);

    await user.click(screen.getByRole('button', { name: 'Ghi nhận nguyên liệu thừa' }));

    expect(screen.getByRole('combobox', { name: /Chọn nguyên liệu/ })).toHaveAccessibleDescription('Vui lòng chọn nguyên liệu.');
    expect(screen.getByLabelText('Số lượng trả lại *')).toHaveAccessibleDescription('Vui lòng nhập số lượng trả lại.');
  });
});
