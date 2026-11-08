import React, { useState, useCallback } from 'react';
import { FileText, Copy, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface DocumentCodeCellProps {
  code: string;
  onOpenDetail?: (code: string) => void;
  title?: string;
  className?: string;
}

/**
 * Enterprise Interactive Document Code Cell
 * - Clickable code badge: Opens detail modal (onOpenDetail).
 * - Dedicated copy button: Copies to clipboard with e.stopPropagation() and visual feedback.
 */
export function DocumentCodeCell({
  code,
  onOpenDetail,
  title = 'Bấm để xem chi tiết phiếu xuất kho',
  className,
}: DocumentCodeCellProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard write fallback
    }
  }, [code]);

  return (
    <div className={twMerge(clsx('inline-flex items-center gap-1.5 max-w-full', className))}>
      {onOpenDetail ? (
        <button
          type="button"
          onClick={() => onOpenDetail(code)}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-50/80 hover:bg-blue-100/90 px-2 py-0.5 rounded border border-blue-200/80 transition-colors cursor-pointer group truncate"
          title={title}
        >
          <FileText size={12} className="shrink-0 text-blue-500 group-hover:text-blue-700" aria-hidden="true" />
          <span className="truncate underline decoration-blue-300 underline-offset-2">{code}</span>
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate">
          <FileText size={12} className="shrink-0 text-slate-500" aria-hidden="true" />
          <span className="truncate">{code}</span>
        </span>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center size-6 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
        title={copied ? 'Đã sao chép!' : 'Sao chép mã chứng từ'}
        aria-label={`Sao chép mã chứng từ ${code}`}
      >
        {copied ? (
          <Check size={12} className="text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy size={12} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
