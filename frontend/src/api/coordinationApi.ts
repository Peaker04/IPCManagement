import { apiSlice } from './apiSlice'
import { workflowCacheTags } from './workflowCacheTags'
import type { components, paths } from '@/shared/api/contracts/schema'
import type { ApiResponse } from '@/types/api'
import type {
  CoordinationScopeActionRequest,
  CoordinationScopeActionResult,
  CreateCustomerContractRequest,
  CustomerContractDto,
  MealQuantityPlanDto,
  MealQuantityPlanQuery,
  MenuVersionRollbackResult,
  MenuScheduleDto,
  MenuScheduleQuery,
  OrderRow,
  RollbackMenuVersionRequest,
  ShiftType,
  SignoffOrderRequest,
  SignoffOrderResult,
  UpdateCustomerContractRequest,
  UpdateMenuScheduleRulesRequest,
  UpdateMenuScheduleVersionRequest,
  ProductionPlanDto,
} from '@/types/coordination'
import { toApiShiftName, toDisplayShift } from '@/types/coordination'

type LowerCamelQuery<Query> = {
  [Key in keyof Query as Uncapitalize<Key & string>]: Query[Key]
}

type CoordinationOrderWire = components['schemas']['CoordinationOrderDto']
type LockOrderPlanWire = components['schemas']['LockOrderPlanRequest']
type LockOrderPlanLineWire = components['schemas']['LockOrderPlanLineRequest']
type WeeklyMenuImportWire = NonNullable<
  paths['/api/coordination/weekly-menu/import/preview']['post']['requestBody']
>['content']['multipart/form-data']
type WeeklyMenuTemplateQuery = LowerCamelQuery<
  NonNullable<paths['/api/coordination/weekly-menu/template']['get']['parameters']['query']>
>
type CommittedWeeklyMenuQuery = LowerCamelQuery<
  NonNullable<paths['/api/coordination/weekly-menu']['get']['parameters']['query']>
>
type WeeklyMenuImportHistoryQuery = LowerCamelQuery<
  NonNullable<paths['/api/coordination/weekly-menu/import-history']['get']['parameters']['query']>
>
type ProductionPlanQuery = LowerCamelQuery<
  NonNullable<paths['/api/production-plans/filter']['get']['parameters']['query']>
>

export interface CoordinationQuery {
  dayOfWeek: string
  serviceDate?: string
  shift: ShiftType
}

export type LockOrderPlanRequest = CoordinationQuery
  & Pick<LockOrderPlanWire, 'serviceDate' | 'scope'>
  & { lines: Array<Pick<LockOrderPlanLineWire, 'quantityPlanLineId' | 'actualQuantity'>> }

export type LockOrderPlanResult = components['schemas']['LockOrderPlanResultDto']
export type AdjustOrderAfterLockRequest = components['schemas']['AdjustOrderAfterLockRequest']
export type AdjustOrderAfterLockResult = components['schemas']['AdjustOrderAfterLockResultDto']

export type UpdateForecastServingsRequest = { orderId: string }
  & components['schemas']['UpdateForecastServingsRequest']

export type UpdateForecastServingsResult = components['schemas']['AdjustServingsResultDto']
export type UpsertQuickServingsRequest = components['schemas']['UpsertQuickServingsRequest']

export type ExportOrderReportRequest = CoordinationQuery
  & Pick<components['schemas']['ExportOrderReportRequest'], 'format'>

export type ExportOrderReportResult = components['schemas']['ExportOrderReportResultDto']
export type CoordinationCustomerOption = components['schemas']['CoordinationCustomerOptionDto']

export type WeeklyMenuImportRequest = Omit<WeeklyMenuImportWire, 'file' | 'customerId'>
  & { file: File; customerId: string; previewToken?: string }

export type WeeklyMenuTemplateRequest = WeeklyMenuTemplateQuery
export type WeeklyMenuQuery = CommittedWeeklyMenuQuery & { customerId: string }

export type WeeklyMenuImportColumn = components['schemas']['WeeklyMenuImportColumnDto']
export type WeeklyMenuImportLayout = components['schemas']['WeeklyMenuImportLayoutDto']
export type WeeklyMenuImportRow = components['schemas']['WeeklyMenuImportRowDto']
export type WeeklyMenuImportDiffRow = components['schemas']['WeeklyMenuImportDiffRowDto']
export type WeeklyMenuImportDiff = components['schemas']['WeeklyMenuImportDiffDto']
export type WeeklyMenuImportValidationIssue = components['schemas']['WeeklyMenuImportValidationIssueDto']
export type WeeklyMenuImportValidation = components['schemas']['WeeklyMenuImportValidationDto']
export type WeeklyMenuImportResult = components['schemas']['WeeklyMenuImportResultDto']
export type CustomerImportMapping = components['schemas']['CustomerImportMappingDto']
export type WeeklyMenuImportHistoryItem = components['schemas']['WeeklyMenuImportHistoryItemDto']
export type RollbackWeeklyMenuImportResult = components['schemas']['RollbackWeeklyMenuImportResultDto']

const buildWeeklyMenuImportFormData = ({ file, customerId, weekStartDate, priceTierAmount, previewToken }: WeeklyMenuImportRequest) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('customerId', customerId)
  if (weekStartDate) {
    formData.append('weekStartDate', weekStartDate)
  }
  if (priceTierAmount) {
    formData.append('priceTierAmount', String(priceTierAmount))
  }
  if (previewToken) {
    formData.append('previewToken', previewToken)
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
      invalidatesTags: [
        'Coordination',
        'MaterialDemandStaleness',
        workflowCacheTags.documents,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.purchasePlan,
        workflowCacheTags.productionPlans,
      ],
    }),
    updateMenuScheduleVersion: builder.mutation<ApiResponse<MenuScheduleDto>, { menuScheduleId: string; body: UpdateMenuScheduleVersionRequest }>({
      query: ({ menuScheduleId, body }) => ({
        url: `/coordination/menu-schedules/${menuScheduleId}/version`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: [
        'Coordination',
        'MaterialDemandStaleness',
        workflowCacheTags.documents,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.purchasePlan,
        workflowCacheTags.productionPlans,
      ],
    }),
    rollbackMenuVersion: builder.mutation<ApiResponse<MenuVersionRollbackResult>, RollbackMenuVersionRequest>({
      query: (body) => ({
        url: '/coordination/menu-versions/rollback',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        'Coordination',
        'MaterialDemandStaleness',
        workflowCacheTags.documents,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.materialRequestCandidates,
        workflowCacheTags.purchasePlan,
        workflowCacheTags.productionPlans,
      ],
    }),
    getMealQuantityPlans: builder.query<ApiResponse<MealQuantityPlanDto[]>, MealQuantityPlanQuery>({
      query: (params) => ({
        url: '/coordination/meal-quantity-plans',
        params,
      }),
      providesTags: ['Coordination'],
    }),
    getCoordinationOrders: builder.query<ApiResponse<OrderRow[]>, CoordinationQuery>({
      query: ({ dayOfWeek, serviceDate, shift }) => ({
        url: '/coordination/orders',
        params: { dayOfWeek, serviceDate, shiftName: toApiShiftName(shift) },
      }),
      transformResponse: (response: ApiResponse<readonly CoordinationOrderWire[]>) => ({
        ...response,
        data: response.data?.map((order) => ({
          ...order,
          shiftName: order.shiftName === 'MORNING' || order.shiftName === 'AFTERNOON'
            ? order.shiftName
            : undefined,
          // Mã ca không thuộc hai ca FE hỗ trợ thì giữ nguyên giá trị server gửi kèm,
          // không quy về "Ca Chiều" — quy sai làm suất ăn bị cộng vào ca khác.
          shift: (order.shiftName ? toDisplayShift(order.shiftName) : undefined) ?? order.shift,
          menuName: order.menuName || order.mealType,
          dishes: order.dishes.map((dish) => ({ ...dish })),
          dishId: order.dishes?.[0]?.dishId || order.dishId || '',
        })),
      }),
      providesTags: ['Coordination'],
    }),
    lockCoordinationOrders: builder.mutation<ApiResponse<LockOrderPlanResult>, LockOrderPlanRequest>({
      query: ({ dayOfWeek, serviceDate, shift, scope = 'FULLDAY', lines }) => ({
        url: '/coordination/orders/lock',
        method: 'POST',
        body: {
          serviceDate,
          dayOfWeek,
          shiftName: toApiShiftName(shift),
          scope,
          lines,
        } satisfies components['schemas']['LockOrderPlanRequest'],
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
        body: { servingsQuantity, reason } satisfies components['schemas']['UpdateForecastServingsRequest'],
      }),
      invalidatesTags: ['Coordination'],
    }),
    upsertQuickServings: builder.mutation<ApiResponse<MealQuantityPlanDto>, UpsertQuickServingsRequest>({
      query: (body) => ({
        url: '/coordination/meal-quantity-plans/quick-servings',
        method: 'POST',
        body: {
          ...body,
          complete: Boolean(body.complete),
        },
      }),
      invalidatesTags: [
        'Coordination',
        workflowCacheTags.documents,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.purchasePlan,
        workflowCacheTags.productionPlans,
      ],
    }),
    signoffCoordinationOrder: builder.mutation<ApiResponse<SignoffOrderResult>, { id: string; body: SignoffOrderRequest }>({
      query: ({ id, body }) => ({
        url: `/coordination/orders/${id}/signoff`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Coordination'],
    }),
    signoffCoordinationScope: builder.mutation<ApiResponse<CoordinationScopeActionResult>, CoordinationScopeActionRequest>({
      query: ({ dayOfWeek, serviceDate, shift, note }) => ({
        url: '/coordination/orders/signoff',
        method: 'POST',
        body: { dayOfWeek, serviceDate, shiftName: toApiShiftName(shift), note } satisfies components['schemas']['CoordinationScopeActionRequest'],
      }),
      invalidatesTags: ['Coordination'],
    }),
    unlockCoordinationOrders: builder.mutation<ApiResponse<LockOrderPlanResult>, { id: string }>({
      query: ({ id }) => ({
        url: `/coordination/orders/${id}/unlock`,
        method: 'POST',
      }),
      invalidatesTags: ['Coordination'],
    }),
    unlockCoordinationScope: builder.mutation<ApiResponse<CoordinationScopeActionResult>, CoordinationScopeActionRequest>({
      query: ({ dayOfWeek, serviceDate, shift, note }) => ({
        url: '/coordination/orders/unlock',
        method: 'POST',
        body: { dayOfWeek, serviceDate, shiftName: toApiShiftName(shift), note } satisfies components['schemas']['CoordinationScopeActionRequest'],
      }),
      invalidatesTags: ['Coordination'],
    }),
    exportCoordinationOrders: builder.mutation<ApiResponse<ExportOrderReportResult>, ExportOrderReportRequest>({
      query: ({ dayOfWeek, serviceDate, shift, format }) => ({
        url: '/coordination/orders/export',
        method: 'POST',
        body: {
          dayOfWeek,
          serviceDate,
          shiftName: toApiShiftName(shift),
          format,
        } satisfies components['schemas']['ExportOrderReportRequest'],
      }),
    }),
    previewWeeklyMenuImport: builder.mutation<ApiResponse<WeeklyMenuImportResult>, WeeklyMenuImportRequest>({
      query: (request) => ({
        url: '/coordination/weekly-menu/import/preview',
        method: 'POST',
        body: buildWeeklyMenuImportFormData(request),
      }),
    }),
    downloadWeeklyMenuTemplate: builder.mutation<string, WeeklyMenuTemplateRequest | void>({
      query: (request) => ({
        url: '/coordination/weekly-menu/template',
        method: 'GET',
        params: {
          ...(request?.customerId ? { customerId: request.customerId } : {}),
          ...(request?.weekStartDate ? { weekStartDate: request.weekStartDate } : {}),
        },
        responseHandler: async (response) => response.blob(),
      }),
      transformResponse: (blob: Blob) => URL.createObjectURL(blob),
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
      { customerId: string } & components['schemas']['SaveCustomerImportMappingRequest']
    >({
      query: ({ customerId, ...body }) => ({
        url: `/coordination/customers/${customerId}/import-mapping`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Customers'],
    }),
    updateWeeklyMenuBulk: builder.mutation<ApiResponse<string[]>, components['schemas']['BulkUpdateWeeklyMenuRequest']>({
      query: (body) => ({
        url: '/coordination/weekly-menu/bulk-update',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Coordination'],
    }),
    getWeeklyMenuImportHistory: builder.query<ApiResponse<WeeklyMenuImportHistoryItem[]>, WeeklyMenuImportHistoryQuery | void>({
      query: (params) => {
        const customerId = params?.customerId;
        return {
          url: '/coordination/weekly-menu/import-history',
          params: customerId ? { customerId } : undefined,
        };
      },
      providesTags: ['Coordination'],
    }),
    rollbackWeeklyMenuImport: builder.mutation<ApiResponse<RollbackWeeklyMenuImportResult>, string>({
      query: (menuVersionId) => ({
        url: `/coordination/weekly-menu/import/${menuVersionId}/rollback`,
        method: 'POST',
      }),
      invalidatesTags: ['Coordination', 'DishCatalog'],
    }),
    getProductionPlans: builder.query<ApiResponse<ProductionPlanDto[]>, ProductionPlanQuery>({
      query: (params) => ({
        url: '/production-plans/filter',
        params,
      }),
      providesTags: ['Coordination'],
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
  useLazyGetMenuSchedulesQuery,
  useUpdateMenuScheduleRulesMutation,
  useUpdateMenuScheduleVersionMutation,
  useRollbackMenuVersionMutation,
  useGetMealQuantityPlansQuery,
  useGetCoordinationOrdersQuery,
  useLockCoordinationOrdersMutation,
  useUnlockCoordinationOrdersMutation,
  useAdjustCoordinationOrderMutation,
  useUpdateForecastServingsMutation,
  useUpsertQuickServingsMutation,
  useSignoffCoordinationOrderMutation,
  useSignoffCoordinationScopeMutation,
  useUnlockCoordinationScopeMutation,
  useExportCoordinationOrdersMutation,
  usePreviewWeeklyMenuImportMutation,
  useDownloadWeeklyMenuTemplateMutation,
  useCommitWeeklyMenuImportMutation,
  useGetCustomerImportMappingQuery,
  useSaveCustomerImportMappingMutation,
  useUpdateWeeklyMenuBulkMutation,
  useGetWeeklyMenuImportHistoryQuery,
  useRollbackWeeklyMenuImportMutation,
  useGetProductionPlansQuery,
  useLazyGetProductionPlansQuery,
} = coordinationApi
