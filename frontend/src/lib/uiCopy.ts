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
    blocker: 'Vấn đề chặn xử lý',
    reason: 'Lý do',
    sourceHash: 'Mã kiểm tra nguồn',
  },
} as const;

export const formatPaginationRange = (start: number, end: number, total: number) =>
  `Đang xem ${start}–${end} trên tổng ${total}`;
