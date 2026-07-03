import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  message: string;
}

export function ErrorDialog({ open, onOpenChange, title = 'Đã xảy ra lỗi', message }: ErrorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--ipc-danger)]">{title}</DialogTitle>
        </DialogHeader>
        <p className="pt-2 text-sm text-slate-700">{message}</p>
        <DialogFooter>
          <button type="button" className="ipc-button ipc-button-primary" onClick={() => onOpenChange(false)}>
            Đóng
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
