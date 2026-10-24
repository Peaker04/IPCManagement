import { clsx } from 'clsx';

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
  status?: string;
  className?: string;
}

export function ReconciliationLifecycleStrip({ status = 'DRAFT', className }: ReconciliationLifecycleStripProps) {
  const currentRank = STATUS_RANK[status] ?? 1;
  const isCompleted = status === 'COMPLETED';

  return (
    <nav aria-label="Tiến trình vòng đời lô đối soát" className={clsx('flex items-center gap-1 select-none', className)}>
      {LIFECYCLE_STEPS.map((step) => {
        const isCurrent = step.status === status;
        const isPast = isCompleted || step.step < currentRank;

        return (
          <div
            key={step.status}
            aria-current={isCurrent ? 'step' : undefined}
            title={`${step.label} · Phụ trách: ${step.owner}`}
            className={clsx(
              'h-7 px-2 rounded flex items-center gap-1.5 text-xs transition-colors',
              isCurrent && isCompleted
                ? 'bg-emerald-100 text-emerald-900 font-semibold border border-emerald-300'
                : isCurrent
                ? 'bg-blue-100 text-blue-900 font-semibold border border-blue-300'
                : isPast
                ? 'bg-slate-100 text-slate-700 font-medium'
                : 'text-slate-600 font-medium bg-transparent'
            )}
          >
            <span
              className={clsx(
                'inline-flex items-center justify-center size-4 rounded-full text-[10px] font-bold font-mono',
                isCurrent && isCompleted
                  ? 'bg-emerald-700 text-white'
                  : isCurrent
                  ? 'bg-blue-700 text-white'
                  : isPast
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              )}
              aria-hidden="true"
            >
              {isPast && !isCurrent ? '✓' : step.step}
            </span>
            <span className="truncate">{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
