import type { DemandLine } from '@/features/workflow'
import type { CatalogDish } from '../../dishCatalogApi'
import type { WeeklyMenuState } from '../../../coordination/types'
import type { WeeklyMenuImportResult } from '../../../coordination/coordinationApi'
import type { ImportedLayoutRow } from '../../components/ImportedLayoutMatrix'
import {
  formatImportDate,
  formatMaterialDishSource,
  formatMenuDishName,
  importSlotLabels,
  normalizeDishMatchKey,
} from './formatters'
import type {
  MaterialSummary,
  MaterialSummaryAccumulator,
  QuickServingShiftName,
  WeeklyPlanRow,
} from './types'

export const QUICK_SERVING_SHIFTS: Array<{
  shiftName: QuickServingShiftName
  shiftLabel: 'Ca Sáng' | 'Ca Chiều'
}> = [
  { shiftName: 'MORNING', shiftLabel: 'Ca Sáng' },
  { shiftName: 'AFTERNOON', shiftLabel: 'Ca Chiều' },
]

export const SECTIONS = [
  { label: 'MENU MẶN CA SÁNG', slotType: 'morningSavory' as const, category: 'savory' as const, shift: 'morning' as const },
  { label: 'MENU CHAY CA SÁNG', slotType: 'morningVegetarian' as const, category: 'vegetarian' as const, shift: 'morning' as const },
  { label: 'MENU MẶN - CA CHIỀU', slotType: 'afternoonSavory' as const, category: 'savory' as const, shift: 'afternoon' as const },
  { label: 'MENU CHAY - CA CHIỀU', slotType: 'afternoonVegetarian' as const, category: 'vegetarian' as const, shift: 'afternoon' as const },
] as const

const isLegacyFruitLabel = (value?: string) => normalizeDishMatchKey(value).includes('TRAI CAY')

export const resolveImportedSlotLabel = (
  row: WeeklyMenuImportResult['rows'][number],
  occurrence: number,
) => {
  const label = row.slotLabel || importSlotLabels[row.slot] || row.slot
  if (row.slot === 'fruit' && occurrence > 1 && isLegacyFruitLabel(label)) return 'Sữa chua'
  return label
}

export const getNormalizedSlotType = (row: WeeklyMenuImportResult['rows'][number]) => {
  const shift = row.dbShiftName === 'MORNING' ? 'morning' : 'afternoon'
  const variant = row.variant?.toLowerCase() === 'vegetarian' ? 'Vegetarian' : 'Savory'
  return `${shift}${variant}` as keyof WeeklyMenuState[string]
}

export const buildImportedLayoutRows = (
  rows: WeeklyMenuImportResult['rows'] = [],
): ImportedLayoutRow[] => {
  const rowMap = new Map<string, ImportedLayoutRow>()
  const occurrenceByDaySlot = new Map<string, number>()

  rows.forEach((row, index) => {
    const repeatedSlotKey = [row.serviceDate, row.sourceSection, row.dbShiftName, row.variant, row.slot, row.slotLabel].join('|')
    const occurrence = (occurrenceByDaySlot.get(repeatedSlotKey) ?? 0) + 1
    occurrenceByDaySlot.set(repeatedSlotKey, occurrence)
    const sourceRowKey = row.sourceRowNumber > 0 ? `row-${row.sourceRowNumber}` : `occurrence-${occurrence}`
    const key = [row.sourceSection, row.dbShiftName, row.variant, row.slot, row.slotLabel, sourceRowKey].join('|')
    const current = rowMap.get(key) ?? {
      key,
      firstIndex: index,
      sourceSection: row.sourceSection,
      slot: row.slot,
      slotLabel: resolveImportedSlotLabel(row, occurrence),
      cells: {},
    }

    current.cells[row.dayKey] = row
    rowMap.set(key, current)
  })

  return Array.from(rowMap.values()).sort((a, b) => a.firstIndex - b.firstIndex)
}

const isSameMergedDish = (
  current?: WeeklyMenuImportResult['rows'][number],
  next?: WeeklyMenuImportResult['rows'][number],
) => Boolean(
  current &&
  next &&
  current.dishName.trim().toLocaleUpperCase('vi-VN') === next.dishName.trim().toLocaleUpperCase('vi-VN') &&
  current.sourceSection === next.sourceSection &&
  current.dbShiftName === next.dbShiftName &&
  current.variant === next.variant,
)

export const isWeeklyMenuRowContinuation = (
  row: WeeklyMenuImportResult['rows'][number],
  index: number,
  rows: WeeklyMenuImportResult['rows'],
) => {
  if (row.isMergedContinuation) return true
  if (row.sourceRowNumber > 0) return false
  return isSameMergedDish(rows[index - 1], row)
}

const getDishSearchText = (dish: CatalogDish) =>
  [dish.name, dish.code, dish.dishType, dish.dishGroup, ...dish.menuSlots]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

export const matchesShift = (dish: CatalogDish, shift: 'morning' | 'afternoon') => {
  const text = getDishSearchText(dish)
  return shift === 'morning'
    ? text.includes('sáng') || text.includes('morning') || !text.includes('chiều')
    : text.includes('chiều') || text.includes('afternoon') || !text.includes('sáng')
}

export const matchesCategory = (dish: CatalogDish, category: 'savory' | 'vegetarian') => {
  const text = getDishSearchText(dish)
  const isVegetarian = text.includes('chay') || text.includes('vegetarian')
  return category === 'vegetarian' ? isVegetarian : !isVegetarian
}

const addDishToMaterialSummary = (
  summary: MaterialSummaryAccumulator,
  dish: CatalogDish,
  dishName: string,
  portions: number,
  quantityFactor: number,
) => {
  dish.ingredients.forEach((ingredient) => {
    const identityKey = `${ingredient.ingredientId}|${ingredient.unitId}`
    summary[identityKey] ??= {
      ingredientId: ingredient.ingredientId,
      ingredientName: ingredient.name,
      unitId: ingredient.unitId,
      theory: 0,
      actual: 0,
      unit: ingredient.unit,
      referencePrice: ingredient.referencePrice,
      dishNames: [],
      dishNameSet: new Set<string>(),
    }
    const theoryQty = ingredient.grossQtyPerServing * portions
    summary[identityKey].theory += theoryQty
    summary[identityKey].actual += theoryQty * quantityFactor
    summary[identityKey].dishNameSet.add(formatMenuDishName(dishName || dish.name))
  })
}

const finalizeMaterialSummary = (summary: MaterialSummaryAccumulator): MaterialSummary =>
  Object.fromEntries(Object.entries(summary).map(([identityKey, data]) => [identityKey, {
    ingredientId: data.ingredientId,
    ingredientName: data.ingredientName,
    unitId: data.unitId,
    theory: data.theory,
    actual: data.actual,
    unit: data.unit,
    referencePrice: data.referencePrice,
    dishNames: Array.from(data.dishNameSet).sort((a, b) => a.localeCompare(b, 'vi-VN')),
  }])) as MaterialSummary

export const buildPlanRowsMaterialSummary = (
  rows: WeeklyPlanRow[],
  dishesById: Map<string, CatalogDish>,
  dishesByName: Map<string, CatalogDish>,
) => {
  const summary: MaterialSummaryAccumulator = {}
  rows.forEach((row) => {
    const dish = (row.dishId ? dishesById.get(row.dishId) : undefined)
      ?? dishesByName.get(normalizeDishMatchKey(row.dishName))
    if (dish) addDishToMaterialSummary(summary, dish, row.dishName, row.portions, row.quantityFactor)
  })
  return finalizeMaterialSummary(summary)
}

export const calculateTotalMaterialCost = (summary: MaterialSummary) =>
  Object.values(summary).reduce((total, data) => total + data.actual * data.referencePrice, 0)

export const getQuickServingKey = (serviceDate: string, shiftName: QuickServingShiftName) =>
  `${serviceDate}|${shiftName}`

export const aggregateDemandLinesByMaterial = (lines: DemandLine[]): DemandLine[] => {
  const groups = new Map<string, {
    id: string; ingredientId?: string; material: string; unit: string; required: number; available: number; reserved: number
    sources: Set<string>; materialRequestIds: Set<string>; sourceDocumentCodes: Set<string>; hasCancelled: boolean
  }>()

  lines.forEach((line) => {
    const key = line.ingredientId
      ? `${line.ingredientId}__${line.unit}`
      : `${normalizeDishMatchKey(line.material)}__${line.unit}`
    const current = groups.get(key) ?? {
      id: `material-${key}`, ingredientId: line.ingredientId, material: line.material, unit: line.unit, required: 0, available: 0, reserved: 0,
      sources: new Set<string>(), materialRequestIds: new Set<string>(), sourceDocumentCodes: new Set<string>(), hasCancelled: false,
    }
    current.required += line.required
    current.available = Math.max(current.available, line.available)
    current.reserved += line.reserved
    if (line.source) current.sources.add(line.source)
    if (line.materialRequestId) current.materialRequestIds.add(line.materialRequestId)
    if (line.sourceDocumentCode) current.sourceDocumentCodes.add(line.sourceDocumentCode)
    current.hasCancelled ||= line.status.toLowerCase().includes('tạo lại')
    groups.set(key, current)
  })

  return Array.from(groups.values()).map((group): DemandLine => {
    const shortage = Math.max(group.required - (group.available - group.reserved), 0)
    return {
      id: group.id,
      ingredientId: group.ingredientId,
      materialRequestId: group.materialRequestIds.size === 1 ? Array.from(group.materialRequestIds)[0] : undefined,
      sourceDocumentCode: group.sourceDocumentCodes.size === 1 ? Array.from(group.sourceDocumentCodes)[0] : undefined,
      material: group.material,
      required: group.required,
      available: group.available,
      reserved: group.reserved,
      unit: group.unit,
      source: formatMaterialDishSource(Array.from(group.sources)),
      status: group.hasCancelled ? 'Cần tạo lại nhu cầu' : shortage > 0 ? 'Thiếu nguyên liệu' : 'Tồn kho đủ',
      nextAction: group.hasCancelled ? 'Tạo lại nhu cầu từ KHSX' : shortage > 0 ? 'Đề xuất mua thêm' : 'Tạo phiếu xuất kho',
      tone: group.hasCancelled ? 'warning' : shortage > 0 ? 'danger' : 'success',
    }
  }).sort((left, right) => left.material.localeCompare(right.material, 'vi-VN'))
}

export const buildImportedDayDates = (rows: WeeklyMenuImportResult['rows']) =>
  rows.reduce<Record<string, string>>((dates, row) => {
    dates[row.dayKey] ??= formatImportDate(row.serviceDate)
    return dates
  }, {})

export const runInBatches = async <T, R>(items: T[], batchSize: number, worker: (item: T) => Promise<R>) => {
  const results: R[] = []
  for (let index = 0; index < items.length; index += batchSize) {
    results.push(...await Promise.all(items.slice(index, index + batchSize).map(worker)))
  }
  return results
}
