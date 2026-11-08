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
        label: 'Chờ Bếp xác nhận',
        value: String(kpis.pendingKitchenConfirmationCount),
        unit: 'phiếu',
        trend: 'Vận hành ca',
        variant: kpis.pendingKitchenConfirmationCount > 0 ? 'warning' : 'success',
      },
      {
        id: 'm2',
        label: 'Vật tư thiếu hụt',
        value: String(kpis.shortageCount),
        unit: 'mặt hàng',
        trend: kpis.shortageCount > 0 ? 'Cần bổ sung PO' : 'Tồn kho đủ',
        variant: kpis.shortageCount > 0 ? 'warning' : 'success',
      },
      {
        id: 'm3',
        label: 'Đề xuất quá hạn',
        value: String(kpis.overduePurchaseRequestCount),
        unit: 'đề xuất',
        trend: kpis.overduePurchaseRequestCount > 0 ? 'Cần duyệt gấp' : 'Đúng hạn',
        variant: kpis.overduePurchaseRequestCount > 0 ? 'danger' : 'default',
      },
      {
        id: 'm4',
        label: 'Nhập kho trễ hạn',
        value: String(kpis.lateReceiptCount),
        unit: 'phiếu kho',
        trend: kpis.lateReceiptCount > 0 ? 'Chậm giao hàng' : 'Đúng tiến độ',
        variant: kpis.lateReceiptCount > 0 ? 'warning' : 'success',
      },
      {
        id: 'm5',
        label: 'Chất lượng dữ liệu',
        value: String(kpis.criticalDataQualityCount),
        unit: 'chỉ số',
        trend: kpis.criticalDataQualityCount > 0 ? 'Cần đối soát' : 'Đạt chuẩn',
        variant: kpis.criticalDataQualityCount > 0 ? 'warning' : 'success',
      },
    ];

    const tasks: DashboardTask[] = [];

    if (kpis.overduePurchaseRequestCount > 0) {
      tasks.push({
        id: 'task-po-overdue',
        title: `Xử lý ${kpis.overduePurchaseRequestCount} đề xuất mua hàng quá hạn cần duyệt`,
        assignee: 'Phòng Thu mua / Quản lý',
        roleCode: 'PURCHASER',
        deadline: '11:00 hôm nay',
        priority: 'high',
        status: 'pending',
        actionRoute: '/purchasing',
      });
    }

    if (kpis.shortageCount > 0) {
      tasks.push({
        id: 'task-shortage',
        title: `Tổng hợp ${kpis.shortageCount} mặt hàng thiếu hụt theo BOM tuần`,
        assignee: 'Điều phối / Thu mua',
        roleCode: 'COORDINATOR',
        deadline: 'Trước 14:00',
        priority: 'medium',
        status: 'in_progress',
        actionRoute: '/weekly-menu?view=demand',
      });
    }

    if (kpis.lateReceiptCount > 0) {
      tasks.push({
        id: 'task-late-receipt',
        title: `Đối soát ${kpis.lateReceiptCount} phiếu nhập kho trễ hạn từ nhà cung cấp`,
        assignee: 'Thủ kho',
        roleCode: 'WAREHOUSE',
        deadline: 'Trong ngày',
        priority: 'medium',
        status: 'pending',
        actionRoute: '/warehouse?view=receipts',
      });
    }

    if (kpis.pendingKitchenConfirmationCount > 0) {
      tasks.push({
        id: 'task-kitchen-confirm',
        title: `Xác nhận nhận ${kpis.pendingKitchenConfirmationCount} phiếu xuất bàn giao tại Bếp`,
        assignee: 'Bếp trưởng',
        roleCode: 'CHEF',
        deadline: 'Trước giờ nấu',
        priority: 'high',
        status: 'pending',
        actionRoute: '/chef?view=issues',
      });
    }

    if (kpis.criticalDataQualityCount > 0) {
      tasks.push({
        id: 'task-data-quality',
        title: `Rà soát ${kpis.criticalDataQualityCount} chỉ số chất lượng dữ liệu và chuẩn hóa ĐVT`,
        assignee: 'Quản trị viên',
        roleCode: 'ADMIN',
        deadline: 'Định kỳ',
        priority: 'normal',
        status: 'in_progress',
        actionRoute: '/admin-data?view=ingredients',
      });
    }

    const stages: StageProgress[] = [
      {
        stageNumber: 1,
        stageName: 'Lập thực đơn & KHSX tuần',
        description: 'Thực đơn tuần và số lượng suất ăn ca đã được phê duyệt.',
        status: 'completed',
        completedCount: 6,
        totalCount: 6,
        actionLabel: 'Xem thực đơn',
        actionRoute: '/weekly-menu',
      },
      {
        stageNumber: 2,
        stageName: 'Tổng hợp BOM & Đề xuất mua hàng',
        description: kpis.shortageCount > 0
          ? `Còn ${kpis.shortageCount} mặt hàng thiếu hụt đang chờ tạo PO.`
          : 'Toàn bộ nhu cầu nguyên liệu đã được cân đối tồn kho.',
        status: kpis.shortageCount > 0 ? 'in_progress' : 'completed',
        completedCount: Math.max(0, 1000 - kpis.shortageCount),
        totalCount: 1000,
        actionLabel: 'Tạo đề xuất PO',
        actionRoute: '/purchasing',
      },
      {
        stageNumber: 3,
        stageName: 'Nhập xuất kho & Bàn giao bếp',
        description: kpis.lateReceiptCount > 0
          ? `Có ${kpis.lateReceiptCount} phiếu nhập trễ hạn cần đôn đốc nhà cung cấp.`
          : 'Tiến độ nhập xuất kho đang bám sát kế hoạch ca.',
        status: kpis.lateReceiptCount > 0 ? 'in_progress' : 'completed',
        completedCount: Math.max(0, 20 - kpis.lateReceiptCount),
        totalCount: 20,
        actionLabel: 'Xem phiếu nhập',
        actionRoute: '/warehouse?view=receipts',
      },
      {
        stageNumber: 4,
        stageName: 'Chế biến ca & Đối soát tiêu hao',
        description: kpis.pendingKitchenConfirmationCount > 0
          ? `Có ${kpis.pendingKitchenConfirmationCount} phiếu xuất chờ Bếp trưởng ký nhận.`
          : 'Công đoạn chế biến ca diễn ra đúng định mức và quy chuẩn.',
        status: kpis.pendingKitchenConfirmationCount > 0 ? 'in_progress' : 'waiting',
        completedCount: 0,
        totalCount: 2,
        actionLabel: 'Bàn giao ca Bếp',
        actionRoute: '/chef?view=plans',
      },
    ];

    return { metrics, tasks, stages };
  },
};
