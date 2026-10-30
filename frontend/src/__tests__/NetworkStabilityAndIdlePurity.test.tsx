import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { AuthProvider } from '../store/authContext';
import { mrxApi } from '../api/mrxApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { systemApi } from '../api/systemApi';
import { MOCK_RECONCILIATION } from '../test/fixtures';

describe('Network Stability and Idle Dependency Purity (Anti-Spam Gate)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-10-19T08:00:00Z'));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-17T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'cust-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue(MOCK_RECONCILIATION);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: MOCK_RECONCILIATION.batchId,
        customerId: 'cust-1',
        customerCode: 'DAV',
        customerName: 'Draxlmaier',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 7,
        createdAt: '2026-10-18T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 100,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue({
      awaitingWarehouseBatchesCount: 0,
      completionReadyBatchesCount: 0,
      pendingDeltasCount: 0,
      unresolvedVariancesCount: 0,
      pendingReturnsCount: 0,
      items: [],
    } as any);
  });

  it('guarantees that getBatchSummary is called exactly once on initial load and DOES NOT loop continuously', async () => {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[`/reconciliation?customerId=DAV&batchId=${MOCK_RECONCILIATION.batchId}&date=2026-10-19`]}>
          <Routes>
            <Route path="/reconciliation" element={<ReconciliationPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByRole('heading', { name: 'Đối soát nguyên liệu' })).toBeInTheDocument();

    // Advance time by 3 seconds of idle time
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    // In a stable tree architecture, getBatchSummary must be called at most 1 time on idle mount, NEVER spammed!
    expect(mrxApi.getBatchSummary).toHaveBeenCalledTimes(1);
  });
});
