import { uiCopy } from '@/lib/uiCopy';
import { toQueryView, type QuerySnapshot } from '@/lib/queryView';
import type { StockMovement } from '@/types/workflow';

export type ReportView = 'price' | 'demand' | 'purchase' | 'stock' | 'movement' | 'kitchen' | 'usage' | 'audit' | 'data-quality';
export type PriceSubView = 'lines' | 'supplier' | 'period' | 'dishGroup';

export const reportTabs = [
  { id: 'reports-price', label: 'Biến động giá' },
  { id: 'reports-demand', label: 'Nhu cầu nguyên liệu' },
  { id: 'reports-purchase', label: 'Kế hoạch thu mua' },
  { id: 'reports-stock', label: 'Tồn kho' },
  { id: 'reports-movement', label: 'Nhập/xuất kho' },
  { id: 'reports-kitchen', label: 'Xuất bếp' },
  { id: 'reports-usage', label: 'Sử dụng thực tế' },
  { id: 'reports-audit', label: uiCopy.reports.audit },
  { id: 'reports-data-quality', label: uiCopy.reports.dataQuality },
];

export const movementTypeLabel: Record<StockMovement['type'], string> = {
  receipt: 'Nhập kho',
  issue: 'Xuất kho',
  supplemental: 'Xuất bổ sung',
  return: 'Trả kho',
  adjustment: 'Điều chỉnh',
};

export const priceSubViewTabs: Array<{ id: PriceSubView; label: string }> = [
  { id: 'lines', label: 'Theo dòng nhập' },
  { id: 'supplier', label: 'Theo nhà cung cấp' },
  { id: 'period', label: 'Theo thời gian' },
  { id: 'dishGroup', label: 'Theo nhóm món' },
];

export const validReportViews: ReportView[] = ['price', 'demand', 'purchase', 'stock', 'movement', 'kitchen', 'usage', 'audit', 'data-quality'];
export const standardPageSizeOptions = [8, 20, 50] as const;
export const pricePageSizeOptions = [6, 20, 50] as const;

export const readPositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const readPageSize = (value: string | null, fallback: number, options: readonly number[]) => {
  const parsed = readPositiveInteger(value, fallback);
  return options.includes(parsed) ? parsed : fallback;
};

export const toReportView = <T,>(query: QuerySnapshot<T> & { refetch: () => unknown }, label: string) => toQueryView(query, {
  instruction: `Mở báo cáo ${label} để tải dữ liệu.`,
  retry: () => query.refetch(),
  errorMessage: `Không tải được báo cáo ${label}.`,
  forbiddenMessage: `Bạn không có quyền xem báo cáo ${label}.`,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each view keeps its own row/column pairing.
export type ReportExportConfig = { filename: string; rows: unknown[]; columns: Array<[string, (row: any) => unknown]> };
