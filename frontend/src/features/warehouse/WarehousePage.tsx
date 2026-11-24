import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../../store/useAuth';
import { WorkspaceHeader } from '../../components/workbench/WorkspaceHeader';
import { TelemetrySubbar } from '../../components/workbench/TelemetrySubbar';
import { DataGrid, type ColumnDef } from '../../components/workbench/DataGrid';
import { StateBoundary } from '../../components/workbench/StateBoundary';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { IdentifierText } from '../../components/ui/identifier-text';
import { Modal } from '../../components/ui/modal';
import { Num } from '../../components/ui/num';
import { useWorkbenchQuery } from '../../hooks/useWorkbenchQuery';
import { useUrlWorkbenchState } from '../../hooks/useUrlWorkbenchState';
import { PaginationBar } from '../../components/workbench/PaginationBar';
import type { ReportPage } from '../../api/reportsApi';
import {
  warehouseApi,
  type WarehouseItem,
  type InventoryReceiptItem,
  type InventoryIssueItem,
} from '../../api/warehouseApi';
import { formatVietnameseDate } from '../../utils/dates';
import { MrxDailyIssueWorkbench } from './MrxDailyIssueWorkbench';
import { MrxMultiCustomerPreparationWorkbench } from './MrxMultiCustomerPreparationWorkbench';
import { MrxSourceDeltaWorkbench } from './MrxSourceDeltaWorkbench';

export function WarehousePage() {
  const { operationalMode } = useAuth();
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view');

  const mrxView = view === 'mrx-daily' || view === 'mrx-preparation' || view === 'mrx-issues';
  if (!mrxView && operationalMode === 'MATERIAL_RECONCILIATION') {
    const batchId = searchParams.get('batchId');
    const serviceDate = searchParams.get('date');
    const params = new URLSearchParams();
    params.set('view', 'mrx-daily');
    if (batchId) params.set('batchId', batchId);
    if (serviceDate) params.set('date', serviceDate);
    return <Navigate to={`/warehouse?${params.toString()}`} replace />;
  }

  if (view === 'mrx-daily') {
    const batchId = searchParams.get('batchId') || '';
    const serviceDate = searchParams.get('date') || '';
    return <MrxDailyIssueWorkbench batchId={batchId} serviceDate={serviceDate} />;
  }

  if (view === 'mrx-preparation') {
    const serviceDate = searchParams.get('date') || '';
    return <MrxMultiCustomerPreparationWorkbench serviceDate={serviceDate} />;
  }
  if (view === 'mrx-issues') return <MrxSourceDeltaWorkbench />;
  return <DefaultWarehousePage />;
}

type WarehouseDocumentPage =
  | { view: 'issues'; page: ReportPage<InventoryIssueItem> }
  | { view: 'receipts'; page: ReportPage<InventoryReceiptItem> };

const receiptStatuses: Record<string, string> = {
  DRAFT: 'Dự thảo',
  PENDING_APPROVAL: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  VOIDED: 'Đã hủy',
  POSTED: 'Đã nhập kho',
};

function DefaultWarehousePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const activeView: 'issues' | 'receipts' | 'stock' =
    requestedView === 'receipts' || requestedView === 'stock' ? requestedView : 'issues';

  const { page, setPage } = useUrlWorkbenchState();
  const selectedWarehouseId = searchParams.get('warehouseId') || 'ALL';
  const setSelectedWarehouseId = (warehouseId: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    if (warehouseId === 'ALL') next.delete('warehouseId');
    else next.set('warehouseId', warehouseId);
    next.delete('page');
    return next;
  }, { replace: true });
  const [selectedIssue, setSelectedIssue] = useState<InventoryIssueItem | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<InventoryReceiptItem | null>(null);
  const receiptDetail = useWorkbenchQuery<InventoryReceiptItem>({
    scopeKey: 'default_receipt_detail',
    cacheKey: `default_receipt_detail_${selectedReceipt?.receiptId ?? ''}`,
    snapshotKey: '',
    scopeId: activeView === 'receipts' ? selectedReceipt?.receiptId ?? null : null,
    queryFn: (_, signal) => warehouseApi.getReceipt(selectedReceipt!.receiptId, signal),
  });
  const receiptLines = receiptDetail.data?.receiptId === selectedReceipt?.receiptId
    ? receiptDetail.data?.lines : undefined;
  const catalog = useWorkbenchQuery<WarehouseItem[]>({
    scopeKey: 'default_warehouse_catalog',
    cacheKey: 'default_warehouse_catalog',
    snapshotKey: '',
    queryFn: (_, signal) => warehouseApi.getWarehouses(signal),
  });
  const documents = useWorkbenchQuery<WarehouseDocumentPage>({
    scopeKey: 'default_warehouse_documents',
    cacheKey: JSON.stringify(['default_warehouse_documents', activeView, selectedWarehouseId, page]),
    snapshotKey: '',
    enabled: activeView !== 'stock',
    queryFn: async (_, signal) => {
      const query = { warehouseId: selectedWarehouseId, pageNumber: page };
      return activeView === 'receipts'
        ? { view: 'receipts', page: await warehouseApi.getReceipts(signal, query) }
        : { view: 'issues', page: await warehouseApi.getIssues(signal, query) };
    },
    isDatasetEmpty: result => result.page.items.length === 0,
  });
  const { isLoading, isFetching, error, isPreviousData } = documents.stateProps;
  const currentPage = documents.data?.view === activeView ? documents.data.page : null;
  const issues = activeView === 'issues' && documents.data?.view === 'issues' ? documents.data.page.items : [];
  const receipts = activeView === 'receipts' && documents.data?.view === 'receipts' ? documents.data.page.items : [];
  const loadData = () => {
    if (catalog.stateProps.error || activeView === 'stock') void catalog.refetch(true);
    if (activeView !== 'stock') void documents.refetch(true);
  };

  const warehouseOptions = useMemo(() => {
    return [
      { value: 'ALL', label: 'Tất cả các kho' },
      ...(catalog.data ?? []).map((w) => ({ value: w.warehouseId, label: `${w.warehouseCode} - ${w.warehouseName}` })),
    ];
  }, [catalog.data]);

  const activeViewLabel =
    activeView === 'receipts' ? 'Phiếu nhập kho' : activeView === 'stock' ? 'Tồn kho hiện tại' : 'Phiếu xuất kho';

  // Tab 1: Issues Columns
  const issueColumns: ColumnDef<InventoryIssueItem>[] = [
    {
      id: 'code',
      header: 'Mã phiếu xuất',
      width: '20%',
      cell: (row) => <IdentifierText value={row.issueCode} />,
    },
    {
      id: 'date',
      header: 'Ngày xuất',
      width: '14%',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {formatVietnameseDate(row.issueDate)}
        </span>
      ),
    },
    {
      id: 'shift',
      header: 'Ca áp dụng',
      width: '16%',
      cell: (row) => <span className="font-medium text-slate-800 text-sm">{row.shiftName}</span>,
    },
    {
      id: 'warehouse',
      header: 'Kho xuất hàng',
      width: '26%',
      cell: (row) => <span className="text-slate-700 text-sm truncate block">{row.warehouseName}</span>,
    },
    {
      id: 'items',
      header: 'Số mặt hàng',
      width: '10%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs">{row.itemsCount} dòng</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '10%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'ISSUED' ? 'success' : row.status === 'CONFIRMED' ? 'info' : 'neutral'}
          size="sm"
        >
          {row.status === 'ISSUED' ? 'Đã xuất kho' : row.status === 'CONFIRMED' ? 'Đã nhận đủ' : 'Dự thảo'}
        </Badge>
      ),
    },
    {
      id: 'action',
      header: 'Thao tác',
      width: '10%',
      align: 'right',
      cell: (row) => (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setSelectedIssue(row)}
          className="h-6 px-2 text-xs"
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  // Tab 2: Receipts Columns
  const receiptColumns: ColumnDef<InventoryReceiptItem>[] = [
    {
      id: 'code',
      header: 'Mã phiếu nhập',
      width: '20%',
      cell: (row) => <IdentifierText value={row.receiptCode} />,
    },
    {
      id: 'date',
      header: 'Ngày nhập',
      width: '14%',
      cell: (row) => (
        <span className="font-mono text-xs text-slate-700">
          {formatVietnameseDate(row.receiptDate)}
        </span>
      ),
    },
    {
      id: 'supplier',
      header: 'Nhà cung cấp',
      width: '26%',
      cell: (row) => <span className="font-semibold text-slate-900 text-sm truncate block">{row.supplierName}</span>,
    },
    {
      id: 'warehouse',
      header: 'Kho tiếp nhận',
      width: '20%',
      cell: (row) => <span className="text-slate-700 text-sm truncate block">{row.warehouseName}</span>,
    },
    {
      id: 'items',
      header: 'Số dòng',
      width: '10%',
      align: 'center',
      cell: (row) => <span className="font-mono text-xs">{row.itemsCount > 0 ? `${row.itemsCount} dòng` : '—'}</span>,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      width: '10%',
      align: 'center',
      cell: (row) => (
        <Badge
          variant={row.status === 'POSTED' ? 'success' : row.status === 'APPROVED' ? 'info' : 'neutral'}
          size="sm"
        >
          {receiptStatuses[row.status] ?? 'Chưa xác định'}
        </Badge>
      ),
    },
    {
      id: 'action',
      header: 'Thao tác',
      width: '10%',
      align: 'right',
      cell: (row) => (
        <Button
          variant="outline"
          size="xs"
          onClick={() => setSelectedReceipt(row)}
          className="h-6 px-2 text-xs"
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col h-full bg-white select-text">
      {/* Zone 1: WorkspaceHeader (56px / h-14) */}
      <WorkspaceHeader
        title="Kho nguyên liệu & Nhập xuất"
        breadcrumb="Kho bãi · Nhập xuất vật tư"
        contextSelectors={
          <>
            <Select
              aria-label="Lọc kho vận hành"
              options={warehouseOptions}
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="h-9 w-60 font-medium text-sm"
            />
            <Badge variant="success" size="default" className="h-9 px-3 text-sm font-medium flex items-center whitespace-nowrap shrink-0">
              Kho đang hoạt động
            </Badge>
          </>
        }
        actions={
          <Button
            variant="outline"
            size="default"
            onClick={loadData}
            disabled={activeView !== 'stock' && (isLoading || isFetching)}
            className="h-9 text-sm font-medium"
          >
            Làm mới
          </Button>
        }
      />

      {/* Zone 2: TelemetrySubbar (44px / h-11) */}
      <TelemetrySubbar
        leftControls={
          <span className="text-xs font-semibold text-slate-700">Đang xem: {activeViewLabel}</span>
        }
        telemetryPills={
          <>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Tổng phiếu:</span>
              <strong className="text-slate-900 font-mono font-bold"><Num value={currentPage?.totalCount} /> chứng từ</strong>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-500">Kho vận hành:</span>
              <strong className="text-slate-900 font-semibold"><Num value={catalog.data?.length} /> kho</strong>
            </span>
            <span className="text-slate-300">·</span>
            <Badge variant="neutral" size="sm">
              Tồn kho: Chưa có nguồn dữ liệu
            </Badge>
          </>
        }
        rightActions={
          <span className="text-xs text-slate-500 truncate max-w-72 hidden xl:inline">
            Phiếu xuất phải bắt đầu từ yêu cầu vật tư đã duyệt.
          </span>
        }
      />

      {/* Zone 3: DataGrid */}
      <StateBoundary
        isLoading={activeView !== 'stock' && !currentPage && (isLoading || isFetching)}
        isFetching={activeView !== 'stock' && isFetching}
        isPreviousData={activeView !== 'stock' && isPreviousData}
        hasExistingData={Boolean(currentPage)}
        error={activeView === 'stock' ? null : error}
        onRetry={loadData}
        isEmpty={activeView !== 'stock' && documents.stateProps.isEmpty && page === 1}
        emptyScenario={selectedWarehouseId !== 'ALL' ? 'filter-empty' : 'true-empty'}
        onResetFilters={() => setSelectedWarehouseId('ALL')}
        actionLabel={selectedWarehouseId !== 'ALL' ? 'Xem tất cả kho' : 'Làm mới danh sách'}
        onAction={selectedWarehouseId !== 'ALL' ? () => setSelectedWarehouseId('ALL') : loadData}
        contextDomain="warehouse"
        emptyTitle={activeView === 'issues' ? 'Chưa có phiếu xuất kho' : 'Chưa có phiếu nhập kho'}
        emptyDescription={
          activeView === 'issues'
            ? 'Không có phiếu xuất kho nào phù hợp với bộ lọc.'
            : 'Không có phiếu nhập kho nào phù hợp với bộ lọc.'
        }
      >
        {activeView === 'issues' && (
          <DataGrid<InventoryIssueItem>
            data={issues}
            columns={issueColumns}
            keyExtractor={(row) => row.issueId}
          />
        )}

        {activeView === 'receipts' && (
          <DataGrid<InventoryReceiptItem>
            data={receipts}
            columns={receiptColumns}
            keyExtractor={(row) => row.receiptId}
          />
        )}

        {activeView === 'stock' && (
          <StateBoundary
            isEmpty
            emptyScenario="prerequisite-blocked"
            emptyTitle="Chưa có nguồn tồn kho hiện tại"
            emptyDescription="Tồn kho hiện tại phải đến từ snapshot có thẩm quyền; không thể suy ra từ phiếu nhập và phiếu xuất với tồn đầu kỳ bằng 0."
            actionLabel="Xem phiếu xuất kho"
            onAction={() => navigate('/warehouse?view=issues')}
          >
            <div />
          </StateBoundary>
        )}
      </StateBoundary>

      {activeView !== 'stock' && currentPage && (
        <PaginationBar label={`Phân trang ${activeViewLabel.toLowerCase()}`} page={currentPage.pageNumber}
          pageSize={currentPage.pageSize} totalCount={currentPage.totalCount} totalPages={currentPage.totalPages}
          hasPrev={currentPage.hasPrev} hasNext={currentPage.hasNext} pending={isFetching || isPreviousData || Boolean(error)}
          retainButtonFocus onPageChange={setPage} />
      )}

      {/* Issue Detail Modal */}
      <Modal
        isOpen={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        title={`Chi tiết phiếu xuất: ${selectedIssue?.issueCode ?? ''}`}
        description={`Kho: ${selectedIssue?.warehouseName ?? ''} · Ngày xuất: ${selectedIssue ? formatVietnameseDate(selectedIssue.issueDate) : ''} · Ca: ${selectedIssue?.shiftName ?? ''}`}
        footer={<Button variant="outline" size="sm" onClick={() => setSelectedIssue(null)}>Đóng</Button>}
      >
        {selectedIssue && (
          <div className="space-y-3">
            <div className="border border-slate-200 rounded overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-2.5">Mã nguyên liệu</th>
                    <th className="p-2.5">Tên nguyên liệu</th>
                    <th className="p-2.5 text-center">ĐVT</th>
                    <th className="p-2.5 text-right">Yêu cầu</th>
                    <th className="p-2.5 text-right">Thực xuất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {selectedIssue.lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                        Phiếu xuất không có dòng chi tiết.
                      </td>
                    </tr>
                  ) : (
                    selectedIssue.lines.map((l) => (
                      <tr key={l.lineId} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-mono text-slate-600"><IdentifierText value={l.ingredientCode} /></td>
                        <td className="p-2.5 font-medium text-slate-900">{l.ingredientName}</td>
                        <td className="p-2.5 text-center font-mono text-slate-700">{l.unit}</td>
                        <td className="p-2.5 text-right font-mono"><Num value={l.requestedQty} format="quantity" /></td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900"><Num value={l.issuedQty} format="quantity" /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Receipt Detail Modal */}
      <Modal
        isOpen={activeView === 'receipts' && Boolean(selectedReceipt)}
        onClose={() => setSelectedReceipt(null)}
        title={`Chi tiết phiếu nhập: ${selectedReceipt?.receiptCode ?? ''}`}
        description={`Nhà cung cấp: ${selectedReceipt?.supplierName ?? ''} · Ngày nhập: ${selectedReceipt ? formatVietnameseDate(selectedReceipt.receiptDate) : ''} · Kho: ${selectedReceipt?.warehouseName ?? ''}`}
        footer={<Button variant="outline" size="sm" onClick={() => setSelectedReceipt(null)}>Đóng</Button>}
      >
        {selectedReceipt && <StateBoundary {...receiptDetail.stateProps}
          isLoading={!receiptLines && (receiptDetail.stateProps.isLoading || receiptDetail.stateProps.isFetching)}
          hasExistingData={Boolean(receiptLines)} onRetry={() => void receiptDetail.refetch(true)}>
        {receiptLines && (
          <div className="space-y-3">
            <div className="border border-slate-200 rounded overflow-hidden max-h-72 overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 sticky top-0">
                  <tr>
                    <th className="p-2.5">Mã nguyên liệu</th>
                    <th className="p-2.5">Tên nguyên liệu</th>
                    <th className="p-2.5 text-center">ĐVT</th>
                    <th className="p-2.5 text-right">Thực nhận</th>
                    <th className="p-2.5 text-right">Đơn giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {receiptLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                        Phiếu nhập không có dòng chi tiết.
                      </td>
                    </tr>
                  ) : (
                    receiptLines.map((l) => (
                      <tr key={l.lineId} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-mono text-slate-600"><IdentifierText value={l.ingredientCode} /></td>
                        <td className="p-2.5 font-medium text-slate-900">{l.ingredientName}</td>
                        <td className="p-2.5 text-center font-mono text-slate-700">{l.unit}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900"><Num value={l.receivedQty} format="quantity" /></td>
                        <td className="p-2.5 text-right font-mono">{l.unitPrice ? <Num value={l.unitPrice} format="currency" /> : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </StateBoundary>}
      </Modal>
    </div>
  );
}
