import { DAYS_OF_WEEK_WITH_DATES as DEFAULT_DAYS_OF_WEEK } from '@/lib/constants'
import { buildImportedDayDates, buildImportedLayoutRows } from '../model/scope'
import { formatMenuDishName, isMeaningfulMenuDiff, parseDisplayDateToIso, summarizeImportWarnings } from '../model/formatters'
import type { WeeklyMenuImportJob } from '../model/types'
import { buildImportDuplicateGroups, buildImportValidationChecks } from './importValidation'

export type ImportDisplayDay = { key: string; label: string; date: string }

export const buildImportPresentation = (
  job: WeeklyMenuImportJob | undefined,
  displayDays: ImportDisplayDay[],
  todayIso: string,
) => {
  const preview = job?.previewResult ?? null
  const previewDates = preview ? buildImportedDayDates(preview.rows) : {}
  const previewDisplayDays = DEFAULT_DAYS_OF_WEEK.map((day) => ({
    ...day,
    date: previewDates[day.key] ?? displayDays.find((displayDay) => displayDay.key === day.key)?.date ?? day.date,
  }))
  const validationChecks = buildImportValidationChecks(job)
  const duplicateGroups = buildImportDuplicateGroups(preview?.rows ?? [])
  const issues = preview?.validation?.issues ?? []
  const diffRows = preview?.previewDiff.rows.filter(isMeaningfulMenuDiff) ?? []
  const warningSummary = summarizeImportWarnings(preview?.warnings ?? [])
  const warningMessages = warningSummary.slice(0, 4)
  const blockingCount = validationChecks.filter((check) => check.blocking).length
  let problemMessages: string[] = []
  if (issues.length) {
    problemMessages = issues.slice(0, 5).map((issue) => `${issue.cell ?? issue.column ?? issue.field ?? 'Trong file'}: ${issue.message}`)
  } else if (duplicateGroups.length) {
    problemMessages = duplicateGroups.slice(0, 3).map((group) => `${group.label}: ${group.rowCount} dòng bị trùng`)
  } else if (job?.error) {
    problemMessages = [job.error]
  } else if (blockingCount) {
    problemMessages = ['Sửa lỗi trong file Excel rồi bấm Kiểm tra lại.']
  }

  return {
    preview,
    layoutRows: buildImportedLayoutRows(preview?.rows ?? []),
    displayDays: previewDisplayDays,
    activeDayKey: previewDisplayDays.find((day) => parseDisplayDateToIso(day.date) === todayIso)?.key,
    issues,
    diffRows: diffRows.map((row) => ({
      ...row,
      currentDishName: formatMenuDishName(row.currentDishName),
      importedDishName: formatMenuDishName(row.importedDishName),
    })),
    warningSummary,
    warningMessages,
    problemMessages,
  }
}

export type WeeklyMenuImportPresentation = ReturnType<typeof buildImportPresentation>
