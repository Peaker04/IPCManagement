import { useState, type ReactNode } from 'react';
import { ChevronDown, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/typography';

export interface DiagnosticPanelProps {
  title?: string;
  error?: unknown;
  details?: ReactNode;
  technicalCode?: string;
  className?: string;
}

/**
 * DiagnosticPanel - Isolates raw technical details (stack traces, exception messages, API error objects)
 * from business-facing UI into an expandable, developer/support-friendly panel.
 */
export function DiagnosticPanel({
  title = 'Chi tiết kỹ thuật dành cho hỗ trợ',
  error,
  details,
  technicalCode,
  className,
}: DiagnosticPanelProps) {
  const [copied, setCopied] = useState(false);

  const rawText =
    typeof details === 'string'
      ? details
      : error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : typeof error === 'object' && error !== null
      ? JSON.stringify(error, null, 2)
      : String(error ?? details ?? '');

  if (!rawText.trim() && !technicalCode) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <details className={cn('rounded border border-slate-200 bg-slate-50 text-xs text-slate-700', className)}>
      <summary className="cursor-pointer px-3 py-1.5 font-medium flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors select-none">
        <span className="flex items-center gap-1.5">
          <ChevronDown size={14} className="transition-transform details-open:rotate-180" />
          <span>{title}</span>
          {technicalCode && (
            <code className={cn(typography.code, 'bg-slate-200 text-slate-800 px-1 py-0.5 rounded text-xs')}>
              {technicalCode}
            </code>
          )}
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleCopy();
            }
          }}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
          title="Sao chép chi tiết lỗi"
        >
          {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
          <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
        </span>
      </summary>
      <div className="border-t border-slate-200 p-2.5 overflow-x-auto">
        <pre className={cn(typography.code, 'm-0 text-xs leading-relaxed text-slate-800 whitespace-pre-wrap')}>
          {rawText}
        </pre>
      </div>
    </details>
  );
}
