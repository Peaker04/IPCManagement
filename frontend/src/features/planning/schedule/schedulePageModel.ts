import type { CoordinationCustomerOption, WeeklyMenuImportResult } from '@/api/coordinationApi'
import type { BomPriceTier } from '@/features/projects/weeklyMenuPlanning'
import type { ImportedLayoutRow } from '@/features/projects/components/ImportedLayoutMatrix'
import type { WeeklyScheduleDay } from '@/features/projects/weekly-menu/schedule/types'
import { formatImportDate } from '@/features/projects/weekly-menu/model/formatters'

export type ScheduleQueryState = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error'

export type SchedulePageModel = {
  identity: {
    title: 'Kế hoạch tuần'
    customerLabel: string
    weekLabel: string
    lifecycle: 'Chưa khởi tạo' | 'Bản nháp' | 'Đã xuất bản'
  }
  pricing: {
    tier?: BomPriceTier
    source?: 'Lịch menu' | 'Hợp đồng' | 'Mặc định'
    blockedReason?: string
  }
  scope: {
    customers: CoordinationCustomerOption[]
    customerId: string
    weekStartDate: string
  }
  commands: {
    canImport: boolean
    canEdit: boolean
    canPublish: boolean
  }
  matrix: {
    displayDays: WeeklyScheduleDay[]
    activeDayKey?: string
  }
  state:
    | { kind: 'prerequisite' }
    | { kind: 'loading' }
    | { kind: 'forbidden' }
    | { kind: 'error' }
    | { kind: 'empty' }
    | { kind: 'ready'; rows: ImportedLayoutRow[] }
}

type Input = {
  customers: CoordinationCustomerOption[]
  customerId: string
  weekStartDate: string
  queryState: ScheduleQueryState
  committedMenu: WeeklyMenuImportResult | null
  rows: readonly ImportedLayoutRow[]
  displayDays?: WeeklyScheduleDay[]
  activeDayKey?: string
  allowMutations?: boolean
  pricing?: SchedulePageModel['pricing']
}

export function buildSchedulePageModel({ customers, customerId, weekStartDate, queryState, committedMenu, rows, displayDays = [], activeDayKey, allowMutations = true, pricing = {} }: Input): SchedulePageModel {
  const customer = customers.find((option) => option.customerId === customerId)
  const lifecycle = committedMenu?.menuVersionStatus === 'ACTIVE'
    ? 'Đã xuất bản'
    : committedMenu ? 'Bản nháp' : 'Chưa khởi tạo'
  const state: SchedulePageModel['state'] = !customerId || !weekStartDate
    ? { kind: 'prerequisite' }
    : queryState === 'loading' || queryState === 'idle'
      ? { kind: 'loading' }
      : queryState === 'forbidden'
        ? { kind: 'forbidden' }
        : queryState === 'error'
          ? { kind: 'error' }
          : rows.length === 0
            ? { kind: 'empty' }
            : { kind: 'ready', rows: [...rows] }

  return {
    identity: {
      title: 'Kế hoạch tuần',
      customerLabel: customer ? `${customer.customerCode} - ${customer.customerName}` : 'Chưa chọn khách hàng',
      weekLabel: weekStartDate ? formatImportDate(weekStartDate) : 'Chưa chọn tuần',
      lifecycle,
    },
    pricing,
    scope: { customers, customerId, weekStartDate },
    commands: {
      canImport: allowMutations,
      canEdit: allowMutations && Boolean(customerId && weekStartDate),
      canPublish: allowMutations && Boolean(committedMenu && committedMenu.menuVersionStatus !== 'ACTIVE'),
    },
    matrix: { displayDays, activeDayKey },
    state,
  }
}
