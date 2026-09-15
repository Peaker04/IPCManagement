import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportsNavigation } from './ReportsNavigation';
import type { ReportsPageModel } from './useReportsPageModel';

const model = (activeView = 'demand') => ({ activeReportView: { phase: 'ready', isRefreshing: false }, activeView, isViewPending: false, priceSubView: 'lines', resetReportPages: vi.fn(), setRequestedView: vi.fn(), startViewTransition: (callback: () => void) => callback(), updateSearchState: vi.fn(), visibleReportTabs: [
  { id: 'reports-price', label: 'Biến động giá' }, { id: 'reports-demand', label: 'Nhu cầu nguyên liệu' }, { id: 'reports-purchase', label: 'Kế hoạch thu mua' }, { id: 'reports-stock', label: 'Tồn kho' }, { id: 'reports-movement', label: 'Nhập/xuất kho' }, { id: 'reports-kitchen', label: 'Xuất bếp' }, { id: 'reports-usage', label: 'Sử dụng thực tế' }, { id: 'reports-audit', label: 'Nhật ký thay đổi' }, { id: 'reports-data-quality', label: 'Chất lượng dữ liệu' },
] }) as unknown as ReportsPageModel;

describe('Reports business navigation', () => {
  it('uses a compact two-level task switcher instead of category cards', () => {
    const current = model(); render(<ReportsNavigation model={current} />);
    expect(screen.getByRole('tablist', { name: 'Chọn nhóm báo cáo vận hành' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Kế hoạch & nhu cầu' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tablist', { name: 'Chọn báo cáo trong nhóm Kế hoạch & nhu cầu' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Sử dụng thực tế' })).not.toBeInTheDocument();
    expect(screen.queryByText(/↳/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Chi phí & giá' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Kho & sử dụng' }));
    expect(current.setRequestedView).toHaveBeenCalledWith('stock');
  });
});
