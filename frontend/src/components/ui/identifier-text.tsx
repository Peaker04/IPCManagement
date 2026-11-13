import React, { useState, useCallback } from 'react';
import { Check, CircleAlert, Copy } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface IdentifierTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string;
  displayValue?: string;
  copyable?: boolean;
}

export function IdentifierText({
  value,
  displayValue = value,
  copyable = true,
  className,
  ...props
}: IdentifierTextProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const Element = copyable ? 'button' : 'span';

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!copyable || !value) return;
      setCopyError(false);
      setCopied(false);
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setCopyError(true);
      }
    },
    [copyable, value]
  );

  return (
    <Element
      type={copyable ? 'button' : undefined}
      aria-label={copyable ? `Sao chép ${value}` : undefined}
      className={twMerge(
        clsx(
          'inline-flex items-center w-fit gap-1 font-mono text-xs text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/80 group select-all',
          copyable && 'cursor-pointer hover:bg-slate-200/80 hover:text-slate-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
          className
        )
      )}
      onClick={copyable ? handleCopy : undefined}
      title={copyable ? (copyError ? 'Không thể sao chép. Hãy chọn và sao chép mã thủ công.' : copied ? 'Đã sao chép!' : 'Bấm để sao chép') : undefined}
      {...props}
    >
      <span>{displayValue}</span>
      {copyable && <span role="status" className="sr-only">{copyError ? 'Không thể sao chép. Hãy chọn và sao chép mã thủ công.' : copied ? 'Đã sao chép' : ''}</span>}
      {copyable && (
        <span
          className={clsx(
            'inline-flex items-center justify-center size-3.5 transition-opacity',
            copyError ? 'text-rose-700' : copied ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          )}
        >
          {copyError ? <CircleAlert className="size-3" aria-hidden="true" /> : copied ? <Check className="size-3" aria-hidden="true" /> : <Copy className="size-3" aria-hidden="true" />}
        </span>
      )}
    </Element>
  );
}
