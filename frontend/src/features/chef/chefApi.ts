import { apiSlice } from '@/api/apiSlice';
import type {
  ProductionPlan,
  DailyProductionPlan,
  SendDailyProductionPlanRequest,
  ProductionPlanDto,
  DailyProductionPlanDto,
  WorkflowReportQuery,
  ServiceRunLifecycleProjectionDto,
  ServiceRunByPlanQuery,
  OpenServiceRunRequest,
  DeclareServiceRunVarianceRequest,
  ApproveServiceRunVarianceWaiverRequest,
  RecordActualServingsRequest,
  ReasonRequest,
  CreateServiceRunAdjustmentRequest,
  ServiceRunAdjustmentDto,
  ServiceRunPageQuery,
  ServiceRunPageResponseDto,
} from '@/api/workflowApiTypes';
import type { ApiResponse } from '@/types/api';
import { workflowCacheTags } from '@/api/workflowCacheTags';

const emptyDailyProductionPlan = (): DailyProductionPlan => ({
  serviceDate: '',
  totalPlans: 0,
  sentPlans: 0,
  totalDishes: 0,
  totalServings: 0,
  totalRequiredQty: 0,
  suggestedPurchaseQty: 0,
  warnings: [],
  plans: [],
});

const mapProductionPlan = (plan: ProductionPlanDto): ProductionPlan => ({
  ...plan,
  customerId: plan.customerId ?? undefined,
  customerCode: plan.customerCode ?? undefined,
  customerName: plan.customerName ?? undefined,
  status: plan.status ?? undefined,
  sentToKitchenAt: plan.sentToKitchenAt ?? undefined,
  sentToKitchenByName: plan.sentToKitchenByName ?? undefined,
  lines: plan.lines.map((line) => ({ ...line })),
});

const normalizeDailyProductionPlan = (
  response: ApiResponse<DailyProductionPlanDto> | DailyProductionPlanDto | unknown,
): DailyProductionPlan => {
  const maybeData =
    response && typeof response === 'object' && 'data' in response
      ? (response as ApiResponse<DailyProductionPlanDto>).data
      : response;

  if (!maybeData || typeof maybeData !== 'object' || Array.isArray(maybeData)) {
    return emptyDailyProductionPlan();
  }

  const plan = maybeData as Partial<DailyProductionPlanDto>;
  return {
    ...emptyDailyProductionPlan(),
    ...plan,
    customerId: plan.customerId ?? undefined,
    customerCode: plan.customerCode ?? undefined,
    customerName: plan.customerName ?? undefined,
    shiftName: plan.shiftName ?? undefined,
    warnings: Array.isArray(plan.warnings) ? plan.warnings : [],
    plans: Array.isArray(plan.plans) ? plan.plans.map(mapProductionPlan) : [],
  };
};

export const chefApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDailyProductionPlan: builder.query<DailyProductionPlan, WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/production-plans/daily',
        params: query || undefined,
      }),
      transformResponse: normalizeDailyProductionPlan,
      providesTags: [workflowCacheTags.productionPlans],
    }),
    sendDailyProductionPlanToKitchen: builder.mutation<DailyProductionPlan, SendDailyProductionPlanRequest>({
      query: (body) => ({
        url: '/production-plans/daily/send-to-kitchen',
        method: 'POST',
        body,
      }),
      transformResponse: normalizeDailyProductionPlan,
      invalidatesTags: [
        workflowCacheTags.productionPlans,
        workflowCacheTags.documents,
        workflowCacheTags.kitchenIssues,
      ],
    }),
    openServiceRun: builder.mutation<ServiceRunLifecycleProjectionDto, OpenServiceRunRequest>({
      query: (body) => ({ url: '/service-runs', method: 'POST', body }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    getServiceRunByPlan: builder.query<ServiceRunLifecycleProjectionDto | null, ServiceRunByPlanQuery>({
      query: (params) => ({ url: '/service-runs/by-plan', params }),
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto | null>) => response.data ?? null,
      providesTags: [workflowCacheTags.productionPlans],
    }),
    getServiceRunPage: builder.query<ServiceRunPageResponseDto, ServiceRunPageQuery>({
      query: (params) => ({ url: '/service-runs/page', params }),
      transformResponse: (response: ApiResponse<ServiceRunPageResponseDto>) => response.data!,
      providesTags: [workflowCacheTags.productionPlans],
    }),
    startServiceRun: builder.mutation<ServiceRunLifecycleProjectionDto, string>({
      query: (id) => ({ url: `/service-runs/${id}/start`, method: 'POST' }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    recordServiceRunActualServings: builder.mutation<ServiceRunLifecycleProjectionDto, { id: string; body: RecordActualServingsRequest }>({
      query: ({ id, body }) => ({ url: `/service-runs/${id}/actual-servings`, method: 'POST', body }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    confirmServiceRun: builder.mutation<ServiceRunLifecycleProjectionDto, string>({
      query: (id) => ({ url: `/service-runs/${id}/service-confirmation`, method: 'POST' }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    resolveServiceRunVariance: builder.mutation<ServiceRunLifecycleProjectionDto, { id: string; body: ReasonRequest }>({
      query: ({ id, body }) => ({ url: `/service-runs/${id}/variance/resolve`, method: 'POST', body }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    resolveServiceRunServingVariance: builder.mutation<ServiceRunLifecycleProjectionDto, { id: string; body: ReasonRequest }>({
      query: ({ id, body }) => ({ url: `/service-runs/${id}/serving-variance/resolve`, method: 'POST', body }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    waiveServiceRunConfirmation: builder.mutation<ServiceRunLifecycleProjectionDto, { id: string; body: ReasonRequest }>({
      query: ({ id, body }) => ({ url: `/service-runs/${id}/service-confirmation/waive`, method: 'POST', body }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    closeServiceRun: builder.mutation<ServiceRunLifecycleProjectionDto, string>({
      query: (id) => ({ url: `/service-runs/${id}/close`, method: 'POST' }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    declareServiceRunVariance: builder.mutation<ServiceRunLifecycleProjectionDto, { id: string; body: DeclareServiceRunVarianceRequest }>({
      query: ({ id, body }) => ({ url: `/service-runs/${id}/variance/declarations`, method: 'POST', body }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    approveServiceRunVarianceWaiver: builder.mutation<ServiceRunLifecycleProjectionDto, { id: string; declarationId: string; body: ApproveServiceRunVarianceWaiverRequest }>({
      query: ({ id, declarationId, body }) => ({ url: `/service-runs/${id}/variance/declarations/${declarationId}/waive`, method: 'POST', body }),
      invalidatesTags: [workflowCacheTags.productionPlans],
      transformResponse: (response: ApiResponse<ServiceRunLifecycleProjectionDto>) => response.data!,
    }),
    getServiceRunAdjustments: builder.query<ServiceRunAdjustmentDto[], string>({
      query: (id) => ({ url: `/service-runs/${id}/adjustments` }),
      transformResponse: (response: ApiResponse<ServiceRunAdjustmentDto[]>) => response.data ?? [],
      providesTags: [workflowCacheTags.productionPlans],
    }),
    createServiceRunAdjustment: builder.mutation<ServiceRunAdjustmentDto, { id: string; body: CreateServiceRunAdjustmentRequest }>({
      query: ({ id, body }) => ({ url: `/service-runs/${id}/adjustments`, method: 'POST', body }),
      transformResponse: (response: ApiResponse<ServiceRunAdjustmentDto>) => response.data!,
      invalidatesTags: [workflowCacheTags.productionPlans],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDailyProductionPlanQuery,
  useSendDailyProductionPlanToKitchenMutation,
  useOpenServiceRunMutation,
  useGetServiceRunByPlanQuery,
  useGetServiceRunPageQuery,
  useStartServiceRunMutation,
  useRecordServiceRunActualServingsMutation,
  useConfirmServiceRunMutation,
  useResolveServiceRunVarianceMutation,
  useResolveServiceRunServingVarianceMutation,
  useWaiveServiceRunConfirmationMutation,
  useCloseServiceRunMutation,
  useDeclareServiceRunVarianceMutation,
  useApproveServiceRunVarianceWaiverMutation,
  useGetServiceRunAdjustmentsQuery,
  useCreateServiceRunAdjustmentMutation,
} = chefApi;
