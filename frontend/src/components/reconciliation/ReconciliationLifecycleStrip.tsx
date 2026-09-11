import { Link } from 'react-router-dom'
import type { ReconciliationBatch } from '@/api/reconciliationApi'
import { MRX_LIFECYCLE_STATUSES, getMrxLifecyclePresentation } from '@/lib/workflowConfig'

export function ReconciliationLifecycleStrip({ status, batchId, showAction = true }: { status: ReconciliationBatch['status']; batchId: string; showAction?: boolean }) {
  const current = getMrxLifecyclePresentation(status)
  const actionHref = `${current.action.route}${current.action.route.includes('?') ? '&' : '?'}batchId=${encodeURIComponent(batchId)}`
  return <section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Vòng đời lô đối chiếu">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tiến độ lô · Bước {current.phase}/{current.phaseCount}</p>
      {showAction && <Link className="ipc-button ipc-button-primary" to={actionHref}>{current.action.label}</Link>}
    </div>
    <ol className="mt-3 grid gap-2 text-xs sm:grid-cols-5">
      {MRX_LIFECYCLE_STATUSES.map((item) => {
        const step = getMrxLifecyclePresentation(item)
        const completed = step.phase < current.phase
        const isCurrent = item === status
        return <li
          key={item}
          aria-current={isCurrent ? 'step' : undefined}
          aria-label={isCurrent ? `Bước hiện tại: ${step.label}` : completed ? `Đã hoàn tất: ${step.label}` : `Chưa thực hiện: ${step.label}`}
          className={isCurrent ? 'font-semibold text-slate-950' : completed ? 'font-medium text-slate-700' : 'text-slate-500'}
        >{completed && <span aria-hidden="true" className="mr-1 text-emerald-700">✓</span>}{step.phase}. {step.label}</li>
      })}
    </ol>
  </section>
}
