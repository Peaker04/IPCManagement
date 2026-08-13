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
}

export function WeeklyScheduleSection({ scope, rows, dishNamesById }: Props) {
  return (
    <SectionPanel
      className="ipc-weekly-schedule-panel"
      title="Bố cục menu theo file khách hàng"
      icon={<Calendar size={18} color="var(--ipc-slate-600)" />}
      badge={<StatusBadge variant={scope.activeDayKey ? 'success' : 'warning'}>{scope.activeDayKey ? `Đang thực hiện · ${scope.activeServiceLabel}` : scope.activeServiceLabel}</StatusBadge>}
    >
      <ImportedLayoutMatrix rows={rows} displayDays={scope.displayDays} activeDayKey={scope.activeDayKey} dishNamesById={dishNamesById} />
    </SectionPanel>
  )
}
