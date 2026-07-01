import { apiSlice } from '../../api/apiSlice'
import type { ApiResponse } from '../../types/api'
import type {
  ApiShiftName,
  MealQuantityPlanDto,
  MealQuantityPlanQuery,
  MenuScheduleDto,
  MenuScheduleQuery,
  OrderRow,
  ShiftType,
  SignoffOrderRequest,
  SignoffOrderResult,
  WeeklyMenuState,
} from './types'
import { toApiShiftName, toDisplayShift } from './types'

export interface CoordinationQuery {
  dayOfWeek: string
  shift: ShiftType
}

export interface LockOrderPlanRequest extends CoordinationQuery {
  scope?: 'FULLDAY' | ApiShiftName
  lines?: Array<{
    quantityPlanLineId: string
    actualQuantity: number
  }>
}

export interface LockOrderPlanResult {
  success: boolean
  lockedAt: string
  serviceDate: string
  scope: 'FULLDAY' | ApiShiftName
  lockedShiftNames: ApiShiftName[]
  lockedLineCount: number
}

export interface AdjustOrderAfterLockRequest {
  orderId: string
  field: string
  newValue: number
  reason: string
}

export interface AdjustOrderAfterLockResult {
  success: boolean
  timestamp: string
}

export interface ExportOrderReportRequest extends CoordinationQuery {
  format: 'excel' | 'pdf'
}

export interface ExportOrderReportResult {
  success: boolean
  downloadUrl: string
}

export interface CoordinationCustomerOption {
  customerId: string
  customerCode: string
  customerName: string
}

export interface WeeklyMenuImportRequest {
  file: File
  customerId: string
  weekStartDate?: string
}

export interface WeeklyMenuQuery {
  customerId: string
  weekStartDate?: string
}

export interface WeeklyMenuImportColumn {
  column: string
  serviceDate: string
  label: string
}

export interface WeeklyMenuImportLayout {
  sheetName: string
  labelColumn: string
  dayColumns: WeeklyMenuImportColumn[]
  sections: string[]
  rowsScanned: number
  rowsImported: number
  rowsSkipped: number
}

export interface WeeklyMenuImportRow {
  serviceDate: string
  dayKey: string
  sourceSection: string
  sourceShift: string
  dbShiftName: ApiShiftName
  variant: string
  slot: string
  slotLabel: string
  dishName: string
  dishId?: string
  existingDish: boolean
}

export interface WeeklyMenuImportResult {
  committed: boolean
  fileName: string
  customerId: string
  customerCode: string
  customerName: string
  weekStartDate?: string
  weekEndDate?: string
  detectedLayout: WeeklyMenuImportLayout
  warnings: string[]
  rows: WeeklyMenuImportRow[]
  importedWeeklyMenu: WeeklyMenuState
}

export interface CustomerImportMapping {
  customerId: string
  sheetNameHint?: string
  labelColumn?: string
}

const buildWeeklyMenuImportFormData = ({ file, customerId, weekStartDate }: WeeklyMenuImportRequest) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('customerId', customerId)
  if (weekStartDate) {
    formData.append('weekStartDate', weekStartDate)
  }
  return formData
}

export const coordinationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCoordinationCustomers: builder.query<ApiResponse<CoordinationCustomerOption[]>, void>({
      query: () => '/coordination/customers',
      providesTags: ['Customers'],
    }),
    getCommittedWeeklyMenu: builder.query<ApiResponse<WeeklyMenuImportResult | null>, WeeklyMenuQuery>({
      query: ({ customerId, weekStartDate }) => ({
        url: '/coordination/weekly-menu',
        params: { customerId, ...(weekStartDate ? { weekStartDate } : {}) },
      }),
      providesTags: ['Coordination'],
    }),
    getMenuSchedules: builder.query<ApiResponse<MenuScheduleDto[]>, MenuScheduleQuery>({
      query: (params) => ({
        url: '/coordination/menu-schedules',
        params,
      }),
      providesTags: ['Coordination'],
    }),
    getMealQuantityPlans: builder.query<ApiResponse<MealQuantityPlanDto[]>, MealQuantityPlanQuery>({
      query: (params) => ({
        url: '/coordination/meal-quantity-plans',
        params,
      }),
      providesTags: ['Coordination'],
    }),
    getCoordinationOrders: builder.query<ApiResponse<OrderRow[]>, CoordinationQuery>({
      query: ({ dayOfWeek, shift }) => ({
        url: '/coordination/orders',
        params: { dayOfWeek, shiftName: toApiShiftName(shift) },
      }),
      transformResponse: (response: ApiResponse<OrderRow[]>) => ({
        ...response,
        data: response.data?.map((order) => ({
          ...order,
          shiftName: order.shiftName,
          shift: order.shiftName ? toDisplayShift(order.shiftName) : order.shift,
          menuName: order.menuName || order.mealType,
          dishes: order.dishes ?? [],
          dishId: order.dishes?.[0]?.dishId || order.dishId || '',
        })),
      }),
      providesTags: ['Coordination'],
    }),
    lockCoordinationOrders: builder.mutation<ApiResponse<LockOrderPlanResult>, LockOrderPlanRequest>({
      query: ({ dayOfWeek, shift, scope = 'FULLDAY', lines }) => ({
        url: '/coordination/orders/lock',
        method: 'POST',
        body: {
          dayOfWeek,
          shiftName: toApiShiftName(shift),
          scope,
          lines,
        },
      }),
      invalidatesTags: ['Coordination'],
    }),
    adjustCoordinationOrder: builder.mutation<ApiResponse<AdjustOrderAfterLockResult>, AdjustOrderAfterLockRequest>({
      query: (body) => ({
        url: '/coordination/orders/adjust',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Coordination'],
    }),
    signoffCoordinationOrder: builder.mutation<ApiResponse<SignoffOrderResult>, { id: string; body: SignoffOrderRequest }>({
      query: ({ id, body }) => ({
        url: `/coordination/orders/${id}/signoff`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Coordination'],
    }),
    exportCoordinationOrders: builder.mutation<ApiResponse<ExportOrderReportResult>, ExportOrderReportRequest>({
      query: ({ dayOfWeek, shift, format }) => ({
        url: '/coordination/orders/export',
        method: 'POST',
        body: {
          dayOfWeek,
          shiftName: toApiShiftName(shift),
          format,
        },
      }),
    }),
    previewWeeklyMenuImport: builder.mutation<ApiResponse<WeeklyMenuImportResult>, WeeklyMenuImportRequest>({
      query: (request) => ({
        url: '/coordination/weekly-menu/import/preview',
        method: 'POST',
        body: buildWeeklyMenuImportFormData(request),
      }),
    }),
    commitWeeklyMenuImport: builder.mutation<ApiResponse<WeeklyMenuImportResult>, WeeklyMenuImportRequest>({
      query: (request) => ({
        url: '/coordination/weekly-menu/import/commit',
        method: 'POST',
        body: buildWeeklyMenuImportFormData(request),
      }),
      invalidatesTags: ['Coordination', 'DishCatalog'],
    }),
    getCustomerImportMapping: builder.query<ApiResponse<CustomerImportMapping | null>, string>({
      query: (customerId) => `/coordination/customers/${customerId}/import-mapping`,
      providesTags: ['Customers'],
    }),
    saveCustomerImportMapping: builder.mutation<
      ApiResponse<CustomerImportMapping>,
      { customerId: string; sheetNameHint?: string; labelColumn?: string }
    >({
      query: ({ customerId, ...body }) => ({
        url: `/coordination/customers/${customerId}/import-mapping`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Customers'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetCoordinationCustomersQuery,
  useGetCommittedWeeklyMenuQuery,
  useGetMenuSchedulesQuery,
  useGetMealQuantityPlansQuery,
  useGetCoordinationOrdersQuery,
  useLockCoordinationOrdersMutation,
  useAdjustCoordinationOrderMutation,
  useSignoffCoordinationOrderMutation,
  useExportCoordinationOrdersMutation,
  usePreviewWeeklyMenuImportMutation,
  useCommitWeeklyMenuImportMutation,
  useGetCustomerImportMappingQuery,
  useSaveCustomerImportMappingMutation,
} = coordinationApi
