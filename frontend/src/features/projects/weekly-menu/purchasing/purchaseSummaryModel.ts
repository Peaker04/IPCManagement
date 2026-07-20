import type { DemandLine } from '@/features/workflow'
import { calculateTotalMaterialCost } from '../model/scope'
import type { MaterialSummary, PurchaseSummaryMaterialEntry } from '../model/types'

export const PURCHASE_SUMMARY_PAGE_SIZE = 10

export const buildPurchaseSummaryPresentation = (
  materialSummary: MaterialSummary,
  demandLines: DemandLine[],
  aggregatedDemandLines: DemandLine[],
  requestedPageIndex: number,
) => {
  const materialEntries = Object.entries(materialSummary).filter(([, data]) => data.theory > 0)
  const usesDemand = demandLines.length > 0
  const totalItems = usesDemand ? aggregatedDemandLines.length : materialEntries.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PURCHASE_SUMMARY_PAGE_SIZE))
  const pageIndex = Math.min(Math.max(0, requestedPageIndex), totalPages - 1)
  const start = pageIndex * PURCHASE_SUMMARY_PAGE_SIZE
  const demandRows: DemandLine[] = usesDemand
    ? aggregatedDemandLines.slice(start, start + PURCHASE_SUMMARY_PAGE_SIZE)
    : []
  const materialRows: PurchaseSummaryMaterialEntry[] = usesDemand
    ? []
    : materialEntries.slice(start, start + PURCHASE_SUMMARY_PAGE_SIZE)
  const shortageCount = aggregatedDemandLines.filter(
    (line) => Math.max(line.required - (line.available - line.reserved), 0) > 0,
  ).length

  return {
    usesDemand,
    totalItems,
    totalPages,
    pageIndex,
    demandRows,
    materialRows,
    shortageCount,
    totalCost: calculateTotalMaterialCost(materialSummary),
  }
}

const escapeCsvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

export const buildWarehouseCsv = (
  materialSummary: MaterialSummary,
  customerCode: string,
  weekStartDate: string,
) => {
  const rows = Object.entries(materialSummary)
    .filter(([, data]) => data.theory !== 0)
    .map(([, data]) => [
      weekStartDate,
      customerCode,
      data.ingredientName,
      data.theory.toFixed(2),
      data.actual.toFixed(2),
      data.unit,
      data.referencePrice,
      Math.round(data.actual * data.referencePrice),
    ])
  if (rows.length === 0) return null
  const header = 'Tuần,Khách hàng,Nguyên liệu,Số lượng LT,Số lượng TT,Đơn vị,Đơn giá (đ),Thành tiền (đ)'
  return `\uFEFF${header}\n${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}\n`
}
