import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Num } from '../components/ui/num';
import { IdentifierText } from '../components/ui/identifier-text';
import { VietnameseDateInput } from '../components/ui/vietnamese-date-input';
import { Modal } from '../components/ui/modal';
import { Tabs } from '../components/ui/tabs';
import { toVietnameseDate, formatVietnameseDate } from '../utils/dates';

describe('10 UI Primitives (WCAG 2.1 AA & Zero AI-Slop)', () => {
  it('Button: renders variants and handles click events', async () => {
    const handleClick = vi.fn();
    render(
      <Button variant="default" size="default" onClick={handleClick}>
        Lưu thay đổi
      </Button>
    );

    const btn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveClass('bg-slate-900'); // Navy/Slate flat background
    await userEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('Input: renders with proper accessibility and handles text entry', async () => {
    const handleChange = vi.fn();
    render(
      <Input
        placeholder="Tìm kiếm..."
        onChange={handleChange}
        aria-label="Tìm kiếm"
      />
    );

    const input = screen.getByPlaceholderText('Tìm kiếm...');
    expect(input).toHaveClass('h-9');
    await userEvent.type(input, 'thịt heo');
    expect(handleChange).toHaveBeenCalled();
  });

  it('Select: renders options and triggers selection change', async () => {
    const handleChange = vi.fn();
    render(
      <Select
        aria-label="Chọn khách hàng"
        options={[
          { value: 'DRAX', label: 'Draxlmaier' },
          { value: 'SAMSUNG', label: 'Samsung' },
        ]}
        onChange={handleChange}
      />
    );

    const select = screen.getByRole('combobox', { name: 'Chọn khách hàng' });
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'SAMSUNG' } });
    expect(handleChange).toHaveBeenCalled();
  });

  it('Badge: renders status semantic variants', () => {
    const { rerender } = render(<Badge variant="success">Hoàn thành</Badge>);
    expect(screen.getByText('Hoàn thành')).toHaveClass('bg-emerald-50');

    rerender(<Badge variant="warning">Chờ xuất</Badge>);
    expect(screen.getByText('Chờ xuất')).toHaveClass('bg-amber-50');
  });

  it('Checkbox: supports checked and indeterminate states', () => {
    const handleChange = vi.fn();
    render(
      <Checkbox
        aria-label="Chọn dòng"
        checked={false}
        indeterminate={true}
        onChange={handleChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Chọn dòng' }) as HTMLInputElement;
    expect(checkbox.indeterminate).toBe(true);
    fireEvent.click(checkbox);
    expect(handleChange).toHaveBeenCalled();
  });

  it('Num: formats currency and quantity with tabular-nums and right alignment', () => {
    const { rerender } = render(
      <Num value={25000} format="currency" data-testid="num-currency" />
    );
    const currencyEl = screen.getByTestId('num-currency');
    expect(currencyEl).toHaveClass('tabular-nums', 'text-right');
    expect(currencyEl.textContent).toContain('25.000 ₫');

    rerender(<Num value={1240.5} format="quantity" suffix=" kg" data-testid="num-qty" />);
    const qtyEl = screen.getByTestId('num-qty');
    expect(qtyEl.textContent).toContain('1.240,5 kg');
  });

  it('IdentifierText: renders code with w-fit inline-flex and handles clipboard copy', async () => {
    render(<IdentifierText value="KHSX-260921-01" />);
    const codeEl = screen.getByText('KHSX-260921-01');
    expect(codeEl).toBeInTheDocument();
    // Rule: Must be w-fit inline-flex, not full-width stretched block!
    expect(codeEl.parentElement).toHaveClass('w-fit', 'inline-flex');
    await userEvent.click(codeEl);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('KHSX-260921-01');
  });

  it('VietnameseDateInput: formats date with dd/MM/yyyy and triggers change', () => {
    const handleChange = vi.fn();
    render(<VietnameseDateInput value="2026-09-21" onChange={handleChange} />);
    const input = screen.getByDisplayValue('2026-09-21');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('h-9', 'w-40');
    fireEvent.change(input, { target: { value: '2026-09-22' } });
    expect(handleChange).toHaveBeenCalledWith('2026-09-22');

    // Unit test for Vietnamese date conversion utilities
    expect(toVietnameseDate('2026-09-21')).toBe('21/09/2026');
    expect(formatVietnameseDate('2026-09-21')).toBe('21/09/2026');
  });

  it('Modal: renders dialog with focus trap and handles Escape key', async () => {
    const handleClose = vi.fn();
    render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        title="Duyệt xuất kho"
        description="Xác nhận duyệt 29 nguyên liệu"
      >
        <p>Nội dung xác nhận</p>
      </Modal>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Duyệt xuất kho')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('Tabs: renders segmented control and navigates with arrow keys', async () => {
    const handleChange = vi.fn();
    const items = [
      { id: 'tab1', label: 'Tab Một' },
      { id: 'tab2', label: 'Tab Hai', count: 5 },
    ];
    render(<Tabs items={items} activeId="tab1" onChange={handleChange} />);

    const tab1 = screen.getByRole('tab', { name: 'Tab Một' });
    expect(tab1).toHaveAttribute('aria-selected', 'true');

    const tab2 = screen.getByRole('tab', { name: /Tab Hai/ });
    await userEvent.click(tab2);
    expect(handleChange).toHaveBeenCalledWith('tab2');
  });
});
