import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IdleSessionGuard } from './IdleSessionGuard';
import {
  IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MINUTES,
  IDLE_WARNING_MS,
} from './idleSessionPolicy';

describe('IdleSessionGuard', () => {
  afterEach(() => vi.useRealTimers());

  it('warns after 60 minutes and logs out once after the two-minute grace period', () => {
    vi.useFakeTimers();
    const onLogout = vi.fn();
    render(<IdleSessionGuard onLogout={onLogout} />);

    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS));
    expect(screen.getByRole('dialog', { name: 'Phiên sắp hết hạn do không hoạt động' })).toHaveTextContent(
      `Bạn đã không thao tác trong ${IDLE_TIMEOUT_MINUTES} phút. Phiên sẽ kết thúc sau ${IDLE_WARNING_MINUTES} phút`,
    );

    act(() => vi.advanceTimersByTime(IDLE_WARNING_MS));
    expect(onLogout).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(IDLE_WARNING_MS));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('resets on trusted activity and lets the user continue the session', () => {
    vi.useFakeTimers();
    const onLogout = vi.fn();
    render(<IdleSessionGuard onLogout={onLogout} />);

    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1));
    fireEvent.keyDown(window, { key: 'Tab' });
    act(() => vi.advanceTimersByTime(IDLE_TIMEOUT_MS - 1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục phiên' }));
    act(() => vi.advanceTimersByTime(IDLE_WARNING_MS));
    expect(onLogout).not.toHaveBeenCalled();
  });
});
