import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export type ReconciliationLifecycleStatus = 'DRAFT' | 'READY' | 'TRANSFERRED' | 'IN_PROGRESS' | 'COMPLETED';

interface LifecycleStepDef {
  status: ReconciliationLifecycleStatus;
  step: number;
  label: string;
  owner: string;
}

const LIFECYCLE_STEPS: LifecycleStepDef[] = [
  { status: 'DRAFT', step: 1, label: 'Chuẩn bị', owner: 'Điều phối' },
  { status: 'READY', step: 2, label: 'Đóng băng', owner: 'Quản lý' },
  { status: 'TRANSFERRED', step: 3, label: 'Bàn giao kho', owner: 'Điều phối' },
  { status: 'IN_PROGRESS', step: 4, label: 'Đang xuất ca', owner: 'Thủ kho' },
  { status: 'COMPLETED', step: 5, label: 'Đã chốt sổ', owner: 'Quản lý' },
];

const STATUS_RANK: Record<string, number> = {
  DRAFT: 1,
  READY: 2,
  TRANSFERRED: 3,
  IN_PROGRESS: 4,
  COMPLETED: 5,
};

export interface ReconciliationLifecycleStripProps {
  isPending?: boolean;
  status?: string;
  className?: string;
}

export function ReconciliationLifecycleStrip({ status, isPending = false, className }: ReconciliationLifecycleStripProps) {
  const currentRank = !isPending && status ? STATUS_RANK[status] ?? 0 : 0;
  const isCompleted = !isPending && status === 'COMPLETED';

  return (
    <nav aria-label="Tiến trình vòng đời lô đối soát" aria-busy={isPending || undefined}
      data-current-label={isPending ? 'Đang tải…' : LIFECYCLE_STEPS.find(step => step.status === status)?.label ?? 'Chưa có lô'}
      className={clsx('mrx-lifecycle-strip flex items-center gap-1 select-none', className)}>
      {LIFECYCLE_STEPS.map((step) => {
        const isCurrent = !isPending && step.status === status;
        const isPast = isCompleted || step.step < currentRank;

        return (
          <div
            key={step.status}
            aria-label={step.label}
            aria-current={isCurrent ? 'step' : undefined}
            title={`${step.label} · Phụ trách: ${step.owner}`}
            className={clsx(
              'mrx-lifecycle-step h-7 px-2 rounded flex items-center gap-1.5 text-xs transition-colors',
              isCurrent
                ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                : isPast
                ? 'bg-slate-100 text-slate-700 font-medium'
                : 'text-slate-600 font-medium bg-transparent'
            )}
          >
            <span
              className={clsx(
                'inline-flex items-center justify-center size-5 rounded-full text-xs font-semibold font-sans leading-none shrink-0 select-none tabular-nums',
                isCurrent
                  ? 'bg-white text-slate-900'
                  : isPast
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              )}
              aria-hidden="true"
            >
              {isPast && !isCurrent ? (
                <Check className="size-3 stroke-[2.5]" aria-hidden="true" />
              ) : (
                step.step
              )}
            </span>
            <span className="mrx-lifecycle-step-label truncate whitespace-nowrap">{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
