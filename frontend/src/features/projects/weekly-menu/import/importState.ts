import { DEFAULT_BOM_PRICE_TIER } from '../../weeklyMenuPlanning'
import type { BomPriceTier } from '../../weeklyMenuPlanning'
import type { WeeklyMenuImportJob } from '../model/types'

export type ImportFeedback = {
  title: string
  message: string
  variant: 'info' | 'warning' | 'danger'
}

export type ImportSetupField = 'customer' | 'weekStartDate' | 'file'
export type ImportSetupErrors = Partial<Record<ImportSetupField, Pick<ImportFeedback, 'title' | 'message'>>>

export type ImportRollbackTarget = {
  menuVersionId: string
  label: string
}

export type WeeklyMenuImportState = {
  isOpen: boolean
  draftCustomerId: string
  weekStartDate: string
  priceTierAmount: BomPriceTier
  selectedFile: File | null
  jobs: WeeklyMenuImportJob[]
  selectedJobId: string
  feedback: ImportFeedback | null
  setupErrors: ImportSetupErrors
  isQuickCustomerFormOpen: boolean
  quickCustomerCode: string
  quickCustomerName: string
  rollbackTarget: ImportRollbackTarget | null
}

export const initialWeeklyMenuImportState: WeeklyMenuImportState = {
  isOpen: false,
  draftCustomerId: '',
  weekStartDate: '',
  priceTierAmount: DEFAULT_BOM_PRICE_TIER,
  selectedFile: null,
  jobs: [],
  selectedJobId: '',
  feedback: null,
  setupErrors: {},
  isQuickCustomerFormOpen: false,
  quickCustomerCode: '',
  quickCustomerName: '',
  rollbackTarget: null,
}

type EditableField =
  | 'draftCustomerId'
  | 'weekStartDate'
  | 'priceTierAmount'
  | 'selectedFile'
  | 'quickCustomerCode'
  | 'quickCustomerName'

export type WeeklyMenuImportAction =
  | { type: 'open'; customerId: string; weekStartDate: string; priceTierAmount: BomPriceTier }
  | { type: 'close' }
  | { type: 'edit'; field: EditableField; value: WeeklyMenuImportState[EditableField] }
  | { type: 'toggle-quick-customer' }
  | { type: 'quick-customer-created'; customerId: string }
  | { type: 'set-feedback'; feedback: ImportFeedback | null }
  | { type: 'set-setup-errors'; errors: ImportSetupErrors }
  | { type: 'upsert-job'; job: WeeklyMenuImportJob }
  | { type: 'update-job'; jobId: string; changes: Partial<WeeklyMenuImportJob> }
  | { type: 'remove-job'; jobId: string }
  | { type: 'select-job'; jobId: string }
  | { type: 'request-rollback'; target: ImportRollbackTarget }
  | { type: 'cancel-rollback' }

export const weeklyMenuImportReducer = (
  state: WeeklyMenuImportState,
  action: WeeklyMenuImportAction,
): WeeklyMenuImportState => {
  switch (action.type) {
    case 'open':
      return {
        ...initialWeeklyMenuImportState,
        isOpen: true,
        draftCustomerId: action.customerId,
        weekStartDate: action.weekStartDate,
        priceTierAmount: action.priceTierAmount,
      }
    case 'close':
      return initialWeeklyMenuImportState
    case 'edit': {
      const setupField = action.field === 'draftCustomerId'
        ? 'customer'
        : action.field === 'weekStartDate'
          ? 'weekStartDate'
          : action.field === 'selectedFile' ? 'file' : null
      const setupErrors = { ...state.setupErrors }
      if (setupField) delete setupErrors[setupField]
      return { ...state, [action.field]: action.value, feedback: null, setupErrors }
    }
    case 'toggle-quick-customer':
      return { ...state, isQuickCustomerFormOpen: !state.isQuickCustomerFormOpen, feedback: null }
    case 'quick-customer-created': {
      const setupErrors = { ...state.setupErrors }
      delete setupErrors.customer
      return {
        ...state,
        draftCustomerId: action.customerId,
        quickCustomerCode: '',
        quickCustomerName: '',
        isQuickCustomerFormOpen: false,
        setupErrors,
      }
    }
    case 'set-feedback':
      return { ...state, feedback: action.feedback }
    case 'set-setup-errors':
      return { ...state, feedback: null, setupErrors: action.errors }
    case 'upsert-job': {
      const exists = state.jobs.some((job) => job.customerId === action.job.customerId)
      const jobs = exists
        ? state.jobs.map((job) => (job.customerId === action.job.customerId ? action.job : job))
        : [...state.jobs, action.job]
      return { ...state, jobs, selectedJobId: action.job.jobId, selectedFile: null }
    }
    case 'update-job':
      return {
        ...state,
        jobs: state.jobs.map((job) => job.jobId === action.jobId ? { ...job, ...action.changes } : job),
      }
    case 'remove-job': {
      const jobs = state.jobs.filter((job) => job.jobId !== action.jobId)
      return {
        ...state,
        jobs,
        selectedJobId: state.selectedJobId === action.jobId ? jobs[0]?.jobId ?? '' : state.selectedJobId,
      }
    }
    case 'select-job':
      return { ...state, selectedJobId: action.jobId }
    case 'request-rollback':
      return { ...state, rollbackTarget: action.target }
    case 'cancel-rollback':
      return { ...state, rollbackTarget: null }
  }
}
