import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountdown } from './hooks'

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down to the 08:30 cutoff without locking business data', () => {
    vi.setSystemTime(new Date(2026, 6, 11, 7, 30, 0))
    const { result } = renderHook(() => useCountdown())

    expect(result.current).toEqual({ timeRemaining: '01:00:00', isPastCutoff: false })

    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current).toEqual({ timeRemaining: '00:59:59', isPastCutoff: false })
  })

  it.each([
    new Date(2026, 6, 11, 8, 30, 0),
    new Date(2026, 6, 11, 15, 45, 0),
  ])('reports a passed cutoff as informational state at %s', (now) => {
    vi.setSystemTime(now)
    const { result } = renderHook(() => useCountdown())

    expect(result.current).toEqual({ timeRemaining: '00:00:00', isPastCutoff: true })
  })
})
