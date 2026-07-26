import { apiSlice } from '@/api/apiSlice';
import type { ApiResponse } from '@/types/api';

interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface DishCatalogBomLineDto {
  bomId: string;
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unitId: string;
  unitCode: string;
  unitName: string;
  customerId?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  priceTierAmount: number;
  bomScope: string;
  grossQtyPerServing: number;
  wasteRatePercent: number;
  bomStatus: string;
  bomStatusLabel: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  referencePrice: number;
}

export interface DishCatalogDto {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishType?: string | null;
  dishGroup?: string | null;
  isActive: boolean;
  menuSlots: string[];
  bomLines: DishCatalogBomLineDto[];
}

export interface DishDto {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishType?: string | null;
  dishGroup?: string | null;
  isActive: boolean;
}

export interface CatalogIngredient {
  bomId: string;
  ingredientId: string;
  ingredientCode: string;
  unitId: string;
  customerId?: string | null;
  customerCode?: string | null;
  priceTierAmount: number;
  bomScope: string;
  name: string;
  unit: string;
  grossQtyPerServing: number;
  wasteRatePercent: number;
  bomStatus: string;
  bomStatusLabel: string;
  referencePrice: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface CatalogDish {
  id: string;
  code: string;
  name: string;
  dishType?: string | null;
  dishGroup?: string | null;
  isActive: boolean;
  menuSlots: string[];
  ingredients: CatalogIngredient[];
}

export interface DishUpsertRequest {
  dishCode?: string;
  dishName: string;
  dishType?: string | null;
  dishGroup?: string | null;
  isActive?: boolean;
}

export interface IngredientLookup {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unitId: string;
  unitName?: string | null;
  referencePrice: number;
  isActive: boolean;
}

export interface UpsertDishBomLineRequest {
  dishId: string;
  bomId?: string;
  ingredientId: string;
  unitId?: string;
  customerId?: string | null;
  priceTierAmount?: number;
  grossQtyPerServing: number;
  wasteRatePercent: number;
  bomStatus?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  reason?: string;
}

export interface BomImportPreviewRow {
  rowNumber: number;
  dishCode: string;
  dishName: string;
  ingredientCode: string;
  ingredientName: string;
  unitCode: string;
  grossQtyPerServing: number;
  wasteRatePercent: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'valid' | 'warning' | 'error';
  action: string;
  errors: string[];
  warnings: string[];
}

export interface BomImportPreview {
  generatedAt: string;
  priceTier: number;
  customerId?: string | null;
  bomScope: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  canCommit: boolean;
  rows: BomImportPreviewRow[];
  warnings: string[];
}

export interface BomImportCommitResult extends BomImportPreview {
  createdRows: number;
  updatedRows: number;
  archivedRows: number;
  auditBatchCode: string;
}

export interface BomImportFileRequest {
  file: File;
  priceTier: number;
  customerId?: string;
  effectiveFrom?: string;
}

export function buildBomImportFormData({ file, priceTier, customerId, effectiveFrom }: BomImportFileRequest): FormData {
  const body = new FormData();
  body.append('file', file);
  body.append('priceTier', String(priceTier));
  if (customerId?.trim()) body.append('customerId', customerId.trim());
  if (effectiveFrom?.trim()) body.append('effectiveFrom', effectiveFrom.trim());
  return body;
}

const mapCatalogDish = (dish: DishCatalogDto): CatalogDish => ({
  id: dish.dishId,
  code: dish.dishCode,
  name: dish.dishName,
  dishType: dish.dishType,
  dishGroup: dish.dishGroup,
  isActive: dish.isActive,
  menuSlots: dish.menuSlots ?? [],
  ingredients: (dish.bomLines ?? []).map((line) => ({
    bomId: line.bomId,
    ingredientId: line.ingredientId,
    ingredientCode: line.ingredientCode,
    unitId: line.unitId,
    customerId: line.customerId,
    customerCode: line.customerCode,
    priceTierAmount: line.priceTierAmount,
    bomScope: line.bomScope,
    name: line.ingredientName,
    unit: line.unitName || line.unitCode,
    grossQtyPerServing: line.grossQtyPerServing,
    wasteRatePercent: line.wasteRatePercent,
    bomStatus: line.bomStatus,
    bomStatusLabel: line.bomStatusLabel,
    referencePrice: line.referencePrice,
    effectiveFrom: line.effectiveFrom,
    effectiveTo: line.effectiveTo,
  })),
});

export const dishCatalogApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDishCatalog: builder.query<CatalogDish[], void>({
      query: () => '/dishes/catalog',
      transformResponse: (response: ApiResponse<DishCatalogDto[]>) =>
        (response.data ?? [])
          .filter((dish) => dish.isActive)
          .map(mapCatalogDish),
      providesTags: ['DishCatalog'],
    }),
    getAdminDishCatalog: builder.query<CatalogDish[], void>({
      query: () => '/dishes/catalog?includeInactive=true',
      transformResponse: (response: ApiResponse<DishCatalogDto[]>) =>
        (response.data ?? []).map(mapCatalogDish),
      providesTags: ['DishCatalog'],
    }),
    createDish: builder.mutation<DishDto, DishUpsertRequest>({
      query: (body) => ({
        url: '/dishes',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<DishDto>) => response.data!,
      invalidatesTags: ['DishCatalog'],
    }),
    updateDish: builder.mutation<DishDto, { dishId: string; body: DishUpsertRequest }>({
      query: ({ dishId, body }) => ({
        url: `/dishes/${dishId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: ApiResponse<DishDto>) => response.data!,
      invalidatesTags: ['DishCatalog'],
    }),
    deactivateDish: builder.mutation<void, string>({
      query: (dishId) => ({
        url: `/dishes/${dishId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['DishCatalog'],
    }),
    getIngredients: builder.query<IngredientLookup[], void>({
      query: () => '/ingredients?pageNumber=1&pageSize=500',
      transformResponse: (response: ApiResponse<PagedResponse<IngredientLookup>>) =>
        (response.data?.items ?? []).filter((ingredient) => ingredient.isActive),
      providesTags: ['Ingredients'],
    }),
    addDishBomLine: builder.mutation<DishCatalogBomLineDto, UpsertDishBomLineRequest>({
      query: ({ dishId, ...body }) => ({
        url: `/dishes/${dishId}/bom`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<DishCatalogBomLineDto>) => response.data!,
      invalidatesTags: ['DishCatalog', 'WorkflowReports'],
    }),
    updateDishBomLine: builder.mutation<DishCatalogBomLineDto, UpsertDishBomLineRequest>({
      query: ({ dishId, bomId, ...body }) => ({
        url: `/dishes/${dishId}/bom/${bomId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: ApiResponse<DishCatalogBomLineDto>) => response.data!,
      invalidatesTags: ['DishCatalog', 'WorkflowReports'],
    }),
    closeDishBomLine: builder.mutation<void, { dishId: string; bomId: string }>({
      query: ({ dishId, bomId }) => ({
        url: `/dishes/${dishId}/bom/${bomId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['DishCatalog', 'WorkflowReports'],
    }),
    downloadBomTemplate: builder.mutation<Blob, { priceTier: number; customerId?: string; dishId?: string; templateType?: 'missing' | 'blank' | 'dish' }>({
      query: ({ priceTier, customerId, dishId, templateType }) => ({
        url: '/dishes/bom-template',
        params: { priceTier, customerId, dishId, templateType },
        responseHandler: (response) => response.blob(),
      }),
    }),
    previewBomImport: builder.mutation<BomImportPreview, BomImportFileRequest>({
      query: (request) => ({
        url: '/dishes/bom-import/preview',
        method: 'POST',
        body: buildBomImportFormData(request),
      }),
      transformResponse: (response: ApiResponse<BomImportPreview>) => response.data!,
    }),
    commitBomImport: builder.mutation<BomImportCommitResult, BomImportFileRequest>({
      query: (request) => ({
        url: '/dishes/bom-import/commit',
        method: 'POST',
        body: buildBomImportFormData(request),
      }),
      transformResponse: (response: ApiResponse<BomImportCommitResult>) => response.data!,
      invalidatesTags: ['DishCatalog', 'WorkflowReports'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDishCatalogQuery,
  useGetAdminDishCatalogQuery,
  useCreateDishMutation,
  useUpdateDishMutation,
  useDeactivateDishMutation,
  useGetIngredientsQuery,
  useAddDishBomLineMutation,
  useUpdateDishBomLineMutation,
  useCloseDishBomLineMutation,
  useDownloadBomTemplateMutation,
  usePreviewBomImportMutation,
  useCommitBomImportMutation,
  useGetDishCatalogQuery: useGetDishesCatalogQuery,
} = dishCatalogApi;
