const MAX_TIMER_MINUTES = 2_147_483_647 / 60_000;

export const boundedTimerMinutes = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= MAX_TIMER_MINUTES ? parsed : fallback;
};

export const IDLE_TIMEOUT_MINUTES = boundedTimerMinutes(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES, 60);
export const IDLE_WARNING_MINUTES = boundedTimerMinutes(import.meta.env.VITE_IDLE_WARNING_MINUTES, 2);
export const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60 * 1000;
export const IDLE_WARNING_MS = IDLE_WARNING_MINUTES * 60 * 1000;
