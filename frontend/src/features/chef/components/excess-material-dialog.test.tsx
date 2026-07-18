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

    const conditionGroup = screen.getByText('Tình Trạng Nguyên Liệu').parentElement?.querySelector('.ipc-excess-condition-group');
    expect(conditionGroup).not.toBeNull();
    expect(conditionGroup).toHaveClass('grid-cols-1', 'sm:grid-cols-3');
    expect(screen.getByText('Nguyên Vẹn')).toBeInTheDocument();
    expect(screen.getByText('Đã Sử Dụng')).toBeInTheDocument();
    expect(screen.getByText('Hư Hỏng')).toBeInTheDocument();
  });
});
