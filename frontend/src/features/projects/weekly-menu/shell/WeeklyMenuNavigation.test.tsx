import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WeeklyMenuNavigation } from './WeeklyMenuNavigation';

const views = ['schedule', 'demand', 'production-plan', 'purchase-summary', 'cost', 'dish-materials'] as const;

describe('Weekly Menu business navigation', () => {
  it('uses a compact two-level DEFAULT switcher and shows the main planning tab first', () => {
    const onViewChange = vi.fn();
    render(<WeeklyMenuNavigation mode="DEFAULT" views={[...views]} activeView="schedule" onViewChange={onViewChange} />);

    const parentTabs = screen.getByRole('tablist', { name: 'Chọn nhóm tác vụ kế hoạch tuần' });
    expect(parentTabs.querySelectorAll('[role="tab"]')[0]).toHaveTextContent('Soạn kế hoạch');
    expect(screen.getByRole('tab', { name: 'Soạn kế hoạch' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tablist', { name: 'Chọn tác vụ trong nhóm Soạn kế hoạch' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kế hoạch tuần' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('tab', { name: 'Kế hoạch sản xuất' })).not.toBeInTheDocument();
    expect(screen.queryByText(/↳/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Thực thi tuần' }));
    expect(onViewChange).toHaveBeenCalledWith('demand');
  });

  it('keeps the MRX two-step navigation', () => {
    render(<WeeklyMenuNavigation mode="MATERIAL_RECONCILIATION" views={['schedule', 'demand']} activeView="demand" onViewChange={vi.fn()} />);
    expect(screen.getByRole('tablist', { name: 'Chọn góc nhìn kế hoạch tuần' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Định lượng xuất kho' })).toHaveAttribute('aria-selected', 'true');
  });
});
