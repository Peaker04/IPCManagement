import { apiSlice } from '@/api/apiSlice';
import type {
  ApprovalInboxQuery,
  ApprovalInboxPage,
  ApprovalHistoryItem,
  ApprovalDecisionRequest,
  ApprovalHistoryQuery,
  ApprovalInboxPageDto,
  ApprovalInboxItemDto,
} from '@/api/workflowApiTypes';
import type { ApprovalRecord, WorkflowTone } from '@/types/workflow';
import type { ApiResponse } from '@/types/api';
import { workflowCacheTags } from '@/api/workflowCacheTags';
import { toneFromStatus } from '@/lib/workflowConfig';

const getData = <T>(response: ApiResponse<T>): T => response.data as T;
const normalizeWorkflowTone = (tone: string, status: string): WorkflowTone =>
  tone === 'success' || tone === 'warning' || tone === 'danger' || tone === 'neutral'
    ? tone
    : toneFromStatus(status);

const mapApprovalInboxItem = (item: ApprovalInboxItemDto): ApprovalRecord => ({
  id: item.inboxItemId || item.targetCode || item.targetId,
  targetType: item.targetType,
  targetId: item.targetId,
  targetCode: item.targetCode,
  type: item.itemType === 'price-alert' || item.itemType === 'price-exception' ? 'price-alert' : item.itemType === 'adjustment' ? 'adjustment' : item.itemType === 'issue' ? 'issue' : 'purchase',
  title: item.title,
  source: item.source || item.targetCode,
  owner: item.ownerRole,
  submittedBy: item.submittedBy,
  deadline: item.dueDate ? new Date(item.dueDate).toLocaleDateString('vi-VN') : 'Trong ca',
  status: item.status,
  reason: item.reason,
  nextAction: item.nextAction,
  tone: normalizeWorkflowTone(item.tone, item.status),
  slaDeadline: item.slaDeadline ?? undefined,
  slaHours: item.slaHours,
  route: item.route,
  weekStartDate: item.weekStartDate ?? undefined,
  serviceDate: item.serviceDate ?? undefined,
  scope: item.scope ?? undefined,
  lineCount: item.lineCount,
  totalQuantity: item.totalQuantity,
  totalValue: item.totalValue,
  submittedAt: item.submittedAt ?? undefined,
  referencePrice: item.referencePrice,
  proposedPrice: item.proposedPrice,
  variancePercent: item.variancePercent,
  evidenceType: item.evidenceType ?? undefined,
  evidenceId: item.evidenceId ?? undefined,
  evidenceDate: item.evidenceDate ?? undefined,
  proposalFingerprint: item.proposalFingerprint ?? undefined,
  proposalVersion: item.proposalVersion,
  supplierName: item.supplierName ?? undefined,
  sourceDocumentCode: item.sourceDocumentCode ?? undefined,
  materials: (item.materials ?? []).map((material) => ({ ...material })),
});

export const approvalsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getApprovalRecords: builder.query<ApprovalInboxPage, ApprovalInboxQuery | void>({
      query: (query) => ({
        url: '/approvals/inbox',
        params: {
          limit: query?.limit ?? 20,
          ...(query?.cursor ? { cursor: query.cursor } : {}),
          ...(query?.targetType ? { targetType: query.targetType } : {}),
          ...(query?.targetId ? { targetId: query.targetId } : {}),
          ...(query?.week ? { week: query.week } : {}),
          ...(query?.date ? { date: query.date } : {}),
          ...(query?.searchKeyword ? { searchKeyword: query.searchKeyword } : {}),
        },
      }),
      transformResponse: (response: ApiResponse<ApprovalInboxPageDto>): ApprovalInboxPage => {
        const page = getData(response);
        return {
          items: (page.items ?? []).map(mapApprovalInboxItem),
          limit: page.limit,
          hasNext: page.hasNext,
          nextCursor: page.nextCursor,
        };
      },
      providesTags: (result) => [
        workflowCacheTags.approvalInbox,
        ...(result?.items ?? []).map((item) => ({
          type: 'WorkflowReports' as const,
          id: `ApprovalTarget:${item.targetType}:${item.targetId}`,
        })),
      ],
    }),
    executeApprovalDecision: builder.mutation<ApiResponse<unknown>, ApprovalDecisionRequest>({
      query: ({ targetType, targetId, status, reason }) => ({
        url: `/approvals/${targetType}/${targetId}`,
        method: 'POST',
        body: { status, reason },
      }),
      invalidatesTags: (_result, _error, { targetType, targetId, week }) => [
        workflowCacheTags.approvalInbox,
        workflowCacheTags.documents,
        workflowCacheTags.operationalKpis,
        workflowCacheTags.purchaseRequests,
        { type: 'WorkflowReports', id: `ApprovalTarget:${targetType}:${targetId}` },
        ...(week
          ? [{ type: 'WorkflowReports' as const, id: `PurchaseWorkbench:${week}` }]
          : []),
      ],
    }),
    getApprovalHistory: builder.query<ApiResponse<ApprovalHistoryItem[]>, ApprovalHistoryQuery>({
      query: ({ documentType, documentId }) => `/approval-history/${documentType}/${documentId}`,
      providesTags: [workflowCacheTags.approvalHistory],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetApprovalRecordsQuery,
  useExecuteApprovalDecisionMutation,
  useGetApprovalHistoryQuery,
} = approvalsApi;
