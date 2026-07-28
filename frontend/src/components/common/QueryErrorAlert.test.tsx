import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryErrorAlert } from './QueryErrorAlert';

describe('QueryErrorAlert', () => {
  it('announces the failure and offers an explicit retry action', () => {
    const onRetry = vi.fn();

    render(
      <QueryErrorAlert title="Không tải được dữ liệu" onRetry={onRetry}>
        Kiểm tra kết nối rồi thử lại.
      </QueryErrorAlert>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được dữ liệu');
    fireEvent.click(screen.getByRole('button', { name: 'Thử tải lại' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('locks retry while a request is already in progress', () => {
    render(
      <QueryErrorAlert title="Không tải được dữ liệu" onRetry={() => undefined} isRetrying>
        Đang thử lại.
      </QueryErrorAlert>,
    );

    expect(screen.getByRole('button', { name: 'Đang tải lại…' })).toBeDisabled();
  });
});
