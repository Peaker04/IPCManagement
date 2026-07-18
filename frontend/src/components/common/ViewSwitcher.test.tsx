import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ViewSwitcher } from './ViewSwitcher';

describe('ViewSwitcher', () => {
  it('keeps every tab flexible so wrapped tab rows do not leave a narrow orphan', () => {
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
    tabs.forEach((tab) => expect(tab).toHaveClass('flex-1', 'min-w-0'));
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
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
  });
});
