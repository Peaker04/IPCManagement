import { useState, useEffect, useRef } from 'react';

export const LOADING_INDICATOR_DELAY_MS = 150;

// Each read owns a fresh delay. Ready data is never held by the default policy.
// An explicit minimum duration remains supported for callers that require it.
export function useDeferredSkeleton(
  isLoading: boolean,
  delayMs = LOADING_INDICATOR_DELAY_MS,
  minDurationMs = 0
): boolean {
  const [showSkeleton, setShowSkeleton] = useState(() => delayMs === 0 && isLoading);
  const [previousLoading, setPreviousLoading] = useState(isLoading);
  const shownAtRef = useRef<number | null>(null);

  // Synchronize before paint: a zero-duration hide timer can otherwise be
  // canceled by the next read, carrying the previous visible state into it.
  if (previousLoading !== isLoading) {
    setPreviousLoading(isLoading);
    if (minDurationMs === 0) setShowSkeleton(delayMs === 0 && isLoading);
  }

  useEffect(() => {
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let minDurationTimer: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      if (showSkeleton && shownAtRef.current === null) {
        shownAtRef.current = Date.now();
      } else if (!showSkeleton) {
        delayTimer = setTimeout(() => {
          shownAtRef.current = Date.now();
          setShowSkeleton(true);
        }, delayMs);
      }
    } else {
      if (!showSkeleton) shownAtRef.current = null;
      if (showSkeleton) {
        const shownAt = shownAtRef.current ?? Date.now();
        const elapsed = Date.now() - shownAt;
        const remaining = Math.max(0, minDurationMs - elapsed);

        minDurationTimer = setTimeout(() => {
          setShowSkeleton(false);
          shownAtRef.current = null;
        }, remaining);
      }
    }

    return () => {
      if (delayTimer) clearTimeout(delayTimer);
      if (minDurationTimer) clearTimeout(minDurationTimer);
    };
  }, [isLoading, delayMs, minDurationMs, showSkeleton]);

  return showSkeleton;
}
