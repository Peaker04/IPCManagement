import type { WeeklyMenuState } from '../../../coordination/types'
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
  quickServingInputs: Record<string, string>
}

export type WeeklyScheduleEditorWorkflow = {
  scope: WeeklyMenuScope
  state: WeeklyScheduleEditorState & { weeklyMenu: WeeklyMenuState }
  status: { isSavingMenu: boolean; isSavingQuickServings: boolean }
  actions: {
    openEditor: () => void
    closeEditor: () => void
    changeDish: (dayKey: string, slotType: keyof WeeklyMenuState[string], dishId: string) => void
    saveEditor: () => Promise<void>
    changeQuickServing: (key: string, value: string) => void
    discardQuickServing: (key: string) => void
    saveQuickServing: (row: QuickServingRow) => Promise<void>
    completeQuickServing: (row: QuickServingRow) => Promise<void>
    completePendingQuickServings: (rows: QuickServingRow[], serviceDates: string[]) => Promise<number>
  }
  presentation: {
    sections: Array<{
      label: string
      slotType: keyof WeeklyMenuState[string]
      dishes: Array<{ id: string; name: string }>
      defaultDishId: string
    }>
    isLocked: (dayKey: string, slotType: keyof WeeklyMenuState[string]) => boolean
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
