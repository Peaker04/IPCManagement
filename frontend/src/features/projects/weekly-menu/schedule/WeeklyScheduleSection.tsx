import { Calendar } from 'lucide-react'
import { SectionPanel, StatusBadge } from '@/components/common'
import { ImportedLayoutMatrix, type ImportedLayoutRow } from '../../components/ImportedLayoutMatrix'
import type { WeeklyMenuScope } from './types'

type Props = {
  scope: WeeklyMenuScope
  customerValue: string
  weekValue: string
  hasCommittedWeek: boolean
  rows: ImportedLayoutRow[]
  dishNamesById?: ReadonlyMap<string, string>
  maxBodyHeight?: string
}

export function WeeklyScheduleSection({ scope, rows, dishNamesById, maxBodyHeight }: Props) {
  return (
    <SectionPanel
      className="ipc-weekly-schedule-panel"
      title="Bố cục menu theo file khách hàng"
      icon={<Calendar size={18} color="var(--ipc-slate-600)" />}
      badge={!scope.activeDayKey ? <StatusBadge variant="warning">{scope.activeServiceLabel}</StatusBadge> : undefined}
    >
      <ImportedLayoutMatrix rows={rows} displayDays={scope.displayDays} activeDayKey={scope.activeDayKey} dishNamesById={dishNamesById} maxBodyHeight={maxBodyHeight} />
    </SectionPanel>
  )
}
