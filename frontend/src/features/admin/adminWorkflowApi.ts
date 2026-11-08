import { apiSlice } from '@/api/apiSlice';
import type { ApiResponse } from '@/types/api';
import type {
  ApprovalRuleDto,
  ApprovalRuleRequestDto,
  UpdateApprovalRuleArgs,
} from '@/api/workflowApiTypes';
import { workflowCacheTags } from '@/api/workflowCacheTags';

export const adminWorkflowApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getApprovalRules: builder.query<ApiResponse<ApprovalRuleDto[]>, void>({
      query: () => '/approval-rules',
      providesTags: [workflowCacheTags.approvalRules],
    }),
    createApprovalRule: builder.mutation<ApiResponse<ApprovalRuleDto>, ApprovalRuleRequestDto>({
      query: (body) => ({
        url: '/approval-rules',
        method: 'POST',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
    updateApprovalRule: builder.mutation<ApiResponse<ApprovalRuleDto>, UpdateApprovalRuleArgs>({
      query: ({ id, body }) => ({
        url: `/approval-rules/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
    deleteApprovalRule: builder.mutation<ApiResponse<void>, string>({
      query: (id) => ({
        url: `/approval-rules/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        workflowCacheTags.approvalRules,
        workflowCacheTags.approvalInbox,
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetApprovalRulesQuery,
  useCreateApprovalRuleMutation,
  useUpdateApprovalRuleMutation,
  useDeleteApprovalRuleMutation,
} = adminWorkflowApi;
