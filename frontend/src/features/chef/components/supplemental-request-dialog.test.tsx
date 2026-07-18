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

    expect(screen.getByText('Chọn nguyên liệu')).toBeInTheDocument();
    expect(screen.getByText('Số lượng yêu cầu')).toBeInTheDocument();
    expect(screen.getByText('Lý do yêu cầu')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Mô tả lý do (ví dụ: hao hụt trong chế biến hoặc phát sinh đột xuất)')).toBeInTheDocument();
    expect(screen.queryByText('Chọn Nguyên Liệu')).not.toBeInTheDocument();
    expect(screen.queryByText('Số Lượng Yêu Cầu')).not.toBeInTheDocument();
  });
});
