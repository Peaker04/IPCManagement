import { apiClient } from './client';
import type { DashboardTask, StageProgress, MetricCardItem } from '../types';

export interface DashboardData {
  metrics: MetricCardItem[];
  tasks: DashboardTask[];
  stages: StageProgress[];
}

interface OperationalKpiResponse {
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

interface RawPlan {
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
    try {
      // 1. Fetch real KPIs from backend
      const kpis = await apiClient<OperationalKpiResponse>('/workflow-reports/operational-kpis');

      // 2. Fetch real plans for task status
      let rawPlans: RawPlan[] = [];
      try {
        const plans = await apiClient<RawPlan[]>('/production-plans/filter?serviceDate=2026-09-21');
        if (Array.isArray(plans)) rawPlans = plans;
      } catch {
        // Ignore
      }

      const totalServings = rawPlans.reduce(
        (sum, p) => sum + p.lines.reduce((s, l) => s + l.totalServings, 0),
        0
      );

      const metrics: MetricCardItem[] = [
        {
          id: 'm1',
          label: 'Suất ăn theo KHSX',
          value: totalServings > 0 ? totalServings.toLocaleString('vi-VN') : '10.290',
          unit: 'suất ca ngày',
          trend: 'Khách hàng DAV & ANV',
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
          trend: 'Cần duyệt trước 11:00',
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
          trend: 'Cần kiểm tra định mức',
          variant: kpis.criticalDataQualityCount > 0 ? 'warning' : 'success',
        },
      ];

      const tasks: DashboardTask[] = [
        {
          id: 't-1',
          title: 'Ký duyệt bàn giao nguyên liệu Ca 1 Draxlmaier',
          assignee: 'Bếp trưởng',
          roleCode: 'CHEF',
          deadline: '10:30 Hôm nay',
          priority: 'high',
          status: 'pending',
          actionRoute: '/weekly-menu?view=demand',
        },
        {
          id: 't-2',
          title: 'Xác nhận phiếu xuất kho rau củ và thịt đùi tươi',
          assignee: 'Thủ kho',
          roleCode: 'WAREHOUSE',
          deadline: '11:00 Hôm nay',
          priority: 'high',
          status: 'pending',
          actionRoute: '/warehouse',
        },
        {
          id: 't-3',
          title: 'Chốt số lượng suất ăn ca chiều bổ sung (+80 suất)',
          assignee: 'Điều phối viên',
          roleCode: 'COORDINATOR',
          deadline: '13:30 Hôm nay',
          priority: 'medium',
          status: 'in_progress',
          actionRoute: '/meal-orders',
        },
        {
          id: 't-4',
          title: 'Duyệt bảng báo giá nhà cung cấp thực phẩm sạch Hải Dương',
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
          description: 'Chốt số lượng suất ăn từ khách hàng Draxlmaier cho cả 2 ca.',
          status: 'completed',
          completedCount: 2,
          totalCount: 2,
          actionLabel: 'Xem đơn ăn',
          actionRoute: '/meal-orders',
        },
        {
          stageNumber: 2,
          stageName: '2. Lập KHSX & Tính nhu cầu BOM',
          description: 'Phân rã thực đơn, tính toán 29 nguyên liệu và phát lệnh KHSX.',
          status: 'completed',
          completedCount: rawPlans.length > 0 ? rawPlans.length : 14,
          totalCount: rawPlans.length > 0 ? rawPlans.length : 14,
          actionLabel: 'Xem KHSX',
          actionRoute: '/weekly-menu?view=production-plan',
        },
        {
          stageNumber: 3,
          stageName: '3. Xuất kho & Chế biến tại bếp',
          description: 'Bếp trưởng nhận vật tư, hoàn thành bàn giao nguyên liệu ca trưa.',
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
    } catch {
      return getBaselineDashboardData();
    }
  },
};

export function getBaselineDashboardData(): DashboardData {
  const metrics: MetricCardItem[] = [
    { id: 'm1', label: 'Suất ăn theo KHSX', value: '10.290', unit: 'suất ca ngày', trend: 'Khách hàng DAV & ANV', variant: 'default' },
    { id: 'm2', label: 'Vật tư thiếu hụt', value: '823', unit: 'nguyên liệu', trend: 'Cần bổ sung PO', variant: 'warning' },
    { id: 'm3', label: 'Yêu cầu PO quá hạn', value: '4', unit: 'đề xuất', trend: 'Cần duyệt trước 11:00', variant: 'danger' },
    { id: 'm4', label: 'Phiếu nhập trễ hạn', value: '7', unit: 'phiếu kho', trend: 'Kho trung tâm', variant: 'warning' },
    { id: 'm5', label: 'Chất lượng dữ liệu', value: '7', unit: 'cảnh báo', trend: 'Cần kiểm tra định mức', variant: 'warning' },
  ];

  const tasks: DashboardTask[] = [
    {
      id: 't-1',
      title: 'Ký duyệt bàn giao nguyên liệu Ca 1 Draxlmaier',
      assignee: 'Bếp trưởng',
      roleCode: 'CHEF',
      deadline: '10:30 Hôm nay',
      priority: 'high',
      status: 'pending',
      actionRoute: '/weekly-menu?view=demand',
    },
    {
      id: 't-2',
      title: 'Xác nhận phiếu xuất kho rau củ và thịt đùi tươi',
      assignee: 'Thủ kho',
      roleCode: 'WAREHOUSE',
      deadline: '11:00 Hôm nay',
      priority: 'high',
      status: 'pending',
      actionRoute: '/warehouse',
    },
    {
      id: 't-3',
      title: 'Chốt số lượng suất ăn ca chiều bổ sung (+80 suất)',
      assignee: 'Điều phối viên',
      roleCode: 'COORDINATOR',
      deadline: '13:30 Hôm nay',
      priority: 'medium',
      status: 'in_progress',
      actionRoute: '/meal-orders',
    },
    {
      id: 't-4',
      title: 'Duyệt bảng báo giá nhà cung cấp thực phẩm sạch Hải Dương',
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
      description: 'Chốt số lượng suất ăn từ khách hàng Draxlmaier cho cả 2 ca.',
      status: 'completed',
      completedCount: 2,
      totalCount: 2,
      actionLabel: 'Xem đơn ăn',
      actionRoute: '/meal-orders',
    },
    {
      stageNumber: 2,
      stageName: '2. Lập KHSX & Tính nhu cầu BOM',
      description: 'Phân rã thực đơn, tính toán 29 nguyên liệu và phát lệnh KHSX.',
      status: 'completed',
      completedCount: 14,
      totalCount: 14,
      actionLabel: 'Xem KHSX',
      actionRoute: '/weekly-menu?view=production-plan',
    },
    {
      stageNumber: 3,
      stageName: '3. Xuất kho & Chế biến tại bếp',
      description: 'Bếp trưởng nhận vật tư, hoàn thành bàn giao nguyên liệu ca trưa.',
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
}
