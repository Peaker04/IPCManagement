import { AlertTriangle, CheckCircle2, CircleDashed, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeeklyMenuCheckpointState, WeeklyMenuReadiness as Readiness } from '../model/readiness';

const checkpointIcons: Record<WeeklyMenuCheckpointState, typeof CheckCircle2> = {
  complete: CheckCircle2,
  pending: CircleDashed,
  warning: AlertTriangle,
  danger: AlertTriangle,
};

const summaryIcons = {
  neutral: CircleDashed,
  info: LoaderCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
};

export function WeeklyMenuReadiness({ readiness }: { readiness: Readiness }) {
  const SummaryIcon = summaryIcons[readiness.tone];

  return (
    <section
      className={cn(
        'ipc-weekly-readiness-strip flex min-h-11 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm',
        `is-${readiness.tone}`
      )}
      aria-label="Mức sẵn sàng của kế hoạch tuần"
    >
      <div className="flex min-w-0 items-center gap-2.5" role="status" aria-live="polite">
        <SummaryIcon
          size={18}
          className={cn(
            readiness.tone === 'success' && 'text-[var(--status-success-fg,#0f766e)]',
            readiness.tone === 'warning' && 'text-[var(--status-warning-fg,#c05621)]',
            readiness.tone === 'danger' && 'text-[var(--status-danger-fg,#c53030)]',
            readiness.tone === 'info' && 'text-[var(--status-info-fg,#1a56a8)]',
            readiness.tone === 'neutral' && 'text-[var(--status-neutral-fg,#334155)]'
          )}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mức sẵn sàng:</span>
          <strong className="text-xs font-bold text-slate-800">{readiness.label}</strong>
          <small className="sr-only">{readiness.detail}</small>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {readiness.checkpoints.map((checkpoint) => {
          const Icon = checkpointIcons[checkpoint.state];
          return (
            <span
              key={checkpoint.key}
              title={`${checkpoint.label}: ${checkpoint.value}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                checkpoint.state === 'complete' && 'bg-[var(--status-success-bg,#e6f7f3)] text-[var(--status-success-fg,#0f766e)]',
                checkpoint.state === 'warning' && 'bg-[var(--status-warning-bg,#fff7e6)] text-[var(--status-warning-fg,#c05621)]',
                checkpoint.state === 'danger' && 'bg-[var(--status-danger-bg,#fff1f1)] text-[var(--status-danger-fg,#c53030)]',
                checkpoint.state === 'pending' && 'bg-[var(--status-neutral-bg,#f1f5f9)] text-[var(--status-neutral-fg,#334155)]'
              )}
            >
              <Icon size={12} aria-hidden="true" />
              <span className="hidden lg:inline">{checkpoint.label}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
