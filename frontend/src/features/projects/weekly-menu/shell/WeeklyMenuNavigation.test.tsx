import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WeeklyMenuNavigation } from './WeeklyMenuNavigation';

const views = ['schedule', 'demand', 'production-plan', 'purchase-summary', 'cost', 'dish-materials'] as const;

describe('Weekly Menu business navigation', () => {
  it('switches directly between DEFAULT views without an intermediate group', () => {
    const onViewChange = vi.fn();
    render(<WeeklyMenuNavigation mode="DEFAULT" views={[...views]} activeView="schedule" onViewChange={onViewChange} />);

    const tabs = screen.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' });
    expect(tabs.querySelectorAll('[role="tab"]')).toHaveLength(6);
    expect(screen.getByRole('tab', { name: 'Kế hoạch tuần' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Nhu cầu' }));
    expect(onViewChange).toHaveBeenCalledWith('demand');
  });

  it('keeps the MRX two-step navigation', () => {
    render(<WeeklyMenuNavigation mode="MATERIAL_RECONCILIATION" views={['schedule', 'demand']} activeView="demand" onViewChange={vi.fn()} />);
    expect(screen.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Định lượng xuất kho' })).toHaveAttribute('aria-selected', 'true');
  });
});
