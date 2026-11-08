import { Check, CircleAlert, CircleDot } from 'lucide-react';
import { StatusBadge } from '@/components/common';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PurchaseWorkflowStageCounts } from '@/api/workflowApiTypes';
import {
  PURCHASING_STAGES,
  isPurchasingStage,
  type PurchasingStageId,
} from './purchasingModel';

interface PurchaseWorkflowGuideProps {
  currentStage?: string | null;
  selectedStage: PurchasingStageId;
  stageCounts: PurchaseWorkflowStageCounts;
  onStageChange: (stage: PurchasingStageId) => void;
}

export function PurchaseWorkflowGuide({
  currentStage,
  selectedStage,
  stageCounts,
  onStageChange,
}: PurchaseWorkflowGuideProps) {
  const currentId = isPurchasingStage(currentStage) ? currentStage : 'demand';
  const currentIndex = PURCHASING_STAGES.findIndex((stage) => stage.id === currentId);

  return (
    <nav aria-label="Sáu giai đoạn thu mua" className="min-w-0">
      <ol className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {PURCHASING_STAGES.map((stage, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isBlocked = index > currentIndex;
          const isSelected = stage.id === selectedStage;
          const count = stageCounts[stage.countKey];

          return (
            <li key={stage.id} className="min-w-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'h-14 w-full items-center justify-start gap-2 rounded-sm px-2.5 text-left text-xs font-semibold leading-tight transition-colors motion-reduce:transition-none',
                  isSelected
                    ? 'border-[var(--ipc-primary)] bg-blue-50 text-blue-900'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
                  isBlocked && 'cursor-not-allowed bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-pressed={isSelected}
                title={isBlocked ? stage.blockedReason : `${stage.label}: ${isComplete ? 'Hoàn tất' : isCurrent ? 'Hiện tại' : 'Sẵn sàng'}`}
                disabled={isBlocked}
                onClick={() => onStageChange(stage.id)}
              >
                <span className="shrink-0" aria-hidden="true">
                  {isComplete ? <Check size={16} /> : isBlocked ? <CircleAlert size={16} /> : <CircleDot size={16} />}
                </span>
                <span data-stage-label className={cn('min-w-0 flex-1 whitespace-normal text-pretty', isBlocked ? 'text-slate-600' : 'text-slate-900')}>{stage.label}</span>
                {isCurrent ? <StatusBadge variant="warning" size="sm">Hiện tại</StatusBadge> : count > 0 ? <span className="shrink-0 text-xs tabular-nums text-slate-500">{count}</span> : null}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
