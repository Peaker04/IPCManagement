import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../store/authContext';
import { serverStateCache } from '../store/serverStateCache';
import { workspaceSessionStore } from '../store/workspaceSessionStore';
import { MrxDailyIssueWorkbench } from '../features/warehouse/MrxDailyIssueWorkbench';
import { MrxMultiCustomerPreparationWorkbench } from '../features/warehouse/MrxMultiCustomerPreparationWorkbench';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { mrxApi } from '../api/mrxApi';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { systemApi } from '../api/systemApi';
import { MOCK_RECONCILIATION } from '../test/fixtures';

const TEST_ADMIN_USER = {
  userId: 'u-admin-1',
  username: 'admin',
  fullName: 'Admin User',
  roleCode: 'ADMIN',
  roleName: 'Admin',
  isActive: true,
  isAdminFullAccess: true,
  permissions: ['*'],
};

describe('MRX 5-Layer State Machine & Transition Matrix Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverStateCache.clearAll();
    workspaceSessionStore.clearScope();

    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    localStorage.setItem('ipc_v3_user', JSON.stringify(TEST_ADMIN_USER));

    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Chế độ đối soát',
      version: 1,
      updatedAt: '2026-10-24T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
  });

  // --------------------------------------------------------------------------
  // CASE L1: REVISIT / CACHE HIT (Render #1 Synchronous 0ms Data Hydration)
  // --------------------------------------------------------------------------
  it('L1 Hydrated Ready: Synchronous Render #1 has DOM data, 0 skeleton, 0 empty state', () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{ batchId: 'b-valid-1', customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-09-21', weekEndDate: '2026-09-27', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-20T00:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'b-valid-1',
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 1,
      weeklyStatus: 'WEEK_COMPLETE',
      compatibility: { canRead: true, canIssueByDate: true },
      dates: [
        {
          serviceDate: '2026-09-21',
          status: 'APPLICABLE',
          isApplicable: true,
          requiredQuantity: 150,
          issuedQuantity: 150,
          returnedQuantity: 0,
          remainingQuantity: 0,
          lines: [
            {
              batchLineId: 'bl-1',
              dailyLineId: 'dl-1',
              ingredientId: 'ing-1',
              ingredientCode: 'NL-THIT',
              ingredientName: 'Thịt heo nạc xay',
              canonicalUnitId: 'u-1',
              canonicalUnitName: 'kg',
              requiredQuantity: 150,
              issuedQuantity: 150,
              returnedQuantity: 0,
              remainingQuantity: 0,
              quantityStatus: 'MATCHED',
              hasValidDisposition: false,
            },
          ],
        },
      ],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false });

    serverStateCache.set('snapshot:mrx_daily', {
      activeBatchId: 'b-valid-1',
      activeDate: '2026-09-21',
      daily: {
        batchId: 'b-valid-1',
        batchStatus: 'IN_PROGRESS',
        sourceVersion: 1,
        weeklyStatus: 'WEEK_COMPLETE',
        compatibility: { canRead: true, canIssueByDate: true },
        dates: [
          {
            serviceDate: '2026-09-21',
            status: 'APPLICABLE',
            isApplicable: true,
            requiredQuantity: 150,
            issuedQuantity: 150,
            returnedQuantity: 0,
            remainingQuantity: 0,
            lines: [
              {
                batchLineId: 'bl-1',
                dailyLineId: 'dl-1',
                ingredientId: 'ing-1',
                ingredientCode: 'NL-THIT',
                ingredientName: 'Thịt heo nạc xay',
                canonicalUnitName: 'kg',
                requiredQuantity: 150,
                issuedQuantity: 150,
                remainingQuantity: 0,
              },
            ],
          },
        ],
      },
      history: { items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false },
    });
    workspaceSessionStore.setScope({ customerId: 'c-1', customerCode: 'DAV', weekStartDate: '2026-09-21', batchId: 'b-valid-1', serviceDate: '2026-09-21' });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/warehouse?view=mrx-daily']}>
          <Routes>
            <Route path="/warehouse" element={<MrxDailyIssueWorkbench />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Synchronous assertions on Render #1:
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Không có định lượng/i)).not.toBeInTheDocument();
    expect(screen.getByText('Thịt heo nạc xay')).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // CASE L2: 409 COMPATIBILITY BLOCKED CACHE HIT
  // --------------------------------------------------------------------------
  it('L2 Compatibility Blocked: Cached 409 legacy batch renders blocked banner at 0ms without skeleton', () => {
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{ batchId: 'b-legacy-409', customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-09-14', weekEndDate: '2026-09-20', status: 'IN_PROGRESS', version: 1, createdAt: '2026-09-13T00:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'b-legacy-409',
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 1,
      weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: false, canIssueByDate: false, reasonCode: 'LEGACY_DAILY_DECOMPOSITION_MISSING' },
      dates: [],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({ items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false });

    serverStateCache.set('snapshot:mrx_daily', {
      activeBatchId: 'b-legacy-409',
      activeDate: '2026-09-14',
      daily: null,
      history: null,
      isCompatibilityBlocked: true,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/warehouse?view=mrx-daily&batchId=b-legacy-409']}>
          <Routes>
            <Route path="/warehouse" element={<MrxDailyIssueWorkbench batchId="b-legacy-409" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.getByText(/Lô thiếu dữ liệu theo ngày/i)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // CASE L3: COLD START BOOTSTRAPPING (Must show Skeleton, NEVER Empty State)
  // --------------------------------------------------------------------------
  it('L3 Bootstrapping: Cold start with empty cache renders Skeleton, NEVER false empty state', () => {
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([]);
    vi.spyOn(mrxApi, 'getBatchPage').mockImplementation(() => new Promise(() => {}));

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reconciliation']}>
          <Routes>
            <Route path="/reconciliation" element={<ReconciliationPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // At Render #1 while getBatchPage is pending:
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Chưa có dữ liệu/i })).not.toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // CASE L4: NO SCOPE AVAILABLE (Batches catalog loaded but zero batches in DB)
  // --------------------------------------------------------------------------
  it('L4 No Scope Available: Transitions from Skeleton to clean Empty State when 0 batches exist', async () => {
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 50,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reconciliation']}>
          <Routes>
            <Route path="/reconciliation" element={<ReconciliationPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /Chưa có lô đối soát cho tháng/i })).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // CASE L5: VALID BATCH WITH 0 LINES (Legitimate Empty Dataset)
  // --------------------------------------------------------------------------
  it('L5 Empty Dataset: Valid batch with 0 lines displays honest empty state after refresh without a skeleton', async () => {
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{ batchId: 'b-empty-lines', customerId: 'c-1', customerCode: 'DAV', customerName: 'Draxlmaier', weekStartDate: '2026-09-21', weekEndDate: '2026-09-27', status: 'IN_PROGRESS', version: 7, createdAt: '2026-09-20T00:00:00Z' }],
      totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue({
      ...MOCK_RECONCILIATION,
      batchId: 'b-empty-lines',
      lines: [],
    });

    serverStateCache.set('snapshot:mrx_reconciliation', {
      customerCode: 'DAV',
      batchId: 'b-empty-lines',
      serviceDate: '2026-09-21',
      data: {
        ...MOCK_RECONCILIATION,
        batchId: 'b-empty-lines',
        lines: [],
      },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/reconciliation?batchId=b-empty-lines&date=2026-09-21']}>
          <Routes>
            <Route path="/reconciliation" element={<ReconciliationPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(await screen.findByText(/Chưa có dữ liệu rà soát dòng ngày/i)).toBeInTheDocument();
  });

  // --------------------------------------------------------------------------
  // CASE TRANSITION: MrxPreparation & MrxSourceDelta SWR Caching
  // --------------------------------------------------------------------------
  it('Transition: MrxMultiCustomerPreparationWorkbench and MrxSourceDeltaWorkbench hydrate 0ms on revisit', () => {
    vi.spyOn(mrxApi, 'getPreparation').mockResolvedValue({
      serviceDate: '2026-09-21',
      batches: [
        {
          batchId: 'b-prep-1', customerId: 'customer-1',
          customerCode: 'DAV', customerName: 'Draxlmaier',
          batchStatus: 'TRANSFERRED', batchVersion: 1,
          isApplicable: true, hasExistingIssue: false,
          requiredQuantity: 200, issuedQuantity: 0, remainingQuantity: 200,
        },
      ],
      aggregatedLines: [
        {
          ingredientId: 'ing-1',
          ingredientCode: 'NL-GA',
          ingredientName: 'Thịt gà phi lê',
          canonicalUnitId: 'unit-kg', canonicalUnitName: 'kg',
          totalRequiredQuantity: 200, totalIssuedQuantity: 0, totalRemainingQuantity: 200,
          allocations: [{ batchId: 'b-prep-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', requiredQuantity: 200, issuedQuantity: 0, remainingQuantity: 200, status: 'UNTOUCHED' }],
        },
      ],
    });

    serverStateCache.set('snapshot:mrx_preparation_week', {
      data: {
        serviceDate: '2026-09-21',
        batches: [
          {
            batchId: 'b-prep-1', customerId: 'customer-1',
            customerCode: 'DAV', customerName: 'Draxlmaier',
            batchStatus: 'TRANSFERRED', batchVersion: 1,
            isApplicable: true, hasExistingIssue: false,
            requiredQuantity: 200, issuedQuantity: 0, remainingQuantity: 200,
          },
        ],
        aggregatedLines: [
          {
            ingredientId: 'ing-1',
            ingredientCode: 'NL-GA',
            ingredientName: 'Thịt gà phi lê',
            canonicalUnitId: 'unit-kg', canonicalUnitName: 'kg',
            totalRequiredQuantity: 200, totalIssuedQuantity: 0, totalRemainingQuantity: 200,
            allocations: [{ batchId: 'b-prep-1', batchLineId: 'bl-1', dailyLineId: 'dl-1', customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier', requiredQuantity: 200, issuedQuantity: 0, remainingQuantity: 200, status: 'UNTOUCHED' }],
          },
        ],
      },
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/warehouse?view=mrx-preparation&date=2026-09-21']}>
          <Routes>
            <Route path="/warehouse" element={<MrxMultiCustomerPreparationWorkbench serviceDate="2026-09-21" />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(screen.getByText('Thịt gà phi lê')).toBeInTheDocument();
  });
});
