import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToastContext, type ToastItem, type ToastOptions, type ToastVariant } from './toast-context';

const variantStyles: Record<ToastVariant, { icon: ReactNode; className: string }> = {
  success: { icon: <CheckCircle2 aria-hidden="true" className="size-4" />, className: 'border-emerald-200 bg-emerald-50 text-emerald-950' },
  info: { icon: <Info aria-hidden="true" className="size-4" />, className: 'border-blue-200 bg-blue-50 text-blue-950' },
  warning: { icon: <TriangleAlert aria-hidden="true" className="size-4" />, className: 'border-amber-200 bg-amber-50 text-amber-950' },
  danger: { icon: <TriangleAlert aria-hidden="true" className="size-4" />, className: 'border-red-200 bg-red-50 text-red-950' },
};

const makeToastId = () => `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const id = makeToastId();
    const item: ToastItem = { ...options, id, variant: options.variant ?? 'info' };
    setItems((current) => [...current.slice(-3), item]);

    if ((options.durationMs ?? 5000) > 0) {
      const timer = setTimeout(() => dismissToast(id), options.durationMs ?? 5000);
      timers.current.set(id, timer);
    }
    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ toast, dismissToast }), [dismissToast, toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex justify-end sm:left-auto sm:w-[min(420px,calc(100vw-2rem))]" aria-live="polite" aria-atomic="false">
          <div className="flex w-full flex-col gap-2">
            {items.map((item) => {
              const variant = item.variant ?? 'info';
              const style = variantStyles[variant];
              return (
                <div key={item.id} role={variant === 'danger' ? 'alert' : 'status'} className={cn('pointer-events-auto flex items-start gap-3 rounded-lg border px-3.5 py-3 shadow-lg shadow-slate-950/10', style.className)}>
                  <div className="mt-0.5 shrink-0">{style.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-sm font-semibold">{item.title}</p>
                    {item.description && <p className="m-1.5 mb-0 text-xs leading-5 opacity-85">{item.description}</p>}
                  </div>
                  <button type="button" className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label="Đóng thông báo" onClick={() => dismissToast(item.id)}>
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
