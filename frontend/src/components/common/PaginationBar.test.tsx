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
});
