import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExcessMaterialDialog } from './excess-material-dialog';

describe('ExcessMaterialDialog responsive contract', () => {
  it('keeps condition choices in a mobile-first layout', () => {
    render(
      <ExcessMaterialDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        materials={[]}
      />,
    );

    const conditionLabel = screen.getByText('Tình trạng nguyên liệu', { exact: true });
    const conditionGroup = conditionLabel.parentElement?.querySelector('.ipc-excess-condition-group');
    expect(conditionGroup).not.toBeNull();
    expect(conditionGroup).toHaveClass('grid-cols-1', 'sm:grid-cols-3');
    expect(screen.getByText('Nguyên vẹn')).toBeInTheDocument();
    expect(screen.getByText('Đã sử dụng')).toBeInTheDocument();
    expect(screen.getByText('Hư hỏng')).toBeInTheDocument();
    expect(conditionLabel).not.toHaveClass('uppercase');
    expect(screen.queryByText('Tình Trạng Nguyên Liệu')).not.toBeInTheDocument();
  });
});
