import { AlertTriangle, CheckCircle2, CircleDashed, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeeklyMenuCheckpointState, WeeklyMenuReadiness as Readiness } from '../model/readiness'

const checkpointIcons: Record<WeeklyMenuCheckpointState, typeof CheckCircle2> = {
  complete: CheckCircle2,
  pending: CircleDashed,
  warning: AlertTriangle,
  danger: AlertTriangle,
}

const summaryIcons = {
  neutral: CircleDashed,
  info: LoaderCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertTriangle,
}

export function WeeklyMenuReadiness({ readiness }: { readiness: Readiness }) {
  const SummaryIcon = summaryIcons[readiness.tone]

  return (
    <section className={cn('ipc-weekly-readiness', `is-${readiness.tone}`)} aria-label="Mức sẵn sàng của kế hoạch tuần">
      <div className="ipc-weekly-readiness-summary" role="status" aria-live="polite">
        <SummaryIcon size={18} aria-hidden="true" />
        <div>
          <span>Mức sẵn sàng</span>
          <strong>{readiness.label}</strong>
          <small title={readiness.detail}>{readiness.detail}</small>
        </div>
      </div>
      <dl className="ipc-weekly-readiness-checkpoints">
        {readiness.checkpoints.map((checkpoint) => {
          const Icon = checkpointIcons[checkpoint.state]
          return (
            <div key={checkpoint.key} className={cn('ipc-weekly-readiness-checkpoint', `is-${checkpoint.state}`)}>
              <Icon size={16} aria-hidden="true" />
              <div>
                <dt>{checkpoint.label}</dt>
                <dd title={checkpoint.value}>{checkpoint.value}</dd>
              </div>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
