import { useState, useEffect, useTransition } from 'react';

/**
 * Standard debounced value hook with React 19 transition support (Rule F5, I2)
 * Ensures smooth typing without blocking main thread on rapid input.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedValue(value);
      });
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
