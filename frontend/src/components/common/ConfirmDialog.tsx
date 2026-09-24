import * as React from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  ariaLabel?: string;
  description: string;
  confirmLabel: string;
  variant?: 'destructive' | 'default';
  busy?: boolean;
  busyLabel?: string;
  children?: React.ReactNode;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  open,
  title,
  ariaLabel,
  description,
  confirmLabel,
  variant = 'destructive',
  busy = false,
  busyLabel = 'Đang xử lý...',
  children,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  const isDestructive = variant === 'destructive';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-label={ariaLabel}>
        <div className="flex items-start gap-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              isDestructive ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
            }`}
            aria-hidden="true"
          >
            {isDestructive ? <AlertCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <DialogHeader className="space-y-1 text-left sm:text-left">
            <DialogTitle className="text-base font-semibold text-slate-900">{title}</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">{description}</DialogDescription>
          </DialogHeader>
        </div>
        {children}
        <DialogFooter className="gap-2 sm:justify-end">
          <DialogClose disabled={busy}>Hủy</DialogClose>
          <Button type="button" variant={variant} onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
