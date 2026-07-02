import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ROUTES } from '../../../routes/routeConfig';
import { subscribeSessionExpired } from '../sessionEvents';

const AUTO_REDIRECT_MS = 1800;

export const SessionTimeoutModal = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => subscribeSessionExpired(() => setIsOpen(true)), []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIsOpen(false);
      navigate(ROUTES.LOGIN, { replace: true, state: { from: location.pathname } });
    }, AUTO_REDIRECT_MS);

    return () => window.clearTimeout(timer);
  }, [isOpen, location.pathname, navigate]);

  const goToLogin = () => {
    setIsOpen(false);
    navigate(ROUTES.LOGIN, { replace: true, state: { from: location.pathname } });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : goToLogin())}>
      <DialogContent className="max-w-md border-amber-200 bg-white p-6 shadow-2xl">
        <DialogHeader className="text-left">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <ShieldAlert size={22} />
          </div>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <AlertTriangle size={18} className="text-amber-700" />
            Phiên đăng nhập đã hết hạn
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Vui lòng đăng nhập lại để tiếp tục thao tác.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={goToLogin}>
            Đăng nhập lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
