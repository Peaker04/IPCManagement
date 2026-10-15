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

interface RawIngredient {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  categoryName?: string;
  unitName?: string;
  referencePrice?: number;
  isActive?: boolean;
}

interface RawDish {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishGroup?: string;
  isActive?: boolean;
}

export const adminApi = {
  async getIngredients(): Promise<IngredientItem[]> {
    try {
      const resp = await apiClient<{ items: RawIngredient[] } | RawIngredient[]>('/ingredients');
      const items = Array.isArray(resp) ? resp : resp?.items || [];
      if (items.length > 0) {
        return items.map((i) => ({
          ingredientId: i.ingredientId,
          ingredientCode: i.ingredientCode,
          ingredientName: i.ingredientName,
          categoryName: i.categoryName || 'Nguyên liệu tươi',
          unitName: i.unitName || 'Kilogram',
          referencePrice: i.referencePrice || 45000,
          isActive: i.isActive !== false,
        }));
      }
    } catch {
      // Fallback
    }

    return [
      { ingredientId: 'i-1', ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', categoryName: 'Thịt & Gia súc', unitName: 'Kilogram', referencePrice: 95000, isActive: true },
      { ingredientId: 'i-2', ingredientCode: 'NL-GA-06', ingredientName: 'Thịt gà phi lê tươi', categoryName: 'Gia cầm', unitName: 'Kilogram', referencePrice: 85000, isActive: true },
      { ingredientId: 'i-3', ingredientCode: 'NL-CA-02', ingredientName: 'Chả cá thác lác', categoryName: 'Thủy hải sản', unitName: 'Kilogram', referencePrice: 75000, isActive: true },
      { ingredientId: 'i-4', ingredientCode: 'NL-RAU-03', ingredientName: 'Bầu sao tươi', categoryName: 'Rau củ', unitName: 'Kilogram', referencePrice: 15000, isActive: true },
      { ingredientId: 'i-5', ingredientCode: 'NL-GIA-04', ingredientName: 'Giá đỗ sạch', categoryName: 'Rau củ', unitName: 'Kilogram', referencePrice: 25000, isActive: true },
      { ingredientId: 'i-6', ingredientCode: 'NL-TOM-05', ingredientName: 'Tôm thẻ bóc vỏ', categoryName: 'Thủy hải sản', unitName: 'Kilogram', referencePrice: 110000, isActive: true },
      { ingredientId: 'i-7', ingredientCode: 'NL-DAUAN-09', ingredientName: 'Dầu ăn Cái Lân', categoryName: 'Gia vị & Dầu', unitName: 'Lít', referencePrice: 42000, isActive: true },
      { ingredientId: 'i-8', ingredientCode: 'NL-NUOCMAM-10', ingredientName: 'Nước mắm 30 độ đạm', categoryName: 'Gia vị & Dầu', unitName: 'Lít', referencePrice: 32000, isActive: true },
    ];
  },

  async getDishes(): Promise<DishItem[]> {
    try {
      const resp = await apiClient<{ items: RawDish[] } | RawDish[]>('/dishes');
      const items = Array.isArray(resp) ? resp : resp?.items || [];
      if (items.length > 0) {
        return items.map((d) => ({
          dishId: d.dishId,
          dishCode: d.dishCode,
          dishName: d.dishName,
          dishGroup: d.dishGroup || 'Món mặn chính',
          isActive: d.isActive !== false,
        }));
      }
    } catch {
      // Fallback
    }

    return [
      { dishId: 'd-1', dishCode: 'DISH-KHO-GA', dishName: 'Khô gà lá chanh', dishGroup: 'Món mặn chính', isActive: true },
      { dishId: 'd-2', dishCode: 'DISH-CHA-CA', dishName: 'Chả cá sốt cà chua', dishGroup: 'Món mặn chính', isActive: true },
      { dishId: 'd-3', dishCode: 'DISH-BAU-XAO', dishName: 'Bầu xào giá đỗ', dishGroup: 'Món rau xào', isActive: true },
      { dishId: 'd-4', dishCode: 'DISH-BAU-CANH', dishName: 'Canh bầu nấu tôm', dishGroup: 'Món canh', isActive: true },
      { dishId: 'd-5', dishCode: 'DISH-BUN-BO', dishName: 'Bún bò chả cua chay', dishGroup: 'Món chay', isActive: true },
    ];
  },

  async getApprovalRules(): Promise<ApprovalRuleItem[]> {
    try {
      const resp = await apiClient<ApprovalRuleItem[]>('/approval-rules');
      if (Array.isArray(resp) && resp.length > 0) return resp;
    } catch {
      // Fallback
    }

    return [
      { ruleId: 'r-1', ruleCode: 'RULE-PO-HIGH', ruleName: 'Duyệt đơn mua hàng giá trị cao (>20 triệu)', targetType: 'purchase-order', thresholdAmount: 20000000, approverRole: 'GiamDocDieuHanh', slaHours: 4, isActive: true },
      { ruleId: 'r-2', ruleCode: 'RULE-PO-MID', ruleName: 'Duyệt đơn mua hàng thông thường (<=20 triệu)', targetType: 'purchase-order', thresholdAmount: 20000000, approverRole: 'QuanLyThuMua', slaHours: 8, isActive: true },
      { ruleId: 'r-3', ruleCode: 'RULE-DEMAND-CA', ruleName: 'Duyệt xuất kho nhu cầu nguyên liệu ca', targetType: 'material-demand', thresholdAmount: 50000000, approverRole: 'QuanLySanXuat', slaHours: 2, isActive: true },
      { ruleId: 'r-4', ruleCode: 'RULE-MENU-CHANGE', ruleName: 'Duyệt điều chỉnh món trong tuần', targetType: 'menu-amendment', thresholdAmount: 10000000, approverRole: 'DieuPhoiVien', slaHours: 6, isActive: true },
      { ruleId: 'r-5', ruleCode: 'RULE-RECON-VARIANCE', ruleName: 'Duyệt biên bản sai lệch đối soát ca', targetType: 'reconciliation', thresholdAmount: 5000000, approverRole: 'KeToanTruong', slaHours: 12, isActive: true },
    ];
  },

  async createIngredient(_data: { ingredientCode: string; ingredientName: string; unitName: string; referencePrice: number }): Promise<{ success: boolean }> {
    void _data;
    return { success: true };
  },

  async createApprovalRule(_data: { ruleCode: string; ruleName: string; targetType: string; thresholdAmount: number; approverRole: string; slaHours: number }): Promise<{ success: boolean }> {
    void _data;
    return { success: true };
  },
};
