import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CursorPaginationBar } from './CursorPaginationBar';

describe('CursorPaginationBar', () => {
  it('keeps cursor semantics without inventing total pages', () => {
    render(
      <CursorPaginationBar
        page={2}
        hasNext
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        ariaLabel="Phân trang báo cáo"
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Phân trang báo cáo' })).toBeInTheDocument();
    expect(screen.getByText('Dữ liệu tiếp nối')).toBeInTheDocument();
    expect(screen.getByText('Trang 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Trang trước')).not.toBeDisabled();
    expect(screen.getByLabelText('Trang sau')).not.toBeDisabled();
    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument();
  });

  it('clamps page one and disables backward navigation', () => {
    render(<CursorPaginationBar page={0} hasNext={false} onPrevious={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Đã tải hết dữ liệu')).toBeInTheDocument();
    expect(screen.getByLabelText('Trang trước')).toBeDisabled();
    expect(screen.getByLabelText('Trang sau')).toBeDisabled();
  });

  it('locks cursor navigation and announces loading without inventing a total', () => {
    render(
      <CursorPaginationBar
        page={3}
        hasNext
        isPending
        onPrevious={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByRole('navigation')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Đang tải trang 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Trang trước')).toBeDisabled();
    expect(screen.getByLabelText('Trang sau')).toBeDisabled();
    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument();
  });

  it('recovers focus to previous when the next cursor becomes terminal', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const { rerender } = render(
      <CursorPaginationBar page={2} hasNext onPrevious={vi.fn()} onNext={onNext} />,
    );

    await user.click(screen.getByLabelText('Trang sau'));
    rerender(
      <CursorPaginationBar page={3} hasNext={false} onPrevious={vi.fn()} onNext={onNext} />,
    );

    expect(screen.getByLabelText('Trang trước')).toHaveFocus();
  });
});
