import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from './ViewSwitcher';

describe('ViewSwitcher', () => {
  it('keeps tabs on one scrollable row with a single tab stop', () => {
    render(
      <ViewSwitcher
        ariaLabel="Chọn dữ liệu"
        activeTab="first"
        onTabChange={vi.fn()}
        tabs={[
          { id: 'first', label: 'Tab một' },
          { id: 'second', label: 'Tab hai' },
          { id: 'third', label: 'Tab ba' },
        ]}
      />,
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    tabs.forEach((tab) => expect(tab).toHaveClass('ipc-view-tab'));
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(tabs[0]).toHaveAttribute('tabindex', '0');
    expect(tabs[1]).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('calls the tab change handler with the selected id', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <ViewSwitcher
        ariaLabel="Chọn dữ liệu"
        activeTab="first"
        onTabChange={onTabChange}
        tabs={[{ id: 'first', label: 'Tab một' }, { id: 'second', label: 'Tab hai' }]}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Tab hai' }));
    expect(onTabChange).toHaveBeenCalledWith('second');

    await user.click(screen.getByRole('tab', { name: 'Tab một' }));
    expect(onTabChange).toHaveBeenCalledTimes(1);
  });

  it('supports Material tab keyboard navigation', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    render(
      <ViewSwitcher
        ariaLabel="Chọn dữ liệu"
        activeTab="first"
        onTabChange={onTabChange}
        tabs={[
          { id: 'first', label: 'Tab một' },
          { id: 'second', label: 'Tab hai' },
          { id: 'third', label: 'Tab ba' },
        ]}
      />,
    );

    screen.getByRole('tab', { name: 'Tab một' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Tab hai' })).toHaveFocus();
    expect(onTabChange).toHaveBeenLastCalledWith('second');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Tab ba' })).toHaveFocus();
    expect(onTabChange).toHaveBeenLastCalledWith('third');
  });

  it('moves keyboard focus without asking the page to scroll vertically', async () => {
    const user = userEvent.setup();
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    render(
      <ViewSwitcher
        ariaLabel="Chọn dữ liệu"
        activeTab="first"
        onTabChange={vi.fn()}
        tabs={[{ id: 'first', label: 'Tab một' }, { id: 'second', label: 'Tab hai' }]}
      />,
    );

    screen.getByRole('tab', { name: 'Tab một' }).focus();
    await user.keyboard('{ArrowRight}');

    expect(focusSpy).toHaveBeenLastCalledWith({ preventScroll: true });
    focusSpy.mockRestore();
  });
});
