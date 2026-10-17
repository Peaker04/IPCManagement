import { apiClient } from './client';

export interface IngredientItem {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  categoryName?: string;
  unitName: string;
  referencePrice: number;
  isActive: boolean;
}

export interface DishItem {
  dishId: string;
  dishCode: string;
  dishName: string;
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
  dishGroup?: string;
  isActive: boolean;
}

export const adminApi = {
  async getIngredients(): Promise<IngredientItem[]> {
    const resp = await apiClient<{ items: RawIngredient[] } | RawIngredient[]>('/ingredients');
    const items = Array.isArray(resp) ? resp : resp?.items || [];
    return items.map((i) => ({
      ingredientId: i.ingredientId,
      ingredientCode: i.ingredientCode,
      ingredientName: i.ingredientName,
      unitName: i.unitName || '—',
      referencePrice: i.referencePrice,
      isActive: i.isActive,
    }));
  },

  async getDishes(): Promise<DishItem[]> {
    const resp = await apiClient<{ items: RawDish[] } | RawDish[]>('/dishes');
    const items = Array.isArray(resp) ? resp : resp?.items || [];
    return items.map((d) => ({
      dishId: d.dishId,
      dishCode: d.dishCode,
      dishName: d.dishName,
      dishGroup: d.dishGroup,
      isActive: d.isActive,
    }));
  },

  async getApprovalRules(): Promise<ApprovalRuleItem[]> {
    return apiClient<ApprovalRuleItem[]>('/approval-rules');
  },

};
