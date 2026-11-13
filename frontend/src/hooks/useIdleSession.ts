import { useEffect, useState } from 'react';

function positiveMinutes(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** User activity only; waking after the deadline cannot revive an idle session. */
export function useIdleSession(enabled: boolean, onExpire: () => void) {
  const [warning, setWarning] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const timeout = positiveMinutes(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES, 60) * 60_000;
    const warningLead = Math.min(positiveMinutes(import.meta.env.VITE_IDLE_WARNING_MINUTES, 2) * 60_000, timeout);
    let lastActivity = Date.now();
    let expired = false;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      if (expired) return;
      const remaining = timeout - (Date.now() - lastActivity);
      if (remaining <= 0) {
        expired = true;
        setWarning(false);
        onExpire();
        return;
      }
      setWarning(remaining <= warningLead);
      timer = setTimeout(check, remaining > warningLead ? remaining - warningLead : remaining);
    };
    const activity = () => {
      if (Date.now() - lastActivity >= timeout) { check(); return; }
      lastActivity = Date.now();
      check();
    };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    events.forEach(event => window.addEventListener(event, activity, { passive: true, capture: true }));
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    check();
    return () => {
      clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, activity, true));
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [enabled, onExpire]);
  return enabled && warning;
}
