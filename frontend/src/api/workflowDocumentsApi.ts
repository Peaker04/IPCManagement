import { apiSlice } from '@/api/apiSlice';
import type {
  WorkflowReportQuery,
  WorkflowDocumentDto,
} from '@/api/workflowApiTypes';
import type { WorkflowDocument, WorkflowDocumentType } from '@/types/workflow';
import type { ApiResponse } from '@/types/api';
import { workflowCacheTags } from '@/api/workflowCacheTags';
import { ownerToLaneId, routeByLaneId, toneFromStatus } from '@/lib/workflowConfig';
import { formatDateOnly } from '@/lib/formatters';

const getData = <T>(response: ApiResponse<T>): T => response.data as T;

const queryWithLimit = (query?: WorkflowReportQuery) => ({
  limit: 100,
  ...query,
});

const normalizeDocumentType = (type: string): WorkflowDocumentType => {
  if (type.includes('Đề nghị')) return 'Đơn mua';
  if (type.includes('mua')) return 'Đơn mua';
  if (type.includes('nhập')) return 'Phiếu nhập';
  if (type.includes('xuất')) return 'Phiếu xuất';
  if (type.includes('hoàn')) return 'Phiếu trả';
  if (type.includes('Điều chỉnh')) return 'Điều chỉnh';
  if (type.includes('Yêu cầu')) return 'KHSX';
  return 'KHSX';
};

const mapDocument = (item: WorkflowDocumentDto): WorkflowDocument => {
  const laneId = ownerToLaneId(item.ownerLane);
  const type = normalizeDocumentType(item.documentType);
  const tone = toneFromStatus(item.status);

  return {
    id: item.documentCode || item.documentId,
    type,
    title: item.documentType,
    status: item.status,
    owner: item.ownerLane,
    summary: item.summary,
    route: item.route || routeByLaneId[laneId],
    tone,
    lines: [
      { label: 'Ngày', value: formatDateOnly(item.documentDate) },
      ...(item.shiftName ? [{ label: 'Ca', value: item.shiftName }] : []),
    ],
  };
};

export const workflowDocumentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getWorkflowDocuments: builder.query<WorkflowDocument[], WorkflowReportQuery | void>({
      query: (query) => ({
        url: '/workflow-reports/workflow-documents',
        params: queryWithLimit(query || undefined),
      }),
      transformResponse: (response: ApiResponse<WorkflowDocumentDto[]>) => getData(response).map(mapDocument),
      providesTags: [workflowCacheTags.documents],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetWorkflowDocumentsQuery,
} = workflowDocumentsApi;
