import { apiSlice } from '@/api/apiSlice'
import type { components } from '@/shared/api/contracts/schema'
import type { ApiResponse } from '@/types/api'

export interface ReconciliationDisposition { category: string; reason: string; version: number; disposedAt: string }
export type ReconciliationDispositionCategory = components['schemas']['ReconciliationDispositionCategoryDto']
export interface ReconciliationLine { batchLineId: string; ingredientId: string; ingredientCode?: string | null; ingredientName?: string | null; canonicalUnitId: string; canonicalUnitName?: string | null; requiredQuantity: number; frozenTolerance: number; purchasedQuantity?: number | null; purchasedVersion?: number | null; issuedQuantity?: number | null; issuedVersion?: number | null; purchasedRequiredDifference?: number | null; issuedRequiredDifference?: number | null; purchasedIssuedDifference?: number | null; triggers: string[]; status: 'MATCHED'|'NEEDS_REVIEW'|'INCOMPLETE'; version: number; disposition?: ReconciliationDisposition | null }
export interface ReconciliationBatch { batchId: string; menuVersionId: string; quantityImportBatchId: string; status: 'DRAFT'|'READY'|'TRANSFERRED'|'IN_PROGRESS'|'COMPLETED'; version: number; createdAt: string; readyAt?: string|null; completedAt?: string|null; lines: ReconciliationLine[] }
export type ReconciliationWarehouseTransfer = components['schemas']['ReconciliationWarehouseTransferDto']
export type CreateReconciliationIssueRequest = components['schemas']['CreateInventoryIssueRequest']
export type ReconciliationIssueCreated = components['schemas']['InventoryIssueCreatedDto']
export interface ReconciliationIssueHistoryItem { issueId: string; issueCode: string; status: string; issueDate: string; lines?: readonly unknown[] }
export interface ReconciliationIssueHistoryPage { items: ReconciliationIssueHistoryItem[]; totalCount: number }
export interface ReconciliationDraftSource { menuVersionId: string; menuLabel: string; quantityImportBatchId: string; importBatchLabel: string }
export interface CreateReconciliationDraftRequest { menuVersionId: string; quantityImportBatchId: string }
export type QuantityImportPreview = components['schemas']['QuantityImportPreviewDto']
export type QuantityImportCommit = components['schemas']['QuantityImportCommitDto']
export type PreviewQuantityImportRequest = components['schemas']['PreviewQuantityImportRequest']
export type CommitQuantityImportRequest = components['schemas']['CommitQuantityImportRequest']

export const reconciliationApi = apiSlice.injectEndpoints({ endpoints: builder => ({
  listReconciliationBatches: builder.query<ReconciliationBatch[], void>({ query: () => '/reconciliation/batches', transformResponse: (r: ApiResponse<ReconciliationBatch[]>) => r.data ?? [], providesTags: ['ReconciliationBatches'] }),
  listReconciliationDraftSources: builder.query<ReconciliationDraftSource[], void>({ query: () => '/reconciliation/batches/draft-sources', transformResponse: (r: ApiResponse<ReconciliationDraftSource[]>) => r.data ?? [], providesTags: ['ReconciliationBatches'] }),
  previewReconciliationQuantityImport: builder.mutation<QuantityImportPreview, PreviewQuantityImportRequest>({ query: body => ({ url: '/reconciliation/batches/quantity-import/preview', method: 'POST', body }), transformResponse: (r: ApiResponse<QuantityImportPreview>) => r.data! }),
  commitReconciliationQuantityImport: builder.mutation<QuantityImportCommit, CommitQuantityImportRequest>({ query: body => ({ url: '/reconciliation/batches/quantity-import/commit', method: 'POST', body }), transformResponse: (r: ApiResponse<QuantityImportCommit>) => r.data!, invalidatesTags: ['ReconciliationBatches'] }),
  listReconciliationDispositionCategories: builder.query<ReconciliationDispositionCategory[], void>({ query: () => '/reconciliation/lines/disposition-categories', transformResponse: (r: ApiResponse<ReconciliationDispositionCategory[]>) => r.data ?? [] }),
  getReconciliationBatch: builder.query<ReconciliationBatch, string>({ query: id => `/reconciliation/batches/${id}`, transformResponse: (r: ApiResponse<ReconciliationBatch>) => r.data!, providesTags: (_result, _error, id) => [{ type: 'ReconciliationBatches', id }] }),
  createReconciliationDraft: builder.mutation<ReconciliationBatch, CreateReconciliationDraftRequest>({ query: body => ({ url: '/reconciliation/batches', method: 'POST', body }), transformResponse: (r: ApiResponse<ReconciliationBatch>) => r.data!, invalidatesTags: ['ReconciliationBatches'] }),
  readyReconciliationBatch: builder.mutation<ReconciliationBatch,{id:string;expectedVersion:number}>({ query:({id,...body})=>({url:`/reconciliation/batches/${id}/ready`,method:'POST',body}), transformResponse: (r: ApiResponse<ReconciliationBatch>) => r.data!, invalidatesTags:['ReconciliationBatches'] }),
  transferReconciliationBatch: builder.mutation<ReconciliationWarehouseTransfer,{id:string;expectedVersion:number}>({ query:({id,...body})=>({url:`/reconciliation/batches/${id}/transfer-to-warehouse`,method:'POST',body}), transformResponse: (r: ApiResponse<ReconciliationWarehouseTransfer>) => r.data!, invalidatesTags: (_result, _error, { id }) => ['ReconciliationBatches', { type: 'ReconciliationBatches', id }] }),
  listReconciliationIssueHistory: builder.query<ReconciliationIssueHistoryPage, string>({ query: batchId => ({ url: '/inventory-issues', params: { sourceFamily: 'MATERIAL_RECONCILIATION', reconciliationBatchId: batchId, pageNumber: 1, pageSize: 20 } }), transformResponse: (r: ApiResponse<ReconciliationIssueHistoryPage>) => r.data ?? { items: [], totalCount: 0 }, providesTags: (_result, _error, batchId) => [{ type: 'ReconciliationIssueHistory', id: batchId }] }),
  createReconciliationIssue: builder.mutation<ReconciliationIssueCreated, CreateReconciliationIssueRequest>({ query: body => ({ url: '/inventory-issues', method: 'POST', body }), transformResponse: (r: ApiResponse<ReconciliationIssueCreated>) => r.data!, invalidatesTags: (_result, _error, body) => [{ type: 'ReconciliationBatches', id: body.reconciliationBatchId! }, { type: 'ReconciliationIssueHistory', id: body.reconciliationBatchId! }] }),
  completeReconciliationBatch: builder.mutation<ReconciliationBatch,{id:string;expectedVersion:number}>({ query:({id,...body})=>({url:`/reconciliation/batches/${id}/complete`,method:'POST',body}), transformResponse: (r: ApiResponse<ReconciliationBatch>) => r.data!, invalidatesTags:['ReconciliationBatches'] }),
  setReconciliationActual: builder.mutation<void,{lineId:string;side:'purchased'|'issued';quantity:number;expectedVersion?:number;confirmZero:boolean;correctionReason?:string}>({query:({lineId,side,...body})=>({url:`/reconciliation/lines/${lineId}/${side}`,method:'PUT',body}),invalidatesTags:['ReconciliationBatches']}),
  setReconciliationDisposition: builder.mutation<void,{lineId:string;category:string;reason:string;expectedVersion?:number}>({query:({lineId,...body})=>({url:`/reconciliation/lines/${lineId}/disposition`,method:'PUT',body}),invalidatesTags:['ReconciliationBatches']}),
})})

export const {
  useListReconciliationBatchesQuery,
  useListReconciliationDraftSourcesQuery,
  useListReconciliationDispositionCategoriesQuery,
  useCreateReconciliationDraftMutation,
  usePreviewReconciliationQuantityImportMutation,
  useCommitReconciliationQuantityImportMutation,
  useReadyReconciliationBatchMutation,
  useTransferReconciliationBatchMutation,
  useListReconciliationIssueHistoryQuery,
  useCreateReconciliationIssueMutation,
  useCompleteReconciliationBatchMutation,
  useGetReconciliationBatchQuery,
  useSetReconciliationActualMutation,
  useSetReconciliationDispositionMutation,
} = reconciliationApi
