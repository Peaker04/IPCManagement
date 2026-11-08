import type { QuickServingRow, WeeklyScheduleEditorWorkflow } from './types'
import { StatusBadge } from '@/components/common'
import type { StatusTone } from '@/lib/statusPresentation'

function resolveQuickServingStatus(row: QuickServingRow, isSaving: boolean): { label: string; tone: StatusTone } {
  if (row.isCompleted) {
    return { label: 'Đã hoàn tất', tone: 'success' }
  }
  if (isSaving) {
    return { label: 'Đang lưu', tone: 'info' }
  }
  if (row.hasDraftChange) {
    return { label: 'Chưa lưu', tone: 'neutral' }
  }
  if (row.hasPlanLines) {
    return { label: row.statusLabel, tone: 'warning' }
  }
  if (row.importedServings > 0) {
    return { label: 'Tạm từ tệp', tone: 'neutral' }
  }
  return { label: 'Chưa có kế hoạch', tone: 'neutral' }
}

export function QuickServingCell({ row, workflow }: { row: QuickServingRow; workflow: WeeklyScheduleEditorWorkflow }) {
  const status = resolveQuickServingStatus(row, workflow.status.isSavingQuickServings)

  return (
    <div className="flex flex-col items-center gap-1.5">
      <input
        type="number"
        min={0}
        step={1}
        value={row.inputValue}
        onChange={(event) => workflow.actions.changeQuickServing(row.key, event.target.value)}
        onBlur={() => { if (row.hasDraftChange) void workflow.actions.saveQuickServing(row) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') {
            workflow.actions.discardQuickServing(row.key)
          }
        }}
        className="h-8 w-24 rounded-sm border border-slate-300 bg-white px-2 text-center text-sm text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        disabled={row.isConfirmed}
        aria-label={`Số suất ${row.dayLabel} ${row.shiftLabel}`}
      />
      <StatusBadge tone={status.tone}>
        {status.label}
      </StatusBadge>
    </div>
  )
}
