import { render, screen } from '@testing-library/react';
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
    expect(screen.getByText('Trang 2, tải theo cursor')).toBeInTheDocument();
    expect(screen.getByText('Trang 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Trang trước')).not.toBeDisabled();
    expect(screen.getByLabelText('Trang sau')).not.toBeDisabled();
    expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument();
  });

  it('clamps page one and disables backward navigation', () => {
    render(<CursorPaginationBar page={0} hasNext={false} onPrevious={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Trang 1, tải theo cursor')).toBeInTheDocument();
    expect(screen.getByLabelText('Trang trước')).toBeDisabled();
    expect(screen.getByLabelText('Trang sau')).toBeDisabled();
  });
});
