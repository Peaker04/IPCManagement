import { apiClient } from './client';

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PagedQueryParams {
  pageNumber?: number;
  pageSize?: number;
  searchKeyword?: string;
}

export interface IngredientItem {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unitId: string;
  unitName: string;
  warehouseId: string;
  warehouseName?: string;
  referencePrice: number;
  isFreshDaily?: boolean;
  isActive: boolean;
}

export interface UnitItem {
  unitId: string;
  unitCode: string;
  unitName: string;
  baseUnitCode: string | null;
  convertRateToBase: number;
}

export interface CreateIngredientInput {
  ingredientCode: string;
  ingredientName: string;
  unitId: string;
  isFreshDaily: boolean;
  referencePrice: number;
}

export interface DishItem {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishType?: string;
  dishGroup?: string;
  isActive: boolean;
}

export interface ApprovalRuleItem {
  ruleId: string;
  ruleName: string;
  documentType: string;
  minAmount?: number;
  maxAmount?: number;
  slaHours?: number;
  isActive: boolean;
}

export interface RawIngredient {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  isActive: boolean;
  isFreshDaily?: boolean;
  referencePrice: number;
  unitId: string;
  unitName?: string;
  warehouseId: string;
  warehouseName?: string;
}

export interface RawDish {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishType?: string;
  dishGroup?: string;
  isActive: boolean;
}

function buildPagedQuery(params?: PagedQueryParams): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  if (params.pageNumber != null) searchParams.set('pageNumber', String(params.pageNumber));
  if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize));
  if (params.searchKeyword) searchParams.set('searchKeyword', params.searchKeyword);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const adminApi = {
  getUnits(): Promise<UnitItem[]> {
    return apiClient<UnitItem[]>('/Units');
  },

  createIngredient(input: CreateIngredientInput): Promise<IngredientItem> {
    return apiClient<IngredientItem>('/ingredients', { method: 'POST', body: JSON.stringify(input) });
  },
  async getIngredients(params?: PagedQueryParams, signal?: AbortSignal): Promise<PagedResult<IngredientItem>> {
    const qs = buildPagedQuery(params);
    const resp = await apiClient<{
      items?: RawIngredient[];
      totalCount?: number;
      pageNumber?: number;
      pageSize?: number;
      totalPages?: number;
      hasPrev?: boolean;
      hasNext?: boolean;
    } | RawIngredient[]>(`/ingredients${qs}`, { signal });

    if (Array.isArray(resp)) {
      return {
        items: resp.map((i) => ({
          ingredientId: i.ingredientId,
          ingredientCode: i.ingredientCode,
          ingredientName: i.ingredientName,
          unitId: i.unitId,
          unitName: i.unitName || '—',
          warehouseId: i.warehouseId,
          warehouseName: i.warehouseName || undefined,
          referencePrice: i.referencePrice,
          isFreshDaily: i.isFreshDaily ?? undefined,
          isActive: i.isActive,
        })),
        totalCount: resp.length,
        pageNumber: 1,
        pageSize: resp.length || 25,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      };
    }

    const rawItems = resp?.items || [];
    const totalCount = resp?.totalCount ?? rawItems.length;
    const pageNumber = resp?.pageNumber ?? params?.pageNumber ?? 1;
    const pageSize = resp?.pageSize ?? params?.pageSize ?? 25;
    const totalPages = resp?.totalPages ?? (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
    const hasPrev = resp?.hasPrev ?? pageNumber > 1;
    const hasNext = resp?.hasNext ?? (totalPages > 0 && pageNumber < totalPages);

    return {
      items: rawItems.map((i) => ({
        ingredientId: i.ingredientId,
        ingredientCode: i.ingredientCode,
        ingredientName: i.ingredientName,
        unitId: i.unitId,
        unitName: i.unitName || '—',
        warehouseId: i.warehouseId,
        warehouseName: i.warehouseName || undefined,
        referencePrice: i.referencePrice,
        isFreshDaily: i.isFreshDaily ?? undefined,
        isActive: i.isActive,
      })),
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      hasPrev,
      hasNext,
    };
  },

  async findActiveIngredientByNameAndUnit(name: string, unitId: string): Promise<IngredientItem | undefined> {
    const key = name.trim().toLocaleLowerCase('vi-VN');
    const matches: IngredientItem[] = [];
    for (let pageNumber = 1; ; pageNumber++) {
      const result = await adminApi.getIngredients({ pageNumber, pageSize: 100, searchKeyword: name.trim() });
      matches.push(...result.items.filter(item => item.isActive && item.unitId === unitId && item.ingredientName.trim().toLocaleLowerCase('vi-VN') === key));
      if (matches.length > 1) throw new Error(`Có nhiều nguyên liệu cùng tên và đơn vị (${matches.map(item => item.ingredientCode).join(', ')}). Hãy chọn đúng mã trong danh mục.`);
      if (!result.hasNext || result.pageNumber !== pageNumber) return matches[0];
    }
  },

  async getDish(dishId: string): Promise<DishItem> {
    const dish = await apiClient<RawDish>(`/Dishes/${encodeURIComponent(dishId)}`);
    return { ...dish, dishType: dish.dishType ?? undefined, dishGroup: dish.dishGroup ?? undefined };
  },

  async getDishes(params?: PagedQueryParams, signal?: AbortSignal): Promise<PagedResult<DishItem>> {
    const qs = buildPagedQuery(params);
    const resp = await apiClient<{
      items?: RawDish[];
      totalCount?: number;
      pageNumber?: number;
      pageSize?: number;
      totalPages?: number;
      hasPrev?: boolean;
      hasNext?: boolean;
    } | RawDish[]>(`/Dishes${qs}`, { signal });

    if (Array.isArray(resp)) {
      return {
        items: resp.map((d) => ({
          dishId: d.dishId,
          dishCode: d.dishCode,
          dishName: d.dishName,
          dishType: d.dishType || undefined,
          dishGroup: d.dishGroup || undefined,
          isActive: d.isActive,
        })),
        totalCount: resp.length,
        pageNumber: 1,
        pageSize: resp.length || 25,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      };
    }

    const rawItems = resp?.items || [];
    const totalCount = resp?.totalCount ?? rawItems.length;
    const pageNumber = resp?.pageNumber ?? params?.pageNumber ?? 1;
    const pageSize = resp?.pageSize ?? params?.pageSize ?? 25;
    const totalPages = resp?.totalPages ?? (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
    const hasPrev = resp?.hasPrev ?? pageNumber > 1;
    const hasNext = resp?.hasNext ?? (totalPages > 0 && pageNumber < totalPages);

    return {
      items: rawItems.map((d) => ({
        dishId: d.dishId,
        dishCode: d.dishCode,
        dishName: d.dishName,
        dishType: d.dishType || undefined,
        dishGroup: d.dishGroup || undefined,
        isActive: d.isActive,
      })),
      totalCount,
      pageNumber,
      pageSize,
      totalPages,
      hasPrev,
      hasNext,
    };
  },

  async getApprovalRules(): Promise<ApprovalRuleItem[]> {
    return apiClient<ApprovalRuleItem[]>('/approval-rules');
  },
};
