import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PaginationBar } from './PaginationBar';

describe('PaginationBar', () => {
  it('does not render when the current page can show every item', () => {
    const { container } = render(
      <PaginationBar page={1} pageSize={20} totalItems={20} onPageChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the item range and page count for long lists', () => {
    render(<PaginationBar page={2} pageSize={20} totalItems={45} onPageChange={vi.fn()} />);

    expect(screen.getByText('Đang xem 21–40 trên tổng 45')).toBeInTheDocument();
    expect(screen.getByText('Trang 2/3')).toBeInTheDocument();
  });

  it('clamps an out-of-range page without exposing an invalid page number', () => {
    render(<PaginationBar page={99} pageSize={20} totalItems={45} onPageChange={vi.fn()} />);

    expect(screen.getByText('Đang xem 41–45 trên tổng 45')).toBeInTheDocument();
    expect(screen.getByText('Trang 3/3')).toBeInTheDocument();
    expect(screen.getByLabelText('Trang sau, trang 3 trong 3')).toBeDisabled();
  });

  it('moves to previous and next pages within bounds', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginationBar page={2} pageSize={20} totalItems={45} onPageChange={onPageChange} />);

    await user.click(screen.getByLabelText('Trang trước, trang 1 trong 3'));
    await user.click(screen.getByLabelText('Trang sau, trang 3 trong 3'));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('supports contextual range copy, page-size selection, and direct page jump', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(
      <PaginationBar
        page={2}
        pageSize={20}
        totalItems={205}
        itemLabel="nguyên liệu"
        pageSizeOptions={[20, 50, 100]}
        onPageSizeChange={onPageSizeChange}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByText('Đang xem 21–40 trên tổng 205 nguyên liệu')).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }), '50');
    expect(onPageSizeChange).toHaveBeenCalledWith(50);

    await user.clear(screen.getByRole('spinbutton', { name: 'Đi đến trang' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Đi đến trang' }), '9');
    await user.click(screen.getByRole('button', { name: 'Đi đến trang đã nhập' }));
    expect(onPageChange).toHaveBeenCalledWith(9);
  });

  it('keeps refresh feedback accessible without inserting a visible pagination glyph', () => {
    const { container, rerender } = render(<PaginationBar page={2} pageSize={20} totalItems={205} onPageChange={vi.fn()} />);
    expect(screen.getByText('Trang 2/11')).toBeInTheDocument();
    expect(container.querySelector('.ipc-pagination-spinner')).not.toBeInTheDocument();

    rerender(<PaginationBar page={2} pageSize={20} totalItems={205} isPending onPageChange={vi.fn()} />);
    expect(screen.getByText('Trang 2/11')).toBeInTheDocument();
    expect(container.querySelector('.ipc-pagination-spinner')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải trang 2');
  });

  it('locks navigation and exposes busy feedback while a page is loading', () => {
    render(
      <PaginationBar
        page={2}
        pageSize={20}
        totalItems={205}
        isPending
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Phân trang danh sách' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Đang tải trang 2')).toBeInTheDocument();
    expect(screen.getByLabelText(/Trang trước/)).toBeDisabled();
    expect(screen.getByLabelText(/Trang sau/)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Đi đến trang/ })).toBeDisabled();
  });

  it('recovers focus to the available direction at a pagination boundary', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { rerender } = render(
      <PaginationBar page={2} pageSize={20} totalItems={45} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByLabelText('Trang sau, trang 3 trong 3'));
    rerender(<PaginationBar page={3} pageSize={20} totalItems={45} onPageChange={onPageChange} />);

    expect(screen.getByLabelText('Trang trước, trang 2 trong 3')).toHaveFocus();

    await user.click(screen.getByLabelText('Trang trước, trang 2 trong 3'));
    rerender(<PaginationBar page={1} pageSize={20} totalItems={45} onPageChange={onPageChange} />);
    expect(screen.getByLabelText('Trang sau, trang 2 trong 3')).toHaveFocus();
  });
});
