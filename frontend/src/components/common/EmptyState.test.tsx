import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('shows a neutral business-empty state without any alert or retry affordance', () => {
    const { container } = render(
      <EmptyState title="Chưa có nhu cầu nguyên liệu" description="Bấm tạo nhu cầu từ KHSX." />,
    );

    expect(screen.getByText('Chưa có nhu cầu nguyên liệu')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('.ipc-empty-state')).not.toBeNull();
    expect(container.querySelector('.ipc-empty-state')).toHaveClass('min-h-0');
    expect(container.querySelector('.ipc-empty-state')?.className).not.toContain('min-h-[200px]');
  });

  it('renders a load failure as an alert with retry, never as a plain empty state', () => {
    const onRetry = vi.fn();
    const { container } = render(
      <EmptyState
        variant="error"
        title="Không tải được nhu cầu nguyên liệu"
        description="Chưa thể kết luận là tuần này không cần mua gì."
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Không tải được nhu cầu nguyên liệu');
    expect(alert).toHaveTextContent('Chưa thể kết luận là tuần này không cần mua gì.');
    // Trạng thái lỗi không được mượn lại vỏ "rỗng thật".
    expect(container.querySelector('.ipc-empty-state')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('locks the retry button while the query is refetching', () => {
    render(
      <EmptyState
        variant="error"
        title="Không tải được tồn kho"
        onRetry={() => undefined}
        isRetrying
      />,
    );

    expect(screen.getByRole('button', { name: 'Đang tải lại…' })).toBeDisabled();
  });
});
