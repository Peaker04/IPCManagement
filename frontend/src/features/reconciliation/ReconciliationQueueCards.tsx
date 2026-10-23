import { clsx } from 'clsx';
import type { MrxOperationalSummary } from '../../api/mrxApi';

interface ReconciliationQueueCardsProps {
  operationalSummary: MrxOperationalSummary | null;
  onNavigateBatchPrep: () => void;
  onFilterAwaitingWarehouse: () => void;
  onNavigateDeltas: () => void;
  onFilterVariances: () => void;
  onFilterReadyCompletion: () => void;
}

export function ReconciliationQueueCards({
  operationalSummary,
  onNavigateBatchPrep,
  onFilterAwaitingWarehouse,
  onNavigateDeltas,
  onFilterVariances,
  onFilterReadyCompletion,
}: ReconciliationQueueCardsProps) {
  const pendingSource = operationalSummary?.pendingSourceChangesCount ?? 0;
  const awaitingWarehouse = operationalSummary?.awaitingWarehouseBatchesCount ?? 0;
  const pendingDeltas = operationalSummary?.pendingDeltasCount ?? 0;
  const unresolvedVariances = operationalSummary?.unresolvedVariancesCount ?? 0;
  const completionReady = operationalSummary?.completionReadyBatchesCount ?? 0;

  return (
    <div className="h-12 shrink-0 border-b border-slate-200 bg-white grid grid-cols-5 divide-x divide-slate-200 text-sm select-none">
      <button
        type="button"
        onClick={onNavigateBatchPrep}
        className="flex items-center justify-between px-4 transition-colors text-left cursor-pointer hover:bg-slate-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx('h-2 w-2 rounded-full shrink-0', pendingSource > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300')} aria-hidden="true" />
          <span className="text-xs text-slate-600 font-medium truncate">Đổi nguồn chờ duyệt</span>
        </div>
        <span className={clsx('text-base font-bold font-mono tracking-tight tabular-nums shrink-0 ml-2', pendingSource > 0 ? 'text-rose-600' : 'text-slate-900')}>
          {pendingSource}
        </span>
      </button>

      <button
        type="button"
        onClick={onFilterAwaitingWarehouse}
        className="flex items-center justify-between px-4 transition-colors text-left cursor-pointer hover:bg-slate-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx('h-2 w-2 rounded-full shrink-0', awaitingWarehouse > 0 ? 'bg-blue-500' : 'bg-slate-300')} aria-hidden="true" />
          <span className="text-xs text-slate-600 font-medium truncate">Lô chờ xuất kho</span>
        </div>
        <span className={clsx('text-base font-bold font-mono tracking-tight tabular-nums shrink-0 ml-2', awaitingWarehouse > 0 ? 'text-blue-600' : 'text-slate-900')}>
          {awaitingWarehouse}
        </span>
      </button>

      <button
        type="button"
        onClick={onNavigateDeltas}
        className="flex items-center justify-between px-4 transition-colors text-left cursor-pointer hover:bg-slate-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx('h-2 w-2 rounded-full shrink-0', pendingDeltas > 0 ? 'bg-amber-500' : 'bg-slate-300')} aria-hidden="true" />
          <span className="text-xs text-slate-600 font-medium truncate">Hàng đợi bù/trả</span>
        </div>
        <span className={clsx('text-base font-bold font-mono tracking-tight tabular-nums shrink-0 ml-2', pendingDeltas > 0 ? 'text-amber-700' : 'text-slate-900')}>
          {pendingDeltas}
        </span>
      </button>

      <button
        type="button"
        onClick={onFilterVariances}
        className="flex items-center justify-between px-4 transition-colors text-left cursor-pointer hover:bg-slate-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx('h-2 w-2 rounded-full shrink-0', unresolvedVariances > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300')} aria-hidden="true" />
          <span className="text-xs text-slate-600 font-medium truncate">Sai lệch chưa giải trình</span>
        </div>
        <span className={clsx('text-base font-bold font-mono tracking-tight tabular-nums shrink-0 ml-2', unresolvedVariances > 0 ? 'text-rose-600' : 'text-slate-900')}>
          {unresolvedVariances}
        </span>
      </button>

      <button
        type="button"
        onClick={onFilterReadyCompletion}
        className="flex items-center justify-between px-4 transition-colors text-left cursor-pointer hover:bg-slate-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={clsx('h-2 w-2 rounded-full shrink-0', completionReady > 0 ? 'bg-emerald-500' : 'bg-slate-300')} aria-hidden="true" />
          <span className="text-xs text-slate-600 font-medium truncate">Lô sẵn sàng chốt</span>
        </div>
        <span className={clsx('text-base font-bold font-mono tracking-tight tabular-nums shrink-0 ml-2', completionReady > 0 ? 'text-emerald-700' : 'text-slate-900')}>
          {completionReady}
        </span>
      </button>
    </div>
  );
}
