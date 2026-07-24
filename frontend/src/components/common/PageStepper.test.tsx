import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PageStepper } from './PageStepper';

describe('PageStepper', () => {
  it('renders grouped-page semantics without an item range', () => {
    render(<PageStepper page={2} totalPages={4} label="Kế hoạch sản xuất" onPageChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: 'Điều hướng các trang' })).toBeInTheDocument();
    expect(screen.getByText('Kế hoạch sản xuất')).toBeInTheDocument();
    expect(screen.getByText('Nhóm 2/4')).toBeInTheDocument();
    expect(screen.queryByText(/Đang xem/)).not.toBeInTheDocument();
  });

  it('clamps an invalid page and hides a single-page stepper', () => {
    const { rerender } = render(<PageStepper page={0} totalPages={3} onPageChange={vi.fn()} />);

    expect(screen.getByText('Nhóm dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Nhóm 1/3')).toBeInTheDocument();
    rerender(<PageStepper page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('keeps focus in the grouped stepper after a page change', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <PageStepper page={1} totalPages={2} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByLabelText('Trang sau, trang 2 trong 2'));
    rerender(<PageStepper page={2} totalPages={2} onPageChange={onPageChange} />);

    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(screen.getByLabelText('Trang trước, trang 1 trong 2')).toHaveFocus();
  });
});
