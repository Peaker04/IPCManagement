import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReportsPage } from '../features/reports/ReportsPage';
import { reportsApi } from '../api/reportsApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';

function renderPage(entry = '/reports?view=demand') {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/reports" element={<ReportsPage />} /></Routes></MemoryRouter>);
}

describe('Reports', () => {
  beforeEach(() => {
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

  it('requests the next server page and reports the authoritative total', async () => {
    renderPage();
    expect(await screen.findByText('26 dòng authoritative')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));

    expect(reportsApi.getDemand).toHaveBeenLastCalledWith(expect.any(String), 'customer-1', 2, 25);
  });

  it('uses URL-owned price report view', async () => {
    renderPage('/reports?view=prices');
    expect(await screen.findByRole('columnheader', { name: 'Phiếu nhập' })).toBeInTheDocument();
    expect(screen.getByText('PN-1')).toBeInTheDocument();
  });
});
