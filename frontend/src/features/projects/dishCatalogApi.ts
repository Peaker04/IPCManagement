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

export interface CatalogIngredient {
  bomId: string;
  ingredientId: string;
  ingredientCode: string;
  unitId: string;
  name: string;
  unit: string;
  grossQtyPerServing: number;
  wasteRatePercent: number;
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
  menuSlots: string[];
  ingredients: CatalogIngredient[];
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
  grossQtyPerServing: number;
  wasteRatePercent: number;
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
  useGetIngredientsQuery,
  useAddDishBomLineMutation,
  useUpdateDishBomLineMutation,
  useCloseDishBomLineMutation,
  useGetDishCatalogQuery: useGetDishesCatalogQuery,
} = dishCatalogApi;
