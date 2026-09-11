import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  IDLE_TIMEOUT_MINUTES,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MINUTES,
  IDLE_WARNING_MS,
} from './idleSessionPolicy';

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['keydown', 'pointerdown', 'touchstart'];

export const IdleSessionGuard = ({ onLogout }: { onLogout: () => void | Promise<void> }) => {
  const [warningOpen, setWarningOpen] = useState(false);
  const idleTimer = useRef<number | undefined>(undefined);
  const warningTimer = useRef<number | undefined>(undefined);
  const logoutStarted = useRef(false);
  const warningOpenRef = useRef(false);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    warningOpenRef.current = warningOpen;
    onLogoutRef.current = onLogout;
  }, [onLogout, warningOpen]);

  const clearTimers = useCallback(() => {
    if (idleTimer.current !== undefined) window.clearTimeout(idleTimer.current);
    if (warningTimer.current !== undefined) window.clearTimeout(warningTimer.current);
  }, []);

  const logoutOnce = useCallback(() => {
    if (logoutStarted.current) return;
    logoutStarted.current = true;
    void onLogoutRef.current();
  }, []);

  const scheduleIdleWarning = useCallback(() => {
    clearTimers();
    idleTimer.current = window.setTimeout(() => {
      setWarningOpen(true);
      warningTimer.current = window.setTimeout(logoutOnce, IDLE_WARNING_MS);
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers, logoutOnce]);

  useEffect(() => {
    scheduleIdleWarning();
    const recordActivity = () => {
      if (!warningOpenRef.current && !logoutStarted.current) scheduleIdleWarning();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, recordActivity, { passive: true }));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, recordActivity));
    };
  }, [clearTimers, scheduleIdleWarning]);

  const continueSession = () => {
    setWarningOpen(false);
    scheduleIdleWarning();
  };

  return (
    <Dialog open={warningOpen} onOpenChange={() => {}}>
      <DialogContent aria-label="Phiên sắp hết hạn do không hoạt động" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock3 size={18} />
            Phiên đăng nhập sắp hết hạn
          </DialogTitle>
          <DialogDescription>
            Bạn đã không thao tác trong {IDLE_TIMEOUT_MINUTES} phút. Phiên sẽ kết thúc sau {IDLE_WARNING_MINUTES} phút nếu không tiếp tục.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={logoutOnce}>Đăng xuất</Button>
          <Button type="button" onClick={continueSession}>Tiếp tục phiên</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
