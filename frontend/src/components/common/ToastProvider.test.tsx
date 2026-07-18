import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './ToastProvider';
import { useToast } from './useToast';

function Trigger() {
  const { toast } = useToast();
  return <button type="button" onClick={() => toast({ title: 'Đã lưu', description: 'Dữ liệu đã được cập nhật.', variant: 'success', durationMs: 0 })}>Thông báo</button>;
}

describe('ToastProvider', () => {
  it('renders typed feedback with an accessible dismiss action', async () => {
    const user = userEvent.setup();
    render(<ToastProvider><Trigger /></ToastProvider>);

    await user.click(screen.getByRole('button', { name: 'Thông báo' }));
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu');
    await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('clears auto-dismiss timers on unmount', () => {
    vi.useFakeTimers();
    const { unmount } = render(<ToastProvider><Trigger /></ToastProvider>);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
