import type { CatalogDish } from '../../dishCatalogApi'
import type { WeeklyMenuImportResult } from '../../../coordination/coordinationApi'
import type { BomPriceTier } from '../../weeklyMenuPlanning'

export interface MaterialSummaryEntry {
  ingredientId: string
  ingredientName: string
  unitId: string
  theory: number
  actual: number
  unit: string
  referencePrice: number
  dishNames: string[]
}

export type MaterialSummary = Record<string, MaterialSummaryEntry>

export type MaterialSummaryAccumulator = Record<
  string,
  MaterialSummaryEntry & { dishNameSet: Set<string> }
>

export type ServingsStatus = 'confirmed' | 'draft' | 'import-default' | 'missing'

export type WeeklyPlanRow = {
  key: string
  dayKey: string
  dayLabel: string
  date: string
  serviceDate: string
  sectionLabel: string
  shiftLabel: string
  menuTypeLabel: string
  slotLabel: string
  dishId: string
  dishName: string
  portions: number
  importedPortions: number
  servingsStatus: ServingsStatus
  servingsStatusLabel: string
  hasConfirmedServings: boolean
  hasCatalogBom: boolean
  menuPrice: number
  bomRatePercent: number
  quantityFactor: number
}

export type WeeklyMenuImportJobStatus =
  | 'idle'
  | 'previewing'
  | 'previewed'
  | 'committing'
  | 'committed'
  | 'failed'

export type ImportWizardStep = 'upload' | 'validate' | 'commit'
export type ImportValidationTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export type WeeklyMenuImportJob = {
  jobId: string
  customerId: string
  customerCode: string
  customerName: string
  weekStartDate: string
  priceTierAmount: BomPriceTier
  file: File
  fileName: string
  fileSize: number
  status: WeeklyMenuImportJobStatus
  previewResult: WeeklyMenuImportResult | null
  warnings: string[]
  error: string | null
}

export type ImportValidationCheck = {
  key: string
  label: string
  value: string
  detail: string
  tone: ImportValidationTone
  blocking?: boolean
}

export type ImportDuplicateGroup = {
  key: string
  label: string
  rowCount: number
  locations: string[]
}

export type PurchaseSummaryMaterialEntry = [string, MaterialSummaryEntry]
export type QuickServingShiftName = 'MORNING' | 'AFTERNOON'
export type WeeklyMenuView =
  | 'schedule'
  | 'demand'
  | 'purchase-summary'
  | 'cost'
  | 'dish-materials'
  | 'production-plan'

export type CatalogDishMaps = {
  dishesById: Map<string, CatalogDish>
  dishesByName: Map<string, CatalogDish>
}
