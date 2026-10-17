import { apiClient } from './client';
import type { DashboardTask, StageProgress, MetricCardItem } from '../types';

export interface DashboardData {
  metrics: MetricCardItem[];
  tasks: DashboardTask[];
  stages: StageProgress[];
}

export interface OperationalKpiResponse {
  shortageCount: number;
  lowStockCount: number;
  overduePurchaseRequestCount: number;
  lateReceiptCount: number;
  pendingKitchenConfirmationCount: number;
  failedWorkflowCount: number;
  criticalDataQualityCount: number;
  overdueApprovalCount: number;
  totalKitchenIssuedQty: number;
  totalKitchenUsedQty: number;
  totalKitchenReturnedQty: number;
  generatedAt: string;
}

export interface RawDashboardPlan {
  planId: string;
  planCode: string;
  planDate: string;
  customerCode: string;
  status: string;
  lines: Array<{
    dishName: string;
    shiftName: string;
    totalServings: number;
  }>;
}

export const dashboardApi = {
  async getDashboardData(): Promise<DashboardData> {
    const kpis = await apiClient<OperationalKpiResponse>('/workflow-reports/operational-kpis');

    const metrics: MetricCardItem[] = [
      {
        id: 'm1',
        label: 'Phiếu chờ Bếp xác nhận',
        value: String(kpis.pendingKitchenConfirmationCount),
        unit: 'phiếu xuất',
        trend: 'Theo dữ liệu vận hành hiện tại',
        variant: kpis.pendingKitchenConfirmationCount > 0 ? 'warning' : 'success',
      },
      {
        id: 'm2',
        label: 'Vật tư thiếu hụt',
        value: String(kpis.shortageCount),
        unit: 'nguyên liệu',
        trend: kpis.shortageCount > 0 ? 'Cần bổ sung PO' : 'Tồn kho đủ',
        variant: kpis.shortageCount > 0 ? 'warning' : 'success',
      },
      {
        id: 'm3',
        label: 'Yêu cầu PO quá hạn',
        value: String(kpis.overduePurchaseRequestCount),
        unit: 'đề xuất',
        trend: kpis.overduePurchaseRequestCount > 0 ? 'Cần duyệt trước 11:00' : 'Đúng hạn',
        variant: kpis.overduePurchaseRequestCount > 0 ? 'danger' : 'default',
      },
      {
        id: 'm4',
        label: 'Phiếu nhập trễ hạn',
        value: String(kpis.lateReceiptCount),
        unit: 'phiếu kho',
        trend: 'Theo dữ liệu vận hành hiện tại',
        variant: kpis.lateReceiptCount > 0 ? 'warning' : 'success',
      },
      {
        id: 'm5',
        label: 'Chất lượng dữ liệu',
        value: String(kpis.criticalDataQualityCount),
        unit: 'cảnh báo',
        trend: 'Theo kiểm tra chất lượng dữ liệu',
        variant: kpis.criticalDataQualityCount > 0 ? 'warning' : 'success',
      },
    ];

    return { metrics, tasks: [], stages: [] };
  },
};
