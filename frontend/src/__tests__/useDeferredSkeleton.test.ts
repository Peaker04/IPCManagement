import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeferredSkeleton } from '../hooks/useDeferredSkeleton';

describe('useDeferredSkeleton Hook — 150ms Doherty Threshold & Min Duration Gate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not display skeleton if loading finishes before 150ms threshold', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useDeferredSkeleton(loading, 150, 250),
      { initialProps: { loading: true } }
    );

    // Frame 0: immediate render should NOT show skeleton
    expect(result.current).toBe(false);

    // Advance 100ms (< 150ms)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);

    // Loading completes before 150ms
    rerender({ loading: false });

    // Advance past 150ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // Skeleton was never shown
    expect(result.current).toBe(false);
  });

  it('displays skeleton when loading exceeds 150ms', () => {
    const { result } = renderHook(
      ({ loading }) => useDeferredSkeleton(loading, 150, 250),
      { initialProps: { loading: true } }
    );

    expect(result.current).toBe(false);

    // Advance to 150ms
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(true);
  });

  it('enforces minimum duration once skeleton has been shown to prevent visual jerk', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useDeferredSkeleton(loading, 150, 250),
      { initialProps: { loading: true } }
    );

    // Reach 150ms: skeleton becomes visible
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(true);

    // Advance 50ms (total 200ms loading), then loading completes
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ loading: false });

    // Even though loading finished, skeleton must stay visible for minDuration (250ms total from appearance)
    expect(result.current).toBe(true);

    // Advance 190ms (skeleton has been shown for 240ms < 250ms)
    act(() => {
      vi.advanceTimersByTime(190);
    });
    expect(result.current).toBe(true);

    // Advance 20ms more (skeleton has been shown for 260ms >= 250ms)
    act(() => {
      vi.advanceTimersByTime(20);
    });
    expect(result.current).toBe(false);
  });
});
