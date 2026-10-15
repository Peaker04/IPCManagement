export interface RouteDef {
  path: string;
  title: string;
  frCode: string;
  allowedRoles?: string[];
}

export const CANONICAL_ROUTES: RouteDef[] = [
  {
    path: '/',
    title: 'Tổng quan điều hành',
    frCode: 'FR-DASH',
    allowedRoles: ['Admin', 'Manager', 'Chef', 'WarehouseStaff', 'PurchasingStaff', 'Coordinator', 'Thủ kho', 'Quản lý', 'Điều phối', 'Bếp trưởng', 'Thu mua'],
  },
  {
    path: '/weekly-menu',
    title: 'Thực đơn tuần',
    frCode: 'FR-MENU',
    allowedRoles: ['Admin', 'Manager', 'Chef', 'Coordinator', 'Quản lý', 'Bếp trưởng', 'Điều phối'],
  },
  {
    path: '/meal-orders',
    title: 'Điều phối đơn',
    frCode: 'FR-COORD',
    allowedRoles: ['Admin', 'Manager', 'Coordinator', 'Quản lý', 'Điều phối'],
  },
  {
    path: '/approvals',
    title: 'Duyệt vận hành',
    frCode: 'FR-APPR',
    allowedRoles: ['Admin', 'Manager', 'Quản lý'],
  },
  {
    path: '/purchasing',
    title: 'Thu mua',
    frCode: 'FR-PUR',
    allowedRoles: ['Admin', 'Manager', 'Purchasing', 'PurchaseStaff', 'ProcurementStaff', 'Quản lý', 'Thu mua'],
  },
  {
    path: '/warehouse',
    title: 'Kho nguyên liệu',
    frCode: 'FR-WH',
    allowedRoles: ['Admin', 'Manager', 'WarehouseStaff', 'WarehouseManager', 'ProcurementStaff', 'Quản lý', 'Thủ kho'],
  },
  {
    path: '/chef',
    title: 'Bếp trưởng',
    frCode: 'FR-CHEF',
    allowedRoles: ['Admin', 'Manager', 'Chef', 'HeadChef', 'Kitchen', 'Quản lý', 'Bếp trưởng'],
  },
  {
    path: '/reconciliation',
    title: 'Đối soát nguyên liệu',
    frCode: 'FR-RECON',
    allowedRoles: ['Admin', 'Manager', 'WarehouseStaff', 'WarehouseManager', 'Quản lý', 'Thủ kho'],
  },
  {
    path: '/reports',
    title: 'Báo cáo vận hành',
    frCode: 'FR-REP',
    allowedRoles: ['Admin', 'Manager', 'Chef', 'Coordinator', 'Purchasing', 'WarehouseStaff', 'Quản lý', 'Bếp trưởng', 'Điều phối', 'Thu mua', 'Thủ kho'],
  },
  {
    path: '/admin-data',
    title: 'Quản trị dữ liệu',
    frCode: 'FR-CAT',
    allowedRoles: ['Admin', 'Manager', 'Quản lý'],
  },
  {
    path: '/settings/approval-rules',
    title: 'Thiết lập quy trình duyệt',
    frCode: 'FR-ADMIN',
    allowedRoles: ['Admin', 'Manager', 'Quản lý'],
  },
  {
    path: '/settings/advanced',
    title: 'Thiết lập nâng cao',
    frCode: 'FR-SYS',
    allowedRoles: ['Admin'],
  },
  {
    path: '/login',
    title: 'Đăng nhập hệ thống',
    frCode: 'FR-AUTH',
  },
  {
    path: '/forbidden',
    title: 'Truy cập bị từ chối (403)',
    frCode: 'FR-AUTH',
  },
];
