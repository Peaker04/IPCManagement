import { DAYS_OF_WEEK } from '@/lib/constants'
import { buildImportedDayDates, buildImportedLayoutRows } from '../model/scope'
import { formatMenuDishName, isMeaningfulMenuDiff, parseDisplayDateToIso, summarizeImportWarnings } from '../model/formatters'
import type { WeeklyMenuImportJob } from '../model/types'
import type { CatalogDish } from '@/api/dishCatalogApi'
import { buildImportDuplicateGroups, buildImportValidationChecks } from './importValidation'

export type ImportDisplayDay = { key: string; label: string; date: string }

export const buildImportPresentation = (
  job: WeeklyMenuImportJob | undefined,
  displayDays: ImportDisplayDay[],
  todayIso: string,
  catalogDishes: CatalogDish[] = [],
) => {
  const preview = job?.previewResult ?? null
  const previewDates = preview ? buildImportedDayDates(preview.rows) : {}
  const previewDisplayDays = DAYS_OF_WEEK.slice(0, 6).map((day) => ({
    ...day,
    date: previewDates[day.key] ?? displayDays.find((displayDay) => displayDay.key === day.key)?.date ?? '',
  }))
  const validationChecks = buildImportValidationChecks(job)
  const duplicateGroups = buildImportDuplicateGroups(preview?.rows ?? [])
  const issues = preview?.validation?.issues.filter((issue) => issue.severity.toLowerCase() === 'error') ?? []
  const warningIssues = preview?.validation?.issues
    .filter((issue) => issue.severity.toLowerCase() === 'warning')
    .map((issue) => `${issue.cell ?? issue.column ?? issue.field ?? 'Trong file'}: ${issue.message}`) ?? []
  const diffRows = preview?.previewDiff.rows.filter(isMeaningfulMenuDiff) ?? []
  const warningSummary = summarizeImportWarnings([...(preview?.warnings ?? []), ...warningIssues])
  const warningMessages = warningSummary.slice(0, 4)
  const blockingCount = validationChecks.filter((check) => check.blocking).length
  const catalogById = new Map(catalogDishes.map((dish) => [dish.id, dish]))
  const missingBomByDish = new Map<string, { dishId: string; dishName: string; affectedSlots: number; serviceDates: Set<string> }>()
  for (const row of preview?.rows ?? []) {
    if (!row.dishId) continue
    const dish = catalogById.get(row.dishId)
    if (!dish) continue
    const serviceDate = row.serviceDate.split('T')[0]
    const bomReady = dish.ingredients.some((line) => {
      const starts = !line.effectiveFrom || line.effectiveFrom.split('T')[0] <= serviceDate
      const ends = !line.effectiveTo || line.effectiveTo.split('T')[0] >= serviceDate
      const customerMatches = !line.customerId || line.customerId === job?.customerId
      return line.bomStatus.toUpperCase() === 'PUBLISHED' && line.priceTierAmount === job?.priceTierAmount && starts && ends && customerMatches
    })
    if (!bomReady) {
      const current = missingBomByDish.get(dish.id) ?? { dishId: dish.id, dishName: dish.name, affectedSlots: 0, serviceDates: new Set<string>() }
      current.affectedSlots += 1
      current.serviceDates.add(serviceDate)
      missingBomByDish.set(dish.id, current)
    }
  }
  const bomIssues = [...missingBomByDish.values()].map((issue) => ({ ...issue, serviceDates: [...issue.serviceDates].sort() }))
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
    bomIssues,
  }
}

export type WeeklyMenuImportPresentation = ReturnType<typeof buildImportPresentation>
