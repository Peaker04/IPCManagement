export interface RouteDef {
  path: string;
  title: string;
  frCode: string;
  allowedRoles?: string[];
}

export const CANONICAL_ROUTES: RouteDef[] = [
  { path: '/', title: 'Tổng quan điều hành', frCode: 'FR-DASH' },
  { path: '/weekly-menu', title: 'Thực đơn tuần', frCode: 'FR-MENU' },
  { path: '/meal-orders', title: 'Điều phối đơn', frCode: 'FR-COORD' },
  { path: '/approvals', title: 'Duyệt vận hành', frCode: 'FR-APPR' },
  { path: '/purchasing', title: 'Thu mua', frCode: 'FR-PUR' },
  { path: '/warehouse', title: 'Kho nguyên liệu', frCode: 'FR-WH' },
  { path: '/chef', title: 'Bếp trưởng', frCode: 'FR-CHEF' },
  { path: '/reconciliation', title: 'Đối soát nguyên liệu', frCode: 'FR-RECON' },
  { path: '/reports', title: 'Báo cáo vận hành', frCode: 'FR-REP' },
  { path: '/admin-data', title: 'Quản trị dữ liệu', frCode: 'FR-CAT' },
  { path: '/settings/approval-rules', title: 'Thiết lập quy trình duyệt', frCode: 'FR-ADMIN' },
  { path: '/settings/advanced', title: 'Thiết lập nâng cao', frCode: 'FR-SYS' },
  { path: '/login', title: 'Đăng nhập hệ thống', frCode: 'FR-AUTH' },
  { path: '/forbidden', title: 'Truy cập bị từ chối (403)', frCode: 'FR-AUTH' },
];
