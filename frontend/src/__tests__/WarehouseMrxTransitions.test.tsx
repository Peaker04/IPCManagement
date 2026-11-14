import { renderWarehouse } from '../test/renderWarehouse';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { MrxSupplementalIssueModal } from '../features/warehouse/MrxSupplementalIssueModal';
import { WarehousePage } from '../features/warehouse/WarehousePage';
import { AuthProvider } from '../store/authContext';
import { warehouseApi } from '../api/warehouseApi';
import { systemApi } from '../api/systemApi';
import { serverStateCache } from '../store/serverStateCache';
import { MrxBatchDishesModal } from '../components/workbench/MrxBatchDishesModal';
import { mrxApi } from '../api/mrxApi';
import { MOCK_WAREHOUSES, MOCK_ISSUES, MOCK_RECEIPTS } from '../test/fixtures';

describe('Warehouse MRX transitions', () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'DEFAULT',
      label: 'Mặc định',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-1',
        customerId: 'c-1',
        customerName: 'Khách A',
        customerCode: 'KA',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 1,
        createdAt: '2026-10-19T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 50,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });
    vi.spyOn(warehouseApi, 'getWarehouses').mockResolvedValue(MOCK_WAREHOUSES);
    vi.spyOn(warehouseApi, 'getIssues').mockResolvedValue(MOCK_ISSUES);
    vi.spyOn(warehouseApi, 'getReceipts').mockResolvedValue(MOCK_RECEIPTS);
  });

  it('E7: redirects non-MRX views (e.g. ?view=issues) to ?view=mrx-daily when operationalMode is MATERIAL_RECONCILIATION', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-10-19T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} },
    });
    const getDailySpy = vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1', batchStatus: 'IN_PROGRESS', sourceVersion: 1, weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true }, dates: [],
    });
    const router = createMemoryRouter([{ path: '/warehouse', element: <WarehousePage /> }], {
      initialEntries: ['/warehouse?view=issues'],
    });
    render(<AuthProvider><RouterProvider router={router} /></AuthProvider>);
    expect(await screen.findByRole('heading', { name: 'Xuất kho nguyên liệu theo ngày' })).toBeVisible();
    expect(router.state.location.search).toContain('view=mrx-daily');
    await waitFor(() => expect(getDailySpy).toHaveBeenCalledWith('batch-1'));
  });

  it('H3: MrxDailyLinesBranch renders revision metadata inside LocalFindBar without mounting a separate banner above LocalFindBar, and keeps date tabs + LocalFindBar mounted on Lịch sử phiếu tab', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1',
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 2,
      weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true },
      dates: [{
        serviceDate: '2026-10-19',
        status: 'OPEN',
        isApplicable: true,
        requiredQuantity: 20,
        issuedQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 20,
        lastRevisionAt: '2026-10-31T01:30:00Z',
        lastRevisionByName: 'Nguyễn Quản Lý',
        lastRevisionByRole: 'MANAGER',
        lines: [{
          dailyLineId: 'dl-1',
          batchLineId: 'bl-1',
          ingredientId: 'ing-1',
          ingredientCode: 'GAO',
          ingredientName: 'Gạo tám thơm',
          canonicalUnitId: 'u-1',
          canonicalUnitName: 'kg',
          requiredQuantity: 20,
          issuedQuantity: null,
          returnedQuantity: 0,
          remainingQuantity: 20,
          hasValidDisposition: false,
          quantityStatus: 'UNTOUCHED',
        }],
      }],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({
      items: [{
        issueId: 'iss-1',
        issueCode: 'PX-20261019-01',
        issueDate: '2026-10-19',
        shiftName: 'MORNING',
        issuedBy: 'user-1',
        issuedByName: 'Thủ kho A',
        warehouseId: 'wh-1',
        sourceFamily: 'MRX',
        createdAt: '2026-10-19T08:00:00Z',
        provisions: [],
        lines: [],
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });

    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');
    const revTitle = await screen.findByText('Định lượng đã được điều chỉnh');
    const searchInput = screen.getByLabelText('Tìm kiếm nguyên liệu xuất kho');
    expect(searchInput.closest('div.border-b')).toContainElement(revTitle);

    await userEvent.click(screen.getByRole('button', { name: /Lịch sử phiếu/ }));
    expect(screen.getByRole('button', { name: /Cả tuần/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Tìm kiếm trong lịch sử phiếu xuất')).toBeInTheDocument();
  });

  it('H9: keeps the source-history total and previous rows readable while loading the next page', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    let resolvePage2 = (() => {}) as (val: Awaited<ReturnType<typeof mrxApi.getSourceDeltas>>) => void;
    vi.spyOn(mrxApi, 'getSourceDeltas').mockImplementation((page) => {
      if (page === 2) {
        return new Promise((resolve) => {
          resolvePage2 = resolve;
        });
      }
      return Promise.resolve({
        items: [{
          sourceDeltaId: 'd-1',
          batchId: 'b-1',
          sourceRevisionId: 'rev-1',
          serviceDate: '2026-10-19',
          ingredientId: 'i-1',
          ingredientCode: 'GAO',
          ingredientName: 'Gạo ST25',
          canonicalUnitId: 'u-1',
          canonicalUnitName: 'kg',
          previousRequiredQuantity: 10,
          newRequiredQuantity: 15,
          deltaQuantity: 5,
          workKind: 'SOURCE_CHANGE',
          status: 'APPLIED',
          version: 1,
          createdAt: '2026-10-19T08:00:00Z',
        }],
        totalCount: 30,
        pageNumber: 1,
        pageSize: 25,
        totalPages: 2,
        hasPrev: false,
        hasNext: true,
      });
    });

    renderWarehouse('/warehouse?view=mrx-issues');
    expect(await screen.findByText('Gạo ST25')).toBeInTheDocument();
    const pager = screen.getByRole('navigation', { name: 'Phân trang lịch sử thay đổi nguồn' });
    expect(pager).toHaveTextContent('30 kết quả');

    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(pager).toHaveTextContent('30 kết quả');
    expect(screen.getByText('Gạo ST25')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();

    resolvePage2({
      items: [],
      totalCount: 30,
      pageNumber: 2,
      pageSize: 25,
      totalPages: 2,
      hasPrev: true,
      hasNext: false,
    });
  });

  it('I3 & I6: MrxDailyDateTabsBranch reserves fixed checkmark slot width across issued/unissued days and MrxPrepAllocationsBranch keeps DataGrid table mounted when date has 0 batches', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-1',
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 1,
      weeklyStatus: 'IN_PROGRESS',
      compatibility: { canRead: true, canIssueByDate: true },
      dates: [
        {
          serviceDate: '2026-10-19',
          status: 'COMPLETE',
          isApplicable: true,
          requiredQuantity: 10,
          issuedQuantity: 10,
          returnedQuantity: 0,
          remainingQuantity: 0,
          lines: [{
            dailyLineId: 'dl-1',
            batchLineId: 'bl-1',
            ingredientId: 'ing-1',
            ingredientName: 'Gạo',
            canonicalUnitId: 'u-1',
            canonicalUnitName: 'kg',
            requiredQuantity: 10,
            issuedQuantity: 10,
            returnedQuantity: 0,
            remainingQuantity: 0,
            hasValidDisposition: false,
            quantityStatus: 'EXACT',
          }],
        },
        {
          serviceDate: '2026-10-20',
          status: 'UNTOUCHED',
          isApplicable: true,
          requiredQuantity: 10,
          issuedQuantity: 0,
          returnedQuantity: 0,
          remainingQuantity: 10,
          lines: [{
            dailyLineId: 'dl-2',
            batchLineId: 'bl-1',
            ingredientId: 'ing-1',
            ingredientName: 'Gạo',
            canonicalUnitId: 'u-1',
            canonicalUnitName: 'kg',
            requiredQuantity: 10,
            issuedQuantity: null,
            returnedQuantity: 0,
            remainingQuantity: 10,
            hasValidDisposition: false,
            quantityStatus: 'UNTOUCHED',
          }],
        },
      ],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false,
    });

    const { unmount } = renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');
    expect(await screen.findByText('Gạo')).toBeInTheDocument();
    const monBtn = screen.getByRole('button', { name: /^T2/ });
    const tueBtn = screen.getByRole('button', { name: /^T3/ });
    expect(monBtn.querySelector('span.w-3')).not.toBeNull();
    expect(tueBtn.querySelector('span.w-3')).not.toBeNull();
    unmount();

    // I6: mrx-preparation with 0 batches keeps DataGrid table mounted
    vi.spyOn(mrxApi, 'getPreparation').mockResolvedValue({
      serviceDate: '2026-11-02',
      batches: [],
      aggregatedLines: [],
    });
    renderWarehouse('/warehouse?view=mrx-preparation&date=2026-11-02');
    expect(await screen.findByText('Không có lô đối soát trong phạm vi đã chọn')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('L4: keeps source-history pagination mounted during loading and shows an empty state without unused column headings', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    let resolveDeltas!: (val: Awaited<ReturnType<typeof mrxApi.getSourceDeltas>>) => void;
    vi.spyOn(mrxApi, 'getSourceDeltas').mockReturnValueOnce(new Promise((r) => { resolveDeltas = r; }));

    renderWarehouse('/warehouse?view=mrx-issues');
    expect(screen.getByRole('navigation', { name: 'Phân trang lịch sử thay đổi nguồn' })).toBeInTheDocument();

    await act(async () => {
      resolveDeltas({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 25,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
      });
    });

    expect(await screen.findByText('Chưa có lịch sử thay đổi nguồn')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Nguyên liệu' })).not.toBeInTheDocument();
  });

  it('N3: locks border and font-semibold on MrxBatchDishesModal shift filter buttons across active and inactive states', async () => {
    serverStateCache.clearAll();
    serverStateCache.set('mrx_batch_dishes_batch-1', [{
      dishId: 'dish-1',
      dishCode: 'MA-01',
      dishName: 'Thịt kho tàu',
      scopes: [{ serviceDate: '2026-10-19', shiftName: 'Ca sáng', frozenServings: 100 }],
      materials: [{
        batchLineId: 'bl-1',
        dailyLineId: 'dl-1',
        ingredientId: 'ing-1',
        ingredientCode: 'NL-01',
        ingredientName: 'Thịt heo',
        canonicalUnitId: 'u-1',
        canonicalUnitName: 'kg',
        serviceDate: '2026-10-19',
        frozenBomQuantityPerServing: 0.1,
        canonicalQtyPerServing: 0.1,
      }],
    }]);

    render(
      <MrxBatchDishesModal
        isOpen={true}
        onClose={() => {}}
        batchId="batch-1"
      />
    );

    const allBtn = await screen.findByRole('button', { name: 'Tất cả' });
    const morningBtn = screen.getByRole('button', { name: 'Sáng' });
    const afternoonBtn = screen.getByRole('button', { name: 'Chiều' });

    expect(allBtn).toHaveClass('border', 'font-semibold');
    expect(morningBtn).toHaveClass('border', 'font-semibold');
    expect(afternoonBtn).toHaveClass('border', 'font-semibold');

    await userEvent.click(morningBtn);
    expect(allBtn).toHaveClass('border', 'font-semibold');
    expect(morningBtn).toHaveClass('border', 'font-semibold');
  });

  it('N4: hydrates MrxSupplementalIssueModal synchronously from warm mrx_batch_dishes_ cache without refetching getBatchDishes', async () => {
    serverStateCache.clearAll();
    serverStateCache.set('mrx_batch_dishes_batch-1', [{
      dishId: 'dish-1',
      dishCode: 'MA-01',
      dishName: 'Thịt kho tàu ấm',
      scopes: [{ serviceDate: '2026-10-19', shiftName: 'Ca sáng', frozenServings: 100 }],
      materials: [{
        batchLineId: 'bl-1',
        dailyLineId: 'dl-1',
        ingredientId: 'ing-1',
        ingredientCode: 'NL-01',
        ingredientName: 'Thịt heo',
        canonicalUnitId: 'u-1',
        canonicalUnitName: 'kg',
        serviceDate: '2026-10-19',
        frozenBomQuantityPerServing: 0.1,
        canonicalQtyPerServing: 0.1,
      }],
    }]);
    const getBatchDishesSpy = vi.spyOn(mrxApi, 'getBatchDishes').mockImplementation(() => new Promise(() => {}));

    render(
      <MrxSupplementalIssueModal
        isOpen={true}
        onClose={() => {}}
        activeBatchId="batch-1"
        activeDate="2026-10-19"
        lines={[{
          dailyLineId: 'dl-1',
          ingredientName: 'Thịt heo',
          canonicalUnitName: 'kg',
          issuedQuantity: 10,
        }]}
        suppMaterialId="dl-1"
        onSuppMaterialIdChange={() => {}}
        suppQuantity=""
        onSuppQuantityChange={() => {}}
        suppReason=""
        onSuppReasonChange={() => {}}
        suppError={null}
        isSubmittingSupp={false}
        onSubmit={() => {}}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: 'Tính theo món ăn & suất phát sinh' }));
    expect(screen.getByRole('option', { name: /Thịt kho tàu ấm/ })).toBeInTheDocument();
    expect(getBatchDishesSpy).not.toHaveBeenCalled();
    getBatchDishesSpy.mockRestore();
  });

  it('N6: keeps history DataGrid mounted in isPreviousData state without unmounting into WorkbenchSkeleton when switching to history tab while daily is warm in snapshot', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    serverStateCache.clearAll();
    const warmDaily = {
      batchId: 'batch-1',
      batchStatus: 'IN_PROGRESS' as const,
      sourceVersion: 1,
      weeklyStatus: 'IN_PROGRESS' as const,
      compatibility: { canRead: true, canIssueByDate: true },
      dates: [{
        serviceDate: '2026-10-19',
        status: 'COMPLETE' as const,
        isApplicable: true,
        requiredQuantity: 10,
        issuedQuantity: 10,
        returnedQuantity: 0,
        remainingQuantity: 0,
        lines: [{
          dailyLineId: 'dl-1',
          batchLineId: 'bl-1',
          ingredientId: 'ing-1',
          ingredientName: 'Gạo ST25',
          canonicalUnitId: 'u-1',
          canonicalUnitName: 'kg',
          requiredQuantity: 10,
          issuedQuantity: 10,
          returnedQuantity: 0,
          remainingQuantity: 0,
          hasValidDisposition: false,
          quantityStatus: 'EXACT' as const,
        }],
      }],
    };
    // Warm snapshot with daily only (history not yet populated)
    serverStateCache.set('snapshot:mrx_daily', { activeBatchId: 'batch-1', activeDate: '2026-10-19', data: { daily: warmDaily, history: null } });
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-1',
        status: 'IN_PROGRESS',
        version: 1,
        customerId: 'customer-1',
        customerCode: 'DAV',
        customerName: 'Draxlmaier',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-24',
        createdAt: '2026-10-18T00:00:00Z',
      }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockReturnValue(new Promise(() => {}));
    vi.spyOn(mrxApi, 'getIssues').mockReturnValue(new Promise(() => {}));

    const { container } = renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-1&date=2026-10-19');
    expect(await screen.findByText('Gạo ST25')).toBeInTheDocument();

    // Switch to "Lịch sử phiếu" while getIssues is still pending and history is null
    await userEvent.click(screen.getByRole('button', { name: /Lịch sử phiếu/i }));

    // N6: Must NOT unmount into WorkbenchSkeleton ("Đang tải nội dung"); history DataGrid must stay mounted!
    expect(screen.queryByRole('status', { name: 'Đang tải nội dung' })).not.toBeInTheDocument();
    expect(container.querySelectorAll('table')).toHaveLength(1);
    expect(screen.getByRole('searchbox', { name: 'Tìm kiếm trong lịch sử phiếu xuất' })).toBeInTheDocument();
  });

  it('keeps an empty-day search usable and presents the truthful empty table body', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    serverStateCache.clearAll();
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: 'batch-empty-day',
        status: 'IN_PROGRESS',
        version: 1,
        customerId: 'customer-1',
        customerCode: 'DAV',
        customerName: 'Draxlmaier',
        weekStartDate: '2026-09-14',
        weekEndDate: '2026-09-19',
        createdAt: '2026-09-14T00:00:00Z',
      }],
      totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false,
    });
    vi.spyOn(mrxApi, 'getWarehouseDaily').mockResolvedValue({
      batchId: 'batch-empty-day',
      batchStatus: 'IN_PROGRESS',
      sourceVersion: 5,
      weeklyStatus: 'COMPLETE',
      compatibility: { canRead: true, canIssueByDate: true },
      dates: [{
        serviceDate: '2026-09-14',
        status: 'NO_DEMAND',
        isApplicable: false,
        requiredQuantity: 0,
        issuedQuantity: 0,
        returnedQuantity: 0,
        remainingQuantity: 0,
        lines: [],
      }],
    });
    vi.spyOn(mrxApi, 'getIssues').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0, hasPrev: false, hasNext: false,
    });

    renderWarehouse('/warehouse?view=mrx-daily&batchId=batch-empty-day&date=2026-09-14');
    expect(await screen.findByText('Không có nguyên liệu nào cần xuất kho cho ngày đã chọn.')).toBeVisible();
    const search = screen.getByRole('searchbox', { name: 'Tìm kiếm nguyên liệu xuất kho' });
    await userEvent.type(search, 'gạo');
    expect(screen.getByRole('searchbox', { name: 'Tìm kiếm nguyên liệu xuất kho' })).toBe(search);
    expect(search).toHaveValue('gạo');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Không tìm thấy nguyên liệu nào khớp với từ khóa.')).toBeVisible();
  });

  it('renders the project empty-state icon and message without a data table when source history is empty', async () => {
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({
      mode: 'MATERIAL_RECONCILIATION',
      label: 'Đối chiếu nguyên liệu',
      version: 1,
      updatedAt: '2026-10-19T00:00:00Z',
      reasonRequired: false,
      capabilities: { navigation: [], pageTabs: {} },
    });
    serverStateCache.clearAll();
    vi.spyOn(mrxApi, 'getSourceDeltas').mockResolvedValue({
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 25,
      totalPages: 0,
      hasPrev: false,
      hasNext: false,
    });

    const { container } = renderWarehouse('/warehouse?view=mrx-issues');
    expect(await screen.findByText('Chưa có lịch sử thay đổi nguồn')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const iconBadge = container.querySelector('main [aria-hidden="true"]');
    expect(iconBadge).not.toBeNull();
    expect(iconBadge?.querySelector('svg')).not.toBeNull();
  });
});
