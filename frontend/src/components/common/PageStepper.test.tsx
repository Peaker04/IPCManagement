import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PageStepper } from './PageStepper';

describe('PageStepper', () => {
  it('renders grouped-page semantics without an item range', () => {
    render(<PageStepper page={2} totalPages={4} label="Kế hoạch sản xuất" onPageChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: 'Điều hướng các trang' })).toBeInTheDocument();
    expect(screen.getByText('Kế hoạch sản xuất · Trang 2/4')).toBeInTheDocument();
    expect(screen.getByText('Trang 2/4')).toBeInTheDocument();
    expect(screen.queryByText(/Đang xem/)).not.toBeInTheDocument();
  });

  it('clamps an invalid page and hides a single-page stepper', () => {
    const { rerender } = render(<PageStepper page={0} totalPages={3} onPageChange={vi.fn()} />);

    expect(screen.getAllByText('Trang 1/3')).toHaveLength(2);
    rerender(<PageStepper page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
