export const uiCopy = {
  navigation: {
    primary: 'Điều hướng chính',
    account: 'Tài khoản đang đăng nhập',
    skipToContent: 'Bỏ qua điều hướng',
  },
  actions: {
    logout: 'Đăng xuất',
    previousPage: 'Trang trước',
    nextPage: 'Trang sau',
  },
  technical: {
    bomCanonical: 'BOM chuẩn',
    bom: 'Định mức nguyên liệu (BOM)',
    blocker: 'Vấn đề chặn xử lý',
    reason: 'Lý do',
    sourceHash: 'Mã kiểm tra nguồn',
  },
  reports: {
    audit: 'Nhật ký thay đổi',
    dataQuality: 'Chất lượng dữ liệu',
    pending: 'Đang chờ xử lý',
    owner: 'Người phụ trách',
    error: 'Lỗi',
    warning: 'Cảnh báo',
    priority: 'Mức ưu tiên',
    open: 'Đang mở',
    resolvedWithIssues: 'Đã xử lý nhưng còn lỗi',
    reopened: 'Mở lại',
    preProductionQuality: 'Chất lượng dữ liệu trước khi vận hành',
  },
  workflow: {
    owner: 'Người phụ trách',
    deadline: 'Hạn xử lý',
    action: 'Thao tác',
    sla: 'Chỉ tiêu SLA',
    documentCode: 'Mã chứng từ',
    copyDocumentCode: 'Sao chép mã chứng từ',
  },
} as const;

export const formatPaginationRange = (start: number, end: number, total: number) =>
  `Đang xem ${start}–${end} trên tổng ${total}`;
