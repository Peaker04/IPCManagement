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
    // 1. Fetch real KPIs from backend
    const kpis = await apiClient<OperationalKpiResponse>('/workflow-reports/operational-kpis');

    // 2. Fetch real production plans
    let rawPlans: RawDashboardPlan[] = [];
    try {
      const plans = await apiClient<RawDashboardPlan[]>('/production-plans/filter?serviceDate=2026-09-21');
      if (Array.isArray(plans)) rawPlans = plans;
    } catch {
      rawPlans = [];
    }

    const totalServings = rawPlans.reduce(
      (sum, p) => sum + p.lines.reduce((s, l) => s + l.totalServings, 0),
      0
    );

    const metrics: MetricCardItem[] = [
      {
        id: 'm1',
        label: 'Suất ăn theo KHSX',
        value: totalServings > 0 ? totalServings.toLocaleString('vi-VN') : '0',
        unit: 'suất ca ngày',
        trend: rawPlans.length > 0 ? `${rawPlans.length} kế hoạch sản xuất` : 'Chưa có KHSX',
        variant: 'default',
      },
      {
        id: 'm2',
        label: 'Vật tư thiếu hụt',
        value: String(kpis.shortageCount || 0),
        unit: 'nguyên liệu',
        trend: kpis.shortageCount > 0 ? 'Cần bổ sung PO' : 'Tồn kho đủ',
        variant: kpis.shortageCount > 0 ? 'warning' : 'success',
      },
      {
        id: 'm3',
        label: 'Yêu cầu PO quá hạn',
        value: String(kpis.overduePurchaseRequestCount || 0),
        unit: 'đề xuất',
        trend: kpis.overduePurchaseRequestCount > 0 ? 'Cần duyệt trước 11:00' : 'Đúng hạn',
        variant: kpis.overduePurchaseRequestCount > 0 ? 'danger' : 'default',
      },
      {
        id: 'm4',
        label: 'Phiếu nhập trễ hạn',
        value: String(kpis.lateReceiptCount || 0),
        unit: 'phiếu kho',
        trend: 'Kho trung tâm',
        variant: kpis.lateReceiptCount > 0 ? 'warning' : 'success',
      },
      {
        id: 'm5',
        label: 'Chất lượng dữ liệu',
        value: String(kpis.criticalDataQualityCount || 0),
        unit: 'cảnh báo',
        trend: 'Kiểm soát định mức BOM',
        variant: kpis.criticalDataQualityCount > 0 ? 'warning' : 'success',
      },
    ];

    const tasks: DashboardTask[] = [
      {
        id: 't-1',
        title: 'Ký duyệt bàn giao nguyên liệu ca nấu Draxlmaier',
        assignee: 'Bếp trưởng',
        roleCode: 'CHEF',
        deadline: '10:30 Hôm nay',
        priority: 'high',
        status: 'pending',
        actionRoute: '/weekly-menu?view=demand',
      },
      {
        id: 't-2',
        title: 'Xác nhận phiếu xuất kho rau củ và thịt tươi',
        assignee: 'Thủ kho',
        roleCode: 'WAREHOUSE',
        deadline: '11:00 Hôm nay',
        priority: 'high',
        status: 'pending',
        actionRoute: '/warehouse',
      },
      {
        id: 't-3',
        title: 'Chốt số lượng suất ăn ca chiều bổ sung',
        assignee: 'Điều phối viên',
        roleCode: 'COORDINATOR',
        deadline: '13:30 Hôm nay',
        priority: 'medium',
        status: 'in_progress',
        actionRoute: '/meal-orders',
      },
      {
        id: 't-4',
        title: 'Duyệt bảng báo giá nhà cung cấp thực phẩm sạch',
        assignee: 'Quản lý thu mua',
        roleCode: 'PURCHASER',
        deadline: '15:00 Hôm nay',
        priority: 'normal',
        status: 'pending',
        actionRoute: '/purchasing',
      },
    ];

    const stages: StageProgress[] = [
      {
        stageNumber: 1,
        stageName: '1. Tiếp nhận & Chốt đơn ăn',
        description: 'Chốt số lượng suất ăn từ khách hàng cho cả 2 ca.',
        status: 'completed',
        completedCount: 2,
        totalCount: 2,
        actionLabel: 'Xem đơn ăn',
        actionRoute: '/meal-orders',
      },
      {
        stageNumber: 2,
        stageName: '2. Lập KHSX & Tính nhu cầu BOM',
        description: 'Phân rã thực đơn, tính toán nguyên liệu và phát lệnh KHSX.',
        status: rawPlans.length > 0 ? 'completed' : 'in_progress',
        completedCount: rawPlans.length,
        totalCount: rawPlans.length > 0 ? rawPlans.length : 14,
        actionLabel: 'Xem KHSX',
        actionRoute: '/weekly-menu?view=production-plan',
      },
      {
        stageNumber: 3,
        stageName: '3. Xuất kho & Chế biến tại bếp',
        description: 'Bếp trưởng nhận vật tư, hoàn thành bàn giao nguyên liệu ca nấu.',
        status: 'in_progress',
        completedCount: 26,
        totalCount: 29,
        actionLabel: 'Theo dõi bếp',
        actionRoute: '/chef',
      },
      {
        stageNumber: 4,
        stageName: '4. Giao nhận suất & Đối soát',
        description: 'Bàn giao khay cơm tại nhà máy, ghi nhận số suất thực tế.',
        status: 'waiting',
        completedCount: 0,
        totalCount: 2,
        actionLabel: 'Đối soát ca',
        actionRoute: '/reconciliation',
      },
    ];

    return { metrics, tasks, stages };
  },
};
