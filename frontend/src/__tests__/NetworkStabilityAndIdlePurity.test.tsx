import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { AuthProvider } from '../store/authContext';

// ReconciliationContracts.cs and PagedResponseDto: all substitutions stay at HTTP.
describe('MRX active-workspace request ownership', () => {
  it('keeps customer and batch catalogues stable across view/date navigation and loads only the selected audit branch', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    const batch = { batchId: 'batch-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19', weekEndDate: '2026-10-25', status: 'IN_PROGRESS', version: 7,
      createdAt: '2026-10-18T00:00:00Z', lines: [], dailyReview: { weeklyStatus: 'WEEK_COMPLETE', lines: [] } };
    const reads: URL[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = new URL(String(input), 'http://localhost');
      reads.push(url);
      let data: unknown;
      if (url.pathname.endsWith('/system-operation-mode')) data = { mode: 'MATERIAL_RECONCILIATION', label: 'Đối soát', version: 1, updatedAt: '2026-10-19T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } };
      else if (url.pathname.endsWith('/coordination/customers')) data = [{ customerId: batch.customerId, customerCode: batch.customerCode, customerName: batch.customerName }];
      else if (url.pathname.endsWith('/batches')) data = { items: [batch], totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false };
      else if (url.pathname.endsWith('/batch-1')) data = batch;
      else if (url.pathname.endsWith('/transactions-history')) data = { items: [{ transactionType: 'INITIAL_ISSUE', documentCode: 'PX-1', date: '2026-10-19', batchId: batch.batchId, customerName: batch.customerName, ingredientCode: 'GAO', ingredientName: 'Gạo', unitName: 'kg', quantity: 2, actorName: 'Thủ kho', createdAt: '2026-10-19T05:00:00Z', reason: null }], totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false };
      else if (url.pathname.endsWith('/audit-trail')) data = { rows: [{ auditId: 'audit-' + url.searchParams.get('pageNumber'), changedAt: '2026-10-19T07:00:00Z', changedBy: 'Thủ kho', businessArea: 'Inventory', entityName: 'InventoryIssue', entityId: 'issue-1', fieldName: 'IssuedQuantity', oldValue: '1', newValue: '2', reason: url.searchParams.get('pageNumber') === '2' ? 'Ghi nhận cũ hơn' : 'Ghi nhận trang đầu' }], totalCount: 51 };
      else if (url.pathname.endsWith('/source-changes')) data = [{ changeId: 'change-1', changedAt: '2026-10-19T07:00:00Z', actor: 'Điều phối', businessArea: 'WeeklyMenu', entityName: 'MenuItem', entityId: null, fieldName: 'Servings', oldValue: '100', newValue: '120', reason: 'Điều chỉnh số suất' }];
      else throw new Error(`Unexpected workspace read ${url.pathname}`);
      return Response.json({ success: true, data });
    });
    const router = createMemoryRouter([{ path: '/reconciliation', element: <ReconciliationPage /> }], {
      initialEntries: ['/reconciliation?customerId=DAV&batchId=batch-1&date=2026-10-19&view=transactions'],
    });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
    expect(await screen.findByText('PX-1')).toBeVisible();
    const count = (suffix: string) => reads.filter(url => url.pathname.endsWith(suffix)).length;
    expect(count('/coordination/customers')).toBe(1);
    expect(count('/batches')).toBe(1);
    expect(screen.queryByRole('textbox', { name: 'Ngày đối soát' })).not.toBeInTheDocument();
    expect(screen.queryByText('Chờ hoàn tất xuất kho các ngày')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chốt đối soát tuần' })).not.toBeInTheDocument();
    await act(async () => { await router.navigate('/reconciliation?customerId=DAV&batchId=batch-1&date=2026-10-26&view=transactions'); });
    expect(screen.getByText('PX-1')).toBeVisible();
    expect(count('/transactions-history')).toBe(1);
    expect(count('/batches')).toBe(1);
    await act(async () => { await router.navigate('/reconciliation?customerId=DAV&batchId=batch-1&date=2026-10-20&view=audit'); });
    expect(await screen.findByText('Ghi nhận trang đầu')).toBeVisible();
    expect(count('/batches')).toBe(1);
    expect(count('/source-changes')).toBe(0);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Phân trang nhật ký kiểm toán' })).getByRole('button', { name: 'Trang sau' }));
    expect(await screen.findByText('Ghi nhận cũ hơn')).toBeVisible();
    expect(count('/source-changes')).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: /Nguồn & BOM/ }));
    expect(await screen.findByText('Điều chỉnh số suất')).toBeVisible();
    expect(count('/source-changes')).toBe(1);
    expect(count('/audit-trail')).toBe(2);
    expect(count('/coordination/customers')).toBe(1);
    expect(count('/batches')).toBe(1);
  });
});
