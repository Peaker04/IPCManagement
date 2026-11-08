import { useState, useEffect, useRef } from 'react';

/**
 * Enterprise Cognitive Latency Deferral Hook (NN/g Doherty Threshold & SAP Fiori Invariant)
 * - Suppresses skeleton flashing if loading finishes within 150ms.
 * - Enforces minimum display duration (250ms) once shown to eliminate perceptual visual jerk.
 */
export function useDeferredSkeleton(
  isLoading: boolean,
  delayMs = 150,
  minDurationMs = 250
): boolean {
  const [showSkeleton, setShowSkeleton] = useState(() => delayMs === 0 && isLoading);
  const shownAtRef = useRef<number | null>(null);

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
