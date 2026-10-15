import React, { useEffect, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Button } from './button';

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

  const handleSafeClose = useCallback(() => {
    if (isDirty) {
      const confirmDiscard = window.confirm(
        confirmCloseMessage || 'Bạn có các thay đổi chưa được lưu. Bạn có chắc chắn muốn đóng và hủy bỏ các thay đổi này?'
      );
      if (!confirmDiscard) return;
    }
    onClose();
  }, [isDirty, confirmCloseMessage, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSafeClose();
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
  }, [isOpen, handleSafeClose]);

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
            ✕
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
      </div>
    </div>
  );
}
