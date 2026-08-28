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
      <ol className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
                textWrap="wrap"
                className={cn(
                  'h-full min-h-11 w-full flex-col items-stretch justify-start gap-1.5 rounded-[3px] px-3 py-2 text-left text-body font-semibold leading-[1.35] transition-colors motion-reduce:transition-none sm:min-h-[7.5rem]',
                  isSelected
                    ? 'border-[var(--ipc-primary)] bg-blue-50 text-blue-900'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
                  isBlocked && 'cursor-not-allowed bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-pressed={isSelected}
                aria-describedby={isBlocked ? `purchasing-stage-${stage.id}-reason` : undefined}
                disabled={isBlocked}
                onClick={() => onStageChange(stage.id)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="shrink-0" aria-hidden="true">
                    {isComplete ? <Check size={16} /> : isBlocked ? <CircleAlert size={16} /> : <CircleDot size={16} />}
                  </span>
                  {isCurrent ? <StatusBadge variant="warning">Hiện tại</StatusBadge> : null}
                </span>
                <span className="min-w-0 w-full flex-1">
                  <span data-stage-label className={cn('block text-sm leading-[1.35]', isBlocked ? 'text-slate-700' : 'text-slate-900')}>{stage.label}</span>
                  <span className="mt-1 block text-caption font-medium leading-[1.4] text-slate-600">
                    {isComplete ? 'Hoàn tất' : isCurrent ? 'Đang xử lý' : 'Chưa mở'}
                    {count > 0 ? `, ${count} ngày` : ''}
                  </span>
                  {isBlocked ? (
                    <span id={`purchasing-stage-${stage.id}-reason`} className="mt-1 block text-caption font-normal leading-[1.4] text-slate-600">
                      {stage.blockedReason}
                    </span>
                  ) : null}
                </span>
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
