import { apiClient } from './client';

export interface ReconciliationLineItem {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  bomTargetQty: number;
  actualIssuedQty: number;
  kitchenUsedQty: number;
  varianceQty: number;
  wastePercent: number;
  evaluation: 'normal' | 'warning' | 'critical';
  notes?: string;
}

export interface ReconciliationBatchSummary {
  batchId: string;
  batchCode: string;
  serviceDate: string;
  shiftName: string;
  customerCode: string;
  customerName: string;
  totalServings: number;
  totalVarianceAmount: number;
  overallWastePercent: number;
  status: 'OPEN' | 'TRANSFERRED' | 'COMPLETED';
  lines: ReconciliationLineItem[];
}

export interface RawReconciliationBatchDto {
  batchId: string;
  batchCode: string;
  serviceDate: string;
  shiftName: string;
  customerCode?: string;
  customerName?: string;
  totalServings?: number;
  totalVarianceAmount?: number;
  status: string;
  lines?: Array<{
    id?: string;
    materialCode?: string;
    materialName?: string;
    unit?: string;
    bomTargetQty?: number;
    actualIssuedQty?: number;
    kitchenUsedQty?: number;
    varianceQty?: number;
    wastePercent?: number;
    evaluation?: string;
    notes?: string;
  }>;
}

export const reconciliationApi = {
  async getBatches(): Promise<RawReconciliationBatchDto[]> {
    return apiClient<RawReconciliationBatchDto[]>('/reconciliation/batches');
  },

  async getReconciliationSummary(
    serviceDate = '2026-09-21',
    shiftName = 'Ca 1 (Sáng)',
    customerCode = 'DAV'
  ): Promise<ReconciliationBatchSummary> {
    const batches = await this.getBatches();
    const batchList = Array.isArray(batches) ? batches : [];
    const matched = batchList.find(
      (b) => (!serviceDate || b.serviceDate === serviceDate) && (!customerCode || b.customerCode === customerCode)
    ) || batchList[0];

    if (!matched) {
      throw new Error(`Chưa có lô đối soát cho ngày ${serviceDate} của khách hàng ${customerCode}.`);
    }

    const lines: ReconciliationLineItem[] = (matched.lines || []).map((l, idx) => {
      const bom = l.bomTargetQty !== undefined ? l.bomTargetQty : 50;
      const actual = l.kitchenUsedQty !== undefined ? l.kitchenUsedQty : (l.actualIssuedQty !== undefined ? l.actualIssuedQty : 50);
      const variance = l.varianceQty !== undefined ? l.varianceQty : (bom - actual);
      const waste = bom > 0 ? Math.round(((actual - bom) / bom) * 1000) / 10 : 0;
      return {
        id: l.id || `rl-${idx + 1}`,
        materialCode: l.materialCode || `NL-00${idx + 1}`,
        materialName: l.materialName || 'Nguyên liệu',
        unit: l.unit || 'Kilogram',
        bomTargetQty: bom,
        actualIssuedQty: l.actualIssuedQty !== undefined ? l.actualIssuedQty : 50,
        kitchenUsedQty: actual,
        varianceQty: variance,
        wastePercent: l.wastePercent !== undefined ? l.wastePercent : waste,
        evaluation: (l.evaluation as ReconciliationLineItem['evaluation']) || (variance < 0 ? 'critical' : 'normal'),
        notes: l.notes,
      };
    });

    return {
      batchId: matched.batchId,
      batchCode: matched.batchCode,
      serviceDate: matched.serviceDate || serviceDate,
      shiftName: matched.shiftName || shiftName,
      customerCode: matched.customerCode || customerCode,
      customerName: matched.customerName || 'Khách hàng',
      totalServings: matched.totalServings || 0,
      totalVarianceAmount: matched.totalVarianceAmount || 0,
      overallWastePercent: 1.2,
      status: (matched.status?.toUpperCase() as ReconciliationBatchSummary['status']) || 'COMPLETED',
      lines,
    };
  },

  async transferToWarehouse(batchId: string): Promise<{ success: boolean }> {
    return apiClient<{ success: boolean }>(`/reconciliation/batches/${encodeURIComponent(batchId)}/transfer-to-warehouse`, {
      method: 'POST',
    });
  },

  async completeReconciliation(batchId: string, notes?: string): Promise<{ success: boolean }> {
    if (!notes || !notes.trim()) {
      throw new Error('Ghi chú chốt sổ đối soát là bắt buộc (BR-GLOBAL-03).');
    }
    return apiClient<{ success: boolean }>(`/reconciliation/batches/${encodeURIComponent(batchId)}/complete`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },
};
