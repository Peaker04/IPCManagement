import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportsFilters } from './ReportsFilters';

const baseProps = {
  dateFrom: '',
  dateTo: '',
  shiftName: '',
  sortDirection: 'desc' as const,
  onDateFromChange: vi.fn(),
  onDateToChange: vi.fn(),
  onShiftNameChange: vi.fn(),
  onSortDirectionChange: vi.fn(),
};

describe('ReportsFilters presentation', () => {
  it('never exposes internal select sentinel or sort tokens', () => {
    render(<ReportsFilters {...baseProps} activeView="audit" />);
    expect(screen.getByRole('combobox', { name: 'Ca' })).toHaveTextContent('Tất cả ca');
    expect(screen.getByRole('combobox', { name: 'Sắp xếp' })).toHaveTextContent('Mới nhất trước');
    expect(screen.queryByText('__all-shifts__')).not.toBeInTheDocument();
    expect(screen.queryByText('desc')).not.toBeInTheDocument();
  });
});
