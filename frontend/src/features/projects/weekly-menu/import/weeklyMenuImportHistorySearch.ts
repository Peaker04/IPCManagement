import type { WeeklyMenuImportHistoryItem } from '@/api/coordinationApi'
import { getWorkflowStatusPresentation } from '@/lib/workflowConfig'
import { formatImportDate } from '../model/formatters'

export const matchesWeeklyMenuImportHistorySearch = (
  item: WeeklyMenuImportHistoryItem,
  search: string,
) => {
  const needle = search.trim().toLocaleLowerCase('vi-VN')
  if (!needle) return true
  return [
    item.customerCode,
    item.customerName,
    item.weekStartDate,
    formatImportDate(item.weekStartDate),
    `v${item.versionNo}`,
    getWorkflowStatusPresentation(item.status).label,
    item.createdByName,
  ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(needle)
}
