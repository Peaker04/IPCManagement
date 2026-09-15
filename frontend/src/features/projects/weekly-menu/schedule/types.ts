import type { WeeklyMenuState } from '@/types/coordination'
import type { ImportedLayoutRow } from '../../components/ImportedLayoutMatrix'
import type { BomPriceTier } from '../../weeklyMenuPlanning'
import type { WeeklyPlanRow } from '../model/types'

export type WeeklyScheduleDay = {
  key: string
  label: string
  date: string
}

export type WeeklyMenuScope = {
  customerId: string
  customerLabel: string
  weekStartDate: string
  weekLabel: string
  menuPrice: BomPriceTier
  fixedBomRatePercent: number
  activeServiceLabel: string
  activeDayKey?: string
  displayDays: WeeklyScheduleDay[]
}

export type WeeklyScheduleFeedback = {
  title: string
  message: string
  variant: 'info' | 'warning' | 'danger'
}

export type QuickServingRow = {
  key: string
  dayKey: string
  dayLabel: string
  date: string
  serviceDate: string
  shiftName: 'MORNING' | 'AFTERNOON'
  shiftLabel: 'Ca Sáng' | 'Ca Chiều'
  quantityPlanId?: string
  quantityPlanIds: string[]
  lines: Array<{ quantityPlanLineId: string; servings: number }>
  currentServings: number
  importedServings: number
  inputValue: string
  hasPlanLines: boolean
  hasDraftChange: boolean
  isConfirmed: boolean
  isCompleted: boolean
  statusLabel: string
}

export type WeeklyScheduleEditorState = {
  isEditorOpen: boolean
  draftMenu: WeeklyMenuState
  draftDishes: Record<string, string>
  quickServingInputs: Record<string, string>
}

export type WeeklyScheduleEditorWorkflow = {
  scope: WeeklyMenuScope
  state: WeeklyScheduleEditorState & { weeklyMenu: WeeklyMenuState }
  status: { isSavingMenu: boolean; isSavingQuickServings: boolean }
  actions: {
    openEditor: () => void
    closeEditor: () => void
    changeDish: (dayKey: string, slotType: string, dishId: string, slotKey?: string) => void
    saveEditor: (amendmentReason?: string) => Promise<void>
    changeQuickServing: (key: string, value: string) => void
    discardQuickServing: (key: string) => void
    saveQuickServing: (row: QuickServingRow) => Promise<void>
    completeQuickServing: (row: QuickServingRow) => Promise<void>
    applyServingToShift?: (shiftName: 'MORNING' | 'AFTERNOON', value: string, rows: QuickServingRow[]) => void
    saveAllQuickServings?: (rows: QuickServingRow[]) => Promise<void>
    completeAllQuickServings?: (rows: QuickServingRow[]) => Promise<void>
  }
  presentation: {
    pendingChangeCount: number
    directChangeCount?: number
    amendmentChangeCount?: number
    hasLockedChanges?: boolean
    allDishes?: Array<{ id: string; name: string; code: string; bomReady: boolean }>
    layoutRows?: ImportedLayoutRow[]
    sections: Array<{
      label: string
      slotType: keyof WeeklyMenuState[string]
      dishes: Array<{ id: string; name: string; code: string; bomReady: boolean }>
      defaultDishId: string
    }>
    getDishName: (dishId: string) => string | undefined
    isLocked: (dayKey: string, slotType: string) => boolean
    getServiceDate: (dayKey: string) => string
    getSlotServingInfo: (dayKey: string, slotType: keyof WeeklyMenuState[string]) => {
      portions: number
      importedPortions: number
      status: 'confirmed' | 'draft' | 'import-default' | 'missing'
      statusLabel: string
      hasConfirmedServings: boolean
    }
    getLinePricing: (serviceDate: string, shiftName: string) => {
      menuPrice: BomPriceTier
      bomRatePercent: number
      quantityFactor: number
    }
    buildQuickServingRows: (weeklyPlanRows: WeeklyPlanRow[]) => QuickServingRow[]
    getQuickServingRow: (rows: QuickServingRow[], planRow: WeeklyPlanRow) => QuickServingRow | undefined
  }
}
