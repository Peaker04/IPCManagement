import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('keeps shared search anatomy while allowing contextual width', () => {
    render(<SearchField id="records-search" label="Tìm bản ghi" description="Tìm theo mã hoặc tên" width="wide" />);

    const input = screen.getByRole('searchbox', { name: 'Tìm bản ghi' });
    const label = input.closest('label');
    expect(label).toHaveClass('ipc-search-field', 'w-[28rem]');
    expect(screen.getByText('Tìm theo mã hoặc tên')).toHaveClass('ipc-search-field__description');
    expect(input).toHaveClass('ipc-search-field__input');
    expect(input.parentElement).toHaveClass('ipc-search-field__control');
  });

  it('retains an accessible name when the visible label is hidden', () => {
    render(<SearchField id="compact-search" label="Tìm tồn kho" hideLabel width="compact" />);
    expect(screen.getByRole('searchbox', { name: 'Tìm tồn kho' })).toBeInTheDocument();
    expect(screen.getByText('Tìm tồn kho')).toHaveClass('sr-only');
  });
});
