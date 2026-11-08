import { apiSlice } from '@/api/apiSlice';
import { workflowCacheTags } from '@/api/workflowCacheTags';
import type { components } from '@/shared/api/contracts/schema';
import type { ApiResponse } from '@/types/api';

type IngredientPage = components['schemas']['IngredientDtoPagedResponseDto'];
export type DishCatalogBomLineDto = components['schemas']['DishCatalogBomLineDto'];
export type DishCatalogDto = components['schemas']['DishCatalogDto'];
export type DishDto = components['schemas']['DishDto'];

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

export type CreateDishRequest = components['schemas']['CreateDishRequest'];
export type UpdateDishRequest = components['schemas']['UpdateDishRequest'];
export type IngredientLookup = components['schemas']['IngredientDto'];
export type CreateDishBomLineRequest = components['schemas']['CreateDishBomLineRequest'];
export type UpdateDishBomLineRequest = components['schemas']['UpdateDishBomLineRequest'];
export type BomImportPreviewRow = components['schemas']['BomImportPreviewRowDto'];
export type BomImportPreview = components['schemas']['BomImportPreviewDto'];
export type BomImportCommitResult = components['schemas']['BomImportCommitResultDto'];

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
  id: dish.dishId ?? '',
  code: dish.dishCode ?? '',
  name: dish.dishName ?? '',
  dishType: dish.dishType,
  dishGroup: dish.dishGroup,
  isActive: dish.isActive ?? false,
  menuSlots: [...(dish.menuSlots ?? [])],
  ingredients: (dish.bomLines ?? []).map((line) => ({
    bomId: line.bomId ?? '',
    ingredientId: line.ingredientId ?? '',
    ingredientCode: line.ingredientCode ?? '',
    unitId: line.unitId ?? '',
    customerId: line.customerId,
    customerCode: line.customerCode,
    priceTierAmount: line.priceTierAmount ?? 0,
    bomScope: line.bomScope ?? '',
    name: line.ingredientName ?? '',
    unit: line.unitName || line.unitCode || '',
    grossQtyPerServing: line.grossQtyPerServing ?? 0,
    wasteRatePercent: line.wasteRatePercent ?? 0,
    bomStatus: line.bomStatus ?? '',
    bomStatusLabel: line.bomStatusLabel ?? '',
    referencePrice: line.referencePrice ?? 0,
    effectiveFrom: line.effectiveFrom ?? '',
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
    createDish: builder.mutation<DishDto, CreateDishRequest>({
      query: (body) => ({
        url: '/dishes',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<DishDto>) => response.data!,
      invalidatesTags: ['DishCatalog'],
    }),
    updateDish: builder.mutation<DishDto, { dishId: string; body: UpdateDishRequest }>({
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
    getIngredients: builder.query<IngredientLookup[], { searchKeyword?: string } | void>({
      query: (args) => ({
        url: '/ingredients',
        params: {
          pageNumber: 1,
          pageSize: 100,
          ...(args?.searchKeyword ? { searchKeyword: args.searchKeyword } : {}),
        },
      }),
      transformResponse: (response: ApiResponse<IngredientPage>) =>
        (response.data?.items ?? []).filter((ingredient) => ingredient.isActive),
      providesTags: ['Ingredients'],
    }),
    addDishBomLine: builder.mutation<DishCatalogBomLineDto, { dishId: string } & CreateDishBomLineRequest>({
      query: ({ dishId, ...body }) => ({
        url: `/dishes/${dishId}/bom`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<DishCatalogBomLineDto>) => response.data!,
      invalidatesTags: [
        'DishCatalog',
        'MaterialDemandStaleness',
        workflowCacheTags.dataQuality,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.purchasePlan,
      ],
    }),
    updateDishBomLine: builder.mutation<DishCatalogBomLineDto, { dishId: string; bomId: string } & UpdateDishBomLineRequest>({
      query: ({ dishId, bomId, ...body }) => ({
        url: `/dishes/${dishId}/bom/${bomId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: ApiResponse<DishCatalogBomLineDto>) => response.data!,
      invalidatesTags: [
        'DishCatalog',
        'MaterialDemandStaleness',
        workflowCacheTags.dataQuality,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.purchasePlan,
      ],
    }),
    closeDishBomLine: builder.mutation<void, { dishId: string; bomId: string }>({
      query: ({ dishId, bomId }) => ({
        url: `/dishes/${dishId}/bom/${bomId}`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        'DishCatalog',
        'MaterialDemandStaleness',
        workflowCacheTags.dataQuality,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.purchasePlan,
      ],
    }),
    downloadBomTemplate: builder.mutation<string, { priceTier: number; customerId?: string; dishId?: string; templateType?: 'missing' | 'blank' | 'dish' }>({
      query: ({ priceTier, customerId, dishId, templateType }) => ({
        url: '/dishes/bom-template',
        params: { priceTier, customerId, dishId, templateType },
        responseHandler: (response) => response.blob(),
      }),
      transformResponse: (blob: Blob) => URL.createObjectURL(blob),
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
      invalidatesTags: [
        'DishCatalog',
        'MaterialDemandStaleness',
        workflowCacheTags.dataQuality,
        workflowCacheTags.ingredientDemand,
        workflowCacheTags.purchasePlan,
      ],
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
