import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ReconciliationPage } from '../features/reconciliation/ReconciliationPage';
import { ReconciliationDashboardPage } from '../features/dashboard/ReconciliationDashboardPage';
import { AuthProvider } from '../store/authContext';
import { isRouteEligible } from '../routes/navigationEligibility';
import { CANONICAL_ROUTES } from '../routes/routeRegistry';
import { mrxApi, type MrxBatchSummary } from '../api/mrxApi';
import * as apiTransport from '../api/client';
import { weeklyMenuApi } from '../api/weeklyMenuApi';
import { MOCK_RECONCILIATION, MOCK_RECONCILIATION_BATCH_DTO } from '../test/fixtures';
import { ApiError } from '../api/client';
import { systemApi } from '../api/systemApi';
import { serverStateCache } from '../store/serverStateCache';

const defaultSummary = { ...MOCK_RECONCILIATION, weekStartDate: '2026-10-19', weekEndDate: '2026-10-24' };


async function selectReviewBatch(batchId: string) {
  const select = await screen.findByRole('combobox', { name: 'Chọn lô đối soát' });
  await waitFor(() => expect(select).toBeEnabled());
  await userEvent.selectOptions(select, batchId);
}

function renderReconciliation(initialEntry = '/reconciliation') {
  return render(
    <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reconciliation" element={<ReconciliationPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('Reconciliation transitions and reports', () => {
  it('searches the full warehouse and source audit scope on the server', async () => {
    const auditRow = { auditId: 'older-audit', changedAt: '2024-11-18T08:00:00Z', changedBy: 'Thủ kho', businessArea: 'Inventory',
      entityName: 'InventoryIssue', entityId: 'issue-1', fieldName: 'Status', oldValue: 'DRAFT', newValue: 'READY', reason: 'Older warehouse match' };
    const warehouse = vi.spyOn(mrxApi, 'getAuditTrail').mockImplementation(async (_batch, _page, _size, search) => ({ rows: search ? [auditRow] : [], totalCount: search ? 1 : 105 }));
    const source = vi.spyOn(mrxApi, 'getSourceChangesPage').mockImplementation(async (_batch, page = 1, _size, search) => ({
      items: search ? [{ changeId: 'older-source', changedAt: auditRow.changedAt, actor: 'Điều phối', businessArea: 'Planning',
        entityName: 'MenuVersion', entityId: 'version-1', fieldName: 'Status', oldValue: 'DRAFT', newValue: 'READY', reason: 'Older source match' }] : [],
      totalCount: search ? 1 : 105, pageNumber: page, pageSize: 50, totalPages: search ? 1 : 3, hasPrev: false, hasNext: !search,
    }));
    renderReconciliation(`/reconciliation?view=audit&batchId=${MOCK_RECONCILIATION.batchId}`);
    const find = await screen.findByRole('searchbox', { name: 'Tìm trong nhật ký kiểm toán kho' });
    await userEvent.type(find, 'Older');
    await waitFor(() => expect(warehouse).toHaveBeenLastCalledWith(MOCK_RECONCILIATION.batchId, 1, 50, 'Older'));
    expect(await screen.findByText('Older warehouse match')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /Nguồn & BOM/ }));
    expect(await screen.findByText('Older source match')).toBeVisible();
    expect(source).toHaveBeenLastCalledWith(MOCK_RECONCILIATION.batchId, 1, 50, 'Older');
    expect(screen.getByRole('navigation', { name: 'Phân trang nhật ký kiểm toán' })).toHaveTextContent('1 kết quả');
  });

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-10-19T08:00:00Z'));
    localStorage.setItem('ipc_v3_mode', 'MATERIAL_RECONCILIATION');
    vi.spyOn(systemApi, 'getOperationalMode').mockResolvedValue({ mode: 'MATERIAL_RECONCILIATION', label: 'Đối chiếu nguyên liệu', version: 1, updatedAt: '2026-10-17T00:00:00Z', reasonRequired: false, capabilities: { navigation: [], pageTabs: {} } });
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);
    vi.spyOn(mrxApi, 'getBatchSummary').mockResolvedValue(defaultSummary);
    vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [{
        batchId: MOCK_RECONCILIATION.batchId,
        customerId: 'customer-1',
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
    vi.spyOn(mrxApi, 'completeBatch').mockResolvedValue({
      ...MOCK_RECONCILIATION_BATCH_DTO,
      status: 'COMPLETED',
      version: 8,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('B5: ReconciliationDashboardPage persists customerId and period in URL searchParams and computes period bounds from business timezone', async () => {
    vi.spyOn(mrxApi, 'getOperationalSummary').mockResolvedValue({
      queueCounts: {}, queuePageNumber: 1, queuePageSize: 10, queueTotalCount: 0, queueTotalPages: 0,
      pendingSourceChangesCount: 0,
      awaitingWarehouseBatchesCount: 1,
      unresolvedVariancesCount: 0,
      completionReadyBatchesCount: 0,
      customerOptions: [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }],
      items: [],
    });
    const getBatchPageSpy = vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 20, totalPages: 0, hasPrev: false, hasNext: false,
    });

    render(
      <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
        <MemoryRouter initialEntries={['/?customerId=customer-1&period=THIS_YEAR']}>
          <Routes>
            <Route path="/" element={<ReconciliationDashboardPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    await waitFor(() => expect(getBatchPageSpy).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'customer-1',
      weekFrom: '2026-01-01',
      weekTo: '2026-12-31',
    })));
    expect(screen.getByRole('combobox', { name: 'Lọc theo khách hàng' })).toHaveValue('customer-1');
    expect(screen.getByRole('combobox', { name: 'Kỳ thời gian' })).toHaveValue('THIS_YEAR');
  });

  it.each([false, true])('C3 & C5 (rapid=%s): keeps previous reconciliation lines visible with progressbar during date switch and never flashes empty state while switching customers', async rapid => {
    let resolveDate2!: (value: typeof MOCK_RECONCILIATION) => void;
    const date2Promise = new Promise<typeof MOCK_RECONCILIATION>((resolve) => {
      resolveDate2 = resolve;
    });
    let resolveCustomer2Batches!: (value: Awaited<ReturnType<typeof mrxApi.getBatchPage>>) => void;
    const customer2BatchesPromise = new Promise<Awaited<ReturnType<typeof mrxApi.getBatchPage>>>((resolve) => {
      resolveCustomer2Batches = resolve;
    });

    vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'KH2', customerName: 'Khách hàng 2' },
    ]);
    vi.mocked(mrxApi.getBatchPage).mockImplementation(async (params) => {
      if (params?.customerId === 'customer-2') {
        return customer2BatchesPromise;
      }
      return {
        items: [{
          batchId: MOCK_RECONCILIATION.batchId,
          customerId: 'customer-1',
          customerCode: 'DAV',
          customerName: 'Draxlmaier',
          weekStartDate: '2026-10-19',
          weekEndDate: '2026-10-25',
          status: 'IN_PROGRESS',
          version: 1,
          createdAt: '2026-10-19T00:00:00Z',
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 100,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      };
    });
    vi.mocked(mrxApi.getBatchSummary).mockImplementation(async (batchId, date) => {
      if (date === '2026-10-20') {
        return date2Promise;
      }
      return {
        ...MOCK_RECONCILIATION,
        batchId,
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
      };
    });

    renderReconciliation('/reconciliation?batchId=b1&date=2026-10-19');
    expect(await screen.findByRole('button', { name: 'Thịt đùi heo tươi' })).toBeInTheDocument();
    const nextDay = screen.getByRole('button', { name: 'T3 · 20/10/2026' });
    await waitFor(() => expect(nextDay).toBeEnabled());
    await userEvent.click(nextDay);

    expect(screen.getByRole('button', { name: 'Thịt đùi heo tươi' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Đang tải trang' })).toBeInTheDocument();

    expect(screen.getByText('Đang xác minh ngày đối soát…')).toBeVisible();
    if (rapid) await userEvent.click(screen.getByRole('button', { name: 'T4 · 21/10/2026' }));
    await act(async () => {
      resolveDate2({
        ...MOCK_RECONCILIATION,
        batchId: 'b1',
        lines: MOCK_RECONCILIATION.lines.map(line => ({ ...line, materialName: 'Nguyên liệu ngày cũ' })),
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('progressbar', { name: 'Đang tải trang' })).not.toBeInTheDocument();
    });

    if (rapid) {
      expect(screen.getByRole('button', { name: 'T4 · 21/10/2026' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('button', { name: 'Nguyên liệu ngày cũ' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Thịt đùi heo tươi' })).toBeVisible();
    }

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'KH2');

    expect(screen.queryByText('Chưa có dữ liệu đối soát cho ngày đã chọn')).not.toBeInTheDocument();

    const days = screen.getByRole('group', { name: 'Ngày đối soát' });
    expect(within(days).getAllByRole('button')).toHaveLength(6);
    for (const button of within(days).getAllByRole('button')) expect(button).toBeDisabled();
    if (rapid) await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'DAV');
    await act(async () => {
      resolveCustomer2Batches({
        items: [],
        totalCount: 0,
        pageNumber: 1,
        pageSize: 100,
        totalPages: 0,
        hasPrev: false,
        hasNext: false,
      });
    });

    if (rapid) {
      expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('DAV');
      expect(await screen.findByRole('button', { name: 'Thịt đùi heo tươi' })).toBeVisible();
    } else expect(await screen.findByRole('heading', { name: /Chưa có lô đối soát cho tháng/ })).toBeInTheDocument();
  });

  it('renders Vietnamese label "Chưa xuất đủ" with warning badge for INCOMPLETE under-issued lines in grid and detail modal without leaking raw INCOMPLETE', async () => {
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue({
      ...MOCK_RECONCILIATION,
      weekStartDate: '2026-10-19',
      lines: [{
        ...MOCK_RECONCILIATION.lines[0],
        materialCode: 'ING-A80C477433',
        materialName: 'Cà rốt',
        requiredQuantity: 1.174544,
        issuedQuantity: 1,
        issuedRequiredDifference: -0.174544,
        status: 'INCOMPLETE',
        triggers: [],
        disposition: undefined,
      }],
    });

    renderReconciliation('/reconciliation');
    const detailBtn = await screen.findByRole('button', { name: 'Cà rốt' });
    const row = screen.getByRole('row', { name: /Cà rốt/ });
    expect(within(row).getByText('-0,174544', { exact: true })).toBeVisible();
    expect(within(row).getByText('Chưa xuất đủ', { exact: true })).toBeVisible();
    expect(within(row).getByText('Chờ Kho xuất bổ sung', { exact: true })).toBeVisible();
    expect(screen.queryByText('INCOMPLETE')).not.toBeInTheDocument();

    await userEvent.click(detailBtn);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Chưa xuất đủ', { exact: true })).toBeVisible();
    expect(within(dialog).queryByText('INCOMPLETE')).not.toBeInTheDocument();
  });

  it.each(['expired', 'invalidated'])('reloads %s raw batch before determining reconciliation readiness', async (reason) => {
    vi.mocked(mrxApi.getBatchSummary).mockRestore();
    serverStateCache.clearAll();
    const batch = MOCK_RECONCILIATION_BATCH_DTO;
    const key = `mrx_raw_batch_${batch.batchId}`;
    serverStateCache.set(key, { ...batch, status: 'TRANSFERRED', version: 4 }, reason === 'expired' ? -1 : 60000);
    if (reason === 'invalidated') serverStateCache.invalidate(key);
    const transport = vi.spyOn(apiTransport, 'apiClient').mockResolvedValue({ ...batch, status: 'IN_PROGRESS', version: 10 });
    const summary = await mrxApi.getBatchSummary(batch.batchId, batch.weekStartDate ?? undefined);
    expect(transport).toHaveBeenCalledWith(`/reconciliation/batches/${batch.batchId}`);
    expect(summary.status).toBe('IN_PROGRESS');
    expect(summary.version).toBe(10);
  });

  it('does not announce readiness while a transferred batch is still awaiting warehouse issues', async () => {
    vi.mocked(mrxApi.getBatchSummary).mockRestore();
    serverStateCache.clearAll();
    vi.spyOn(apiTransport, 'apiClient').mockResolvedValue({
      ...MOCK_RECONCILIATION_BATCH_DTO, status: 'TRANSFERRED',
      dailyReview: { ...MOCK_RECONCILIATION_BATCH_DTO.dailyReview, weeklyStatus: 'NOT_ISSUED' },
    });
    renderReconciliation();
    expect(await screen.findByText('Chưa thể chốt đối soát:')).toBeInTheDocument();
    expect(screen.queryByText('Sẵn sàng chốt đối soát:')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chốt đối soát tuần' })).not.toBeInTheDocument();
  });

  it('reuses cached raw MrxBatch across serviceDate calls in getBatchSummary without duplicate network GETs', async () => {
    vi.mocked(mrxApi.getBatchSummary).mockRestore();
    serverStateCache.clearAll();
    const getBatchSpy = vi.spyOn(mrxApi, 'getBatch').mockResolvedValue({
      ...MOCK_RECONCILIATION_BATCH_DTO,
      batchId: 'cached-batch-1',
      weekStartDate: '2026-10-19',
      weekEndDate: '2026-10-25',
      dailyReview: {
        weeklyStatus: 'IN_PROGRESS',
        lines: [
          { ...MOCK_RECONCILIATION_BATCH_DTO.lines[0], dailyLineId: 'd-mon', serviceDate: '2026-10-19', requiredQuantity: 5 },
          { ...MOCK_RECONCILIATION_BATCH_DTO.lines[0], dailyLineId: 'd-tue', serviceDate: '2026-10-20', requiredQuantity: 8 },
        ],
      },
    });

    const monSummary = await mrxApi.getBatchSummary('cached-batch-1', '2026-10-19');
    const tueSummary = await mrxApi.getBatchSummary('cached-batch-1', '2026-10-20');

    expect(getBatchSpy).toHaveBeenCalledTimes(1);
    expect(monSummary.lines).toHaveLength(1);
    expect(monSummary.lines[0].requiredQuantity).toBe(5);
    expect(tueSummary.lines).toHaveLength(1);
    expect(tueSummary.lines[0].requiredQuantity).toBe(8);
  });

  it('D6: completing a batch updates the week catalogue status and invalidates cached summaries', async () => {
    vi.mocked(mrxApi.getBatchPage).mockResolvedValue({
      items: [{
        batchId: 'b1',
        customerId: 'cust-1',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 1,
        createdAt: '2026-10-19T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 100,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue({
      ...MOCK_RECONCILIATION,
      batchId: 'b1',
      status: 'IN_PROGRESS',
      weeklyStatus: 'WEEK_COMPLETE',
      version: 1,
      weekStartDate: '2026-10-19',
      weekEndDate: '2026-10-25',
      lines: [{
        ...MOCK_RECONCILIATION.lines[0],
        requiredQuantity: 10,
        issuedQuantity: 10,
        issuedRequiredDifference: 0,
        status: 'MATCHED',
        triggers: [],
      }],
    });
    vi.mocked(mrxApi.completeBatch).mockResolvedValue({
      ...MOCK_RECONCILIATION_BATCH_DTO,
      batchId: 'b1',
      status: 'COMPLETED',
      version: 2,
      weekStartDate: '2026-10-19',
      weekEndDate: '2026-10-25',
      dailyReview: {
        weeklyStatus: 'WEEK_COMPLETE',
        lines: [{
          ...MOCK_RECONCILIATION_BATCH_DTO.lines[0],
          dailyLineId: 'dl-1',
          serviceDate: '2026-10-19',
          requiredQuantity: 10,
          issuedQuantity: 10,
          issuedRequiredDifference: 0,
          status: 'MATCHED',
          triggers: [],
        }],
      },
    });

    renderReconciliation('/reconciliation?batchId=b1&date=2026-10-19');

    const completeBtn = await screen.findByRole('button', { name: 'Chốt đối soát tuần' });
    await userEvent.click(completeBtn);
    const confirmBtn = await screen.findByRole('button', { name: 'Xác nhận khóa chốt tuần' });
    await userEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText('Hoàn tất')).toBeInTheDocument();
    });
    expect(serverStateCache.get<MrxBatchSummary[]>('mrx_recon_month_batches_customer-1_2026-10')?.data?.[0]?.status).toBe('COMPLETED');
  });

  it('D7: bulk disposition partial failure refreshes parent data via onSaved so already-saved lines are updated', async () => {
    vi.mocked(mrxApi.getBatchSummary).mockResolvedValue({
      ...MOCK_RECONCILIATION,
      batchId: 'b1',
      weekStartDate: '2026-10-19',
      lines: [
        {
          ...MOCK_RECONCILIATION.lines[0],
          id: 'l-1',
          dailyLineId: 'dl-1',
          materialCode: 'ING-01',
          materialName: 'Thịt heo',
          requiredQuantity: 10,
          issuedQuantity: 12,
          issuedRequiredDifference: 2,
          status: 'NEEDS_REVIEW',
          triggers: ['OVER_ISSUED'],
          disposition: undefined,
        },
        {
          ...MOCK_RECONCILIATION.lines[0],
          id: 'l-2',
          dailyLineId: 'dl-2',
          materialCode: 'ING-02',
          materialName: 'Thịt bò',
          requiredQuantity: 5,
          issuedQuantity: 6,
          issuedRequiredDifference: 1,
          status: 'NEEDS_REVIEW',
          triggers: ['OVER_ISSUED'],
          disposition: undefined,
        },
      ],
    });
    vi.spyOn(mrxApi, 'getDispositionCategories').mockResolvedValue([{ value: 'ACCEPTED_VARIANCE', label: 'Chấp nhận sai lệch' }]);
    vi.spyOn(mrxApi, 'setDailyDisposition')
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new ApiError(409, 'Hướng xử lý theo ngày đã thay đổi.'));

    renderReconciliation('/reconciliation?batchId=b1&date=2026-10-19');

    const bulkBtn = await screen.findByRole('button', { name: 'Giải trình hàng loạt (2)' });
    const callsBefore = vi.mocked(mrxApi.getBatchSummary).mock.calls.length;
    await userEvent.click(bulkBtn);

    const reasonInput = await screen.findByRole('textbox', { name: 'Lý do xử lý chênh lệch' });
    await userEvent.type(reasonInput, 'Giải trình hàng loạt ca sáng');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận 2 dòng' }));

    expect(await screen.findByText('Hướng xử lý theo ngày đã thay đổi.')).toBeVisible();
    await waitFor(() => {
      expect(vi.mocked(mrxApi.getBatchSummary).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('E1: invalidateMrxCaches clears reconciliation workspace snapshot so remounting does not render stale pre-mutation snapshot data', async () => {
    const { invalidateMrxCaches } = await import('../api/mrxCacheInvalidation');
    serverStateCache.set(
      'snapshot:reconciliation',
      {
        batchId: 'b1',
        serviceDate: '2026-10-19',
        data: {
          ...MOCK_RECONCILIATION,
          batchId: 'b1',
          weekStartDate: '2026-10-19',
          lines: [{ ...MOCK_RECONCILIATION.lines[0], materialName: 'Nguyên liệu snapshot cũ' }],
        },
      }
    );
    serverStateCache.set(
      'snapshot:mrx_reconciliation',
      {
        batchId: 'b1',
        serviceDate: '2026-10-19',
        data: {
          ...MOCK_RECONCILIATION,
          batchId: 'b1',
          weekStartDate: '2026-10-19',
          lines: [{ ...MOCK_RECONCILIATION.lines[0], materialName: 'Nguyên liệu snapshot MRX cũ' }],
        },
      }
    );

    invalidateMrxCaches();

    expect(serverStateCache.get('snapshot:reconciliation')).toBeNull();
    expect(serverStateCache.get('snapshot:mrx_reconciliation')).toBeNull();
  });

  it('E9: MrxBatchDishesModal and ReconciliationIssueDetailModal reuse warm serverStateCache entries across close and reopen', async () => {
    const { MrxBatchDishesModal } = await import('../components/workbench/MrxBatchDishesModal');
    const { ReconciliationIssueDetailModal } = await import('../components/workbench/ReconciliationIssueDetailModal');

    const getBatchDishesSpy = vi.spyOn(mrxApi, 'getBatchDishes').mockResolvedValue([
      {
        dishId: 'd-1',
        dishCode: 'MON-01',
        dishName: 'Thịt kho tàu',
        scopes: [{ serviceDate: '2026-10-19', shiftName: 'MORNING', frozenServings: 100, currentServings: 100, additionalServings: 0 }],
        materials: [],
      },
    ]);
    const getIssueByIdSpy = vi.spyOn(mrxApi, 'getIssueById').mockResolvedValue({
      issueId: 'iss-1',
      issueCode: 'PXK-001',
      issueDate: '2026-10-19',
      warehouseId: 'wh-1',
      warehouseName: 'Kho chính',
      issuedBy: 'u-1',
      issuedByName: 'Thủ kho',
      createdAt: '2026-10-19T08:00:00Z',
      sourceFamily: 'MATERIAL_RECONCILIATION',
      receivedAt: null,
      provisions: [],
      lines: [],
    });

    const { rerender } = render(
      <MrxBatchDishesModal isOpen={true} onClose={vi.fn()} batchId="b-cache-1" customerName="Khách A" />
    );

    expect(await screen.findByRole('heading', { name: 'Thịt kho tàu' })).toBeVisible();
    expect(getBatchDishesSpy).toHaveBeenCalledTimes(1);

    rerender(
      <MrxBatchDishesModal isOpen={false} onClose={vi.fn()} batchId="b-cache-1" customerName="Khách A" />
    );
    rerender(
      <MrxBatchDishesModal isOpen={true} onClose={vi.fn()} batchId="b-cache-1" customerName="Khách A" />
    );

    expect(screen.getByRole('heading', { name: 'Thịt kho tàu' })).toBeVisible();
    expect(getBatchDishesSpy).toHaveBeenCalledTimes(1);

    rerender(
      <ReconciliationIssueDetailModal isOpen={true} onClose={vi.fn()} issueId="iss-1" />
    );
    expect(await screen.findByRole('dialog', { name: 'Chi tiết phiếu xuất kho' })).toHaveTextContent('PXK-001');
    expect(getIssueByIdSpy).toHaveBeenCalledTimes(1);

    rerender(
      <ReconciliationIssueDetailModal isOpen={false} onClose={vi.fn()} issueId="iss-1" />
    );
    rerender(
      <ReconciliationIssueDetailModal isOpen={true} onClose={vi.fn()} issueId="iss-1" />
    );
    expect(screen.getByRole('dialog', { name: 'Chi tiết phiếu xuất kho' })).toHaveTextContent('PXK-001');
    expect(getIssueByIdSpy).toHaveBeenCalledTimes(1);
  });

  it('E3 & E8: synchronizes customerId with searchParams on same-mounted navigation and customer selection, and resets lineStatusFilter when switching batches', async () => {
    vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'KH2', customerName: 'Khách hàng 2' },
    ]);
    vi.mocked(mrxApi.getBatchPage).mockImplementation(async (params) => ({
      items: [
        {
          batchId: params?.customerId === 'customer-2' ? 'b-kh2' : 'b1',
          customerId: params?.customerId || 'customer-1',
          customerCode: params?.customerId === 'customer-2' ? 'KH2' : 'DAV',
          customerName: params?.customerId === 'customer-2' ? 'Khách hàng 2' : 'Draxlmaier',
          weekStartDate: '2026-10-19',
          weekEndDate: '2026-10-25',
          status: 'IN_PROGRESS',
          version: 1,
          createdAt: '2026-10-19T00:00:00Z',
        },
        {
          batchId: 'b2',
          customerId: params?.customerId || 'customer-1',
          customerCode: 'DAV',
          customerName: 'Draxlmaier',
          weekStartDate: '2026-10-12',
          weekEndDate: '2026-10-18',
          status: 'COMPLETED',
          version: 2,
          createdAt: '2026-10-12T00:00:00Z',
        },
      ].filter(batch => params?.customerId !== 'customer-2' || batch.customerCode === 'KH2'),
      totalCount: params?.customerId === 'customer-2' ? 1 : 2,
      pageNumber: 1,
      pageSize: 100,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    }));
    vi.mocked(mrxApi.getBatchSummary).mockImplementation(async (batchId) => ({
      ...MOCK_RECONCILIATION,
      batchId,
      customerCode: batchId === 'b-kh2' ? 'KH2' : 'DAV',
      status: batchId === 'b2' ? 'COMPLETED' : 'IN_PROGRESS',
      weekStartDate: batchId === 'b2' ? '2026-10-12' : '2026-10-19',
      weekEndDate: batchId === 'b2' ? '2026-10-18' : '2026-10-25',
      lines: [
        {
          ...MOCK_RECONCILIATION.lines[0],
          id: `line-${batchId}`,
          dailyLineId: `dl-${batchId}`,
          materialName: batchId === 'b2' ? 'Gạo lô hoàn tất' : 'Thịt lô đang chạy',
          requiredQuantity: 10,
          issuedQuantity: batchId === 'b2' ? 10 : 12,
          issuedRequiredDifference: batchId === 'b2' ? 0 : 2,
          status: batchId === 'b2' ? 'MATCHED' : 'NEEDS_REVIEW',
          triggers: batchId === 'b2' ? [] : ['OVER_ISSUED'],
          disposition: undefined,
        },
      ],
    }));

    const router = createMemoryRouter(
      [{ path: '/reconciliation', element: <ReconciliationPage /> }],
      { initialEntries: ['/reconciliation?customerId=customer-1&batchId=b1&date=2026-10-19'] }
    );
    render(
      <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
        <RouterProvider router={router} />
      </AuthProvider>
    );

    expect(await screen.findByRole('button', { name: 'Thịt lô đang chạy' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('10');

    // Turn on NEEDS_REVIEW filter on batch b1
    await userEvent.click(screen.getByRole('button', { name: /Cần xử lý/i }));
    expect(screen.getByRole('button', { name: 'Thịt lô đang chạy' })).toBeVisible();

    // E8: Switch to completed batch b2 (which has only MATCHED lines) — filter must reset to ALL so 'Gạo lô hoàn tất' is visible!
    await selectReviewBatch('b2');
    expect(await screen.findByRole('button', { name: 'Gạo lô hoàn tất' })).toBeVisible();

    // E3 part 1: Selecting customer KH2 in header dropdown updates ?customerId=customer-2 in URL
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'KH2');
    expect(router.state.location.search).toContain('customerId=customer-2');

    // E3 part 2: Navigating via same-mounted URL back to ?customerId=customer-1 updates customer selector to DAV
    await act(async () => {
      await router.navigate('/reconciliation?customerId=customer-1');
    });
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('DAV');
    });
  });

  it('F1 & F3: retains previous customer table dimmed while switching customers and hydrates warm customer switches synchronously in 0ms', async () => {
    let resolveKh2Summary!: (value: typeof MOCK_RECONCILIATION) => void;
    const kh2SummaryPromise = new Promise<typeof MOCK_RECONCILIATION>((resolve) => {
      resolveKh2Summary = resolve;
    });

    vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'KH2', customerName: 'Khách hàng 2' },
    ]);
    vi.mocked(mrxApi.getBatchPage).mockImplementation(async (params) => ({
      items: [{
        batchId: params?.customerId === 'customer-2' ? 'b-kh2' : 'b-dav',
        customerId: params?.customerId || 'customer-1',
        customerCode: params?.customerId === 'customer-2' ? 'KH2' : 'DAV',
        customerName: params?.customerId === 'customer-2' ? 'Khách hàng 2' : 'Draxlmaier',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 1,
        createdAt: '2026-10-19T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 100,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    }));
    vi.mocked(mrxApi.getBatchSummary).mockImplementation(async (batchId) => {
      if (batchId === 'b-kh2') {
        return kh2SummaryPromise;
      }
      return {
        ...MOCK_RECONCILIATION,
        batchId: 'b-dav',
        customerCode: 'DAV',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        lines: [{
          ...MOCK_RECONCILIATION.lines[0],
          materialName: 'Thịt heo khách DAV',
        }],
      };
    });

    renderReconciliation('/reconciliation?customerId=customer-1&batchId=b-dav&date=2026-10-19');
    expect(await screen.findByRole('button', { name: 'Thịt heo khách DAV' })).toBeInTheDocument();

    // Switch to KH2 while b-kh2 summary is deferred: table must NOT unmount!
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'KH2');
    expect(screen.getByRole('button', { name: 'Thịt heo khách DAV' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Đang tải trang' })).toBeInTheDocument();

    await act(async () => {
      resolveKh2Summary({
        ...MOCK_RECONCILIATION,
        batchId: 'b-kh2',
        customerCode: 'KH2',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        lines: [{
          ...MOCK_RECONCILIATION.lines[0],
          materialName: 'Cá basa khách KH2',
        }],
      });
    });

    expect(await screen.findByRole('button', { name: 'Cá basa khách KH2' })).toBeInTheDocument();

    // Switch back to DAV (warm in serverStateCache): must hydrate synchronously with zero progressbar flash!
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'DAV');
    expect(screen.getByRole('button', { name: 'Thịt heo khách DAV' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Đang tải trang' })).not.toBeInTheDocument();
  });

  it('G5: Refresh on ReconciliationPage marks sibling MRX caches stale for SWR instead of deleting them', async () => {
    serverStateCache.set('mrx_warehouse_daily_other_batch', { batchId: 'other_batch' });
    renderReconciliation('/reconciliation?customerId=customer-1&batchId=b-dav&date=2026-10-19');
    expect(await screen.findByRole('button', { name: /Làm mới/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Làm mới/i }));

    const sibling = serverStateCache.get<{ batchId: string }>('mrx_warehouse_daily_other_batch');
    expect(sibling).toBeDefined();
    expect(sibling?.data.batchId).toBe('other_batch');
    expect(sibling?.isStale).toBe(true);
  });

  it('G1: ReconciliationDashboardPage retains KPI cards and batch table with progressbar while switching customer or period to an uncached filter', async () => {
    const { ReconciliationDashboardPage } = await import('../features/dashboard/ReconciliationDashboardPage');
    let resolveFilteredSummary!: (value: Awaited<ReturnType<typeof mrxApi.getOperationalSummary>>) => void;
    let resolveFilteredBatches!: (value: Awaited<ReturnType<typeof mrxApi.getBatchPage>>) => void;

    vi.spyOn(mrxApi, 'getOperationalSummary').mockImplementation(async (params) => {
      if (params?.customerId === 'cust-2') {
        return new Promise((resolve) => {
          resolveFilteredSummary = resolve;
        });
      }
      return {
        queueCounts: {}, queuePageNumber: 1, queuePageSize: 10, queueTotalCount: 0, queueTotalPages: 0,
        pendingSourceChangesCount: 2,
        awaitingWarehouseBatchesCount: 3,
        unresolvedVariancesCount: 4,
        completionReadyBatchesCount: 1,
        items: [],
        customerOptions: [
          { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
          { customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai' },
        ],
      };
    });
    vi.spyOn(mrxApi, 'getBatchPage').mockImplementation(async (params) => {
      if (params?.customerId === 'cust-2') {
        return new Promise((resolve) => {
          resolveFilteredBatches = resolve;
        });
      }
      return {
        items: [
          {
            batchId: 'batch-c1',
            customerId: 'cust-1',
            customerCode: 'C1',
            customerName: 'Khách Một',
            weekStartDate: '2026-10-19',
            weekEndDate: '2026-10-25',
            status: 'IN_PROGRESS',
            version: 1,
            createdAt: '2026-10-19T00:00:00Z',
          },
        ],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      };
    });

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/']}>
          <ReconciliationDashboardPage />
        </MemoryRouter>
      </AuthProvider>
    );

    expect(await screen.findByRole('region', { name: 'Danh sách lô theo bộ lọc' })).toBeInTheDocument();
    expect(screen.getAllByText(/C1 · Khách Một/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Chỉ số điều hành đối soát')).toBeInTheDocument();

    // Switch Customer to cust-2 while network is pending: KPI cards & table MUST stay mounted!
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo khách hàng' }), 'cust-2');
    expect(screen.getByLabelText('Chỉ số điều hành đối soát')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Danh sách lô theo bộ lọc' })).toBeInTheDocument();

    await act(async () => {
      resolveFilteredSummary({
        queueCounts: {}, queuePageNumber: 1, queuePageSize: 10, queueTotalCount: 0, queueTotalPages: 0,
        pendingSourceChangesCount: 0,
        awaitingWarehouseBatchesCount: 1,
        unresolvedVariancesCount: 0,
        completionReadyBatchesCount: 0,
        items: [],
        customerOptions: [
          { customerId: 'cust-1', customerCode: 'C1', customerName: 'Khách Một' },
          { customerId: 'cust-2', customerCode: 'C2', customerName: 'Khách Hai' },
        ],
      });
      resolveFilteredBatches({
        items: [
          {
            batchId: 'batch-c2',
            customerId: 'cust-2',
            customerCode: 'C2',
            customerName: 'Khách Hai',
            weekStartDate: '2026-10-19',
            weekEndDate: '2026-10-25',
            status: 'IN_PROGRESS',
            version: 1,
            createdAt: '2026-10-19T00:00:00Z',
          },
        ],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Danh sách lô theo bộ lọc' })).toHaveTextContent('C2 · Khách Hai');
    });
  });

  it('H4: ReconciliationVariancesBranch keeps LocalFindBar mounted when rows are empty, and ReconciliationAuditBranch keeps LocalFindBar + PaginationBar mounted across Kho and Nguồn & BOM sub-tabs', async () => {
    vi.spyOn(mrxApi, 'getVarianceRegister').mockResolvedValue({
      rows: [],
      totalCount: 0,
    });
    vi.spyOn(mrxApi, 'getAuditTrail').mockResolvedValue({
      rows: [{
        auditId: 'aud-1',
        changedAt: '2026-10-19T08:00:00Z',
        changedBy: 'Thủ kho',
        businessArea: 'Inventory',
        entityName: 'InventoryIssue',
        entityId: 'iss-1',
        fieldName: 'IssuedQuantity',
        oldValue: '10',
        newValue: '12',
        reason: 'Bổ sung ca sáng',
      }],
      totalCount: 1,
    });
    vi.spyOn(mrxApi, 'getSourceChangesPage').mockResolvedValue({ totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false, items: [{
      changeId: 'sc-1',
      changedAt: '2026-10-19T09:00:00Z',
      actor: 'Quản lý',
      businessArea: 'Planning',
      entityName: 'MealQuantityPlan',
      entityId: 'mqp-1',
      fieldName: 'SavoryServings',
      oldValue: '100',
      newValue: '110',
      reason: 'Khách báo tăng suất',
    }] });

    const { unmount } = renderReconciliation(`/reconciliation?view=variances&batchId=${MOCK_RECONCILIATION.batchId}`);
    expect(await screen.findByText('Chưa ghi nhận chênh lệch xuất kho')).toBeInTheDocument();
    expect(screen.getByLabelText('Tìm trong sổ chênh lệch')).toBeInTheDocument();
    unmount();

    renderReconciliation(`/reconciliation?view=audit&batchId=${MOCK_RECONCILIATION.batchId}`);
    expect(await screen.findByText('Bổ sung ca sáng')).toBeInTheDocument();
    expect(screen.getByLabelText('Tìm trong nhật ký kiểm toán kho')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang nhật ký kiểm toán' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Nguồn & BOM/ }));
    expect(await screen.findByText('Khách báo tăng suất')).toBeInTheDocument();
    expect(screen.getByLabelText('Tìm trong lịch sử nguồn và BOM')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Phân trang nhật ký kiểm toán' })).toBeInTheDocument();
  });

  it('uses server source-history pages and forwards whole-batch search', async () => {
    const { ReconciliationAuditBranch } = await import('../features/reconciliation/branches/ReconciliationAuditBranch');
    const changes = Array.from({ length: 51 }, (_, index) => ({
      changeId: `change-${index + 1}`, changedAt: '2026-10-19T09:00:00Z', actor: 'Quản lý',
      businessArea: 'Planning', entityName: 'MealQuantityPlanLine', entityId: `line-${index + 1}`,
      fieldName: 'FinalServings', oldValue: '1', newValue: '2', reason: `Thay đổi ${index + 1}`,
    }));
    const onPageChange = vi.fn();
    const onSearchChange = vi.fn();
    const { rerender } = render(<ReconciliationAuditBranch auditReport={null} sourceChanges={changes.slice(0, 50)} auditSubTab="source" sourceTotalCount={51} onPageChange={onPageChange} onSearchChange={onSearchChange} />);
    const pager = screen.getByRole('navigation', { name: 'Phân trang nhật ký kiểm toán' });
    expect(pager).toHaveTextContent('Trang 1/2');
    expect(screen.getByText('Thay đổi 1')).toBeInTheDocument();
    expect(screen.queryByText('Thay đổi 51')).not.toBeInTheDocument();
    await userEvent.click(within(pager).getByRole('button', { name: 'Trang sau' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    rerender(<ReconciliationAuditBranch auditReport={null} sourceChanges={changes.slice(50)} auditSubTab="source" page={2} sourceTotalCount={51} onPageChange={onPageChange} onSearchChange={onSearchChange} />);
    expect(pager).toHaveTextContent('Trang 2/2');
    expect(screen.getByText('Thay đổi 51')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Tìm trong lịch sử nguồn và BOM'), 'x');
    expect(onSearchChange).toHaveBeenCalledWith('x');
  });

  it('shows resolved dish names in source audit while retaining the original identifier for traceability', async () => {
    const { ReconciliationAuditBranch } = await import('../features/reconciliation/branches/ReconciliationAuditBranch');
    render(<ReconciliationAuditBranch batchId="batch-a" auditReport={null} auditSubTab="source" sourceChanges={[{
      changeId: 'change-dish', changedAt: '2026-10-19T09:00:00Z', actor: 'Quản lý',
      businessArea: 'Planning', entityName: 'MenuItem', entityId: 'item-1', fieldName: 'DishId',
      oldValue: null, newValue: '00000000-0000-0000-0000-000000000007', newDisplayValue: 'Cá kho (DISH-07)', reason: 'Đổi món',
    }]} onPageChange={() => {}} />);
    expect(screen.getByText('Cá kho (DISH-07)')).toBeInTheDocument();
    expect(screen.getByTitle(/00000000-0000-0000-0000-000000000007/)).toBeInTheDocument();
  });

  it('looks up historical batches across all months when no month is selected', async () => {
    const { ReconciliationBatchPicker } = await import('../components/workbench/ReconciliationBatchPicker');
    const page = vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [], totalCount: 26, pageNumber: 1, pageSize: 25, totalPages: 2, hasPrev: false, hasNext: true,
    });
    render(<ReconciliationBatchPicker selectedBatchId="" onClose={() => {}} onSelect={() => {}} />);
    await waitFor(() => expect(page).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 25 }));
    const pager = screen.getByRole('navigation', { name: 'Phân trang lịch sử lô' });
    await userEvent.click(within(pager).getByRole('button', { name: 'Trang sau' }));
    await waitFor(() => expect(page).toHaveBeenCalledWith({ pageNumber: 2, pageSize: 25 }));
  });

  it('filters old batches on the server by week range and exact batch reference', async () => {
    const { ReconciliationBatchPicker } = await import('../components/workbench/ReconciliationBatchPicker');
    const page = vi.spyOn(mrxApi, 'getBatchPage').mockResolvedValue({
      items: [], totalCount: 0, pageNumber: 1, pageSize: 25, totalPages: 0, hasPrev: false, hasNext: false,
    });
    render(<ReconciliationBatchPicker customerId="customer-1" selectedBatchId="" onClose={() => {}} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Mã khách hàng'), 'anv');
    await userEvent.type(screen.getByLabelText('Tuần từ'), '2020-01-01');
    await userEvent.type(screen.getByLabelText('Tuần đến'), '2020-12-31');
    await userEvent.type(screen.getByLabelText('Mã lô đối soát'), '00000000-0000-0000-0000-000000000002');
    await userEvent.click(screen.getByRole('button', { name: 'Tìm lô' }));
    await waitFor(() => expect(page).toHaveBeenCalledWith({ customerId: 'customer-1', customerCode: 'ANV', weekFrom: '2020-01-01',
      weekTo: '2020-12-31', batchId: '00000000-0000-0000-0000-000000000002', pageNumber: 1, pageSize: 25 }));
  });

  it('I1 & I8: selects batch matching target week on cross-week date switch and retains report table across customer switch without flashing Chưa chọn lô đối soát', async () => {
    serverStateCache.clearAll();
    vi.spyOn(weeklyMenuApi, 'getCustomers').mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'ANV', customerName: 'AMANN' },
    ]);

    const batchOct19: MrxBatchSummary = {
      batchId: MOCK_RECONCILIATION.batchId,
      customerId: 'customer-1',
      customerCode: 'DAV',
      customerName: 'Draxlmaier',
      weekStartDate: '2026-10-19',
      weekEndDate: '2026-10-25',
      status: 'IN_PROGRESS',
      version: 7,
      createdAt: '2026-10-18T00:00:00Z',
    };
    const batchOct12: MrxBatchSummary = {
      batchId: 'batch-oct-12',
      customerId: 'customer-1',
      customerCode: 'DAV',
      customerName: 'Draxlmaier',
      weekStartDate: '2026-10-12',
      weekEndDate: '2026-10-18',
      status: 'IN_PROGRESS',
      version: 3,
      createdAt: '2026-10-11T00:00:00Z',
    };

    let resolveAnvBatches!: (value: { items: MrxBatchSummary[]; totalCount: number; pageNumber: number; pageSize: number; totalPages: number; hasPrev: boolean; hasNext: boolean }) => void;
    vi.spyOn(mrxApi, 'getBatchPage').mockImplementation(async (params) => {
      if (params?.customerId === 'customer-2') {
        return new Promise((resolve) => {
          resolveAnvBatches = resolve;
        });
      }
      return {
        items: [batchOct19, batchOct12],
        totalCount: 2,
        pageNumber: 1,
        pageSize: 100,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      };
    });

    vi.spyOn(mrxApi, 'getVarianceRegister').mockImplementation(async (bId) => ({
      rows: [{
        batchId: bId ?? MOCK_RECONCILIATION.batchId,
        customerName: bId === 'batch-anv-1' ? 'AMANN' : 'Draxlmaier',
        serviceDate: '2026-10-19',
        shiftName: 'Ca sáng',
        ingredientCode: 'NVL-01',
        ingredientName: bId === 'batch-anv-1' ? 'Thịt bò ANV' : 'Thịt bò DAV',
        canonicalUnitName: 'kg',
        requiredQuantity: 10,
        issuedQuantity: 12,
        difference: 2,
        varianceType: 'OVER_ISSUED',
        dispositionCategory: 'ACCEPTED_VARIANCE',
        dispositionReason: 'Bao bì lẻ',
        disposedBy: 'user-1',
        disposedAt: '2026-10-19T07:00:00Z',
        issueNotes: [],
      }],
      totalCount: 1,
    }));

    vi.mocked(mrxApi.getBatchSummary).mockImplementation(async batchId => ({
      ...defaultSummary, batchId, weekStartDate: batchId === batchOct12.batchId ? '2026-10-12' : '2026-10-19',
    }));
    const { unmount } = renderReconciliation('/reconciliation');
    expect(await screen.findByRole('button', { name: 'Thịt đùi heo tươi' })).toBeVisible();
    await selectReviewBatch('batch-oct-12');
    await waitFor(() => expect(mrxApi.getBatchSummary).toHaveBeenCalledWith('batch-oct-12', '2026-10-12', true));
    await userEvent.click(screen.getByRole('button', { name: 'T4 · 14/10/2026' }));
    expect(screen.getByRole('button', { name: 'T4 · 14/10/2026' })).toHaveAttribute('aria-pressed', 'true');
    unmount();

    // I8: On ?view=variances, switch customer from DAV to ANV while ANV getBatchPage is pending
    renderReconciliation('/reconciliation?view=variances&date=2026-10-19');
    expect(await screen.findByText(/Thịt bò DAV/)).toBeInTheDocument();

    const customerSelect = screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' });
    await userEvent.selectOptions(customerSelect, 'ANV');

    // Must NOT flash "Chưa chọn lô đối soát" and must keep previous variance row mounted while loading
    expect(screen.queryByText('Chưa chọn lô đối soát')).not.toBeInTheDocument();
    expect(screen.getByText(/Thịt bò DAV/)).toBeInTheDocument();

    await act(async () => {
      resolveAnvBatches({
        items: [{
          batchId: 'batch-anv-1',
          customerId: 'customer-2',
          customerCode: 'ANV',
          customerName: 'AMANN',
          weekStartDate: '2026-10-19',
          weekEndDate: '2026-10-25',
          status: 'IN_PROGRESS',
          version: 1,
          createdAt: '2026-10-18T00:00:00Z',
        }],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 100,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      });
    });

    expect(await screen.findByText(/Thịt bò ANV/)).toBeInTheDocument();
  });

  it('K2 & K5: locks ReconciliationBlockerStrip to h-11 in both states and commits customer switch batch + summary atomically without intermediate header/table mismatch', async () => {
    const { ReconciliationBlockerStrip } = await import('../features/reconciliation/ReconciliationBlockerStrip');
    const { rerender, unmount: unmountStrip } = render(
      <ReconciliationBlockerStrip
        needsReviewCount={2}
        isBlocked={true}
        onFilterNeedsReview={() => {}}
      />
    );
    expect(screen.getByRole('status')).toHaveClass('h-11', 'whitespace-nowrap');
    rerender(
      <ReconciliationBlockerStrip
        needsReviewCount={0}
        isBlocked={false}
        isCompleted={true}
        onFilterNeedsReview={() => {}}
      />
    );
    expect(screen.getByRole('status')).toHaveClass('h-11', 'whitespace-nowrap');
    unmountStrip();

    serverStateCache.clearAll();
    let resolveKh2Summary!: (value: typeof MOCK_RECONCILIATION) => void;
    vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'KH2', customerName: 'Khách hàng 2' },
    ]);
    vi.mocked(mrxApi.getBatchPage).mockImplementation(async (params) => ({
      items: [{
        batchId: params?.customerId === 'customer-2' ? 'b-kh2' : 'b-dav',
        customerId: params?.customerId || 'customer-1',
        customerCode: params?.customerId === 'customer-2' ? 'KH2' : 'DAV',
        customerName: params?.customerId === 'customer-2' ? 'Khách hàng 2' : 'Draxlmaier',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 1,
        createdAt: '2026-10-19T00:00:00Z',
      }],
      totalCount: 1,
      pageNumber: 1,
      pageSize: 100,
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    }));
    vi.mocked(mrxApi.getBatchSummary).mockImplementation((bId) => {
      if (bId === 'b-kh2') {
        return new Promise((resolve) => {
          resolveKh2Summary = resolve;
        });
      }
      return Promise.resolve({
        ...MOCK_RECONCILIATION,
        batchId: 'b-dav',
        customerCode: 'DAV',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        lines: [{ ...MOCK_RECONCILIATION.lines[0], materialName: 'Thịt heo khách DAV' }],
      });
    });

    renderReconciliation('/reconciliation?customerId=customer-1&batchId=b-dav&date=2026-10-19');
    expect(await screen.findByRole('button', { name: 'Thịt heo khách DAV' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'KH2');
    await waitFor(() => {
      expect(mrxApi.getBatchSummary).toHaveBeenCalledWith('b-kh2', '2026-10-19');
    });
    // While b-kh2 summary is still pending, batch options must NOT have switched to KH2 · 19/10/2026 while table still shows DAV!
    expect(screen.getByRole('progressbar', { name: 'Đang tải trang' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Thịt heo khách DAV' })).toBeInTheDocument();

    await act(async () => {
      resolveKh2Summary({
        ...MOCK_RECONCILIATION,
        batchId: 'b-kh2',
        customerCode: 'KH2',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        lines: [{ ...MOCK_RECONCILIATION.lines[0], materialName: 'Cá basa khách KH2' }],
      });
    });
    expect(await screen.findByRole('button', { name: 'Cá basa khách KH2' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('KH2');
    expect(screen.queryByRole('progressbar', { name: 'Đang tải trang' })).not.toBeInTheDocument();
  });

  it('L5: switching customer while on ?view=variances pre-warms getVarianceRegister before committing new batch options so header and variance table flip atomically in 1 render', async () => {
    serverStateCache.clearAll();
    let resolveKh2Variances!: (val: Awaited<ReturnType<typeof mrxApi.getVarianceRegister>>) => void;
    vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'KH2', customerName: 'Khách hàng 2' },
    ]);
    vi.mocked(mrxApi.getBatchPage).mockImplementation(async (params) => ({
      items: [{
        batchId: params?.customerId === 'customer-2' ? 'b-kh2' : 'b-dav',
        customerId: params?.customerId || 'customer-1',
        customerCode: params?.customerId === 'customer-2' ? 'KH2' : 'DAV',
        customerName: params?.customerId === 'customer-2' ? 'Khách hàng 2' : 'Draxlmaier',
        weekStartDate: '2026-10-19',
        weekEndDate: '2026-10-25',
        status: 'IN_PROGRESS',
        version: 1,
        createdAt: '2026-10-19T00:00:00Z',
      }],
      totalCount: 1, pageNumber: 1, pageSize: 100, totalPages: 1, hasPrev: false, hasNext: false,
    }));
    vi.spyOn(mrxApi, 'getVarianceRegister').mockImplementation((bId) => {
      if (bId === 'b-kh2') {
        return new Promise((r) => { resolveKh2Variances = r; });
      }
      return Promise.resolve({
        rows: [{
          batchId: 'b-dav', customerName: 'Draxlmaier', serviceDate: '2026-10-19', shiftName: 'Ca sáng',
          ingredientCode: 'NL-1', ingredientName: 'Thịt bò DAV', canonicalUnitName: 'kg',
          requiredQuantity: 10, issuedQuantity: 11, difference: 1, varianceType: 'OVER_ISSUED',
          dispositionCategory: 'ACCEPTED_VARIANCE', dispositionReason: 'Lệch DAV', disposedBy: 'u-1',
          disposedAt: '2026-10-19T07:00:00Z', issueNotes: [],
        }],
        totalCount: 1,
      });
    });

    renderReconciliation('/reconciliation?view=variances&customerId=customer-1&batchId=b-dav&date=2026-10-19');
    expect(await screen.findByText('Thịt bò DAV')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'KH2');
    await waitFor(() => expect(mrxApi.getVarianceRegister).toHaveBeenCalledWith('b-kh2'));
    // While b-kh2 variance report is still pending, header batch option must NOT have flipped to KH2 · 19/10/2026 ahead of the table!
    expect(screen.getByRole('button', { name: 'Tải Excel Sổ chênh lệch' })).toBeDisabled();
    expect(screen.getByText('Thịt bò DAV')).toBeInTheDocument();

    await act(async () => {
      resolveKh2Variances({
        rows: [{
          batchId: 'b-kh2', customerName: 'Khách hàng 2', serviceDate: '2026-10-19', shiftName: 'Ca sáng',
          ingredientCode: 'NL-2', ingredientName: 'Cá hồi KH2', canonicalUnitName: 'kg',
          requiredQuantity: 5, issuedQuantity: 6, difference: 1, varianceType: 'OVER_ISSUED',
          dispositionCategory: 'ACCEPTED_VARIANCE', dispositionReason: 'Lệch KH2', disposedBy: 'u-1',
          disposedAt: '2026-10-19T07:00:00Z', issueNotes: [],
        }],
        totalCount: 1,
      });
    });
    expect(await screen.findByText('Cá hồi KH2')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('KH2');
    expect(screen.getByRole('button', { name: 'Tải Excel Sổ chênh lệch' })).toBeEnabled();
  });

  it('M4 & M5: preserves audit find state but replaces the foreign schema during a sub-tab transition', async () => {
    serverStateCache.clearAll();
    let resolveSourceChanges!: (val: Awaited<ReturnType<typeof mrxApi.getSourceChangesPage>>) => void;
    vi.spyOn(mrxApi, 'getAuditTrail').mockResolvedValue({
      rows: [{
        auditId: 'aud-1',
        businessArea: 'reconciliation',
        changedAt: '2026-10-19T08:00:00Z',
        changedBy: '10000000-0000-0000-0000-000000000004',
        entityId: 'iss-line-1',
        entityName: 'InventoryIssueLine',
        fieldName: 'IssuedQty',
        oldValue: '10',
        newValue: '12',
        reason: 'Xuất bổ sung ca sáng',
      }],
      totalCount: 1,
    });
    vi.spyOn(mrxApi, 'getSourceChangesPage').mockImplementation(() => new Promise((r) => {
      resolveSourceChanges = r;
    }));

    const { container } = renderReconciliation('/reconciliation?view=audit&customerId=customer-1&batchId=b-dav&date=2026-10-19');
    expect(await screen.findByText('Xuất bổ sung ca sáng')).toBeInTheDocument();

    // M5: "Phạm vi: cả lô" span in ReconciliationHeaderBranch must have h-9 and min-w-[155px] to match VietnameseDateInput
    expect(screen.queryByText(/Cả tuần từ/)).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ngày đối soát' })).not.toBeInTheDocument();

    // M4: Click "Nguồn & BOM" sub-tab while getSourceChanges is pending: LocalFindBar and DataGrid MUST NOT unmount into WorkbenchSkeleton!
    const findBar = screen.getByRole('searchbox', { name: /Tìm trong/i });
    await userEvent.type(findBar, 'ca');
    await userEvent.click(screen.getByRole('button', { name: /Nguồn & BOM/i }));
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toBeInTheDocument();
    expect(container.querySelectorAll('table')).toHaveLength(0);
    expect(screen.queryByText('Xuất bổ sung ca sáng')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /Tìm trong/i })).toBe(findBar);
    expect(findBar).toHaveValue('ca');
    await userEvent.clear(findBar);

    await act(async () => {
      resolveSourceChanges({ totalCount: 1, pageNumber: 1, pageSize: 50, totalPages: 1, hasPrev: false, hasNext: false, items: [{
        changeId: 'sc-1',
        changedAt: '2026-10-19T09:00:00Z',
        actor: '10000000-0000-0000-0000-000000000002',
        businessArea: 'source',
        entityName: 'MenuVersion',
        fieldName: 'QuantityAndWaste',
        oldValue: '100',
        newValue: '120',
        reason: 'Điều chỉnh suất ăn khách báo',
      }] });
    });
    expect(await screen.findByText('Điều chỉnh suất ăn khách báo')).toBeInTheDocument();
  });

  it('N1: clears isReportLoading and inert without calling getBatchSummary when switching batches on the variances report tab', async () => {
    serverStateCache.clearAll();
    const getSummarySpy = vi.spyOn(mrxApi, 'getBatchSummary').mockImplementation(() => new Promise(() => {}));
    vi.spyOn(mrxApi, 'getBatchPage').mockImplementation(async () => ({
      items: [
        {
          batchId: 'b-week1', status: 'IN_PROGRESS', version: 1,
          customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
          weekStartDate: '2026-10-19', weekEndDate: '2026-10-24',
          createdAt: '2026-10-18T00:00:00Z', readyAt: '2026-10-18T01:00:00Z', completedAt: undefined,
        },
        {
          batchId: 'b-week2', status: 'IN_PROGRESS', version: 1,
          customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier',
          weekStartDate: '2026-10-26', weekEndDate: '2026-10-31',
          createdAt: '2026-10-25T00:00:00Z', readyAt: '2026-10-25T01:00:00Z', completedAt: undefined,
        },
      ],
      totalCount: 2, pageNumber: 1, pageSize: 5, totalPages: 1, hasNext: false, hasPrev: false,
    }));
    vi.spyOn(mrxApi, 'getVarianceRegister').mockImplementation((batchId?: string) =>
      Promise.resolve({
        rows: [{
          batchId: batchId ?? 'b-week1', customerName: 'Draxlmaier', serviceDate: batchId === 'b-week2' ? '2026-10-26' : '2026-10-19', shiftName: 'Ca sáng',
          ingredientCode: 'NL-1', ingredientName: batchId === 'b-week2' ? 'Thịt bò Tuần 2' : 'Thịt bò Tuần 1', canonicalUnitName: 'kg',
          requiredQuantity: 10, issuedQuantity: 11, difference: 1, varianceType: 'OVER_ISSUED',
          dispositionCategory: 'ACCEPTED_VARIANCE', dispositionReason: 'Lệch ca', disposedBy: 'u-1',
          disposedAt: '2026-10-19T07:00:00Z', issueNotes: [],
        }],
        totalCount: 1,
      })
    );

    const { container } = renderReconciliation('/reconciliation?view=variances&customerId=customer-1&batchId=b-week1&date=2026-10-19');
    expect(await screen.findByText('Thịt bò Tuần 1')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tháng đối soát' })).toHaveValue('10');

    // Batch selection must not require a daily summary on a report tab.
    await selectReviewBatch('b-week2');
    expect(await screen.findByText('Thịt bò Tuần 2')).toBeInTheDocument();

    // N1: After getVarianceRegister('b-week2') resolves, report wrapper must NOT stay stuck with aria-busy="true", inert, or opacity-70, and getBatchSummary should not be needed!
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    });
    expect(container.querySelector('[inert]')).toBeNull();
    expect(getSummarySpy).not.toHaveBeenCalled();
    getSummarySpy.mockRestore();
  });

  it('N2: replaces a foreign report schema with the target skeleton while the uncached tab loads', async () => {
    serverStateCache.clearAll();
    let resolveTransactions!: (val: Awaited<ReturnType<typeof mrxApi.getTransactionsHistory>>) => void;
    vi.spyOn(mrxApi, 'getVarianceRegister').mockResolvedValue({
      rows: [{
        batchId: 'b-dav', customerName: 'Draxlmaier', serviceDate: '2026-10-19', shiftName: 'Ca sáng',
        ingredientCode: 'NL-1', ingredientName: 'Thịt bò DAV', canonicalUnitName: 'kg',
        requiredQuantity: 10, issuedQuantity: 11, difference: 1, varianceType: 'OVER_ISSUED',
        dispositionCategory: 'ACCEPTED_VARIANCE', dispositionReason: 'Lệch DAV', disposedBy: 'u-1',
        disposedAt: '2026-10-19T07:00:00Z', issueNotes: [],
      }],
      totalCount: 1,
    });
    vi.spyOn(mrxApi, 'getTransactionsHistory').mockImplementation(() => new Promise((r) => {
      resolveTransactions = r;
    }));

    const router = createMemoryRouter(
      [{ path: '/reconciliation', element: <ReconciliationPage /> }],
      { initialEntries: ['/reconciliation?view=variances&customerId=customer-1&batchId=b-dav&date=2026-10-19'] }
    );
    const { container } = render(
      <AuthProvider resolveEligibility={(user, mode, pathname, search) => isRouteEligible(CANONICAL_ROUTES, pathname, search, user, mode)}>
        <RouterProvider router={router} />
      </AuthProvider>
    );
    expect(await screen.findByText('Thịt bò DAV')).toBeInTheDocument();

    // Navigate to "Giao dịch kho đối chiếu" (?view=transactions) while getTransactionsHistory is pending
    await act(async () => {
      await router.navigate('/reconciliation?view=transactions&customerId=customer-1&batchId=b-dav&date=2026-10-19');
    });

    // A different schema is a cold target, not a refresh of the old table.
    expect(screen.getByRole('status', { name: 'Đang tải nội dung' })).toHaveAttribute('data-skeleton-kind', 'table');
    expect(container.querySelectorAll('table')).toHaveLength(0);
    expect(screen.queryByText('Thịt bò DAV')).not.toBeInTheDocument();

    await act(async () => {
      resolveTransactions({
        items: [{
          transactionType: 'INITIAL_ISSUE', documentCode: 'PXK-001', date: '2026-10-19',
          batchId: 'b-dav', customerName: 'Draxlmaier',
          ingredientCode: 'NL-THIT-01', ingredientName: 'Thịt đùi heo tươi', unitName: 'kg',
          quantity: 72.5, actorName: 'Thủ kho', createdAt: '2026-10-19T05:00:00Z', reason: null,
        }],
        totalCount: 1, pageNumber: 1, pageSize: 25, totalPages: 1, hasPrev: false, hasNext: false,
      });
    });
    expect(await screen.findByText('PXK-001')).toBeInTheDocument();
  });

  it('N5: ignores the unscoped empty cache and waits for authoritative week data when switching customer', async () => {
    serverStateCache.clearAll();
    vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
      { customerId: 'customer-2', customerCode: 'KH2', customerName: 'Khách hàng 2' },
    ]);
    // Pre-warm KH2 with 0 batches in serverStateCache
    serverStateCache.set('mrx_batches_customer-2', []);

    renderReconciliation(`/reconciliation?customerId=customer-1&batchId=${MOCK_RECONCILIATION.batchId}&date=2026-10-19`);
    expect(await screen.findByText('Thịt đùi heo tươi')).toBeInTheDocument();

    let resolvePage!: (page: Awaited<ReturnType<typeof mrxApi.getBatchPage>>) => void;
    const getBatchPageSpy = vi.spyOn(mrxApi, 'getBatchPage').mockImplementation(() => new Promise(resolve => { resolvePage = resolve; }));

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' }), 'KH2');
    expect(screen.queryByRole('heading', { name: /Chưa có lô đối soát cho tháng/ })).not.toBeInTheDocument();
    expect(screen.getByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Đang tải trang' })).toBeVisible();
    await act(async () => resolvePage({ items: [], totalCount: 0, pageNumber: 1, pageSize: 2, totalPages: 0, hasPrev: false, hasNext: false }));
    expect(await screen.findByRole('heading', { name: /Chưa có lô đối soát cho tháng/ })).toBeVisible();
    expect(screen.queryByText('Thịt đùi heo tươi')).not.toBeInTheDocument();
    getBatchPageSpy.mockRestore();
  });

  it('Bug 4: ReconciliationPage does not crash with (cachedCustomers ?? []).find is not a function when catalog_customers holds a CacheWrapper entry', async () => {
    serverStateCache.clearAll();
    serverStateCache.set('catalog_customers', {
      data: [{ customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' }],
      isCompatibilityBlocked: false,
    });
    vi.mocked(weeklyMenuApi.getCustomers).mockResolvedValue([
      { customerId: 'customer-1', customerCode: 'DAV', customerName: 'Draxlmaier' },
    ]);

    renderReconciliation(`/reconciliation?customerId=customer-1&batchId=${MOCK_RECONCILIATION.batchId}&date=2026-10-19`);
    expect(await screen.findByText('Thịt đùi heo tươi')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Chọn khách hàng đối soát' })).toHaveValue('DAV');
  });
});
