import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PurchaseWorkflowGuide } from './PurchaseWorkflowGuide';
import { PURCHASING_STAGES } from './purchasingModel';

describe('PurchaseWorkflowGuide mounted behavior', () => {
  it('renders navigation region and preserves all six stage controls with accessible state and navigation callbacks', () => {
    const onStageChange = vi.fn();

    // Stage is 'supplier-price', so 'demand' is completed (prior), 'supplier-price' is current, and later stages are blocked (future)
    render(
      <PurchaseWorkflowGuide
        currentStage="supplier-price"
        selectedStage="supplier-price"
        onStageChange={onStageChange}
      />,
    );

    // 1. Navigation region exists
    const nav = screen.getByRole('navigation', { name: 'Sáu giai đoạn thu mua' });
    expect(nav).toBeInTheDocument();

    // 2. All six stage controls exist and no stage is lost during compaction
    const listItems = within(nav).getAllByRole('listitem');
    expect(listItems).toHaveLength(6);
    for (const stage of PURCHASING_STAGES) {
      expect(within(nav).getByText(stage.shortLabel)).toBeInTheDocument();
    }

    // 3. Active/current stage is identifiable
    const currentBtn = within(nav).getByRole('button', { name: /Chọn nhà cung cấp và giá - Hiện tại/i });
    expect(currentBtn).toHaveAttribute('aria-current', 'step');
    expect(currentBtn).toHaveAttribute('aria-pressed', 'true');
    expect(within(currentBtn).queryByText('Hiện tại')).toBeNull();
    expect(within(currentBtn).getByText('NCC & giá')).toBeInTheDocument();

    // 4. Completed prior stage is enabled
    const priorDemandBtn = within(nav).getByRole('button', { name: /^Nhu cầu đã duyệt/i });
    expect(priorDemandBtn).not.toBeDisabled();

    // 5. Blocked future stage is disabled
    const futureOrderBtn = within(nav).getByRole('button', { name: /^Duyệt và tạo đơn/i });
    expect(futureOrderBtn).toBeDisabled();

    // 6. Blocked reason is accessible via title
    const exceptionStage = PURCHASING_STAGES.find((s) => s.id === 'exception')!;
    const futureExceptionBtn = within(nav).getByRole('button', { name: /^Xử lý ngoại lệ giá/i });
    expect(futureExceptionBtn).toHaveAttribute('title', exceptionStage.blockedReason);

    // 7. Clicking an enabled prior stage calls onStageChange with exact id
    fireEvent.click(priorDemandBtn);
    expect(onStageChange).toHaveBeenCalledWith('demand');
  });
});
