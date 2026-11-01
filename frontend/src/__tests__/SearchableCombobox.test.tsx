import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableCombobox, type ComboboxOption } from '../components/ui/searchable-combobox';

describe('SearchableCombobox UI Primitive (NFR Performance)', () => {
  const mockOptions: ComboboxOption[] = Array.from({ length: 50 }, (_, i) => ({
    value: `val-${i + 1}`,
    label: `Nguyên liệu ${i + 1}`,
    sublabel: `NL-CODE-${i + 1}`,
  }));

  it('renders input with placeholder and closed menu initially', () => {
    render(
      <SearchableCombobox
        aria-label="Chọn nguyên liệu"
        options={mockOptions}
        value=""
        onChange={vi.fn()}
        placeholder="Tìm nguyên liệu..."
      />
    );

    const input = screen.getByRole('combobox', { name: 'Chọn nguyên liệu' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', 'Tìm nguyên liệu...');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('limits visible rendered options to maxVisibleOptions (default 15) to preserve 60fps DOM performance', async () => {
    const user = userEvent.setup();
    render(
      <SearchableCombobox
        aria-label="Chọn nguyên liệu"
        options={mockOptions}
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox', { name: 'Chọn nguyên liệu' });
    await user.click(input);

    const listbox = await screen.findByRole('listbox');
    expect(listbox).toBeInTheDocument();

    const renderedOptions = screen.getAllByRole('option');
    expect(renderedOptions.length).toBeLessThanOrEqual(15);
  });

  it('filters options by search query and calls onChange when option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableCombobox
        aria-label="Chọn nguyên liệu"
        options={mockOptions}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByRole('combobox', { name: 'Chọn nguyên liệu' });
    await user.type(input, '12');

    await waitFor(() => {
      expect(screen.getByText('Nguyên liệu 12')).toBeInTheDocument();
    });

    const targetOption = screen.getByRole('option', { name: /Nguyên liệu 12/ });
    await user.click(targetOption);

    expect(onChange).toHaveBeenCalledWith('val-12');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects the active option with Arrow keys and Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SearchableCombobox
        aria-label="Chọn nguyên liệu"
        options={mockOptions.slice(0, 3)}
        value=""
        onChange={onChange}
      />
    );

    const input = screen.getByRole('combobox', { name: 'Chọn nguyên liệu' });
    await user.click(input);

    const firstActiveId = input.getAttribute('aria-activedescendant');
    expect(firstActiveId).toBeTruthy();
    expect(document.getElementById(firstActiveId!)).toHaveTextContent('Nguyên liệu 1');

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith('val-2');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('tracks the first filtered option and clears the active descendant when no option matches', async () => {
    const user = userEvent.setup();

    render(
      <SearchableCombobox
        aria-label="Chọn nguyên liệu"
        options={mockOptions}
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox', { name: 'Chọn nguyên liệu' });
    await user.type(input, '12');

    await waitFor(() => {
      const activeId = input.getAttribute('aria-activedescendant');
      expect(activeId).toBeTruthy();
      expect(document.getElementById(activeId!)).toHaveTextContent('Nguyên liệu 12');
    });

    await user.clear(input);
    await user.type(input, 'không tồn tại');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });

  it('closes menu on Escape and retains focus on the combobox', async () => {
    const user = userEvent.setup();

    render(
      <SearchableCombobox
        aria-label="Chọn nguyên liệu"
        options={mockOptions}
        value=""
        onChange={vi.fn()}
      />
    );

    const input = screen.getByRole('combobox', { name: 'Chọn nguyên liệu' });
    await user.click(input);
    expect(await screen.findByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });
});
