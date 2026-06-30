import { apiSlice } from '../../api/apiSlice'
import type { ApiResponse } from '../../types/api'
import type {
  ApiShiftName,
  CreateCustomerContractRequest,
  CustomerContractDto,
  MealQuantityPlanDto,
  MealQuantityPlanQuery,
  MenuScheduleDto,
  MenuScheduleQuery,
  OrderRow,
  ShiftType,
  SignoffOrderRequest,
  SignoffOrderResult,
  UpdateCustomerContractRequest,
  UpdateMenuScheduleRulesRequest,
  UpdateMenuScheduleVersionRequest,
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

export interface UpdateForecastServingsRequest {
  orderId: string
  servingsQuantity: number
  reason: string
}

export interface UpdateForecastServingsResult {
  success: boolean
  orderId: string
  oldServings: number
  newServings: number
  changedAt: string
  auditId: string
  warning?: string
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

export interface WeeklyMenuImportDiffRow {
  serviceDate: string
  shiftName: ApiShiftName
  variant: string
  slot: string
  currentDishName?: string | null
  importedDishName?: string | null
  changeType: 'added' | 'changed' | 'removed' | 'unchanged' | string
}

export interface WeeklyMenuImportDiff {
  addedSlots: number
  changedSlots: number
  removedSlots: number
  unchangedSlots: number
  rows: WeeklyMenuImportDiffRow[]
}

export interface WeeklyMenuImportResult {
  committed: boolean
  fileName: string
  customerId: string
  customerCode: string
  customerName: string
  weekStartDate?: string
  weekEndDate?: string
  menuVersionId?: string | null
  menuVersionNo?: number | null
  menuVersionStatus?: string | null
  publishedBy?: string | null
  publishedAt?: string | null
  sourceImportBatch?: string | null
  detectedLayout: WeeklyMenuImportLayout
  warnings: string[]
  rows: WeeklyMenuImportRow[]
  previewDiff: WeeklyMenuImportDiff
  importedWeeklyMenu: WeeklyMenuState
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
    getCustomerContracts: builder.query<ApiResponse<CustomerContractDto[]>, void>({
      query: () => '/coordination/customer-contracts',
      providesTags: ['Customers', 'Coordination'],
    }),
    createCustomerContract: builder.mutation<ApiResponse<CustomerContractDto>, CreateCustomerContractRequest>({
      query: (body) => ({
        url: '/coordination/customers/contract',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Customers', 'Coordination'],
    }),
    updateCustomerContract: builder.mutation<ApiResponse<CustomerContractDto>, { customerId: string; body: UpdateCustomerContractRequest }>({
      query: ({ customerId, body }) => ({
        url: `/coordination/customers/${customerId}/contract`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Customers', 'Coordination'],
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
    updateMenuScheduleRules: builder.mutation<ApiResponse<MenuScheduleDto>, { menuScheduleId: string; body: UpdateMenuScheduleRulesRequest }>({
      query: ({ menuScheduleId, body }) => ({
        url: `/coordination/menu-schedules/${menuScheduleId}/rules`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Coordination', 'WorkflowReports'],
    }),
    updateMenuScheduleVersion: builder.mutation<ApiResponse<MenuScheduleDto>, { menuScheduleId: string; body: UpdateMenuScheduleVersionRequest }>({
      query: ({ menuScheduleId, body }) => ({
        url: `/coordination/menu-schedules/${menuScheduleId}/version`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Coordination', 'WorkflowReports'],
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
    updateForecastServings: builder.mutation<ApiResponse<UpdateForecastServingsResult>, UpdateForecastServingsRequest>({
      query: ({ orderId, servingsQuantity, reason }) => ({
        url: `/coordination/orders/${orderId}/forecast`,
        method: 'PATCH',
        body: { servingsQuantity, reason },
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
    updateWeeklyMenuBulk: builder.mutation<ApiResponse<string[]>, { customerId: string; slots: Array<{ serviceDate: string; shiftName: string; slotType: string; dishId: string }> }>({
      query: (body) => ({
        url: '/coordination/weekly-menu/bulk-update',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Coordination'],
    }),
  }),
  overrideExisting: false,
})

export const {
  useGetCoordinationCustomersQuery,
  useGetCustomerContractsQuery,
  useCreateCustomerContractMutation,
  useUpdateCustomerContractMutation,
  useGetCommittedWeeklyMenuQuery,
  useGetMenuSchedulesQuery,
  useUpdateMenuScheduleRulesMutation,
  useUpdateMenuScheduleVersionMutation,
  useGetMealQuantityPlansQuery,
  useGetCoordinationOrdersQuery,
  useLockCoordinationOrdersMutation,
  useAdjustCoordinationOrderMutation,
  useUpdateForecastServingsMutation,
  useSignoffCoordinationOrderMutation,
  useExportCoordinationOrdersMutation,
  usePreviewWeeklyMenuImportMutation,
  useCommitWeeklyMenuImportMutation,
  useUpdateWeeklyMenuBulkMutation,
} = coordinationApi
