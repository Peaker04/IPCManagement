import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportsPage } from '../features/reports/ReportsPage';
import { reportsApi } from '../api/reportsApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { systemApi } from '../api/systemApi';
import { AuthProvider } from '../store/authContext';
import { queryClient } from '../lib/scopedQuery';

function renderPage(entry = '/reports?view=demand') {
  return render(<AuthProvider><MemoryRouter initialEntries={[entry]}><Link to="/reports?view=demand">Mở nhu cầu</Link><Routes><Route path="/reports" element={<ReportsPage />} /></Routes></MemoryRouter></AuthProvider>);
}

describe('Reports', () => {
  beforeEach(() => {
    queryClient.clearAll();
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'DEFAULT', label: 'Mặc định', version: 1, updatedAt: '2026-11-02T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }]);
    vi.spyOn(reportsApi, 'getDemand').mockResolvedValue({ items: [{ requestDate: '2026-10-01', customerCode: 'DAV', customerName: 'Draxlmaier', ingredientId: 'i1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', totalRequiredQty: 10, currentStockQty: 4, suggestedPurchaseQty: 6, issuedQty: 2, receivedByKitchenQty: 1, fulfillmentStatus: 'PARTIAL' }], totalCount: 26, pageNumber: 1, pageSize: 25, totalPages: 2, hasPrev: false, hasNext: true });
    vi.spyOn(reportsApi, 'getPriceVariance').mockResolvedValue({ items: [{ receiptLineId: 'rl1', receiptCode: 'PN-1', receiptDate: '2026-10-01', ingredientId: 'i1', ingredientName: 'Gạo', unitName: 'kg', quantity: 10, unitPrice: 20000, referencePrice: 18000, variancePercent: 11.1, isWarning: true }], totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false });
    vi.spyOn(reportsApi, 'getCurrentStock').mockResolvedValue({ items: [{ warehouseId: 'w1', warehouseName: 'Kho A', ingredientId: 'i1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', currentQty: 4, lastUpdated: '2026-10-15T00:00:00Z' }], totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false });
  });

  it('renders authoritative demand without fabricated meal-cost or export surfaces', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
    expect(screen.getByText('Gạo')).toBeInTheDocument();
    expect(screen.queryByText(/Tổng chi phí|Hao hụt TB|Đạt chuẩn/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xuất báo cáo Excel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('does not declare demand empty while its customer scope is still loading', async () => {
    let resolve!: (customers: Awaited<ReturnType<typeof weeklyMenuApi.getCustomers>>) => void;
    vi.mocked(weeklyMenuApi.getCustomers).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    renderPage();
    expect(screen.queryByText('Chưa có dữ liệu báo cáo')).not.toBeInTheDocument();
    expect(reportsApi.getDemand).not.toHaveBeenCalled();
    await act(async () => resolve([]));
    expect(await screen.findByText('Chưa có dữ liệu báo cáo')).toBeVisible();
  });

  it('retries a failed customer prerequisite before loading demand', async () => {
    vi.mocked(weeklyMenuApi.getCustomers).mockRejectedValueOnce(new Error('Danh sách khách hàng tạm ngừng'));
    renderPage();
    expect(await screen.findByText('Danh sách khách hàng tạm ngừng')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Gạo')).toBeVisible();
    expect(weeklyMenuApi.getCustomers).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed initial load at error until an explicit retry', async () => {
    vi.mocked(reportsApi.getCurrentStock).mockRejectedValueOnce(new Error('Báo cáo tạm ngừng')).mockImplementation(() => new Promise(() => {}));
    renderPage('/reports?view=stock');
    expect(await screen.findByText('Báo cáo tạm ngừng')).toBeVisible();
    expect(reportsApi.getCurrentStock).toHaveBeenCalledTimes(1);
    vi.mocked(reportsApi.getCurrentStock).mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false });
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có dữ liệu báo cáo')).toBeVisible();
    expect(reportsApi.getCurrentStock).toHaveBeenCalledTimes(2);
  });

  it('honors explicit demand navigation after viewing cached stock', async () => {
    renderPage('/reports?view=stock');
    expect(await screen.findByRole('columnheader', { name: 'Kho' })).toBeVisible();
    await userEvent.click(screen.getByRole('link', { name: 'Mở nhu cầu' }));
    expect(await screen.findByRole('columnheader', { name: 'Đề xuất mua' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Kho' })).not.toBeInTheDocument();
  });

  it('does not repopulate a cleared session with a delayed report', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof reportsApi.getCurrentStock>>) => void;
    vi.mocked(reportsApi.getCurrentStock).mockImplementation(() => new Promise(r => { resolve = r; }));
    const page = renderPage('/reports?view=stock');
    await waitFor(() => expect(reportsApi.getCurrentStock).toHaveBeenCalledTimes(1));
    page.unmount();
    queryClient.clearAll();
    await act(async () => resolve({ items: [{ warehouseId: 'w1', warehouseName: 'Kho A', ingredientId: 'i1', ingredientName: 'Gạo', unitId: 'kg', unitName: 'kg', currentQty: 4, lastUpdated: '2026-10-15T00:00:00Z' }], totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false }));
    renderPage('/reports?view=stock');
    expect(screen.queryByText('Kho A')).not.toBeInTheDocument();
  });

  it('requests the next server page and reports the authoritative total', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/dòng số liệu/)).toHaveTextContent('26 dòng số liệu'));

    let resolve!: (value: Awaited<ReturnType<typeof reportsApi.getDemand>>) => void;
    vi.mocked(reportsApi.getDemand).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(reportsApi.getDemand).toHaveBeenLastCalledWith(expect.any(String), 'customer-1', 2, 25);
    expect(screen.getByText('Gạo')).toBeVisible();
    expect(screen.queryByText('Chưa có dữ liệu báo cáo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    await act(async () => resolve({ items: [], totalCount: 26, pageNumber: 2, pageSize: 25, totalPages: 2, hasPrev: true, hasNext: false }));
    expect(await screen.findByText('Chưa có dữ liệu báo cáo')).toBeVisible();
  });

  it('uses URL-owned price report view', async () => {
    renderPage('/reports?view=prices');
    expect(await screen.findByRole('columnheader', { name: 'Phiếu nhập' })).toBeInTheDocument();
    expect(screen.getByText('PN-1')).toBeInTheDocument();
  });

  it('allows manual refresh via header action and provides error retry', async () => {
    const user = userEvent.setup();
    renderPage();

    const refreshBtn = await screen.findByRole('button', { name: 'Làm mới' });
    await user.click(refreshBtn);

    expect(reportsApi.getDemand).toHaveBeenCalledTimes(2);

    // Error retry
    vi.spyOn(reportsApi, 'getDemand').mockRejectedValueOnce(new Error('Lỗi máy chủ báo cáo'));
    await user.click(refreshBtn);

    expect(await screen.findByText('Không thể tải dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Lỗi máy chủ báo cáo')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    await user.click(retryBtn);

    expect(await screen.findByRole('columnheader', { name: 'Nguyên liệu' })).toBeInTheDocument();
  });
});
