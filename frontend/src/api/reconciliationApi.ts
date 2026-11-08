import { apiSlice } from '@/api/apiSlice'
import type { components } from '@/shared/api/contracts/schema'
import type { ApiResponse } from '@/types/api'

export interface ReconciliationDisposition { category: string; reason: string; version: number; disposedAt: string }
export type ReconciliationDispositionCategory = components['schemas']['ReconciliationDispositionCategoryDto']
export interface ReconciliationLine { batchLineId: string; ingredientId: string; ingredientCode?: string | null; ingredientName?: string | null; canonicalUnitId: string; canonicalUnitName?: string | null; requiredQuantity: number; frozenTolerance: number; purchasedQuantity?: number | null; purchasedVersion?: number | null; issuedQuantity?: number | null; issuedVersion?: number | null; purchasedRequiredDifference?: number | null; issuedRequiredDifference?: number | null; purchasedIssuedDifference?: number | null; triggers: string[]; status: 'MATCHED'|'NEEDS_REVIEW'|'INCOMPLETE'; version: number; disposition?: ReconciliationDisposition | null; issueNotes?: string[] | null }
export interface ReconciliationBatch {
  batchId: string
  menuVersionId: string
  quantityImportBatchId: string
  status: 'DRAFT'|'READY'|'TRANSFERRED'|'IN_PROGRESS'|'COMPLETED'
  version: number
  createdAt: string
  readyAt?: string|null
  completedAt?: string|null
  lines: ReconciliationLine[]
  customerId?: string | null
  customerName?: string | null
  customerCode?: string | null
  weekStartDate?: string | null
  weekEndDate?: string | null
}
export type ReconciliationWarehouseTransfer = components['schemas']['ReconciliationWarehouseTransferDto']
export interface ReconciliationWarehouseDailyLine { dailyLineId: string; batchLineId: string; ingredientId: string; ingredientCode?: string | null; ingredientName?: string | null; canonicalUnitId: string; canonicalUnitName?: string | null; requiredQuantity: number; issuedQuantity?: number | null; returnedQuantity: number; remainingQuantity: number; quantityStatus: 'UNTOUCHED'|'UNDER_ISSUED'|'EXACT'|'OVER_ISSUED'; hasValidDisposition: boolean }
export interface ReconciliationWarehouseDay { serviceDate: string; status: 'NO_REQUIREMENT'|'UNTOUCHED'|'PARTIAL'|'OVERAGE_REQUIRES_RESOLUTION'|'COMPLETE'; isApplicable: boolean; requiredQuantity: number; issuedQuantity: number; returnedQuantity: number; remainingQuantity: number; lines: ReconciliationWarehouseDailyLine[] }
export interface ReconciliationWarehouseDaily { batchId: string; batchStatus: ReconciliationBatch['status']; sourceVersion: number; weeklyStatus: 'WEEK_UNTOUCHED'|'IN_PROGRESS'|'VARIANCE_REQUIRES_RESOLUTION'|'WEEK_COMPLETE'|'LEGACY_INCOMPATIBLE'; compatibility: { canRead: boolean; canIssueByDate: boolean; reasonCode?: string | null }; dates: ReconciliationWarehouseDay[] }
export interface ReconciliationKitchenCookingRow { serviceDate: string; weekday: string; shiftName: string; dishCode: string; dishName: string; servings: number; ingredientCode: string; ingredientName: string; unitName: string; bomQuantityPerServing: number; wasteRatePercent?: number | null; totalRequiredQuantity: number }
export interface ReconciliationKitchenCookingExport { batchId: string; sourceVersion: number; rows: ReconciliationKitchenCookingRow[] }
export type CreateReconciliationIssueRequest = components['schemas']['CreateInventoryIssueRequest']
export type ReconciliationIssueCreated = components['schemas']['InventoryIssueCreatedDto']
export type ReconciliationIssueHistoryLine = components['schemas']['InventoryIssueLineDto']
export interface ReconciliationIssueHistoryItem { issueId: string; issueCode: string; sourceFamily: string; reconciliationBatchId?: string | null; issueDate: string; createdAt: string; receivedAt?: string | null; receivedBy?: string | null; receivedByName?: string | null; issuedBy: string; issuedByName?: string | null; warehouseId: string; warehouseName?: string | null; lines: readonly ReconciliationIssueHistoryLine[] }
export interface ReconciliationIssueHistoryPage { items: ReconciliationIssueHistoryItem[]; totalCount: number }
export interface ReconciliationDraftSource { menuVersionId: string; menuLabel: string; quantityImportBatchId: string; importBatchLabel: string }
export interface ReconciliationSourceChange { changeId: string; changedAt: string; actor: string; businessArea: string; entityName: string; entityId?: string | null; fieldName?: string | null; oldValue?: string | null; newValue?: string | null; reason?: string | null }
export interface CreateReconciliationDraftRequest { menuVersionId: string; quantityImportBatchId: string }
export type QuantityImportPreview = components['schemas']['QuantityImportPreviewDto']
export type QuantityImportCommit = components['schemas']['QuantityImportCommitDto']
export type PreviewQuantityImportRequest = components['schemas']['PreviewQuantityImportRequest']
export type CommitQuantityImportRequest = components['schemas']['CommitQuantityImportRequest']

export interface ReconciliationBatchDishMaterial {
  batchLineId: string
  ingredientId: string
  ingredientCode?: string | null
  ingredientName?: string | null
  canonicalUnitId: string
  canonicalUnitName?: string | null
  dailyLineId?: string
  serviceDate?: string
  grossQtyPerServing: number
}

export interface ReconciliationBatchDishScope { serviceDate: string; shiftName: string; frozenServings: number; currentServings: number; additionalServings: number }
export interface ReconciliationBatchDishSummary {
  dishId: string
  dishCode: string
  dishName: string
  materials: ReconciliationBatchDishMaterial[]
  scopes?: ReconciliationBatchDishScope[] | null
}

export const reconciliationOwnedQueryEndpointNames = new Set([
  'getReconciliationWeeklyMenu',
  'listReconciliationBatches',
  'listReconciliationDraftSources',
  'listReconciliationDispositionCategories',
  'getReconciliationBatch',
  'listReconciliationIssueHistory',
  'getReconciliationIssue',
  'listReconciliationSourceChanges',
  'listReconciliationBatchDishes',
  'getReconciliationWarehouseDaily',
  'getReconciliationKitchenCooking',
  'getReconciliationKitchenCookingCsv',
])

export const reconciliationOwnedMutationEndpointNames = new Set([
  'initializeReconciliationTolerance',
  'previewReconciliationQuantityImport',
  'commitReconciliationQuantityImport',
  'createReconciliationDraft',
  'readyReconciliationBatch',
  'transferReconciliationBatch',
  'createReconciliationIssue',
  'completeReconciliationBatch',
  'setReconciliationDisposition',
])

type ApiStateBucket = {
  queries?: Record<string, { endpointName?: string; originalArgs?: unknown }>
  mutations?: Record<string, { endpointName?: string; requestId?: string; fixedCacheKey?: string }>
}

type RunningRequest = {
  endpointName?: string
  abort?: () => void
}

export const clearReconciliationApiResidue = (dispatch: (action: unknown) => unknown, state: unknown) => {
  const apiState = (state as Record<string, ApiStateBucket | undefined>)[apiSlice.reducerPath]
  if (!apiState) return

  for (const query of Object.values(apiState.queries ?? {})) {
    if (!query.endpointName || !reconciliationOwnedQueryEndpointNames.has(query.endpointName)) continue
    const runningQuery = dispatch(apiSlice.util.getRunningQueryThunk(query.endpointName as never, query.originalArgs as never)) as RunningRequest | undefined
    runningQuery?.abort?.()
  }

  for (const mutation of Object.values(apiState.mutations ?? {})) {
    if (!mutation.requestId || !mutation.endpointName || !reconciliationOwnedMutationEndpointNames.has(mutation.endpointName)) {
      continue
    }
    const runningMutation = dispatch(
      apiSlice.util.getRunningMutationThunk(mutation.endpointName as never, (mutation.fixedCacheKey ?? mutation.requestId) as never),
    ) as RunningRequest | undefined
    runningMutation?.abort?.()
  }

  const internalActions = (apiSlice as typeof apiSlice & {
    internalActions: {
      removeQueryResult: (payload: { queryCacheKey: string }) => unknown
      removeMutationResult: (payload: { requestId: string; fixedCacheKey?: string }) => unknown
    }
  }).internalActions

  for (const [queryCacheKey, query] of Object.entries(apiState.queries ?? {})) {
    if (query.endpointName && reconciliationOwnedQueryEndpointNames.has(query.endpointName)) {
      dispatch(internalActions.removeQueryResult({ queryCacheKey }))
    }
  }

  for (const mutation of Object.values(apiState.mutations ?? {})) {
    if (!mutation.requestId || !mutation.endpointName || !reconciliationOwnedMutationEndpointNames.has(mutation.endpointName)) {
      continue
    }
    dispatch(internalActions.removeMutationResult({ requestId: mutation.requestId, fixedCacheKey: mutation.fixedCacheKey }))
  }
}

export const reconciliationApi = apiSlice.injectEndpoints({ endpoints: builder => ({
  initializeReconciliationTolerance: builder.mutation<void, void>({ query: () => ({ url: '/reconciliation/configuration/system-default/initialize', method: 'POST' }) }),
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
  getReconciliationIssue: builder.query<ReconciliationIssueHistoryItem, string>({ query: issueId => ({ url: `/inventory-issues/${issueId}`, params: { sourceFamily: 'MATERIAL_RECONCILIATION' } }), transformResponse: (r: ApiResponse<ReconciliationIssueHistoryItem>) => r.data!, providesTags: (_result, _error, issueId) => [{ type: 'ReconciliationIssueHistory', id: issueId }] }),
  listReconciliationSourceChanges: builder.query<ReconciliationSourceChange[], string>({ query: batchId => `/reconciliation/batches/${batchId}/source-changes`, transformResponse: (r: ApiResponse<ReconciliationSourceChange[]>) => r.data ?? [], providesTags: (_result, _error, batchId) => [{ type: 'ReconciliationBatches', id: batchId }] }),
  listReconciliationBatchDishes: builder.query<ReconciliationBatchDishSummary[], string>({ query: id => `/reconciliation/batches/${id}/dishes`, transformResponse: (r: ApiResponse<ReconciliationBatchDishSummary[]>) => r.data ?? [], providesTags: (_result, _error, id) => [{ type: 'ReconciliationBatches', id: `${id}-dishes` }] }),
  getReconciliationWarehouseDaily: builder.query<ReconciliationWarehouseDaily, string>({ query: id => `/reconciliation/batches/${id}/warehouse-daily`, transformResponse: (r: ApiResponse<ReconciliationWarehouseDaily>) => r.data!, providesTags: (_result, _error, id) => [{ type: 'ReconciliationBatches', id }] }),
  getReconciliationKitchenCooking: builder.query<ReconciliationKitchenCookingExport, string>({ query: id => `/reconciliation/batches/${id}/kitchen-cooking`, transformResponse: (r: ApiResponse<ReconciliationKitchenCookingExport>) => r.data!, providesTags: (_result, _error, id) => [{ type: 'ReconciliationBatches', id: `${id}-kitchen-cooking` }] }),
  getReconciliationKitchenCookingCsv: builder.query<Blob, string>({ query: id => ({ url: `/reconciliation/batches/${id}/kitchen-cooking/csv`, responseHandler: response => response.blob() }) }),
  getReconciliationKitchenCookingXlsx: builder.query<Blob, string>({ query: id => ({ url: `/reconciliation/batches/${id}/kitchen-cooking/xlsx`, responseHandler: response => response.blob() }) }),
  createReconciliationIssue: builder.mutation<ReconciliationIssueCreated, CreateReconciliationIssueRequest>({ query: body => ({ url: '/inventory-issues', method: 'POST', body }), transformResponse: (r: ApiResponse<ReconciliationIssueCreated>) => r.data!, invalidatesTags: (_result, _error, body) => ['ReconciliationBatches', { type: 'ReconciliationBatches', id: body.reconciliationBatchId! }, { type: 'ReconciliationIssueHistory', id: body.reconciliationBatchId! }] }),
  completeReconciliationBatch: builder.mutation<ReconciliationBatch,{id:string;expectedVersion:number}>({ query:({id,...body})=>({url:`/reconciliation/batches/${id}/complete`,method:'POST',body}), transformResponse: (r: ApiResponse<ReconciliationBatch>) => r.data!, invalidatesTags:['ReconciliationBatches'] }),
  setReconciliationDisposition: builder.mutation<void,{lineId:string;category:string;reason:string;expectedVersion?:number}>({query:({lineId,...body})=>({url:`/reconciliation/lines/${lineId}/disposition`,method:'PUT',body}),invalidatesTags:['ReconciliationBatches']}),
})})

export const {
  useInitializeReconciliationToleranceMutation,
  useListReconciliationBatchesQuery,
  useListReconciliationDraftSourcesQuery,
  useListReconciliationDispositionCategoriesQuery,
  useCreateReconciliationDraftMutation,
  usePreviewReconciliationQuantityImportMutation,
  useCommitReconciliationQuantityImportMutation,
  useReadyReconciliationBatchMutation,
  useTransferReconciliationBatchMutation,
  useListReconciliationIssueHistoryQuery,
  useGetReconciliationIssueQuery,
  useListReconciliationSourceChangesQuery,
  useListReconciliationBatchDishesQuery,
  useGetReconciliationWarehouseDailyQuery,
  useGetReconciliationKitchenCookingQuery,
  useLazyGetReconciliationKitchenCookingCsvQuery,
  useLazyGetReconciliationKitchenCookingXlsxQuery,
  useCreateReconciliationIssueMutation,
  useCompleteReconciliationBatchMutation,
  useGetReconciliationBatchQuery,
  useSetReconciliationDispositionMutation,
} = reconciliationApi
