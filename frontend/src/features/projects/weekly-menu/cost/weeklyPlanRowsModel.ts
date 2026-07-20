import type { WeeklyMenuImportResult } from '../../../coordination/coordinationApi'
import type { WeeklyMenuState } from '../../../coordination/types'
import type { CatalogDish } from '../../dishCatalogApi'
import {
  formatImportDate,
  formatMenuDishName,
  getShiftLabel,
  getVariantLabel,
  importSlotLabels,
  normalizeDishMatchKey,
  parseDisplayDateToIso,
} from '../model/formatters'
import { getNormalizedSlotType, isWeeklyMenuRowContinuation, SECTIONS } from '../model/scope'
import type { WeeklyPlanRow } from '../model/types'
import type { WeeklyScheduleDay, WeeklyScheduleEditorWorkflow } from '../schedule/types'

type Options = {
  committedRows: WeeklyMenuImportResult['rows']
  displayDays: WeeklyScheduleDay[]
  weeklyMenu: WeeklyMenuState
  dishesById: Map<string, CatalogDish>
  dishesByName: Map<string, CatalogDish>
  getServiceDate: WeeklyScheduleEditorWorkflow['presentation']['getServiceDate']
  getSlotServingInfo: WeeklyScheduleEditorWorkflow['presentation']['getSlotServingInfo']
  getLinePricing: WeeklyScheduleEditorWorkflow['presentation']['getLinePricing']
}

export const buildWeeklyPlanRows = ({
  committedRows,
  displayDays,
  weeklyMenu,
  dishesById,
  dishesByName,
  getServiceDate,
  getSlotServingInfo,
  getLinePricing,
}: Options): WeeklyPlanRow[] => committedRows.length > 0
  ? committedRows
    .filter((row, index, rows) => !isWeeklyMenuRowContinuation(row, index, rows))
    .map((row, index) => {
      const catalogDish = (row.dishId ? dishesById.get(row.dishId) : undefined)
        ?? dishesByName.get(normalizeDishMatchKey(row.dishName))
      const day = displayDays.find((item) => item.key === row.dayKey)
      const slotType = getNormalizedSlotType(row)
      const servingsInfo = getSlotServingInfo(row.dayKey, slotType)
      const calculatedPortions = weeklyMenu[row.dayKey]?.[slotType]?.portions ?? servingsInfo.portions
      const linePricing = getLinePricing(row.serviceDate.split('T')[0], row.dbShiftName)
      return {
        key: `import-${row.serviceDate}-${row.sourceSection}-${row.slot}-${index}`,
        dayKey: row.dayKey,
        dayLabel: day?.label ?? row.dayKey.toUpperCase(),
        date: formatImportDate(row.serviceDate),
        serviceDate: row.serviceDate.split('T')[0],
        sectionLabel: row.sourceSection,
        shiftLabel: getShiftLabel(row.dbShiftName),
        menuTypeLabel: getVariantLabel(row.variant),
        slotLabel: row.slotLabel || importSlotLabels[row.slot] || row.slot,
        dishId: catalogDish?.id ?? row.dishId ?? '',
        dishName: formatMenuDishName(row.dishName),
        portions: calculatedPortions > 0 ? calculatedPortions : servingsInfo.importedPortions,
        importedPortions: servingsInfo.importedPortions,
        servingsStatus: servingsInfo.status,
        servingsStatusLabel: servingsInfo.statusLabel,
        hasConfirmedServings: servingsInfo.hasConfirmedServings,
        hasCatalogBom: Boolean(catalogDish?.ingredients.length),
        ...linePricing,
      }
    })
  : displayDays.flatMap((day) => SECTIONS.flatMap((section): WeeklyPlanRow[] => {
    const slot = weeklyMenu[day.key]?.[section.slotType]
    if (!slot) return []
    const importedMainDish = slot.customComponents?.main?.trim()
    const catalogDish = dishesById.get(slot.dishId) ?? dishesByName.get(normalizeDishMatchKey(importedMainDish))
    const dishName = formatMenuDishName(importedMainDish || catalogDish?.name || 'Chưa có món')
    if (dishName === 'Chưa có món') return []
    const serviceDate = getServiceDate(day.key) || parseDisplayDateToIso(day.date) || day.date
    const shiftName = section.shift === 'morning' ? 'MORNING' : 'AFTERNOON'
    const servingsInfo = getSlotServingInfo(day.key, section.slotType)
    return [{
      key: `${day.key}-${section.slotType}`,
      dayKey: day.key,
      dayLabel: day.label,
      date: day.date,
      serviceDate,
      sectionLabel: section.label,
      shiftLabel: section.shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều',
      menuTypeLabel: section.category === 'vegetarian' ? 'Chay' : 'Mặn',
      slotLabel: 'Món chính',
      dishId: catalogDish?.id ?? slot.dishId,
      dishName,
      portions: servingsInfo.portions > 0 ? servingsInfo.portions : servingsInfo.importedPortions,
      importedPortions: servingsInfo.importedPortions,
      servingsStatus: servingsInfo.status,
      servingsStatusLabel: servingsInfo.statusLabel,
      hasConfirmedServings: servingsInfo.hasConfirmedServings,
      hasCatalogBom: Boolean(catalogDish?.ingredients.length),
      ...getLinePricing(serviceDate, shiftName),
    }]
  }))
