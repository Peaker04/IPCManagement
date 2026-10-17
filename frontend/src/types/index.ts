export type OperationalMode = 'DEFAULT' | 'MATERIAL_RECONCILIATION';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
}

export interface UserInfo {
  userId: string;
  fullName: string;
  username: string;
  roleCode: string;
  roleName: string;
  isActive: boolean;
  isAdminFullAccess: boolean;
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

export interface CustomerOption {
  customerId: string;
  customerCode: string;
  customerName: string;
}

export interface DashboardTask {
  id: string;
  title: string;
  assignee: string;
  roleCode: string;
  deadline: string;
  priority: 'high' | 'medium' | 'normal';
  status: 'pending' | 'in_progress' | 'completed';
  actionRoute: string;
}

export interface StageProgress {
  stageNumber: number;
  stageName: string;
  description: string;
  status: 'completed' | 'in_progress' | 'waiting' | 'blocked';
  completedCount: number;
  totalCount: number;
  actionLabel?: string;
  actionRoute?: string;
}

export interface MetricCardItem {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  trend?: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

export interface MaterialDemandItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  dishNames: string[];
  requiredQuantity: number;
  issuedQuantity: number;
  remainingQuantity: number;
  status: 'missing' | 'in_progress' | 'fulfilled';
}

export interface ProductionPlanItem {
  planId: string;
  planCode: string;
  dishId: string;
  dishName: string;
  shiftName: string;
  plannedServings: number;
  actualServings?: number;
  serviceDate: string;
  status: 'draft' | 'sent_to_kitchen' | 'completed';
}

export interface BomIngredientItem {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  quantityPerServing: number;
  grossWeight: number;
  unitPrice: number;
  lineCost: number;
}

export interface DishCostSummaryItem {
  dishId: string;
  dishCode: string;
  dishName: string;
  categoryName: string;
  servingTargetPrice: number;
  calculatedCost: number;
  bomItemsCount: number;
  costRatioPercent: number;
  bomLines: BomIngredientItem[];
}

export interface DailyMaterialSummaryItem {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  totalQuantity: number;
  estimatedAmount: number;
}

export interface ScheduleMatrixCell {
  dishId: string;
  dishName: string;
  category: 'mon_man' | 'mon_canh' | 'mon_xao' | 'trang_mieng';
  priceTier: number;
}

export interface ScheduleDayColumn {
  dayName: string; // "Thứ Hai", "Thứ Ba"...
  dateStr: string; // "21/09/2026"
  cells: ScheduleMatrixCell[];
}

export interface WeeklyScheduleMatrixRow {
  sectionTitle: string; // e.g. "MENU MẶN CA SÁNG", "MENU CHAY CA SÁNG"
  slotLabel: string;    // e.g. "Món chính", "Phụ 1", "Rau", "Canh", "Sữa chua / Tráng miệng"
  days: Record<string, string>; // serviceDate ISO string (2026-09-21) -> dishName
}
