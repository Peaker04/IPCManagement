import React, { useEffect, useEffectEvent, useRef, useCallback, useId, useState } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './button';
import { useOptionalDirtyNavigation } from '../workbench/dirty-navigation-context';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDirty?: boolean;
  closeDisabled?: boolean;
  confirmCloseMessage?: string;
  title: React.ReactNode;
  role?: 'dialog' | 'alertdialog';
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode | ((requestClose: () => void) => React.ReactNode);
  maxWidth?: string;
  className?: string;
  bodyClassName?: string;
}

export function Modal({
  isOpen,
  onClose,
  isDirty = false,
  closeDisabled = false,
  confirmCloseMessage,
  title,
  role = 'dialog',
  description,
  children,
  footer,
  maxWidth = 'max-w-lg',
  className,
  bodyClassName,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [discardTrigger, setDiscardTrigger] = useState<HTMLElement | null>(null);
  const dirtyNavigation = useOptionalDirtyNavigation();
  const registerDirty = dirtyNavigation?.registerDirty;
  const dirtyKey = useId();
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

  const handleSafeClose = useCallback(() => {
    if (closeDisabled) return;
    if (isDirty) {
      setDiscardTrigger(document.activeElement as HTMLElement | null);
      setIsDiscardConfirmOpen(true);
      return;
    }
    onClose();
  }, [closeDisabled, isDirty, onClose]);

  const discardAndClose = useCallback(() => {
    if (closeDisabled) return;
    setDiscardTrigger(null);
    setIsDiscardConfirmOpen(false);
    onClose();
  }, [closeDisabled, onClose]);

  const cancelDiscard = useCallback(() => setIsDiscardConfirmOpen(false), []);
  useEffect(() => {
    if (!isDiscardConfirmOpen && discardTrigger) discardTrigger.focus();
  }, [isDiscardConfirmOpen, discardTrigger]);

  useEffect(() => {
    if (!isOpen || (!isDirty && !closeDisabled) || !registerDirty) return;
    return registerDirty(dirtyKey, { blockNavigation: closeDisabled });
  }, [dirtyKey, registerDirty, isDirty, closeDisabled, isOpen]);

  const handleEscape = useEffectEvent(() => {
    if (isDiscardConfirmOpen) cancelDiscard();
    else handleSafeClose();
  });

  useEffect(() => {
    if (!isOpen) return;

    triggerRef.current = document.activeElement as HTMLElement | null;
    const ownDialog = modalRef.current?.parentElement;
    const backgroundDialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]'))
      .filter(dialog => dialog !== ownDialog && !dialog.contains(ownDialog ?? null) && dialog.getAttribute('aria-hidden') !== 'true');
    const previousDialogState = backgroundDialogs.map(dialog => ({ dialog, hidden: dialog.getAttribute('aria-hidden'), inert: dialog.hasAttribute('inert') }));
    for (const dialog of backgroundDialogs) { dialog.setAttribute('aria-hidden', 'true'); dialog.setAttribute('inert', ''); }

    const focusTimer = window.setTimeout(() => {
      if (!modalRef.current) return;
      const focusables = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length > 0 && !modalRef.current.contains(document.activeElement)) {
        focusables[0].focus();
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      const topDialog = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]:not([aria-hidden="true"])')).at(-1);
      if (topDialog && topDialog !== ownDialog && !modalRef.current?.contains(topDialog)) return;
      if (e.key === 'Escape') {
        handleEscape();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const trap = modalRef.current.querySelector<HTMLElement>('[role="alertdialog"]') ?? modalRef.current;
        const focusables = Array.from(trap.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ));

        if (focusables.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !trap.contains(document.activeElement)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last || !trap.contains(document.activeElement)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    if (!document.body.hasAttribute('data-modal-scroll-restore')) document.body.setAttribute('data-modal-scroll-restore', document.body.style.overflow);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      for (const { dialog, hidden, inert } of previousDialogState) {
        if (hidden === null) dialog.removeAttribute('aria-hidden'); else dialog.setAttribute('aria-hidden', hidden);
        if (!inert) dialog.removeAttribute('inert');
      }
      if (!document.querySelector('[aria-modal="true"]')) {
        document.body.style.overflow = document.body.getAttribute('data-modal-scroll-restore') || '';
        document.body.removeAttribute('data-modal-scroll-restore');
      }
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role={isDiscardConfirmOpen ? undefined : role}
      aria-modal={isDiscardConfirmOpen ? undefined : true}
      aria-labelledby={`${dirtyKey}-title`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      <div
        ref={modalRef}
        className={twMerge(
          clsx(
            'relative w-full rounded-lg border border-slate-200 bg-white shadow-xl flex flex-col max-h-[90dvh] overflow-hidden',
            maxWidth,
            className
          )
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0 bg-slate-50/50">
          <div>
            <h2 id={`${dirtyKey}-title`} className="text-sm font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSafeClose}
            disabled={closeDisabled}
            aria-label="Đóng hộp thoại"
            className="h-7 w-7 text-slate-400 hover:text-slate-700"
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Body */}
        <div className={twMerge('p-4 overflow-y-auto flex-1 text-xs text-slate-700', bodyClassName)}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2.5 bg-slate-50/50 shrink-0">
            {typeof footer === 'function' ? footer(handleSafeClose) : footer}
          </div>
        )}
        {isDiscardConfirmOpen && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${dirtyKey}-discard-title`}
            aria-describedby={`${dirtyKey}-discard-description`}
            className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4"
          >
            <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
              <h3 id={`${dirtyKey}-discard-title`} className="text-sm font-semibold text-slate-900">
                Hủy thay đổi chưa lưu?
              </h3>
              <p id={`${dirtyKey}-discard-description`} className="mt-1 text-xs leading-relaxed text-slate-600">
                {confirmCloseMessage || 'Các thay đổi trong biểu mẫu này chưa được lưu và sẽ bị mất nếu bạn đóng.'}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={cancelDiscard} autoFocus>
                  Tiếp tục chỉnh sửa
                </Button>
                <Button variant="destructive" size="sm" onClick={discardAndClose} disabled={closeDisabled}>
                  Hủy thay đổi
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
