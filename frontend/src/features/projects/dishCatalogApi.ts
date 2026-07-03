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

export interface UnitLookup {
  unitId: string;
  unitCode: string;
  unitName: string;
}

export interface WarehouseLookup {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
}

export interface CreateIngredientRequest {
  ingredientCode: string;
  ingredientName: string;
  unitId: string;
  warehouseId: string;
  referencePrice: number;
  isFreshDaily: boolean;
}

export interface UpsertDishBomLineRequest {
  dishId: string;
  bomId?: string;
  ingredientId: string;
  unitId?: string;
  grossQtyPerServing: number;
  wasteRatePercent: number;
  bomStatus?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  reason?: string;
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
      query: () => '/ingredients/lookup',
      transformResponse: (response: ApiResponse<IngredientLookup[]>) =>
        (response.data ?? []).filter((ingredient) => ingredient.isActive),
      providesTags: ['Ingredients'],
    }),
    searchIngredients: builder.query<IngredientLookup[], string>({
      query: (searchKeyword) => ({
        url: '/ingredients',
        params: { pageNumber: 1, pageSize: 50, searchKeyword: searchKeyword || undefined },
      }),
      transformResponse: (response: ApiResponse<PagedResponse<IngredientLookup>>) =>
        (response.data?.items ?? []).filter((ingredient) => ingredient.isActive),
      providesTags: ['Ingredients'],
    }),
    createIngredient: builder.mutation<IngredientLookup, CreateIngredientRequest>({
      query: (body) => ({
        url: '/ingredients',
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<IngredientLookup>) => response.data!,
      invalidatesTags: ['Ingredients'],
    }),
    getUnits: builder.query<UnitLookup[], void>({
      query: () => '/units',
      transformResponse: (response: ApiResponse<UnitLookup[]>) => response.data ?? [],
    }),
    getWarehouses: builder.query<WarehouseLookup[], void>({
      query: () => '/warehouses?pageNumber=1&pageSize=100',
      transformResponse: (response: ApiResponse<PagedResponse<WarehouseLookup>>) => response.data?.items ?? [],
    }),
    addDishBomLine: builder.mutation<DishCatalogBomLineDto, UpsertDishBomLineRequest>({
      query: ({ dishId, ...body }) => ({
        url: `/dishes/${dishId}/bom`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: ApiResponse<DishCatalogBomLineDto>) => response.data!,
      invalidatesTags: ['DishCatalog'],
    }),
    updateDishBomLine: builder.mutation<DishCatalogBomLineDto, UpsertDishBomLineRequest>({
      query: ({ dishId, bomId, ...body }) => ({
        url: `/dishes/${dishId}/bom/${bomId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: ApiResponse<DishCatalogBomLineDto>) => response.data!,
      invalidatesTags: ['DishCatalog'],
    }),
    closeDishBomLine: builder.mutation<void, { dishId: string; bomId: string }>({
      query: ({ dishId, bomId }) => ({
        url: `/dishes/${dishId}/bom/${bomId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['DishCatalog'],
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
  useSearchIngredientsQuery,
  useCreateIngredientMutation,
  useGetUnitsQuery,
  useGetWarehousesQuery,
  useAddDishBomLineMutation,
  useUpdateDishBomLineMutation,
  useCloseDishBomLineMutation,
  useGetDishCatalogQuery: useGetDishesCatalogQuery,
} = dishCatalogApi;
