import { describe, expect, it } from 'vitest';
import { historicalRange } from '../utils/historicalScope';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HistoricalScopeFilter } from '../components/workbench/HistoricalScopeFilter';

describe('Historical scope request boundaries', () => {
  it('retains the same input, form and focus after applying a historical year', () => {
    render(<MemoryRouter initialEntries={['/?period=YEAR&year=2024']}><HistoricalScopeFilter /></MemoryRouter>);
    const year = screen.getByRole('textbox', { name: 'Năm tra cứu' });
    const form = year.closest('form');
    fireEvent.change(year, { target: { value: '2023' } });
    year.focus();
    fireEvent.submit(form!);
    expect(screen.getByRole('textbox', { name: 'Năm tra cứu' })).toBe(year);
    expect(year.closest('form')).toBe(form);
    expect(year).toHaveFocus();
    expect(year).toHaveValue('2023');
  });
  it('addresses a previous year without depending on the current clock', () => {
    expect(historicalRange({ period: 'YEAR', year: '2024', from: '', to: '' })).toEqual({ weekFrom: '2024-01-01', weekTo: '2024-12-31' });
  });
  it('preserves a cross-year interval and refuses a reversed interval', () => {
    expect(historicalRange({ period: 'RANGE', year: '', from: '2023-01-01', to: '2025-12-31' })).toEqual({ weekFrom: '2023-01-01', weekTo: '2025-12-31' });
    expect(historicalRange({ period: 'RANGE', year: '', from: '2025-12-31', to: '2023-01-01' }).error).toBeTruthy();
    expect(historicalRange({ period: 'YEAR', year: '20', from: '', to: '' }).error).toBeTruthy();
  });
});
