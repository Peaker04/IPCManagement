import { Link } from 'react-router-dom'
import { StatusBadge } from '@/components/common'
import type { ReconciliationBatch } from '@/api/reconciliationApi'
import { getReconciliationLifecyclePresentation } from './reconciliationLifecyclePresentation'

const statuses: ReconciliationBatch['status'][] = ['DRAFT', 'READY', 'TRANSFERRED', 'IN_PROGRESS', 'COMPLETED']

export function ReconciliationLifecycleStrip({ status, batchId, showAction = true }: { status: ReconciliationBatch['status']; batchId: string; showAction?: boolean }) {
  const current = getReconciliationLifecyclePresentation(status)
  const actionHref = `${current.action.route}${current.action.route.includes('?') ? '&' : '?'}batchId=${encodeURIComponent(batchId)}`
  return <section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Vòng đời lô đối chiếu">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bước {current.phase}/{current.phaseCount} · {current.owner}</p><StatusBadge size="sm" variant={status === 'COMPLETED' ? 'success' : status === 'DRAFT' || status === 'TRANSFERRED' ? 'warning' : 'info'}>{current.label}</StatusBadge></div>
      {showAction && <Link className="ipc-button ipc-button-primary" to={actionHref}>{current.action.label}</Link>}
    </div>
    <ol className="mt-3 grid gap-2 text-xs sm:grid-cols-5">
      {statuses.map((item) => {
        const step = getReconciliationLifecyclePresentation(item)
        return <li key={item} aria-current={item === status ? 'step' : undefined} className={item === status ? 'font-semibold text-slate-950' : step.phase < current.phase ? 'text-slate-600' : 'text-slate-400'}>{step.phase}. {step.label}</li>
      })}
    </ol>
  </section>
}
