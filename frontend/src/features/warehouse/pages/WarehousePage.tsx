import { lazy, Suspense, useDeferredValue, useState } from 'react';
import { PackageOpen, ReceiptText, Warehouse } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useHasRole } from '@/lib/useHasRole';
import {
  CommandBar,
  ContextStrip,
  InlineAlert,
  KeepAliveTabPanel,
  OperationalFrame,
  PaginationBar,
  QueryErrorAlert,
  SectionPanel,
  StatusBadge,
  TableViewport,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/lib/routeConfig';
import { visibleTabIds } from '@/lib/navigationPreferences';
import {
  useGetCurrentStockQuery,
  useGetCurrentStockPageQuery,
  useGetIngredientDemandAggregatePageQuery,
  useGetIngredientDemandQuery,
  useGetMaterialRequestCandidatePageQuery,
  useGetKitchenIssuesQuery,
  useGetStockMovementPageQuery,
  useWorkflowOverview,
} from '@/api/reportsApi';
import { useCreateInventoryIssueMutation, useGetWarehouseSelectorQuery } from '@/api/warehouseApi';
import { useGetPurchaseOrdersPageQuery } from '@/api/purchasingApi';
import { useGetWorkflowDocumentsQuery } from '@/api/workflowDocumentsApi';
import { toNextReportCursor, type ReportCursor } from '@/api/workflowApiTypes';
import { formatQuantityWithUnit } from '@/lib/formatters';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import { toQueryView } from '@/lib/queryView';
import type { PurchaseOrderLineDto } from '@/api/workflowApiTypes';
import { buildWarehouseIssueAllocation, formatIssueCandidateLabel } from '../warehouseIssueAllocation';
import { PurchaseOrderLineGroups } from '../PurchaseOrderLineGroups';
import { resolveIssueCreationAvailability } from '@/lib/actionEligibility';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addIsoDays } from '../warehouseDateRange';
import { typography } from '@/lib/typography';
import { WarehouseMovementPanel } from './WarehouseMovementPanel';
import { getWarehouseMutationErrorMessage } from '../warehouseError';
const ServiceRunBlockerPanel = lazy(() => import('@/components/common/ServiceRunBlockerPanel').then(({ ServiceRunBlockerPanel: component }) => ({ default: component })))
const WarehousePurchaseReceiptDialog = lazy(() => import('../WarehousePurchaseReceiptDialog').then(({ WarehousePurchaseReceiptDialog: component }) => ({ default: component })))
const WarehouseBatchPurchaseReceiptDialog = lazy(() => import('../WarehouseBatchPurchaseReceiptDialog').then(({ WarehouseBatchPurchaseReceiptDialog: component }) => ({ default: component })))
const WarehouseReceiptLifecyclePanel = lazy(() => import('../WarehouseReceiptLifecyclePanel').then(({ WarehouseReceiptLifecyclePanel: component }) => ({ default: component })))
const WarehouseExceptionsWorkbench = lazy(() => import('../WarehouseExceptionsWorkbench').then(({ WarehouseExceptionsWorkbench: component }) => ({ default: component })))
const WarehouseDemandPanel = lazy(() => import('../WarehouseDemandPanel').then(({ WarehouseDemandPanel: component }) => ({ default: component })))
const EMPTY_QUERY_ROWS: never[] = [];
export default function WarehousePage() {
  const [searchParams] = useSearchParams();
  const canReceivePurchases = useHasRole(['dieuphoi']);
  const canCreateInventoryIssues = useHasRole(['thukho']);
  const canDispositionReturns = useHasRole([]);
  const warehouseTabIds = visibleTabIds('warehouse') as Array<'movement' | 'demand' | 'exceptions'>;
  const [selectedView, setSelectedView] = useState<'movement' | 'demand' | 'exceptions'>(() => warehouseTabIds[0] ?? 'movement');
  const activeView = useDeferredValue(selectedView);
  const isViewPending = selectedView !== activeView;
  const [purchaseOrderPageNumber, setPurchaseOrderPageNumber] = useState(1);
  const selectedPurchaseOrderId = searchParams.get('purchaseOrderId');
  const isPurchaseOrderDetailsOpen = selectedPurchaseOrderId !== null;
  const [selectedReceiptLine, setSelectedReceiptLine] = useState<PurchaseOrderLineDto>();
  const [isBatchReceiptOpen, setIsBatchReceiptOpen] = useState(false);
  const [currentStockPage, setCurrentStockPage] = useState(1);
  const [currentStockSearch, setCurrentStockSearch] = useState('');
  const deferredCurrentStockSearch = useDeferredValue(currentStockSearch.trim());
  const [demandPage, setDemandPage] = useState(1);
  const [demandSearch, setDemandSearch] = useState('');
  const deferredDemandSearch = useDeferredValue(demandSearch.trim());
  const [issueCandidatePageNumber, setIssueCandidatePageNumber] = useState(1);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [selectedMaterialRequestId, setSelectedMaterialRequestId] = useState('');
  const [issueCommandId, setIssueCommandId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [stockMovementCursors, setStockMovementCursors] = useState<ReportCursor[]>([]);
  const [stockMovementSearch, setStockMovementSearch] = useState('');
  const deferredStockMovementSearch = useDeferredValue(stockMovementSearch.trim());
  const [warehouseFeedback, setWarehouseFeedback] = useState<{
    title: string;
    message: string;
    variant: 'info' | 'warning' | 'danger';
  } | null>(null);
  const { data: workflowDocuments = [], isError: isWorkflowDocumentError, isFetching: isFetchingWorkflowDocuments, refetch: refetchWorkflowDocuments } = useGetWorkflowDocumentsQuery({ limit: 20 });
  const {
    data: purchaseOrderPageResponse,
    isFetching: isFetchingPurchaseOrders,
    isError: isPurchaseOrderError,
    refetch: refetchPurchaseOrders,
  } = useGetPurchaseOrdersPageQuery({
    pageNumber: purchaseOrderPageNumber,
    pageSize: 8,
  });
  const { data: receiptWarehouses = [], isError: isWarehouseSelectorError } = useGetWarehouseSelectorQuery();
  const requestedDemandDate = searchParams.get('date');
  const requestedDemandWeek = searchParams.get('week');
  const demandDateFrom = requestedDemandDate ?? requestedDemandWeek ?? undefined;
  const demandDateTo = requestedDemandDate ?? (requestedDemandWeek ? addIsoDays(requestedDemandWeek, 6) : undefined);
  const {
    data: demandPageResponse,
    isError: isDemandPageError,
    isFetching: isFetchingDemandPage,
    refetch: refetchDemandPage,
  } = useGetIngredientDemandAggregatePageQuery(
    {
      pageNumber: demandPage,
      pageSize: 8,
      dateFrom: demandDateFrom,
      dateTo: demandDateTo,
      searchKeyword: deferredDemandSearch || undefined,
    },
    { skip: activeView !== 'demand' },
  );
  const demandLines = demandPageResponse?.items ?? [];
  const {
    data: issueCandidatePage,
    isFetching: isFetchingIssueCandidates,
    isError: isIssueCandidateError,
    refetch: refetchIssueCandidates,
  } = useGetMaterialRequestCandidatePageQuery({
    purpose: 'issue',
    pageNumber: issueCandidatePageNumber,
    pageSize: 8,
  });
  const stockMovementCursor = stockMovementCursors.at(-1);
  const stockMovementQuery = useGetStockMovementPageQuery(
    {
      cursorDate: stockMovementCursor?.cursorDate,
      cursorId: stockMovementCursor?.cursorId,
      cursorOffset: stockMovementCursor?.cursorOffset,
      searchKeyword: deferredStockMovementSearch || undefined,
      limit: 8,
      sortDirection: 'desc',
    },
    { skip: activeView !== 'movement' },
  );
  const stockMovementView = toQueryView(stockMovementQuery, {
    instruction: 'Mở tab Luân chuyển để xem sổ kho.',
    retry: () => stockMovementQuery.refetch(),
    errorMessage: 'Không tải được sổ luân chuyển kho.',
    forbiddenMessage: 'Bạn không có quyền xem sổ luân chuyển kho.',
  });
  const stockMovementPage = stockMovementView.phase === 'ready' ? stockMovementView.data : undefined;
  const currentStockQuery = useGetCurrentStockPageQuery(
    {
      searchKeyword: deferredCurrentStockSearch || undefined,
      pageNumber: currentStockPage,
      pageSize: 8,
    },
    { skip: activeView !== 'movement' },
  );
  const currentStockView = toQueryView(currentStockQuery, {
    instruction: 'Mở tab Luân chuyển để xem tồn kho hiện tại.',
    retry: () => currentStockQuery.refetch(),
    errorMessage: 'Không tải được tồn kho hiện tại.',
    forbiddenMessage: 'Bạn không có quyền xem tồn kho hiện tại.',
  });
  const currentStockPageResponse = currentStockView.phase === 'ready' ? currentStockView.data : undefined;
  const currentStockRows = currentStockPageResponse ? currentStockPageResponse.items : EMPTY_QUERY_ROWS;
  const isCurrentStockError = currentStockView.phase === 'error' || currentStockView.phase === 'forbidden';
  const { data: kitchenIssueRows = [], isError: isKitchenIssueError, isFetching: isFetchingKitchenIssues, refetch: refetchKitchenIssues } = useGetKitchenIssuesQuery({ limit: 500 });
  const [createInventoryIssue, { isLoading: isCreatingIssue }] = useCreateInventoryIssueMutation();
  const { roleInboxItems } = useWorkflowOverview({
    skip: activeView !== 'demand',
  });
  const warehouseDocuments = [...workflowDocuments.filter((document) => document.type === 'Phiếu nhập'), ...workflowDocuments.filter((document) => document.type === 'Phiếu xuất')];
  const warehouseInbox = roleInboxItems.filter((item) => item.laneId === 'warehouse');
  const shortageLine = demandLines.find((line) => line.tone === 'danger');
  const shortageCount = demandPageResponse?.shortageCount ?? 0;
  const issueDocument = warehouseDocuments.find((document) => document.type === 'Phiếu xuất');
  const receiptDocument = warehouseDocuments.find((document) => document.type === 'Phiếu nhập');
  const warehouseName = currentStockRows[0]?.warehouse ?? receiptDocument?.owner ?? issueDocument?.owner ?? 'Kho';
  const issueCandidates = issueCandidatePage?.items ?? [];
  const issueCreationAvailability = resolveIssueCreationAvailability({
    canManageWarehouse: canCreateInventoryIssues,
    isFetching: isFetchingIssueCandidates || isFetchingKitchenIssues,
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
      ? {
          dateFrom: selectedIssueCandidate.requestDate,
          dateTo: selectedIssueCandidate.requestDate,
          limit: 500,
        }
      : undefined,
    { skip: !selectedIssueCandidate },
  );
  const {
    data: selectedWarehouseStockRows = [],
    isFetching: isFetchingSelectedWarehouseStock,
    isError: isSelectedWarehouseStockError,
    refetch: refetchSelectedWarehouseStock,
  } = useGetCurrentStockQuery(selectedWarehouseId ? { warehouseId: selectedWarehouseId, limit: -1 } : undefined, { skip: !selectedWarehouseId });
  // Nhu cầu hoặc tồn kho lỗi => phân bổ ra 0 dòng. Đó KHÔNG phải bằng chứng kho
  // thiếu hàng, nên không được hiển thị như vậy và không được cho xác nhận xuất.
  const isAllocationSourceError = isSelectedDemandError || isSelectedWarehouseStockError;
  const isIssueAllocationRefreshing = isFetchingSelectedDemand || isFetchingSelectedWarehouseStock || isFetchingKitchenIssues;
  const selectedWarehouseAllocation = selectedIssueCandidate
    ? buildWarehouseIssueAllocation(selectedIssueCandidate.materialRequestId, selectedWarehouseId, selectedDemandLines, selectedWarehouseStockRows, kitchenIssueRows)
    : { lines: [], remainingLineCount: 0, fullyCoveredLineCount: 0 };
  const pendingKitchenReceiptCount = kitchenIssueRows.filter((row) => !row.isReceivedByKitchen).length;
  const purchaseOrders = purchaseOrderPageResponse?.page.items ?? [];
  const requestedPurchaseRequestId = searchParams.get('purchaseRequestId');
  const selectedPurchaseOrder = isPurchaseOrderDetailsOpen
    ? (purchaseOrders.find((order) => order.purchaseOrderId === selectedPurchaseOrderId) ??
      (selectedPurchaseOrderId === null ? purchaseOrders.find((order) => order.purchaseRequestId === requestedPurchaseRequestId) : undefined))
    : undefined;
  const purchaseOrderDetailsHref = (purchaseOrderId: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (purchaseOrderId) next.set('purchaseOrderId', purchaseOrderId);
    else next.delete('purchaseOrderId');
    return `${ROUTES.WAREHOUSE}?${next.toString()}`;
  };

  const openIssueDialog = () => {
    setIssueCandidatePageNumber(1);
    setSelectedMaterialRequestId('');
    setSelectedWarehouseId('');
    setWarehouseFeedback(null);
    setIssueCommandId(`inventory-issue-${crypto.randomUUID()}`);
    setIsIssueDialogOpen(true);
  };

  const handleCreateInventoryIssue = async () => {
    setWarehouseFeedback(null);

    if (isIssueAllocationRefreshing) {
      setWarehouseFeedback({
        title: 'Đang đồng bộ số lượng còn lại',
        message: 'Chờ nhu cầu, tồn kho và các phiếu đã xuất tải xong trước khi xác nhận để tránh dùng số liệu cũ.',
        variant: 'warning',
      });
      return;
    }

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
        commandId: issueCommandId,
        expectedVersion: selectedIssueCandidate.concurrencyVersion,
        issueDate: selectedIssueCandidate.requestDate,
        warehouseId: selectedWarehouseId,
        materialRequestId: selectedIssueCandidate.materialRequestId,
        lines: selectedWarehouseAllocation.lines,
      }).unwrap();

      await Promise.all([refetchIssueCandidates(), refetchKitchenIssues(), refetchSelectedWarehouseStock()]);

      setWarehouseFeedback({
        title: 'Đã tạo phiếu xuất kho',
        message: response.data
          ? `Phiếu ${response.data.issueCode} gồm ${selectedWarehouseAllocation.lines.length} nhóm nguyên liệu đã được ghi nhận và chờ bếp ký nhận.`
          : response.message || 'Phiếu xuất kho đã được ghi nhận.',
        variant: 'info',
      });
      setIsIssueDialogOpen(false);
      setIssueCommandId('');
      setSelectedView('movement');
    } catch (error) {
      setWarehouseFeedback({
        title: 'Chưa tạo được phiếu xuất kho',
        message: getWarehouseMutationErrorMessage(error, 'Kiểm tra tồn kho, demand còn lại hoặc quyền thủ kho rồi thử lại.'),
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
            {
              label: 'Phiếu nhập',
              value: isWorkflowDocumentError ? 'Chưa xác định' : `${warehouseDocuments.filter((document) => document.type === 'Phiếu nhập').length} chứng từ`,
              tone: isWorkflowDocumentError ? 'danger' : 'warning',
            },
            {
              label: 'Phiếu xuất',
              value: isWorkflowDocumentError ? 'Chưa xác định' : `${warehouseDocuments.filter((document) => document.type === 'Phiếu xuất').length} phiếu`,
              tone: isWorkflowDocumentError ? 'danger' : 'warning',
            },
            {
              label: 'Dòng tồn kho',
              value: isCurrentStockError ? 'Chưa xác định' : currentStockRows.length.toString(),
              tone: isCurrentStockError ? 'danger' : currentStockRows.length > 0 ? 'success' : 'warning',
            },
            {
              label: 'Thiếu hàng',
              value: isDemandPageError
                ? 'Chưa xác định'
                : shortageLine
                  ? `${shortageLine.material} ${formatQuantityWithUnit(Math.max(shortageLine.required - shortageLine.available, 0), shortageLine.unit)}`
                  : shortageCount > 0
                    ? `${shortageCount} dòng thiếu`
                    : 'Không có',
              tone: isDemandPageError || shortageCount > 0 ? 'danger' : 'success',
            },
            {
              label: 'Bếp nhận',
              value: isKitchenIssueError ? 'Chưa xác định' : pendingKitchenReceiptCount > 0 ? `${pendingKitchenReceiptCount} dòng chờ ký` : 'Không còn chờ ký',
              tone: isKitchenIssueError ? 'danger' : pendingKitchenReceiptCount > 0 ? 'warning' : 'success',
            },
          ]}
        />
      }
    >
      {isPurchaseOrderError && (
        <QueryErrorAlert title="Không tải được đơn mua chờ nhập kho" isRetrying={isFetchingPurchaseOrders} onRetry={refetchPurchaseOrders}>
          Không thể coi danh sách đơn mua đang trống. Hãy kiểm tra kết nối rồi tải lại trước khi ghi nhận nhận hàng.
        </QueryErrorAlert>
      )}
      {isWorkflowDocumentError && (
        <QueryErrorAlert
          title="Thiếu dữ liệu tham chiếu của kho"
          isRetrying={isFetchingWorkflowDocuments}
          onRetry={() => {
            if (isWorkflowDocumentError) refetchWorkflowDocuments();
          }}
        >
          Chưa tải được danh sách chứng từ kho. Danh sách phiếu hiển thị chưa đầy đủ; hãy tải lại trước khi đối chiếu chứng từ.
        </QueryErrorAlert>
      )}
      {issueCreationAvailability.disabledReason && !isFetchingIssueCandidates && (
        <InlineAlert title="Không thể tạo phiếu xuất kho mới" variant="info">
          <span id="warehouse-issue-action-guidance">{issueCreationAvailability.disabledReason}</span>
        </InlineAlert>
      )}

      {isIssueDialogOpen && (
        <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
          <DialogContent aria-labelledby="warehouse-issue-title" aria-describedby="warehouse-issue-description">
            <DialogHeader>
              <DialogTitle id="warehouse-issue-title">Tạo phiếu xuất kho</DialogTitle>
              <DialogDescription id="warehouse-issue-description">Chọn đúng nhu cầu nguyên liệu và kho xuất. Hệ thống không tự chọn chứng từ thay bạn.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="warehouse-material-request">
                  Nhu cầu nguyên liệu{' '}
                  <span aria-hidden="true" className="text-red-600">
                    *
                  </span>
                </label>
                <Select
                  value={selectedMaterialRequestId}
                  onValueChange={(value) => {
                    setSelectedMaterialRequestId(value ?? '');
                    setSelectedWarehouseId('');
                    setIssueCommandId(`inventory-issue-${crypto.randomUUID()}`);
                  }}
                >
                  <SelectTrigger id="warehouse-material-request" aria-label="Chọn nhu cầu nguyên liệu">
                    <SelectValue placeholder="Chọn chứng từ cần xuất">{selectedIssueCandidate ? formatIssueCandidateLabel(selectedIssueCandidate) : 'Chọn chứng từ cần xuất'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {issueCandidates.map((candidate) => (
                      <SelectItem key={candidate.materialRequestId} value={candidate.materialRequestId}>
                        {formatIssueCandidateLabel(candidate)}
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
                  <p
                    className={isIssueCandidateError && !isFetchingIssueCandidates ? 'text-xs font-semibold text-red-700' : 'text-xs text-amber-700'}
                    role={isIssueCandidateError && !isFetchingIssueCandidates ? 'alert' : undefined}
                  >
                    {isFetchingIssueCandidates
                      ? 'Đang tải nhu cầu nguyên liệu...'
                      : isIssueCandidateError
                        ? 'Không tải được nhu cầu nguyên liệu. Danh sách trống ở đây là do lỗi tải dữ liệu, không phải vì hết nhu cầu cần xuất.'
                        : 'Chưa có nhu cầu nguyên liệu đủ điều kiện để xuất kho.'}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-800" htmlFor="warehouse-source">
                  Kho xuất{' '}
                  <span aria-hidden="true" className="text-red-600">
                    *
                  </span>
                </label>
                <Select value={selectedWarehouseId} onValueChange={(value) => setSelectedWarehouseId(value ?? '')}>
                  <SelectTrigger id="warehouse-source" aria-label="Chọn kho xuất">
                    <SelectValue placeholder="Chọn kho cấp nguyên liệu">{warehouseOptions.find((warehouse) => warehouse.id === selectedWarehouseId)?.name ?? 'Chọn kho cấp nguyên liệu'}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseOptions.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {warehouseOptions.length === 0 &&
                  (isWarehouseSelectorError ? (
                    <p className="text-xs font-semibold text-red-700" role="alert">
                      Không tải được danh sách kho. Chưa thể kết luận là không có kho nào cấp được nguyên liệu.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">Chưa có kho từ dữ liệu tồn hiện tại.</p>
                  ))}
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
                    {isIssueAllocationRefreshing
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
              <Button type="button" variant="outline" onClick={() => setIsIssueDialogOpen(false)}>
                Hủy
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreateInventoryIssue()}
                disabled={
                  !selectedMaterialRequestId || !selectedWarehouseId || isIssueAllocationRefreshing || isAllocationSourceError || selectedWarehouseAllocation.lines.length === 0 || isCreatingIssue
                }
              >
                {isCreatingIssue || isIssueAllocationRefreshing ? 'Đang đồng bộ số lượng...' : `Xác nhận xuất ${selectedWarehouseAllocation.lines.length} dòng`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedPurchaseOrder && selectedReceiptLine && canReceivePurchases && (
        <Suspense fallback={null}><WarehousePurchaseReceiptDialog
          key={`${selectedPurchaseOrder.purchaseOrderId}-${selectedReceiptLine.purchaseOrderLineId}`}
          open
          order={selectedPurchaseOrder}
          line={selectedReceiptLine}
          warehouses={receiptWarehouses}
          week={searchParams.get('week') ?? undefined}
          onOpenChange={(open) => {
            if (!open) setSelectedReceiptLine(undefined);
          }}
          onSuccess={() => {
            setSelectedReceiptLine(undefined);
            void refetchPurchaseOrders();
            setWarehouseFeedback({
              title: 'Đã tạo phiếu nhập nháp',
              message: 'Phiếu nhập đang chờ kiểm tra chất lượng và Quản lý duyệt; tồn kho và tiến độ đơn mua chưa thay đổi.',
              variant: 'info',
            });
          }}
        /></Suspense>
      )}

      {warehouseFeedback && (
        <InlineAlert title={warehouseFeedback.title} variant={warehouseFeedback.variant}>
          {warehouseFeedback.message}
        </InlineAlert>
      )}

      <SectionPanel
        title="Đơn mua chờ nhập kho"
        icon={<ReceiptText size={18} aria-hidden="true" />}
        description="Chọn đúng đơn và dòng thực nhận để đối chiếu số lượng thực tế từ nhà cung cấp."
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
          <table className="ipc-data-table min-w-[1060px] !table-auto">
            <thead>
              <tr>
                <th className="min-w-[280px]">Đơn mua</th>
                <th className="min-w-[160px]">Nhà cung cấp</th>
                <th className="min-w-[220px]">Đề xuất mua</th>
                <th className="min-w-[140px]">Trạng thái</th>
                <th className="min-w-[130px]">Tiến độ dòng</th>
                <th className="min-w-[130px]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isFetchingPurchaseOrders && purchaseOrders.length === 0 ? (
                Array.from({ length: 8 }, (_, index) => (
                  <tr key={`purchase-order-skeleton-${index}`} aria-hidden="true">
                    <td colSpan={6}>
                      <div className="h-5 animate-pulse rounded-sm bg-slate-200 motion-reduce:animate-none" />
                    </td>
                  </tr>
                ))
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="h-[320px] text-center text-slate-600">
                    Chưa có đơn mua để theo dõi nhập kho.
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((order) => {
                  const completedLines = order.lines.filter((line) => line.receivedQty >= line.orderedQty).length;
                  const isSelected = isPurchaseOrderDetailsOpen && selectedPurchaseOrderId === order.purchaseOrderId;
                  return (
                    <tr key={order.purchaseOrderId} className={isSelected ? 'bg-blue-50/60' : undefined}>
                      <td className="font-semibold text-slate-900 whitespace-nowrap">{order.purchaseOrderCode}</td>
                      <td>{order.supplierName}</td>
                      <td className="whitespace-nowrap text-slate-600">{order.purchaseRequestCode}</td>
                      <td className="ipc-badge-cell whitespace-nowrap">
                        <StatusBadge variant={order.status === 'COMPLETED' ? 'success' : order.status === 'ORDERED' ? 'info' : order.status === 'PARTIALLY_RECEIVED' ? 'warning' : 'neutral'} className="ipc-table-badge ipc-table-badge--status">
                          {formatWorkflowStatus(order.status)}
                        </StatusBadge>
                      </td>
                      <td className="whitespace-nowrap">
                        {completedLines}/{order.lines.length} dòng đã đủ
                      </td>
                      <td>
                        <Link className="ipc-button ipc-button-ghost" aria-expanded={isSelected} to={purchaseOrderDetailsHref(isSelected ? null : order.purchaseOrderId)}>
                          {isSelected ? 'Đóng chi tiết' : 'Xem dòng nhận'}
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar
          page={purchaseOrderPageResponse?.page.pageNumber ?? purchaseOrderPageNumber}
          pageSize={purchaseOrderPageResponse?.page.pageSize ?? 8}
          totalItems={purchaseOrderPageResponse?.page.totalCount ?? 0}
          onPageChange={(page) => {
            setPurchaseOrderPageNumber(page);
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-600">{selectedPurchaseOrder.orderDate}</span>
                {canReceivePurchases && selectedPurchaseOrder.lines.some((line) => line.receivedQty < line.orderedQty) && (
                  <Button type="button" size="sm" onClick={() => setIsBatchReceiptOpen(true)}>
                    Nhận toàn bộ dòng còn lại
                  </Button>
                )}
              </div>
            </div>
            <TableViewport ariaLabel={`Chi tiết đơn mua ${selectedPurchaseOrder.purchaseOrderCode}`} caption="Các dòng và yêu cầu bằng chứng nhập kho do máy chủ cung cấp." className="max-h-[320px]">
              <PurchaseOrderLineGroups lines={selectedPurchaseOrder.lines} canReceive={canReceivePurchases} onReceive={setSelectedReceiptLine} />
            </TableViewport>
          </div>
        )}
      </SectionPanel>

      <Suspense fallback={<div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50 motion-reduce:animate-none" />}><WarehouseReceiptLifecyclePanel /></Suspense>

      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn kho"
        tabs={[
          { id: 'warehouse-movement', label: 'Luân chuyển' },
          { id: 'warehouse-demand', label: 'Nhu cầu xuất' },
          { id: 'warehouse-exceptions', label: 'Ngoại lệ' },
        ].filter((tab) => warehouseTabIds.includes(tab.id.replace('warehouse-', '') as 'movement' | 'demand' | 'exceptions'))}
        activeTab={`warehouse-${selectedView}`}
        onTabChange={(id) => setSelectedView(id.replace('warehouse-', '') as 'movement' | 'demand' | 'exceptions')}
      />

      <div className={`${typography.body} relative min-h-[420px]`} aria-busy={isViewPending} aria-live="polite">
        {isViewPending && (
          <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-sm bg-white/95 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm border border-slate-200">
            Đang cập nhật
          </span>
        )}
        <KeepAliveTabPanel id="warehouse-movement" active={activeView === 'movement'} className="duration-150 motion-reduce:transition-none">
          <WarehouseMovementPanel
            documents={warehouseDocuments}
            currentStockSearch={currentStockSearch}
            onCurrentStockSearchChange={(value) => { setCurrentStockSearch(value); setCurrentStockPage(1); }}
            currentStockView={currentStockView}
            currentStockRows={currentStockRows}
            currentStockPage={currentStockPageResponse?.pageNumber ?? currentStockPage}
            currentStockPageSize={currentStockPageResponse?.pageSize ?? 8}
            currentStockTotalItems={currentStockPageResponse?.totalCount ?? 0}
            onCurrentStockPageChange={setCurrentStockPage}
            stockMovementSearch={stockMovementSearch}
            onStockMovementSearchChange={(value) => { setStockMovementSearch(value); setStockMovementCursors([]); }}
            stockMovementView={stockMovementView}
            stockMovements={stockMovementPage?.items ?? EMPTY_QUERY_ROWS}
            stockMovementPage={stockMovementCursors.length + 1}
            stockMovementHasNext={stockMovementPage?.hasNext ?? false}
            onStockMovementPrevious={() => setStockMovementCursors((current) => current.slice(0, -1))}
            onStockMovementNext={() => {
              const nextCursor = toNextReportCursor(stockMovementPage);
              if (nextCursor) setStockMovementCursors((current) => [...current, nextCursor]);
            }}
          />
        </KeepAliveTabPanel>

        <KeepAliveTabPanel id="warehouse-demand" active={activeView === 'demand'}>
          <Suspense fallback={<div aria-hidden="true" className="min-h-20 rounded-md bg-slate-50" />}><ServiceRunBlockerPanel serviceDate={requestedDemandDate ?? undefined} owner="Kho" /></Suspense>
          <Suspense fallback={<div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50 motion-reduce:animate-none" />}>
            <WarehouseDemandPanel
              demandSearch={demandSearch}
            onDemandSearchChange={(value) => {
              setDemandSearch(value);
              setDemandPage(1);
            }}
            requestedDemandDate={requestedDemandDate}
            requestedDemandWeek={requestedDemandWeek}
            demandDateTo={demandDateTo}
            isError={isDemandPageError}
            isFetching={isFetchingDemandPage}
            onRetry={refetchDemandPage}
            lines={demandLines}
            page={demandPageResponse?.pageNumber ?? demandPage}
            pageSize={demandPageResponse?.pageSize ?? 8}
            totalItems={demandPageResponse?.totalCount ?? 0}
            onPageChange={setDemandPage}
              inboxItems={warehouseInbox}
            />
          </Suspense>
        </KeepAliveTabPanel>
        {selectedPurchaseOrder && isBatchReceiptOpen && canReceivePurchases && (
          <Suspense fallback={null}><WarehouseBatchPurchaseReceiptDialog
            open
            order={selectedPurchaseOrder}
            warehouses={receiptWarehouses}
            week={searchParams.get('week') ?? undefined}
            onOpenChange={setIsBatchReceiptOpen}
            onSuccess={() => {
              setIsBatchReceiptOpen(false);
              void refetchPurchaseOrders();
              setWarehouseFeedback({
                title: 'Đã tạo phiếu nhập nháp',
                message: 'Toàn bộ dòng còn lại của đơn mua đã vào cùng một phiếu và chờ kiểm tra chất lượng.',
                variant: 'info',
              });
            }}
          /></Suspense>
        )}

        <KeepAliveTabPanel id="warehouse-exceptions" active={activeView === 'exceptions'}>
          <Suspense fallback={<div aria-busy="true" className="min-h-[420px] rounded-md bg-slate-50 motion-reduce:animate-none" />}>
            <WarehouseExceptionsWorkbench canManage={canCreateInventoryIssues} canDisposition={canDispositionReturns} />
          </Suspense>
        </KeepAliveTabPanel>
      </div>
    </OperationalFrame>
  );
}
