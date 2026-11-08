import React, { useState, useCallback } from 'react';
import { Check, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface IdentifierTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string;
  copyable?: boolean;
}

export function IdentifierText({
  value,
  copyable = true,
  className,
  ...props
}: IdentifierTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!copyable || !value) return;
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        // Clipboard write fallback
      }
    },
    [copyable, value]
  );

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center w-fit gap-1 font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 group select-all',
          copyable && 'cursor-pointer hover:bg-slate-200/80 hover:text-slate-900 transition-colors',
          className
        )
      )}
      onClick={copyable ? handleCopy : undefined}
      title={copyable ? (copied ? 'Đã sao chép!' : 'Bấm để sao chép') : undefined}
      {...props}
    >
      <span>{value}</span>
      {copyable && (
        <span
          className={clsx(
            'inline-flex items-center justify-center size-3.5 transition-opacity',
            copied ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700 opacity-0 group-hover:opacity-100'
          )}
        >
          {copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
        </span>
      )}
    </span>
  );
}
