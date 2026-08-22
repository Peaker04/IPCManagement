import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SplitWorkbench } from './SplitWorkbench';

describe('SplitWorkbench', () => {
  it('phase27-baseline-responsive-wide-rail-stacked: opts Warehouse into the responsive rail without changing DOM order', () => {
    const { container } = render(
      <SplitWorkbench detail={<button type="button">Mở phiếu</button>} detailLabel="Phiếu kho" wideDetailRail>
        <button type="button">Tìm tồn kho</button>
      </SplitWorkbench>,
    );

    expect(container.firstElementChild).toHaveClass('ipc-split-workbench--wide-detail-rail');
    expect(Array.from(container.firstElementChild?.children ?? []).map((node) => node.className)).toEqual([
      'ipc-split-primary',
      'ipc-split-detail-strip',
    ]);
    expect(screen.getByRole('complementary', { name: 'Phiếu kho' })).toBeVisible();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Tìm tồn kho', 'Mở phiếu']);
  });

  it('preserves the stacked shared default for Approval and Chef consumers', () => {
    const { container } = render(
      <SplitWorkbench detail={<span>Chi tiết</span>} detailLabel="Chi tiết">
        <span>Danh sách</span>
      </SplitWorkbench>,
    );

    expect(container.firstElementChild).toHaveClass('ipc-split-workbench');
    expect(container.firstElementChild).not.toHaveClass('ipc-split-workbench--wide-detail-rail');
  });
});
