import { Fragment } from 'react'
import { TableViewport } from '@/components/common'
import { cn } from '@/lib/utils'
import type { WeeklyMenuImportResult } from '@/features/coordination/coordinationApi'

export type ImportedLayoutRow = {
  key: string
  firstIndex: number
  sourceSection: string
  slot: string
  slotLabel: string
  cells: Record<string, WeeklyMenuImportResult['rows'][number]>
}

interface ImportedLayoutMatrixProps {
  rows: ImportedLayoutRow[]
  displayDays: Array<{ key: string; label: string; date: string }>
  activeDayKey?: string
  maxBodyHeight?: string
}

const formatDishName = (value?: string | null) => {
  const stripped = (value ?? '')
    .replace(/\s*\b\d+(?:[.,]\d+)?\s*(?:g|gram|kg)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped || value || '-'
}

const isSameMergedDish = (
  current?: WeeklyMenuImportResult['rows'][number],
  next?: WeeklyMenuImportResult['rows'][number],
) => Boolean(current && next &&
  current.dishName.trim().toLocaleUpperCase('vi-VN') === next.dishName.trim().toLocaleUpperCase('vi-VN') &&
  current.sourceSection === next.sourceSection &&
  current.dbShiftName === next.dbShiftName &&
  current.variant === next.variant)

const buildCellSpans = (rows: ImportedLayoutRow[], displayDays: Array<{ key: string }>) => {
  const spans = new Map<string, { hidden: boolean; span: number }>()
  const hasSourceMergeMetadata = rows.some((row) =>
    Object.values(row.cells).some((cell) => cell.sourceRowNumber > 0),
  )

  displayDays.forEach((day) => {
    rows.forEach((row, index) => {
      const cellKey = `${row.key}|${day.key}`
      const cell = row.cells[day.key]
      if (!cell) {
        spans.set(cellKey, { hidden: false, span: 1 })
      } else if (hasSourceMergeMetadata) {
        spans.set(cellKey, {
          hidden: cell.isMergedContinuation,
          span: cell.isMergedContinuation ? 1 : Math.max(1, Math.min(cell.rowSpan || 1, rows.length - index)),
        })
      } else if (isSameMergedDish(rows[index - 1]?.cells[day.key], cell)) {
        spans.set(cellKey, { hidden: true, span: 1 })
      } else {
        let span = 1
        for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
          if (!isSameMergedDish(cell, rows[nextIndex]?.cells[day.key])) break
          span += 1
        }
        spans.set(cellKey, { hidden: false, span })
      }
    })
  })
  return spans
}

export function ImportedLayoutMatrix({ rows, displayDays, activeDayKey, maxBodyHeight = 'max-h-[440px]' }: ImportedLayoutMatrixProps) {
  const sectionNames = Array.from(new Set(rows.map((row) => row.sourceSection)))

  return (
    <TableViewport caption="Bố cục thực đơn theo file khách hàng" className={cn('ipc-weekly-menu-shell', maxBodyHeight)} ariaLabel="Bảng bố cục thực đơn theo file khách hàng">
      <table className="ipc-data-table ipc-schedule-table">
        <thead>
          <tr>
            <th className="w-[190px] min-w-[190px] border-r border-slate-200 bg-slate-100 text-left">Bố cục / dòng</th>
            {displayDays.map((day, index) => (
              <th key={day.key} className={cn('text-center border-r border-slate-200 transition-colors', index % 2 === 1 ? 'bg-slate-100' : 'bg-slate-50', day.key === activeDayKey && 'bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-200')}>
                <div className="flex flex-col items-center justify-center gap-0.5 py-1">
                  <span className="text-[13px] font-bold text-slate-800">{day.label}</span>
                  <span className="text-[10.5px] font-medium text-slate-500">{day.date}</span>
                  {day.key === activeDayKey && <span className="mt-0.5 rounded-sm bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Hôm nay</span>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sectionNames.map((sectionName) => {
            const sectionRows = rows.filter((row) => row.sourceSection === sectionName)
            const cellSpans = buildCellSpans(sectionRows, displayDays)
            return (
              <Fragment key={sectionName}>
                <tr><td colSpan={displayDays.length + 1} className="border-b border-r border-slate-300 bg-slate-200 py-2.5 text-center text-[12.5px] font-bold uppercase tracking-wide text-slate-900">{sectionName}</td></tr>
                {sectionRows.map((row) => (
                  <tr key={row.key}>
                    <td className="border-r border-slate-200 bg-slate-50 p-2 text-left align-middle"><span className="text-[12.5px] font-semibold text-slate-800">{row.slotLabel}</span></td>
                    {displayDays.map((day, index) => {
                      const cell = row.cells[day.key]
                      const spanInfo = cellSpans.get(`${row.key}|${day.key}`) ?? { hidden: false, span: 1 }
                      if (spanInfo.hidden) return null
                      return (
                        <td key={`${row.key}-${day.key}`} rowSpan={spanInfo.span} className={cn('border-r border-slate-200 p-2 text-center align-middle text-[12.5px]', index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white', day.key === activeDayKey && 'bg-blue-50/70', !cell && 'text-slate-400')}>
                          {cell ? <span className="font-semibold text-slate-900">{formatDishName(cell.dishName)}</span> : '-'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            )
          })}
          {rows.length === 0 && <tr><td className="p-4 text-center text-sm text-slate-500" colSpan={displayDays.length + 1}>Chưa có dữ liệu thực đơn từ file cho khách hàng và tuần đang chọn.</td></tr>}
        </tbody>
      </table>
    </TableViewport>
  )
}
