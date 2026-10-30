import { apiClient } from './client';

export interface BomCoverageDish {
  dishId: string;
  dishCode: string;
  dishName: string;
  dishType?: string;
  dishGroup?: string;
  bomLineCount: number;
  hasBom: boolean;
  status: string;
  statusLabel: string;
}

export interface BomCoverageReport {
  generatedAt: string;
  totalDishes: number;
  completeDishes: number;
  missingBomDishes: number;
  totalBomLines: number;
  dishes: BomCoverageDish[];
}

export interface DishBomLine {
  bomId: string;
  dishId: string;
  dishCode: string;
  dishName: string;
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

export interface CreateBomLinePayload {
  ingredientId: string;
  grossQtyPerServing: number;
  unitId?: string;
  priceTierAmount?: number;
  customerId?: string;
  bomScope?: string;
  wasteRatePercent?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface UpdateBomLinePayload {
  grossQtyPerServing?: number;
  wasteRatePercent?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
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
}

export interface BomImportPreviewResult {
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

export interface BomImportCommitResult {
  totalCommittedRows: number;
  createdRows: number;
  updatedRows: number;
  archivedRows: number;
  auditBatchCode: string;
}

export const bomApi = {
  getBomTemplateUrl(priceTier: number, customerId?: string, templateType = 'by-dish'): string {
    const query = new URLSearchParams({
      TemplateType: templateType,
      PriceTier: String(priceTier),
    });
    if (customerId) query.set('CustomerId', customerId);
    return `/api/Dishes/bom-template?${query.toString()}`;
  },

  previewBomImport(formData: FormData): Promise<BomImportPreviewResult> {
    return apiClient<BomImportPreviewResult>('/Dishes/bom-import/preview', {
      method: 'POST',
      body: formData,
    });
  },

  commitBomImport(formData: FormData): Promise<BomImportCommitResult> {
    return apiClient<BomImportCommitResult>('/Dishes/bom-import/commit', {
      method: 'POST',
      body: formData,
    });
  },

  getBomCoverage(): Promise<BomCoverageReport> {
    return apiClient<BomCoverageReport>('/Dishes/bom-coverage');
  },

  getDishBomLines(dishId: string): Promise<DishBomLine[]> {
    return apiClient<DishBomLine[]>(`/Dishes/${encodeURIComponent(dishId)}/bom`);
  },

  addDishBomLine(dishId: string, payload: CreateBomLinePayload): Promise<DishBomLine> {
    return apiClient<DishBomLine>(`/Dishes/${encodeURIComponent(dishId)}/bom`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateDishBomLine(dishId: string, bomId: string, payload: UpdateBomLinePayload): Promise<DishBomLine> {
    return apiClient<DishBomLine>(`/Dishes/${encodeURIComponent(dishId)}/bom/${encodeURIComponent(bomId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  closeDishBomLine(dishId: string, bomId: string): Promise<unknown> {
    return apiClient(`/Dishes/${encodeURIComponent(dishId)}/bom/${encodeURIComponent(bomId)}`, {
      method: 'DELETE',
    });
  },
};
