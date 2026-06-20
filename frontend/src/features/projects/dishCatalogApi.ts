import { apiSlice } from '@/api/apiSlice';
import type { ApiResponse } from '@/types/api';

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
  ingredientId: string;
  ingredientCode: string;
  name: string;
  unit: string;
  grossQtyPerServing: number;
  wasteRatePercent: number;
  referencePrice: number;
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

const mapCatalogDish = (dish: DishCatalogDto): CatalogDish => ({
  id: dish.dishId,
  code: dish.dishCode,
  name: dish.dishName,
  dishType: dish.dishType,
  dishGroup: dish.dishGroup,
  menuSlots: dish.menuSlots ?? [],
  ingredients: (dish.bomLines ?? []).map((line) => ({
    ingredientId: line.ingredientId,
    ingredientCode: line.ingredientCode,
    name: line.ingredientName,
    unit: line.unitName || line.unitCode,
    grossQtyPerServing: line.grossQtyPerServing,
    wasteRatePercent: line.wasteRatePercent,
    referencePrice: line.referencePrice,
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
  }),
  overrideExisting: false,
});

export const {
  useGetDishCatalogQuery,
  useGetDishCatalogQuery: useGetDishesCatalogQuery,
} = dishCatalogApi;
