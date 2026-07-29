import { apiSlice } from '@/api/apiSlice';
import type {
  ProductionPlan,
  DailyProductionPlan,
  SendDailyProductionPlanRequest,
  ProductionPlanDto,
  DailyProductionPlanDto,
  WorkflowReportQuery,
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
  }),
  overrideExisting: false,
});

export const {
  useGetDailyProductionPlanQuery,
  useSendDailyProductionPlanToKitchenMutation,
} = chefApi;
