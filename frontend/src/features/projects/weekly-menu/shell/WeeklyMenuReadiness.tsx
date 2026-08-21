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
        'ipc-weekly-readiness-strip flex h-11 min-h-[44px] items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-1.5 shadow-sm',
        `is-${readiness.tone}`
      )}
      aria-label="Mức sẵn sàng của kế hoạch tuần"
    >
      <div className="flex min-w-0 items-center gap-2.5" role="status" aria-live="polite">
        <SummaryIcon
          size={18}
          className={cn(
            'shrink-0',
            readiness.tone === 'success' && 'text-emerald-600',
            readiness.tone === 'warning' && 'text-amber-600',
            readiness.tone === 'danger' && 'text-rose-600',
            readiness.tone === 'info' && 'text-blue-600',
            readiness.tone === 'neutral' && 'text-slate-500'
          )}
          aria-hidden="true"
        />
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mức sẵn sàng:</span>
          <strong className="truncate text-xs font-bold text-slate-800">{readiness.label}</strong>
          <span className="hidden text-xs text-slate-500 sm:inline">·</span>
          <small className="hidden truncate text-xs text-slate-600 md:inline" title={readiness.detail}>
            {readiness.detail}
          </small>
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
                checkpoint.state === 'complete' && 'bg-emerald-50 text-emerald-700',
                checkpoint.state === 'warning' && 'bg-amber-50 text-amber-700',
                checkpoint.state === 'danger' && 'bg-rose-50 text-rose-700',
                checkpoint.state === 'pending' && 'bg-slate-100 text-slate-600'
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
