import { Link } from 'react-router-dom'
import type { ReconciliationBatch } from '@/api/reconciliationApi'
import { MRX_LIFECYCLE_STATUSES, getMrxLifecyclePresentation } from '@/lib/workflowConfig'
import { cn } from '@/lib/utils'

export function ReconciliationLifecycleStrip({ status, batchId, showAction = true }: { status: ReconciliationBatch['status']; batchId: string; showAction?: boolean }) {
  const current = getMrxLifecyclePresentation(status)
  const actionHref = `${current.action.route}${current.action.route.includes('?') ? '&' : '?'}batchId=${encodeURIComponent(batchId)}`
  const isCompletedBatch = status === 'COMPLETED'
  return <section className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5 sm:px-4 sm:py-2.5 shadow-xs" aria-label="Vòng đời lô đối chiếu">
    <div className="flex min-h-9 items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className={cn('inline-block h-2 w-2 rounded-full', isCompletedBatch ? 'bg-emerald-600' : 'bg-blue-600 animate-pulse')} aria-hidden="true" />
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tiến độ lô · Bước {current.phase}/{current.phaseCount}</p>
        <span className="hidden sm:inline-block rounded border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600">Phụ trách: {current.owner}</span>
      </div>
      {showAction ? (
        <Link className="ipc-button ipc-button-primary text-xs py-1 px-3 h-8 shadow-xs transition hover:shadow-sm" to={actionHref} title={`Đi tới khu vực: ${current.action.label}`}>
          {current.action.label}
        </Link>
      ) : (
        <div className="h-9 w-0 shrink-0" aria-hidden="true" />
      )}
    </div>
    <ol className="mt-2 grid gap-1.5 text-xs sm:grid-cols-5">
      {MRX_LIFECYCLE_STATUSES.map((item) => {
        const step = getMrxLifecyclePresentation(item)
        const completed = isCompletedBatch || step.phase < current.phase
        const isCurrent = item === status
        return <li
          key={item}
          aria-current={isCurrent ? 'step' : undefined}
          aria-label={isCurrent ? `Bước hiện tại: ${step.label}` : completed ? `Đã hoàn tất: ${step.label}` : `Chưa thực hiện: ${step.label}`}
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 transition-all text-xs ${
            isCurrent && isCompletedBatch
              ? 'border-emerald-300 bg-emerald-50/80 font-semibold text-emerald-950 shadow-xs ring-1 ring-emerald-500/20'
              : isCurrent
              ? 'border-blue-300 bg-blue-50/70 font-semibold text-blue-950 shadow-xs ring-1 ring-blue-500/20'
              : completed
              ? 'border-emerald-200/70 bg-emerald-50/40 font-medium text-slate-700'
              : 'border-slate-200/60 bg-slate-50/40 text-slate-500'
          }`}
        >{completed && <span aria-hidden="true" className="font-bold text-emerald-700">✓</span>}{step.phase}. {step.label}</li>
      })}
    </ol>
  </section>
}
