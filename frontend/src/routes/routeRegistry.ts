export type OperationalModeEligibility = 'SHARED' | 'DEFAULT' | 'MATERIAL_RECONCILIATION';
export type SurfaceReadiness = 'READY' | 'PARTIAL' | 'BLOCKED';

export interface RouteLeafDef {
  id: string;
  to: string;
  label: string;
  surfaceId: string;
  capabilityIds: string[];
  allowedRoles?: string[];
  permissions?: string[];
  modes: OperationalModeEligibility[];
  readiness: SurfaceReadiness;
}

export interface RouteDef {
  path: string;
  title: string;
  navigationLabel?: string;
  frCode: string;
  allowedRoles?: string[];
  permissions?: string[];
  modes: OperationalModeEligibility[];
  leaves?: RouteLeafDef[];
}

const ALL_OPERATIONAL_ROLES = ['Admin', 'Manager', 'Chef', 'WarehouseStaff', 'Purchasing', 'PurchaseStaff', 'Coordinator', 'Thủ kho', 'Quản lý', 'Điều phối', 'Bếp trưởng', 'Thu mua'];
const MENU_ROLES = ['Admin', 'Manager', 'Chef', 'Coordinator', 'Quản lý', 'Bếp trưởng', 'Điều phối'];
const WAREHOUSE_ROLES = ['Admin', 'Manager', 'WarehouseStaff', 'WarehouseManager', 'ProcurementStaff', 'Quản lý', 'Thủ kho'];
const CHEF_ROLES = ['Admin', 'Manager', 'Chef', 'HeadChef', 'Kitchen', 'Quản lý', 'Bếp trưởng'];
const REPORT_ROLES = ['Admin', 'Manager', 'Chef', 'Coordinator', 'Purchasing', 'WarehouseStaff', 'Quản lý', 'Bếp trưởng', 'Điều phối', 'Thu mua', 'Thủ kho'];
const ADMIN_MANAGER_ROLES = ['Admin', 'Manager', 'Quản lý'];
const COORDINATOR_ROLES = ['Admin', 'Manager', 'Coordinator', 'Quản lý', 'Điều phối'];

export const CANONICAL_ROUTES: RouteDef[] = [
  { path: '/', title: 'Tổng quan điều hành', navigationLabel: 'Tổng quan', frCode: 'FR-DASH', allowedRoles: ALL_OPERATIONAL_ROLES, modes: ['DEFAULT'] },
  {
    path: '/weekly-menu', title: 'Thực đơn tuần', frCode: 'FR-MENU', allowedRoles: MENU_ROLES, modes: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
    leaves: [
      { id: 'weekly.schedule', to: '/weekly-menu', label: 'Kế hoạch tuần', surfaceId: 'weekly.schedule', capabilityIds: ['MENU.IMPORT.READ', 'COORD.MENU_SCHEDULE.READ', 'COORD.MEAL_PLAN.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'weekly.demand', to: '/weekly-menu?view=demand', label: 'Bàn giao nguyên liệu', surfaceId: 'weekly.demand', capabilityIds: ['PLAN.DEMAND.GENERATE', 'PLAN.DEMAND.STALENESS.READ', 'PLAN.PRODUCTION.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'weekly.production', to: '/weekly-menu?view=production-plan', label: 'Kế hoạch sản xuất', surfaceId: 'weekly.production', capabilityIds: ['PLAN.PRODUCTION.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'weekly.cost', to: '/weekly-menu?view=cost', label: 'Giá vốn & Định mức BOM', surfaceId: 'weekly.cost', capabilityIds: [], modes: ['DEFAULT'], readiness: 'BLOCKED' },
      { id: 'mrx.batch', to: '/weekly-menu?view=mrx-batch', label: 'Chuẩn bị lô đối soát', surfaceId: 'mrx.batch', capabilityIds: ['RECON.BATCH.CREATE', 'RECON.BATCH.PREVIEW_IMPORT', 'RECON.BATCH.COMMIT_IMPORT', 'RECON.BATCH.READY', 'RECON.BATCH.TRANSFER_WAREHOUSE'], allowedRoles: COORDINATOR_ROLES, permissions: ['reconciliation.source.read'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
    ],
  },
  { path: '/meal-orders', title: 'Điều phối đơn', frCode: 'FR-COORD', allowedRoles: ['Admin', 'Manager', 'Coordinator', 'Quản lý', 'Điều phối'], modes: ['DEFAULT'] },
  { path: '/approvals', title: 'Duyệt vận hành', frCode: 'FR-APPR', allowedRoles: ADMIN_MANAGER_ROLES, modes: ['DEFAULT'] },
  { path: '/purchasing', title: 'Thu mua', frCode: 'FR-PUR', allowedRoles: ['Admin', 'Manager', 'Purchasing', 'PurchaseStaff', 'ProcurementStaff', 'Quản lý', 'Thu mua'], modes: ['DEFAULT'] },
  {
    path: '/warehouse', title: 'Kho nguyên liệu', frCode: 'FR-WH', allowedRoles: WAREHOUSE_ROLES, modes: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
    leaves: [
      { id: 'warehouse.issues', to: '/warehouse?view=issues', label: 'Phiếu xuất kho', surfaceId: 'warehouse.issues', capabilityIds: ['WH.ISSUE.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'warehouse.receipts', to: '/warehouse?view=receipts', label: 'Phiếu nhập kho', surfaceId: 'warehouse.receipts', capabilityIds: ['WH.RECEIPT.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'warehouse.stock', to: '/warehouse?view=stock', label: 'Tồn kho hiện tại', surfaceId: 'warehouse.stock', capabilityIds: ['WH.CATALOG.READ', 'REP.INVENTORY.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'mrx.daily', to: '/warehouse?view=mrx-daily', label: 'Định lượng xuất theo ngày', surfaceId: 'mrx.daily', capabilityIds: ['RECON.BATCH.READ', 'WH.ISSUE.CREATE'], allowedRoles: WAREHOUSE_ROLES, permissions: ['reconciliation.warehouse.read'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
      { id: 'mrx.preparation', to: '/warehouse?view=mrx-preparation', label: 'Chuẩn bị xuất phối hợp', surfaceId: 'mrx.daily', capabilityIds: ['RECON.PREPARATION.READ', 'RECON.PREPARATION.ISSUE'], allowedRoles: WAREHOUSE_ROLES, permissions: ['reconciliation.warehouse.read'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
      { id: 'mrx.issues', to: '/warehouse?view=mrx-issues', label: 'Thay đổi nguồn chờ xử lý', surfaceId: 'mrx.issues', capabilityIds: ['WH.ISSUE.READ', 'WH.ISSUE.CREATE'], allowedRoles: WAREHOUSE_ROLES, permissions: ['reconciliation.warehouse.read'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
    ],
  },
  {
    path: '/chef', title: 'Bếp trưởng', frCode: 'FR-CHEF', allowedRoles: CHEF_ROLES, modes: ['DEFAULT', 'MATERIAL_RECONCILIATION'],
    leaves: [
      { id: 'chef.plans', to: '/chef?view=plans', label: 'Kế hoạch sản xuất', surfaceId: 'chef.plans', capabilityIds: ['PLAN.PRODUCTION.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'chef.issues', to: '/chef?view=issues', label: 'Phiếu xuất bàn giao', surfaceId: 'chef.issues', capabilityIds: ['WH.ISSUE.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'mrx.cooking', to: '/chef?view=mrx-cooking', label: 'Phiếu nấu theo lô', surfaceId: 'mrx.cooking', capabilityIds: ['RECON.KITCHEN_REPORT.READ'], allowedRoles: CHEF_ROLES, permissions: ['reconciliation.kitchen.read'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
    ],
  },
  {
    path: '/reconciliation',
    title: 'Đối soát nguyên liệu',
    frCode: 'FR-RECON',
    allowedRoles: ADMIN_MANAGER_ROLES,
    permissions: ['reconciliation.read'],
    modes: ['MATERIAL_RECONCILIATION'],
    leaves: [
      { id: 'reconciliation.lines', to: '/reconciliation', label: 'Rà soát dòng ngày', surfaceId: 'reconciliation.batch', capabilityIds: ['RECON.BATCH.READ', 'RECON.LINE.DISPOSE'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
      { id: 'reconciliation.variances', to: '/reconciliation?view=variances', label: 'Sổ theo dõi chênh lệch', surfaceId: 'reconciliation.batch', capabilityIds: ['RECON.BATCH.READ'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
      { id: 'reconciliation.transactions', to: '/reconciliation?view=transactions', label: 'Lịch sử giao dịch kho', surfaceId: 'reconciliation.batch', capabilityIds: ['RECON.BATCH.READ'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
      { id: 'reconciliation.audit', to: '/reconciliation?view=audit', label: 'Nhật ký kiểm toán', surfaceId: 'reconciliation.batch', capabilityIds: ['RECON.BATCH.READ'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
      { id: 'reconciliation.completed', to: '/reconciliation?view=completed', label: 'Danh bạ lô hoàn tất', surfaceId: 'reconciliation.batch', capabilityIds: ['RECON.BATCH.READ'], modes: ['MATERIAL_RECONCILIATION'], readiness: 'READY' },
    ],
  },
  {
    path: '/reports', title: 'Báo cáo vận hành', frCode: 'FR-REP', allowedRoles: REPORT_ROLES, modes: ['DEFAULT'],
    leaves: [
      { id: 'reports.demand', to: '/reports?view=demand', label: 'Nhu cầu nguyên liệu', surfaceId: 'reports.demand', capabilityIds: ['REP.DEMAND.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'reports.prices', to: '/reports?view=prices', label: 'Biến động giá nhập', surfaceId: 'reports.prices', capabilityIds: ['REP.PRICE.READ'], modes: ['DEFAULT'], readiness: 'READY' },
      { id: 'reports.stock', to: '/reports?view=stock', label: 'Tồn kho hiện tại', surfaceId: 'reports.stock', capabilityIds: ['REP.INVENTORY.READ'], modes: ['DEFAULT'], readiness: 'READY' },
    ],
  },
  {
    path: '/admin-data', title: 'Quản trị dữ liệu', frCode: 'FR-CAT', allowedRoles: ADMIN_MANAGER_ROLES, modes: ['SHARED'],
    leaves: [
      { id: 'admin.ingredients', to: '/admin-data?view=ingredients', label: 'Danh mục nguyên liệu', surfaceId: 'admin.ingredients', capabilityIds: ['CAT.INGREDIENT.READ', 'CAT.UNIT.READ'], modes: ['SHARED'], readiness: 'READY' },
      { id: 'admin.dishes', to: '/admin-data?view=dishes', label: 'Danh mục món ăn', surfaceId: 'admin.dishes', capabilityIds: ['CAT.DISH.READ'], modes: ['SHARED'], readiness: 'READY' },
    ],
  },
  { path: '/settings/approval-rules', title: 'Thiết lập quy trình duyệt', navigationLabel: 'Quy trình phê duyệt', frCode: 'FR-ADMIN', allowedRoles: ADMIN_MANAGER_ROLES, modes: ['DEFAULT'] },
  {
    path: '/settings/advanced', title: 'Thiết lập nâng cao', frCode: 'FR-SYS', allowedRoles: ['Admin'], modes: ['SHARED'],
    leaves: [
      { id: 'admin.mode', to: '/settings/advanced?view=mode', label: 'Chế độ vận hành', surfaceId: 'admin.mode', capabilityIds: ['SYS.MODE.READ', 'SYS.MODE.CHANGE'], modes: ['SHARED'], readiness: 'READY' },
    ],
  },
  { path: '/login', title: 'Đăng nhập hệ thống', frCode: 'FR-AUTH', modes: ['SHARED'] },
  { path: '/forbidden', title: 'Truy cập bị từ chối (403)', frCode: 'FR-AUTH', modes: ['SHARED'] },
];
