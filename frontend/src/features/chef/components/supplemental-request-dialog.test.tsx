import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SupplementalRequestDialog } from './supplemental-request-dialog';

describe('SupplementalRequestDialog user-facing copy', () => {
  it('uses sentence-case Vietnamese labels instead of code-like title casing', () => {
    render(
      <SupplementalRequestDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        materials={[]}
      />,
    );

    const materialLabel = screen.getByText('Chọn nguyên liệu');
    const quantityLabel = screen.getByText('Số lượng yêu cầu');
    const reasonLabel = screen.getByText('Lý do yêu cầu');
    expect(materialLabel).toBeInTheDocument();
    expect(quantityLabel).toBeInTheDocument();
    expect(reasonLabel).toBeInTheDocument();
    expect(materialLabel).not.toHaveClass('uppercase');
    expect(quantityLabel).not.toHaveClass('uppercase');
    expect(reasonLabel).not.toHaveClass('uppercase');
    expect(screen.getByPlaceholderText('Mô tả lý do (ví dụ: hao hụt trong chế biến hoặc phát sinh đột xuất)')).toBeInTheDocument();
    expect(screen.queryByText('Chọn Nguyên Liệu')).not.toBeInTheDocument();
    expect(screen.queryByText('Số Lượng Yêu Cầu')).not.toBeInTheDocument();
  });
});
