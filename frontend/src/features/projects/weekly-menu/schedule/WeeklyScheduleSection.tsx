import { Calendar } from 'lucide-react'
import { ContextStrip, SectionPanel } from '@/components/common'
import { ImportedLayoutMatrix, type ImportedLayoutRow } from '../../components/ImportedLayoutMatrix'
import type { WeeklyMenuScope } from './types'

type Props = {
  scope: WeeklyMenuScope
  customerValue: string
  weekValue: string
  hasCommittedWeek: boolean
  rows: ImportedLayoutRow[]
}

export function WeeklyScheduleSection({ scope, customerValue, weekValue, hasCommittedWeek, rows }: Props) {
  return (
    <SectionPanel title="Bố cục menu theo file khách hàng" icon={<Calendar size={18} color="var(--ipc-slate-600)" />}>
      <div className="flex flex-col gap-3">
        <ContextStrip items={[
          { label: 'Khách hàng', value: customerValue, tone: 'neutral' },
          { label: 'Tuần', value: weekValue, tone: hasCommittedWeek ? 'info' : 'neutral' },
          { label: 'Đang thực hiện', value: scope.activeServiceLabel, tone: scope.activeDayKey ? 'success' : 'warning' },
        ]} />
        <ImportedLayoutMatrix rows={rows} displayDays={scope.displayDays} activeDayKey={scope.activeDayKey} />
      </div>
    </SectionPanel>
  )
}
