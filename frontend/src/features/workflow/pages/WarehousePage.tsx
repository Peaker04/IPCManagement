import { useState } from 'react';
import { ClipboardList, PackageOpen, ReceiptText, Warehouse } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHasRole } from '@/app/hooks';
import {
  CommandBar,
  ContextStrip,
  DemandSummary,
  DocumentRail,
  ExceptionLane,
  InlineAlert,
  OperationalFrame,
  PaginationBar,
  RoleInbox,
  SectionPanel,
  SplitWorkbench,
  StockMovementTable,
  TableViewport,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useCreateInventoryIssueMutation,
  useGetCurrentStockQuery,
  useGetCurrentStockPageQuery,
  useGetIngredientDemandPageQuery,
  useGetMaterialRequestCandidatePageQuery,
  useGetKitchenIssuesQuery,
  useGetStockMovementPageQuery,
  useGetWorkflowDocumentsQuery,
  useWorkflowOverview,
} from '@/features/workflow';
import { formatCurrency, formatQuantityWithUnit } from '@/lib/formatters';
import { formatWorkflowStatus } from '../workflowConfig';
import {
  useGetPurchaseOrdersPageQuery,
  useGetWarehouseSelectorQuery,
  type PurchaseOrderLineDto,
} from '../workflowApi';
import { WarehousePurchaseReceiptDialog } from '../warehouse/WarehousePurchaseReceiptDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const getMutationErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data && typeof data === 'object' && 'message' in data) {
      return String(data.message);
    }
  }

  return fallback;
};

export default function WarehousePage() {
  const [searchParams] = useSearchParams();
  const canReceivePurchases = useHasRole(['warehouse']);
  const [activeView, setActiveView] = useState<'movement' | 'demand' | 'exceptions'>('movement');
  const [purchaseOrderPageNumber, setPurchaseOrderPageNumber] = useState(1);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(searchParams.get('purchaseOrderId'));
  const [selectedReceiptLine, setSelectedReceiptLine] = useState<PurchaseOrderLineDto>();
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [demandPage, setDemandPage] = useState(1);
  const [issueCandidatePageNumber, setIssueCandidatePageNumber] = useState(1);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [selectedMaterialRequestId, setSelectedMaterialRequestId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [stockMovementCursors, setStockMovementCursors] = useState<Array<{ cursorDate: string; cursorId?: string }>>([]);
  const [warehouseFeedback, setWarehouseFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 20 });
  const { data: purchaseOrderPageResponse, isFetching: isFetchingPurchaseOrders } = useGetPurchaseOrdersPageQuery({
    pageNumber: purchaseOrderPageNumber,
    pageSize: 8,
  });
  const { data: receiptWarehouses = [] } = useGetWarehouseSelectorQuery();
  const { data: demandPageResponse } = useGetIngredientDemandPageQuery({
    pageNumber: demandPage,
    pageSize: 8,
  });
  const demandLines = demandPageResponse?.items ?? [];
  const { data: issueCandidatePage, isFetching: isFetchingIssueCandidates } = useGetMaterialRequestCandidatePageQuery({
    purpose: 'issue',
    pageNumber: issueCandidatePageNumber,
    pageSize: 8,
  });
  const { data: issueWarehouseRows = [] } = useGetCurrentStockQuery({ limit: 100 });
  const stockMovementCursor = stockMovementCursors.at(-1);
  const { data: stockMovementPage } = useGetStockMovementPageQuery({
    cursorDate: stockMovementCursor?.cursorDate,
    cursorId: stockMovementCursor?.cursorId,
    limit: 8,
    sortDirection: 'desc',
  }, { skip: activeView !== 'movement' });
  const { data: currentStockPageResponse } = useGetCurrentStockPageQuery({
    pageNumber: currentStockPage,
    pageSize: 8,
  }, { skip: activeView !== 'movement' });
  const currentStockRows = currentStockPageResponse?.items ?? [];
  const { data: kitchenIssueRows = [] } = useGetKitchenIssuesQuery({ limit: 100 });
  const [createInventoryIssue, { isLoading: isCreatingIssue }] = useCreateInventoryIssueMutation();
  const { roleInboxItems } = useWorkflowOverview();
  const warehouseDocuments = [
    ...workflowDocuments.filter((document) => document.type === 'Phiếu nhập'),
    ...workflowDocuments.filter((document) => document.type === 'Phiếu xuất'),
  ];
  const warehouseInbox = roleInboxItems.filter((item) => item.laneId === 'warehouse');
  const shortageLine = demandLines.find((line) => line.tone === 'danger');
  const shortageCount = demandPageResponse?.shortageCount ?? 0;
  const issueDocument = warehouseDocuments.find((document) => document.type === 'Phiếu xuất');
  const receiptDocument = warehouseDocuments.find((document) => document.type === 'Phiếu nhập');
  const warehouseName = currentStockRows[0]?.warehouse ?? receiptDocument?.owner ?? issueDocument?.owner ?? 'Kho';
  const issueCandidates = issueCandidatePage?.items ?? [];
  const warehouseOptions = Array.from(
    new Map(issueWarehouseRows.filter((row) => row.warehouseId).map((row) => [row.warehouseId, row.warehouse])).entries(),
  ).map(([id, name]) => ({ id, name }));
  const selectedIssueCandidate = issueCandidates.find((candidate) => candidate.materialRequestId === selectedMaterialRequestId);
  const pendingKitchenReceiptCount = kitchenIssueRows.filter((row) => !row.isReceivedByKitchen).length;
  const purchaseOrders = purchaseOrderPageResponse?.page.items ?? [];
  const requestedPurchaseRequestId = searchParams.get('purchaseRequestId');
  const selectedPurchaseOrder = purchaseOrders.find((order) => order.purchaseOrderId === selectedPurchaseOrderId)
    ?? (selectedPurchaseOrderId === null
      ? purchaseOrders.find((order) => order.purchaseRequestId === requestedPurchaseRequestId)
      : undefined);

  const selectPurchaseOrder = (purchaseOrderId: string) => {
    setSelectedPurchaseOrderId(selectedPurchaseOrder?.purchaseOrderId === purchaseOrderId ? '' : purchaseOrderId);
    setSelectedReceiptLine(undefined);
  };

  const openIssueDialog = () => {
    setIssueCandidatePageNumber(1);
    setSelectedMaterialRequestId('');
    setSelectedWarehouseId('');
    setWarehouseFeedback(null);
    setIsIssueDialogOpen(true);
  };

  const handleCreateInventoryIssue = async () => {
    setWarehouseFeedback(null);

    if (!selectedIssueCandidate) {
      setWarehouseFeedback({
        title: 'Chưa có nhu cầu xuất kho',
        message: 'Kho cần có nhu cầu nguyên liệu và kế hoạch sản xuất hợp lệ trước khi tạo phiếu xuất.',
        variant: 'warning',
      });
      setActiveView('demand');
      return;
    }

    if (!selectedWarehouseId) {
      setWarehouseFeedback({
        title: 'Chưa xác định kho xuất',
        message: 'Chưa có dòng tồn kho live để xác định warehouseId cho phiếu xuất.',
        variant: 'warning',
      });
      setActiveView('movement');
      return;
    }

    try {
      const response = await createInventoryIssue({
        issueDate: selectedIssueCandidate.requestDate,
        warehouseId: selectedWarehouseId,
        materialRequestId: selectedIssueCandidate.materialRequestId,
        lines: [],
      }).unwrap();

      setWarehouseFeedback({
        title: 'Đã tạo phiếu xuất kho',
        message: response.data
          ? `Phiếu ${response.data.issueCode} đã được ghi nhận và chờ bếp ký nhận.`
          : response.message || 'Phiếu xuất kho đã được ghi nhận.',
        variant: 'info',
      });
      setIsIssueDialogOpen(false);
      setActiveView('movement');
    } catch (error) {
      setWarehouseFeedback({
        title: 'Chưa tạo được phiếu xuất kho',
        message: getMutationErrorMessage(error, 'Kiểm tra tồn kho, demand còn lại hoặc quyền thủ kho rồi thử lại.'),
        variant: 'danger',
      });
      setActiveView('exceptions');
    }
  };

  return (
    <OperationalFrame
      command={
        <CommandBar
          actionsClassName="ipc-warehouse-actions"
          actions={
            <>
              <button
                className="ipc-button ipc-button-primary"
                type="button"
                onClick={openIssueDialog}
              >
                Tạo phiếu xuất kho
              </button>
              <Link className="ipc-button ipc-button-success" to={ROUTES.REPORTS}>
                Xem tồn kho
              </Link>
              <Link className="ipc-button ipc-button-primary" to={ROUTES.CHEF_DASHBOARD}>
                <PackageOpen size={16} />
                Bàn giao cho bếp
              </Link>
              <Link className="ipc-button ipc-button-ghost" to={ROUTES.PURCHASING}>
                Quay lại thu mua
              </Link>
            </>
          }
        >
          <span className="ipc-command-meta">
            <Warehouse size={16} />
            {warehouseName}
          </span>
          <span className="ipc-command-meta">Bàn giao bếp: {issueDocument?.title ?? 'Chưa có phiếu xuất'}</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Phiếu nhập', value: `${warehouseDocuments.filter((document) => document.type === 'Phiếu nhập').length} chứng từ`, tone: 'warning' },
            { label: 'Phiếu xuất', value: `${warehouseDocuments.filter((document) => document.type === 'Phiếu xuất').length} phiếu`, tone: 'warning' },
            { label: 'Dòng tồn kho', value: currentStockRows.length.toString(), tone: currentStockRows.length > 0 ? 'success' : 'warning' },
            { label: 'Thiếu hàng', value: shortageLine ? `${shortageLine.material} ${formatQuantityWithUnit(Math.max(shortageLine.required - shortageLine.available, 0), shortageLine.unit)}` : shortageCount > 0 ? `${shortageCount} dòng thiếu` : 'Không có', tone: shortageCount > 0 ? 'danger' : 'success' },
            { label: 'Bếp nhận', value: pendingKitchenReceiptCount > 0 ? `${pendingKitchenReceiptCount} dòng chờ ký` : 'Không còn chờ ký', tone: pendingKitchenReceiptCount > 0 ? 'warning' : 'success' },
          ]}
        />
      }
    >

      <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
        <DialogContent aria-labelledby="warehouse-issue-title" aria-describedby="warehouse-issue-description">
          <DialogHeader>
            <DialogTitle id="warehouse-issue-title">Tạo phiếu xuất kho</DialogTitle>
            <DialogDescription id="warehouse-issue-description">
              Chọn đúng nhu cầu nguyên liệu và kho xuất. Hệ thống không tự chọn chứng từ thay bạn.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="warehouse-material-request">Nhu cầu nguyên liệu <span aria-hidden="true" className="text-red-600">*</span></label>
              <Select value={selectedMaterialRequestId} onValueChange={(value) => setSelectedMaterialRequestId(value ?? '')}>
                <SelectTrigger id="warehouse-material-request" aria-label="Chọn nhu cầu nguyên liệu">
                  <SelectValue placeholder="Chọn chứng từ cần xuất" />
                </SelectTrigger>
                <SelectContent>
                  {issueCandidates.map((candidate) => (
                    <SelectItem key={candidate.materialRequestId} value={candidate.materialRequestId}>
                      {candidate.materialRequestCode} | {candidate.requestDate} | {candidate.actionableLineCount} dòng
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <PaginationBar
                page={issueCandidatePageNumber}
                pageSize={issueCandidatePage?.pageSize ?? 8}
                totalItems={issueCandidatePage?.totalCount ?? 0}
                onPageChange={(page) => {
                  setSelectedMaterialRequestId('');
                  setIssueCandidatePageNumber(page);
                }}
              />
              {issueCandidates.length === 0 && (
                <p className="text-xs text-amber-700">
                  {isFetchingIssueCandidates ? 'Đang tải nhu cầu nguyên liệu...' : 'Chưa có nhu cầu nguyên liệu đủ điều kiện để xuất kho.'}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-800" htmlFor="warehouse-source">Kho xuất <span aria-hidden="true" className="text-red-600">*</span></label>
              <Select value={selectedWarehouseId} onValueChange={(value) => setSelectedWarehouseId(value ?? '')}>
                <SelectTrigger id="warehouse-source" aria-label="Chọn kho xuất">
                  <SelectValue placeholder="Chọn kho cấp nguyên liệu" />
                </SelectTrigger>
                <SelectContent>
                  {warehouseOptions.map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {warehouseOptions.length === 0 && <p className="text-xs text-amber-700">Chưa có kho từ dữ liệu tồn hiện tại.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsIssueDialogOpen(false)}>Hủy</Button>
            <Button type="button" onClick={() => void handleCreateInventoryIssue()} disabled={!selectedMaterialRequestId || !selectedWarehouseId || isCreatingIssue}>
              {isCreatingIssue ? 'Đang tạo phiếu...' : 'Xác nhận tạo phiếu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedPurchaseOrder && selectedReceiptLine && canReceivePurchases && (
        <WarehousePurchaseReceiptDialog
          key={`${selectedPurchaseOrder.purchaseOrderId}-${selectedReceiptLine.purchaseOrderLineId}`}
          open
          order={selectedPurchaseOrder}
          line={selectedReceiptLine}
          warehouses={receiptWarehouses}
          week={searchParams.get('week') ?? undefined}
          onOpenChange={(open) => { if (!open) setSelectedReceiptLine(undefined); }}
          onSuccess={(result) => {
            setSelectedReceiptLine(undefined);
            setWarehouseFeedback({
              title: 'Đã ghi nhận nhập kho',
              message: `Phiếu nhập ${result.receiptId} đã cập nhật tồn kho và tiến độ đơn mua.`,
              variant: 'info',
            });
          }}
        />
      )}

      {warehouseFeedback && (
        <InlineAlert title={warehouseFeedback.title} variant={warehouseFeedback.variant}>
          {warehouseFeedback.message}
        </InlineAlert>
      )}

      <SectionPanel
        title="Đơn mua chờ nhập kho"
        icon={<ReceiptText size={18} aria-hidden="true" />}
        description="Chọn đúng đơn và dòng thực nhận. Cờ bằng chứng do máy chủ cung cấp, không suy đoán theo tên nguyên liệu."
        className="min-w-0 overflow-hidden"
      >
        {!canReceivePurchases && (
          <InlineAlert title="Chế độ chỉ đọc" variant="info" className="mb-3">
            Chỉ vai trò Warehouse được ghi nhận phiếu nhập. Bạn vẫn có thể theo dõi tiến độ đơn mua.
          </InlineAlert>
        )}
        <TableViewport
          ariaLabel="Danh sách đơn mua và tiến độ nhập kho"
          caption="Danh sách được phân trang và cuộn trong vùng cố định."
          className="h-[400px] max-h-[400px] xl:h-[480px] xl:max-h-[480px]"
        >
          <table className="ipc-data-table min-w-[820px]">
            <thead>
              <tr>
                <th>Đơn mua</th>
                <th>Nhà cung cấp</th>
                <th>Đề xuất mua</th>
                <th>Trạng thái</th>
                <th>Tiến độ dòng</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isFetchingPurchaseOrders && purchaseOrders.length === 0 ? (
                Array.from({ length: 8 }, (_, index) => (
                  <tr key={`purchase-order-skeleton-${index}`} aria-hidden="true">
                    <td colSpan={6}><div className="h-5 animate-pulse rounded-sm bg-slate-200 motion-reduce:animate-none" /></td>
                  </tr>
                ))
              ) : purchaseOrders.length === 0 ? (
                <tr><td colSpan={6} className="h-[320px] text-center text-slate-600">Chưa có đơn mua để theo dõi nhập kho.</td></tr>
              ) : purchaseOrders.map((order) => {
                const completedLines = order.lines.filter((line) => line.receivedQty >= line.orderedQty).length;
                const isSelected = selectedPurchaseOrder?.purchaseOrderId === order.purchaseOrderId;
                return (
                  <tr key={order.purchaseOrderId} className={isSelected ? 'bg-blue-50/60' : undefined}>
                    <td className="font-semibold text-slate-900">{order.purchaseOrderCode}</td>
                    <td>{order.supplierName}</td>
                    <td>{order.purchaseRequestCode}</td>
                    <td>{formatWorkflowStatus(order.status)}</td>
                    <td>{completedLines}/{order.lines.length} dòng đã đủ</td>
                    <td>
                      <Button type="button" variant="outline" size="sm" aria-expanded={isSelected} onClick={() => selectPurchaseOrder(order.purchaseOrderId)}>
                        {isSelected ? 'Đóng chi tiết' : 'Xem dòng nhận'}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar
          page={purchaseOrderPageResponse?.page.pageNumber ?? purchaseOrderPageNumber}
          pageSize={purchaseOrderPageResponse?.page.pageSize ?? 8}
          totalItems={purchaseOrderPageResponse?.page.totalCount ?? 0}
          onPageChange={(page) => {
            setPurchaseOrderPageNumber(page);
            setSelectedPurchaseOrderId('');
            setSelectedReceiptLine(undefined);
          }}
        />

        {selectedPurchaseOrder && (
          <div className="mt-4 rounded-sm border border-slate-300 bg-slate-50 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">Chi tiết {selectedPurchaseOrder.purchaseOrderCode}</h3>
                <p className="mt-1 text-xs text-slate-600">Số lượng và đơn giá thực nhận được xác nhận riêng cho từng dòng.</p>
              </div>
              <span className="text-xs font-medium text-slate-600">{selectedPurchaseOrder.orderDate}</span>
            </div>
            <TableViewport ariaLabel={`Chi tiết đơn mua ${selectedPurchaseOrder.purchaseOrderCode}`} caption="Các dòng và yêu cầu bằng chứng nhập kho do máy chủ cung cấp." className="max-h-[320px]">
              <table className="ipc-data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>Nguyên liệu</th>
                    <th>Đã nhận / đặt</th>
                    <th>Đơn giá đặt</th>
                    <th>Bằng chứng bắt buộc</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchaseOrder.lines.map((line) => {
                    const remaining = Math.max(line.orderedQty - line.receivedQty, 0);
                    const requirements = [
                      line.lotNumberRequired ? 'số lô' : null,
                      line.manufactureDateRequired ? 'ngày sản xuất' : null,
                      line.expiryDateRequired ? 'hạn sử dụng' : null,
                    ].filter(Boolean).join(', ');
                    return (
                      <tr key={line.purchaseOrderLineId}>
                        <td>
                          <span className="block font-semibold text-slate-900">{line.ingredientName}</span>
                          {line.blockerReason && <span className="mt-1 block text-xs text-red-700">{line.blockerReason}</span>}
                        </td>
                        <td>{line.receivedQty}/{line.orderedQty} {line.unitName}<span className="block text-xs text-slate-500">Còn {remaining} {line.unitName}</span></td>
                        <td>{formatCurrency(line.unitPrice)}</td>
                        <td>{requirements || 'Không có yêu cầu bổ sung'}</td>
                        <td>
                          {canReceivePurchases && (
                            <Button type="button" size="sm" disabled={remaining <= 0 || Boolean(line.blockerReason)} onClick={() => setSelectedReceiptLine(line)}>
                              {remaining <= 0 ? 'Đã nhận đủ' : 'Ghi nhận nhập kho'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableViewport>
          </div>
        )}
      </SectionPanel>

      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn kho"
        tabs={[
          { id: 'warehouse-movement', label: 'Luân chuyển' },
          { id: 'warehouse-demand', label: 'Nhu cầu xuất' },
          { id: 'warehouse-exceptions', label: 'Ngoại lệ' },
        ]}
        activeTab={`warehouse-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('warehouse-', '') as 'movement' | 'demand' | 'exceptions')}
      />

      {activeView === 'movement' && (
        <div id="warehouse-movement-panel" role="tabpanel" aria-labelledby="warehouse-movement-tab">
          <SplitWorkbench
            detailLabel="Phiếu kho"
            detail={
              <DocumentRail
                documents={warehouseDocuments}
                title={null}
                actionForDocument={(document) => (
                  <Link className="ipc-button ipc-button-ghost" to={document.route}>
                    Mở phiếu
                  </Link>
                )}
              />
            }
          >
            <div className="flex flex-col gap-4">
              <SectionPanel title="Tồn kho hiện tại" icon={<Warehouse size={18} />}>
                <TableViewport className="ipc-warehouse-table-shell" ariaLabel="Bảng tồn kho hiện tại trong kho" caption="Danh sách tồn kho hiện tại trong kho">
                  <table className="ipc-data-table">
                    <thead>
                      <tr>
                        <th>Kho</th>
                        <th>Nguyên liệu</th>
                        <th>Số lượng</th>
                        <th>Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentStockRows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center text-slate-500">Chưa có dữ liệu tồn kho</td>
                        </tr>
                      ) : currentStockRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.warehouse}</td>
                          <td>{row.ingredient}</td>
                          <td className="ipc-numeric-cell">{formatQuantityWithUnit(row.currentQty, row.unit)}</td>
                          <td>{new Date(row.lastUpdated).toLocaleString('vi-VN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableViewport>
                <PaginationBar
                  page={currentStockPageResponse?.pageNumber ?? currentStockPage}
                  pageSize={currentStockPageResponse?.pageSize ?? 8}
                  totalItems={currentStockPageResponse?.totalCount ?? 0}
                  onPageChange={setCurrentStockPage}
                />
              </SectionPanel>

              <SectionPanel title="Luân chuyển kho" icon={<ClipboardList size={18} />}>
                <StockMovementTable
                  movements={stockMovementPage?.items ?? []}
                  cursorPagination={{
                    page: stockMovementCursors.length + 1,
                    hasNext: stockMovementPage?.hasNext ?? false,
                    onPrevious: () => setStockMovementCursors((current) => current.slice(0, -1)),
                    onNext: () => {
                      const nextCursorDate = stockMovementPage?.nextCursorDate;
                      if (nextCursorDate) {
                        setStockMovementCursors((current) => [...current, { cursorDate: nextCursorDate, cursorId: stockMovementPage?.nextCursorId }]);
                      }
                    },
                  }}
                />
              </SectionPanel>
            </div>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'demand' && (
        <SectionPanel title="Nhu cầu xuất và thiếu hàng">
          <div id="warehouse-demand-panel" role="tabpanel" aria-labelledby="warehouse-demand-tab">
          <DemandSummary lines={demandLines} />
          <PaginationBar
            page={demandPageResponse?.pageNumber ?? demandPage}
            pageSize={demandPageResponse?.pageSize ?? 8}
            totalItems={demandPageResponse?.totalCount ?? 0}
            onPageChange={setDemandPage}
          />
          <div className="mt-4">
            <RoleInbox
              items={warehouseInbox}
              title={null}
              actionForItem={(item) => (
                <Link className="ipc-button ipc-button-ghost" to={item.route}>
                  {formatWorkflowStatus(item.nextAction)}
                </Link>
              )}
            />
          </div>
          </div>
        </SectionPanel>
      )}

      {activeView === 'exceptions' && (
        <SectionPanel title="Nhánh thiếu hàng và xuất bổ sung">
          <div id="warehouse-exceptions-panel" role="tabpanel" aria-labelledby="warehouse-exceptions-tab">
          <ExceptionLane
            title="Thiếu hàng cần xử lí"
            items={[
              {
                title: shortageLine ? `${shortageLine.material} còn thiếu` : shortageCount > 0 ? `${shortageCount} dòng đang thiếu` : 'Không có thiếu hàng',
                description: shortageLine
                  ? 'Không đủ hàng để xuất theo danh sách. Tạo phiếu xuất bổ sung hoặc danh sách mua thêm.'
                  : shortageCount > 0
                    ? 'Có dòng nhu cầu thiếu hàng trong các trang dữ liệu. Mở tab nhu cầu xuất để xem từng nguyên liệu.'
                  : 'Các dòng nhu cầu hiện có đủ tồn kho để xử lí.',
                action: shortageCount > 0 ? 'Thủ kho: Tạo phiếu xuất kho bổ sung' : 'Thủ kho: Theo dõi nhu cầu',
                tone: shortageCount > 0 ? 'danger' : 'info',
              },
              {
                title: issueDocument ? `Bếp chưa ký nhận ${issueDocument.title}` : 'Chưa có phiếu xuất chờ ký nhận',
                description: issueDocument
                  ? `Phiếu ${formatWorkflowStatus(issueDocument.status).toLowerCase()} cần bàn giao để bếp xác nhận nhận nguyên liệu.`
                  : 'Khi có phiếu xuất từ báo cáo vận hành, thủ kho bàn giao để bếp xác nhận nhận nguyên liệu.',
                action: 'Thủ kho: Xuất kho cho bếp',
                tone: issueDocument ? 'warning' : 'info',
              },
            ]}
          />
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}
