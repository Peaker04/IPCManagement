import type { QuickServingRow, WeeklyScheduleEditorWorkflow } from './types'
import { StatusBadge } from '@/components/common'

export function QuickServingCell({ row, workflow }: { row: QuickServingRow; workflow: WeeklyScheduleEditorWorkflow }) {
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
        className="ipc-input h-8 w-24 text-center"
        disabled={row.isConfirmed}
        aria-label={`Số suất ${row.dayLabel} ${row.shiftLabel}`}
      />
      <StatusBadge variant={row.isCompleted ? 'success' : row.hasDraftChange ? 'neutral' : row.hasPlanLines ? 'warning' : 'neutral'}>
        {row.isCompleted
          ? 'Đã hoàn tất'
          : workflow.status.isSavingQuickServings
            ? 'Đang lưu'
            : row.hasDraftChange
              ? 'Chưa lưu'
              : row.hasPlanLines
                ? row.statusLabel
                : row.importedServings > 0 ? 'Tạm từ tệp' : 'Chưa có kế hoạch'}
      </StatusBadge>
    </div>
  )
}
