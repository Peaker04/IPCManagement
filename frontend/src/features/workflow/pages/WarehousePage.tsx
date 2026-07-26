import { useDeferredValue, useState } from 'react';
import { ClipboardList, PackageOpen, ReceiptText, Warehouse } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHasRole } from '@/app/hooks';
import {
  CommandBar,
  ContextStrip,
  DemandSummary,
  DocumentRail,
  EmptyState,
  InlineAlert,
  OperationalFrame,
  PaginationBar,
  QueryErrorAlert,
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
  useGetIngredientDemandQuery,
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
  useGetSupplementalMaterialRequestsQuery,
  useGetWarehouseSelectorQuery,
  type PurchaseOrderLineDto,
} from '../workflowApi';
import { WarehousePurchaseReceiptDialog } from '../warehouse/WarehousePurchaseReceiptDialog';
import { buildWarehouseIssueAllocation } from '../warehouse/warehouseIssueAllocation';
import { WarehouseExceptionsWorkbench } from '../warehouse/WarehouseExceptionsWorkbench';
import { resolveIssueCreationAvailability } from '../actionEligibility';
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
  const canReceivePurchases = useHasRole(['thukho']);
  const [selectedView, setSelectedView] = useState<'movement' | 'demand' | 'exceptions'>('movement');
  const activeView = useDeferredValue(selectedView);
  const isViewPending = selectedView !== activeView;
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
  const {
    data: workflowDocuments = [],
    isError: isWorkflowDocumentError,
    isFetching: isFetchingWorkflowDocuments,
    refetch: refetchWorkflowDocuments,
  } = useGetWorkflowDocumentsQuery({ limit: 20 });
  const { data: purchaseOrderPageResponse, isFetching: isFetchingPurchaseOrders, isError: isPurchaseOrderError, refetch: refetchPurchaseOrders } = useGetPurchaseOrdersPageQuery({
    pageNumber: purchaseOrderPageNumber,
    pageSize: 8,
  });
  const { data: receiptWarehouses = [], isError: isWarehouseSelectorError } = useGetWarehouseSelectorQuery();
  const {
    data: supplementalRequests,
    isError: isSupplementalRequestError,
    isFetching: isFetchingSupplementalRequests,
    refetch: refetchSupplementalRequests,
  } = useGetSupplementalMaterialRequestsQuery({ pageNumber: 1, pageSize: 100 });
  const {
    data: demandPageResponse,
    isError: isDemandPageError,
    isFetching: isFetchingDemandPage,
    refetch: refetchDemandPage,
  } = useGetIngredientDemandPageQuery({
    pageNumber: demandPage,
    pageSize: 8,
  }, { skip: activeView !== 'demand' });
  const demandLines = demandPageResponse?.items ?? [];
  const {
    data: issueCandidatePage,
    isFetching: isFetchingIssueCandidates,
    isError: isIssueCandidateError,
  } = useGetMaterialRequestCandidatePageQuery({
    purpose: 'issue',
    pageNumber: issueCandidatePageNumber,
    pageSize: 8,
  });
  const stockMovementCursor = stockMovementCursors.at(-1);
  const {
    data: stockMovementPage,
    isError: isStockMovementError,
    isFetching: isFetchingStockMovement,
    refetch: refetchStockMovement,
  } = useGetStockMovementPageQuery({
    cursorDate: stockMovementCursor?.cursorDate,
    cursorId: stockMovementCursor?.cursorId,
    limit: 8,
    sortDirection: 'desc',
  }, { skip: activeView !== 'movement' });
  const {
    data: currentStockPageResponse,
    isError: isCurrentStockError,
    isFetching: isFetchingCurrentStock,
    refetch: refetchCurrentStock,
  } = useGetCurrentStockPageQuery({
    pageNumber: currentStockPage,
    pageSize: 8,
  }, { skip: activeView !== 'movement' });
  const currentStockRows = currentStockPageResponse?.items ?? [];
  const { data: kitchenIssueRows = [], isError: isKitchenIssueError } = useGetKitchenIssuesQuery({ limit: 100 });
  const [createInventoryIssue, { isLoading: isCreatingIssue }] = useCreateInventoryIssueMutation();
  const { roleInboxItems } = useWorkflowOverview({ skip: activeView !== 'demand' });
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
  const issueCreationAvailability = resolveIssueCreationAvailability({
    canManageWarehouse: canReceivePurchases,
    isFetching: isFetchingIssueCandidates,
    candidateCount: issueCandidatePage?.totalCount,
    isError: isIssueCandidateError,
  });
  const warehouseOptions = receiptWarehouses.map((warehouse) => ({
    id: warehouse.warehouseId,
    name: warehouse.warehouseName,
  }));
  const selectedIssueCandidate = issueCandidates.find((candidate) => candidate.materialRequestId === selectedMaterialRequestId);
  const {
    data: selectedDemandLines = [],
    isFetching: isFetchingSelectedDemand,
    isError: isSelectedDemandError,
  } = useGetIngredientDemandQuery(
    selectedIssueCandidate
      ? { dateFrom: selectedIssueCandidate.requestDate, dateTo: selectedIssueCandidate.requestDate, limit: 100 }
      : undefined,
    { skip: !selectedIssueCandidate },
  );
  const {
    data: selectedWarehouseStockRows = [],
    isFetching: isFetchingSelectedWarehouseStock,
    isError: isSelectedWarehouseStockError,
  } = useGetCurrentStockQuery(
    selectedWarehouseId ? { warehouseId: selectedWarehouseId, limit: -1 } : undefined,
    { skip: !selectedWarehouseId },
  );
  // Nhu cầu hoặc tồn kho lỗi => phân bổ ra 0 dòng. Đó KHÔNG phải bằng chứng kho
  // thiếu hàng, nên không được hiển thị như vậy và không được cho xác nhận xuất.
  const isAllocationSourceError = isSelectedDemandError || isSelectedWarehouseStockError;
  const selectedWarehouseAllocation = selectedIssueCandidate
    ? buildWarehouseIssueAllocation(
        selectedIssueCandidate.materialRequestId,
        selectedWarehouseId,
        selectedDemandLines,
        selectedWarehouseStockRows,
        kitchenIssueRows,
      )
    : { lines: [], remainingLineCount: 0, fullyCoveredLineCount: 0 };
  const pendingKitchenReceiptCount = kitchenIssueRows.filter((row) => !row.isReceivedByKitchen).length;
  const purchaseOrders = purchaseOrderPageResponse?.page.items ?? [];
  const requestedPurchaseRequestId = searchParams.get('purchaseRequestId');
  const selectedPurchaseOrder = purchaseOrders.find((order) => order.purchaseOrderId === selectedPurchaseOrderId)
    ?? (selectedPurchaseOrderId === null
      ? purchaseOrders.find((order) => order.purchaseRequestId === requestedPurchaseRequestId)
      : undefined);
  const linkedSupplementalRequest = supplementalRequests?.items.find(
    (request) => request.purchaseRequestId === selectedPurchaseOrder?.purchaseRequestId,
  );

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
      setSelectedView('demand');
      return;
    }

    if (!selectedWarehouseId) {
      setWarehouseFeedback({
        title: 'Chưa xác định kho xuất',
        message: 'Chưa có dòng tồn kho live để xác định warehouseId cho phiếu xuất.',
        variant: 'warning',
      });
      setSelectedView('movement');
      return;
    }

    if (selectedWarehouseAllocation.lines.length === 0) {
      setWarehouseFeedback({
        title: 'Kho đã chọn chưa thể cấp nguyên liệu',
        message: 'Chọn kho khác có tồn phù hợp với nhu cầu còn lại. Hệ thống không tạo phiếu rỗng hoặc xuất vượt tồn.',
        variant: 'warning',
      });
      return;
    }

    try {
      const response = await createInventoryIssue({
        issueDate: selectedIssueCandidate.requestDate,
        warehouseId: selectedWarehouseId,
        materialRequestId: selectedIssueCandidate.materialRequestId,
        lines: selectedWarehouseAllocation.lines,
      }).unwrap();

      setWarehouseFeedback({
        title: 'Đã tạo phiếu xuất kho',
        message: response.data
          ? `Phiếu ${response.data.issueCode} gồm ${selectedWarehouseAllocation.lines.length} nhóm nguyên liệu đã được ghi nhận và chờ bếp ký nhận.`
          : response.message || 'Phiếu xuất kho đã được ghi nhận.',
        variant: 'info',
      });
      setIsIssueDialogOpen(false);
      setSelectedView('movement');
    } catch (error) {
      setWarehouseFeedback({
        title: 'Chưa tạo được phiếu xuất kho',
        message: getMutationErrorMessage(error, 'Kiểm tra tồn kho, demand còn lại hoặc quyền thủ kho rồi thử lại.'),
        variant: 'danger',
      });
      setSelectedView('exceptions');
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
                disabled={!issueCreationAvailability.canCreate}
                aria-describedby={issueCreationAvailability.disabledReason ? 'warehouse-issue-action-guidance' : undefined}
                title={issueCreationAvailability.disabledReason ?? undefined}
              >
                {isFetchingIssueCandidates ? 'Đang kiểm tra nhu cầu' : 'Tạo phiếu xuất kho'}
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
            { label: 'Phiếu nhập', value: isWorkflowDocumentError ? 'Chưa xác định' : `${warehouseDocuments.filter((document) => document.type === 'Phiếu nhập').length} chứng từ`, tone: isWorkflowDocumentError ? 'danger' : 'warning' },
            { label: 'Phiếu xuất', value: isWorkflowDocumentError ? 'Chưa xác định' : `${warehouseDocuments.filter((document) => document.type === 'Phiếu xuất').length} phiếu`, tone: isWorkflowDocumentError ? 'danger' : 'warning' },
            { label: 'Dòng tồn kho', value: isCurrentStockError ? 'Chưa xác định' : currentStockRows.length.toString(), tone: isCurrentStockError ? 'danger' : currentStockRows.length > 0 ? 'success' : 'warning' },
            { label: 'Thiếu hàng', value: isDemandPageError ? 'Chưa xác định' : shortageLine ? `${shortageLine.material} ${formatQuantityWithUnit(Math.max(shortageLine.required - shortageLine.available, 0), shortageLine.unit)}` : shortageCount > 0 ? `${shortageCount} dòng thiếu` : 'Không có', tone: isDemandPageError || shortageCount > 0 ? 'danger' : 'success' },
            { label: 'Bếp nhận', value: isKitchenIssueError ? 'Chưa xác định' : pendingKitchenReceiptCount > 0 ? `${pendingKitchenReceiptCount} dòng chờ ký` : 'Không còn chờ ký', tone: isKitchenIssueError ? 'danger' : pendingKitchenReceiptCount > 0 ? 'warning' : 'success' },
          ]}
        />
      }
    >
      {isPurchaseOrderError && (
        <QueryErrorAlert
          title="Không tải được đơn mua chờ nhập kho"
          isRetrying={isFetchingPurchaseOrders}
          onRetry={refetchPurchaseOrders}
        >
          Không thể coi danh sách đơn mua đang trống. Hãy kiểm tra kết nối rồi tải lại trước khi ghi nhận nhận hàng.
        </QueryErrorAlert>
      )}
      {(isWorkflowDocumentError || isSupplementalRequestError) && (
        <QueryErrorAlert
          title="Thiếu dữ liệu tham chiếu của kho"
          isRetrying={isFetchingWorkflowDocuments || isFetchingSupplementalRequests}
          onRetry={() => {
            if (isWorkflowDocumentError) refetchWorkflowDocuments();
            if (isSupplementalRequestError) refetchSupplementalRequests();
          }}
        >
          Chưa tải được danh sách chứng từ kho hoặc yêu cầu cấp bổ sung. Danh sách phiếu hiển thị chưa đầy đủ và kho gợi ý sẵn khi ghi nhận nhập kho có thể sai; hãy tải lại trước khi đối chiếu chứng từ.
        </QueryErrorAlert>
      )}
      {issueCreationAvailability.disabledReason && !isFetchingIssueCandidates && (
        <InlineAlert title="Không thể tạo phiếu xuất kho mới" variant="info">
          <span id="warehouse-issue-action-guidance">{issueCreationAvailability.disabledReason}</span>
        </InlineAlert>
      )}

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
              <Select value={selectedMaterialRequestId} onValueChange={(value) => {
                setSelectedMaterialRequestId(value ?? '');
                setSelectedWarehouseId('');
              }}>
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
                <p className={isIssueCandidateError && !isFetchingIssueCandidates ? 'text-xs font-semibold text-red-700' : 'text-xs text-amber-700'} role={isIssueCandidateError && !isFetchingIssueCandidates ? 'alert' : undefined}>
                  {isFetchingIssueCandidates
                    ? 'Đang tải nhu cầu nguyên liệu...'
                    : isIssueCandidateError
                      ? 'Không tải được nhu cầu nguyên liệu. Danh sách trống ở đây là do lỗi tải dữ liệu, không phải vì hết nhu cầu cần xuất.'
                      : 'Chưa có nhu cầu nguyên liệu đủ điều kiện để xuất kho.'}
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
              {warehouseOptions.length === 0 && (
                isWarehouseSelectorError
                  ? <p className="text-xs font-semibold text-red-700" role="alert">Không tải được danh sách kho. Chưa thể kết luận là không có kho nào cấp được nguyên liệu.</p>
                  : <p className="text-xs text-amber-700">Chưa có kho từ dữ liệu tồn hiện tại.</p>
              )}
              {selectedWarehouseId && (
                <div
                  className={`rounded-sm border px-3 py-2 text-xs ${
                    isAllocationSourceError && !isFetchingSelectedDemand && !isFetchingSelectedWarehouseStock
                      ? 'border-red-200 bg-red-50 font-semibold text-red-800'
                      : selectedWarehouseAllocation.lines.length > 0
                        ? 'border-sky-200 bg-sky-50 text-slate-700'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                  role={isAllocationSourceError && !isFetchingSelectedDemand && !isFetchingSelectedWarehouseStock ? 'alert' : 'status'}
                >
                  {isFetchingSelectedDemand || isFetchingSelectedWarehouseStock
                    ? 'Đang đối chiếu nhu cầu còn lại với tồn kho đã chọn...'
                    : isAllocationSourceError
                      ? 'Không đối chiếu được nhu cầu với tồn kho vì lỗi tải dữ liệu. Chưa thể kết luận kho này thiếu hàng; hãy tải lại trang trước khi xuất.'
                      : selectedWarehouseAllocation.lines.length > 0
                        ? `Kho có thể xuất ${selectedWarehouseAllocation.lines.length}/${selectedWarehouseAllocation.remainingLineCount} nhóm nguyên liệu còn lại; ${selectedWarehouseAllocation.fullyCoveredLineCount} nhóm đủ toàn bộ số lượng.`
                        : 'Kho này không có tồn phù hợp với nhu cầu còn lại. Chọn kho khác để tiếp tục.'}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsIssueDialogOpen(false)}>Hủy</Button>
            <Button
              type="button"
              onClick={() => void handleCreateInventoryIssue()}
              disabled={!selectedMaterialRequestId || !selectedWarehouseId || isFetchingSelectedDemand || isFetchingSelectedWarehouseStock || isAllocationSourceError || selectedWarehouseAllocation.lines.length === 0 || isCreatingIssue}
            >
              {isCreatingIssue ? 'Đang tạo phiếu...' : `Xác nhận xuất ${selectedWarehouseAllocation.lines.length} dòng`}
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
          preferredWarehouseId={linkedSupplementalRequest?.warehouseId}
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
        activeTab={`warehouse-${selectedView}`}
        onTabChange={(id) => setSelectedView(id.replace('warehouse-', '') as 'movement' | 'demand' | 'exceptions')}
      />

      <div className="relative min-h-[420px] transition-opacity duration-150 motion-reduce:transition-none" aria-busy={isViewPending} aria-live="polite">
      {isViewPending && (
        <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm">
          Đang cập nhật
        </span>
      )}
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
                {isCurrentStockError && (
                  <EmptyState
                    variant="error"
                    className="mb-3"
                    title="Không tải được tồn kho hiện tại"
                    description="Bảng trống bên dưới là do lỗi tải dữ liệu, không phải vì kho hết hàng. Hãy tải lại trước khi lập phiếu xuất hoặc kết luận thiếu hàng."
                    onRetry={refetchCurrentStock}
                    isRetrying={isFetchingCurrentStock}
                  />
                )}
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
                          <td colSpan={4} className={isCurrentStockError ? 'text-center font-semibold text-red-700' : 'text-center text-slate-500'}>
                            {isCurrentStockError ? 'Không tải được tồn kho' : 'Chưa có dữ liệu tồn kho'}
                          </td>
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
                {isStockMovementError && (
                  <EmptyState
                    variant="error"
                    className="mb-3"
                    title="Không tải được sổ luân chuyển kho"
                    description="Không có dòng luân chuyển nào hiển thị vì lỗi tải dữ liệu. Đừng coi đây là bằng chứng kho chưa phát sinh nhập, xuất hay trả hàng."
                    onRetry={refetchStockMovement}
                    isRetrying={isFetchingStockMovement}
                  />
                )}
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
          {isDemandPageError ? (
            <EmptyState
              variant="error"
              title="Không tải được nhu cầu xuất kho"
              description="Chưa lấy được danh sách nhu cầu và thiếu hàng, nên không thể kết luận là không còn gì phải xuất. Hãy tải lại trước khi lập phiếu xuất."
              onRetry={refetchDemandPage}
              isRetrying={isFetchingDemandPage}
            />
          ) : <DemandSummary lines={demandLines} />}
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
        <div id="warehouse-exceptions-panel" role="tabpanel" aria-labelledby="warehouse-exceptions-tab">
          <WarehouseExceptionsWorkbench canManage={canReceivePurchases} />
        </div>
      )}
      </div>
    </OperationalFrame>
  );
}
