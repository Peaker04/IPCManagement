export type WorkflowTone = 'neutral' | 'success' | 'warning' | 'danger';

export type WorkflowLaneId =
  | 'coordination'
  | 'planning'
  | 'management'
  | 'purchasing'
  | 'warehouse'
  | 'kitchen'
  | 'admin';

export type WorkflowStage =
  | 'Chọn menu'
  | 'Nhập số suất'
  | 'Chốt đơn'
  | 'Tính định lượng'
  | 'Kiểm tồn kho'
  | 'Duyệt mua / duyệt xuất'
  | 'Thu mua'
  | 'Nhập kho'
  | 'Xuất kho'
  | 'Bếp nhận'
  | 'Nấu theo KHSX'
  | 'Bổ sung / trả dư'
  | 'Điều chỉnh / thông báo';

export interface WorkflowLane {
  id: WorkflowLaneId;
  label: string;
  owner: string;
  stage: WorkflowStage;
  status: string;
  nextAction: string;
  waiting: number;
  blocked: number;
  done: number;
  tone: WorkflowTone;
  route: string;
}

export interface RoleInboxItem {
  id: string;
  laneId: WorkflowLaneId;
  owner: string;
  title: string;
  description: string;
  due: string;
  nextAction: string;
  tone: WorkflowTone;
  route: string;
}

export type WorkflowDocumentType =
  | 'KHSX'
  | 'Danh sách mua thêm'
  | 'Đơn mua'
  | 'Phiếu nhập'
  | 'Phiếu xuất'
  | 'Phiếu xuất bổ sung'
  | 'Phiếu trả'
  | 'Điều chỉnh';

export interface WorkflowDocumentLine {
  label: string;
  value: string;
  tone?: WorkflowTone;
}

export interface WorkflowDocument {
  id: string;
  type: WorkflowDocumentType;
  title: string;
  status: string;
  owner: string;
  summary: string;
  route: string;
  lines: WorkflowDocumentLine[];
  tone: WorkflowTone;
}

export type ApprovalType = 'purchase' | 'issue' | 'adjustment' | 'price-alert';

export interface ApprovalRecord {
  id: string;
  targetType?: string;
  targetId?: string;
  type: ApprovalType;
  title: string;
  source: string;
  owner: string;
  submittedBy: string;
  deadline: string;
  status: string;
  reason: string;
  nextAction: string;
  tone: WorkflowTone;
  materials: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
}

export interface DemandLine {
  id: string;
  materialRequestId?: string;
  purchaseRequestId?: string;
  purchaseRequestLineId?: string;
  supplierId?: string;
  ingredientId?: string;
  estimatedUnitPrice?: number;
  referenceUnitPrice?: number;
  priceVariancePercent?: number;
  isPriceWarning?: boolean;
  expectedDeliveryDate?: string;
  note?: string;
  sourceDocumentCode?: string;
  serviceDate?: string;
  material: string;
  required: number;
  available: number;
  reserved: number;
  unit: string;
  source: string;
  appliedPortionRuleId?: string | null;
  appliedPortionRuleSource?: string;
  appliedPortionRatePercent?: number;
  bomRatePercent?: number;
  yieldLossPercent?: number | null;
  status: string;
  nextAction: string;
  tone: WorkflowTone;
}

export type StockMovementType = 'receipt' | 'issue' | 'supplemental' | 'return' | 'adjustment';

export interface StockMovement {
  id: string;
  type: StockMovementType;
  documentNo: string;
  material: string;
  quantity: number;
  unit: string;
  owner: string;
  status: string;
  nextAction: string;
  tone: WorkflowTone;
}
