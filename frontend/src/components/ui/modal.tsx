import React, { useEffect, useRef, useCallback, useId, useState } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './button';
import { useOptionalDirtyNavigation } from '../workbench/dirty-navigation-context';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDirty?: boolean;
  confirmCloseMessage?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  isDirty = false,
  confirmCloseMessage,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-lg',
  className,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const dirtyNavigation = useOptionalDirtyNavigation();
  const registerDirty = dirtyNavigation?.registerDirty;
  const dirtyKey = useId();
  const [isDiscardConfirmOpen, setIsDiscardConfirmOpen] = useState(false);

  const handleSafeClose = useCallback(() => {
    if (isDirty) {
      setIsDiscardConfirmOpen(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  const discardAndClose = useCallback(() => {
    setIsDiscardConfirmOpen(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !isDirty || !registerDirty) return;
    return registerDirty(dirtyKey);
  }, [dirtyKey, registerDirty, isDirty, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDiscardConfirmOpen) {
          setIsDiscardConfirmOpen(false);
        } else {
          handleSafeClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleSafeClose, isDiscardConfirmOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
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
            <h2 id="modal-title" className="text-sm font-semibold text-slate-900">
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
            aria-label="Đóng hộp thoại"
            className="h-7 w-7 text-slate-400 hover:text-slate-700"
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 text-xs text-slate-700">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2.5 bg-slate-50/50 shrink-0">
            {footer}
          </div>
        )}
        {isDiscardConfirmOpen && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-dialog-title"
            aria-describedby="discard-dialog-description"
            className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4"
          >
            <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
              <h3 id="discard-dialog-title" className="text-sm font-semibold text-slate-900">
                Hủy thay đổi chưa lưu?
              </h3>
              <p id="discard-dialog-description" className="mt-1 text-xs leading-relaxed text-slate-600">
                {confirmCloseMessage || 'Các thay đổi trong biểu mẫu này chưa được lưu và sẽ bị mất nếu bạn đóng.'}
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsDiscardConfirmOpen(false)} autoFocus>
                  Tiếp tục chỉnh sửa
                </Button>
                <Button variant="destructive" size="sm" onClick={discardAndClose}>
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
