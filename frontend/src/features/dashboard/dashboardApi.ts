import { apiSlice } from '@/api/apiSlice';
import type {
  OperationalKpiSummaryDto,
} from '@/api/workflowApi';
import type { ApiResponse } from '@/types/api';
import { workflowCacheTags, workflowOperationalKpiSourceTags } from '@/api/workflowCacheTags';

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOperationalKpis: builder.query<OperationalKpiSummaryDto, void>({
      query: () => '/workflow-reports/operational-kpis',
      transformResponse: (response: ApiResponse<OperationalKpiSummaryDto>) => response.data!,
      providesTags: [
        'Coordination',
        'PurchaseOrders',
        workflowCacheTags.operationalKpis,
        ...workflowOperationalKpiSourceTags,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetOperationalKpisQuery,
} = dashboardApi;
