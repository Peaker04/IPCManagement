import { Check, CircleAlert, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  PURCHASING_STAGES,
  isPurchasingStage,
  type PurchasingStageId,
} from './purchasingModel';

interface PurchaseWorkflowGuideProps {
  currentStage?: string | null;
  selectedStage: PurchasingStageId;
  onStageChange: (stage: PurchasingStageId) => void;
}

export function PurchaseWorkflowGuide({
  currentStage,
  selectedStage,
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

          return (
            <li key={stage.id} className="min-w-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'h-10 w-full items-center justify-start gap-2 rounded-sm px-2 text-left text-xs font-semibold leading-tight transition-colors motion-reduce:transition-none',
                  isSelected
                    ? 'border-[var(--ipc-primary)] bg-[var(--alert-info-bg,#eff6ff)] text-[var(--status-info-fg,#1a56a8)]'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50',
                  isBlocked && 'cursor-not-allowed bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-pressed={isSelected}
                aria-label={`${stage.label}${isCurrent ? ' - Hiện tại' : ''}`}
                title={isBlocked ? stage.blockedReason : `${stage.label}: ${isComplete ? 'Hoàn tất' : isCurrent ? 'Hiện tại' : 'Sẵn sàng'}`}
                disabled={isBlocked}
                onClick={() => onStageChange(stage.id)}
              >
                <span className="shrink-0" aria-hidden="true">
                  {isComplete ? <Check size={14} /> : isBlocked ? <CircleAlert size={14} /> : <CircleDot size={14} />}
                </span>
                <span data-stage-label className={cn('min-w-0 flex-1 whitespace-nowrap', isBlocked ? 'text-slate-600' : 'text-slate-900')}>{stage.shortLabel}</span>
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
