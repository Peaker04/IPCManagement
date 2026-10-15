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
  ruleCode: string;
  ruleName: string;
  targetType: string;
  thresholdAmount: number;
  approverRole: string;
  slaHours: number;
  isActive: boolean;
}

export interface RawIngredient {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  categoryName?: string;
  unitName?: string;
  referencePrice?: number;
  isActive?: boolean;
}

export interface RawDish {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishGroup?: string;
  isActive?: boolean;
}

export const adminApi = {
  async getIngredients(): Promise<IngredientItem[]> {
    const resp = await apiClient<{ items: RawIngredient[] } | RawIngredient[]>('/ingredients');
    const items = Array.isArray(resp) ? resp : resp?.items || [];
    return items.map((i) => ({
      ingredientId: i.ingredientId,
      ingredientCode: i.ingredientCode,
      ingredientName: i.ingredientName,
      categoryName: i.categoryName || 'Nguyên liệu tươi',
      unitName: i.unitName || 'Kilogram',
      referencePrice: i.referencePrice || 45000,
      isActive: i.isActive !== false,
    }));
  },

  async getDishes(): Promise<DishItem[]> {
    const resp = await apiClient<{ items: RawDish[] } | RawDish[]>('/dishes');
    const items = Array.isArray(resp) ? resp : resp?.items || [];
    return items.map((d) => ({
      dishId: d.dishId,
      dishCode: d.dishCode,
      dishName: d.dishName,
      dishGroup: d.dishGroup || 'Món mặn chính',
      isActive: d.isActive !== false,
    }));
  },

  async getApprovalRules(): Promise<ApprovalRuleItem[]> {
    const resp = await apiClient<ApprovalRuleItem[]>('/approval-rules');
    return Array.isArray(resp) ? resp : [];
  },

  async createIngredient(data: {
    ingredientCode: string;
    ingredientName: string;
    unitName: string;
    referencePrice: number;
  }): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/ingredients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createApprovalRule(data: {
    ruleCode: string;
    ruleName: string;
    targetType: string;
    thresholdAmount: number;
    approverRole: string;
    slaHours: number;
  }): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>('/approval-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
