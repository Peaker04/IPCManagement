import { Fragment, useState, type FormEvent } from 'react';
import { PackageCheck, ShoppingCart } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CommandBar,
  ConfirmDialog,
  ContextStrip,
  DemandSummary,
  DocumentRail,
  OperationalFrame,
  PaginationBar,
  SectionPanel,
  SplitWorkbench,
  StockMovementTable,
  TableViewport,
  ViewSwitcher,
  useToast,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetPriceVariancePageQuery,
  useGetMaterialRequestCandidatePageQuery,
  useGetPurchasePlanPageQuery,
  useGetPurchaseRequestsPageQuery,
  useGetCurrentStockQuery,
  useGetStockMovementPageQuery,
  useGetWorkflowDocumentsQuery,
  useGetSuppliersQuery,
  useCreatePurchaseRequestFromDemandMutation,
  useSubmitPurchaseRequestMutation,
  useUpdatePurchaseRequestLineSupplierMutation,
  useGetSupplierQuotationsByIngredientPageQuery,
  useCreateSupplierQuotationMutation,
  useUpdateSupplierQuotationMutation,
  useDeactivateSupplierQuotationMutation,
  useGetPurchaseOrdersPageQuery,
  useCreatePurchaseOrdersFromRequestMutation,
  useRecordPurchaseOrderReceiptMutation,
  useCancelPurchaseOrderMutation,
} from '@/features/workflow';
import type { CurrentStockRow, DemandLine, SupplierDto, SupplierQuotationDto, PurchaseOrderDto } from '@/features/workflow';
import { useGetIngredientsQuery, type IngredientLookup } from '@/features/projects/dishCatalogApi';
import { formatWorkflowStatus } from '../workflowConfig';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierLineItem } from '../components/purchasing/SupplierLineItem';

type PurchasingView = 'demand' | 'supplier' | 'quotation' | 'orders' | 'handoff';
const validPurchasingViews: PurchasingView[] = ['demand', 'supplier', 'quotation', 'orders', 'handoff'];

export default function PurchasingPage() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [purchasePlanPage, setPurchasePlanPage] = useState(1);
  const [purchaseRequestPage, setPurchaseRequestPage] = useState(1);
  const [purchaseCandidatePage, setPurchaseCandidatePage] = useState(1);
  const [isCreateRequestDialogOpen, setIsCreateRequestDialogOpen] = useState(false);
  const [selectedMaterialRequestId, setSelectedMaterialRequestId] = useState('');
  const [receiptMovementCursors, setReceiptMovementCursors] = useState<Array<{ cursorDate: string; cursorId?: string }>>([]);
  const initialView = searchParams.get('view');
  const [activeView, setActiveView] = useState<PurchasingView>(
    validPurchasingViews.includes(initialView as PurchasingView) ? (initialView as PurchasingView) : 'demand'
  );
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 20 });
  const { data: purchasePlanResponse } = useGetPurchasePlanPageQuery({ groupBy: 'day', pageNumber: purchasePlanPage, pageSize: 8 });
  const { data: purchaseCandidatePageResponse, isFetching: isFetchingPurchaseCandidates } = useGetMaterialRequestCandidatePageQuery({
    purpose: 'purchase',
    pageNumber: purchaseCandidatePage,
    pageSize: 8,
  });
  const { data: purchaseRequestsPageResponse } = useGetPurchaseRequestsPageQuery({ pageNumber: purchaseRequestPage, pageSize: 8 });
  const receiptMovementCursor = receiptMovementCursors.at(-1);
  const { data: receiptMovementPage } = useGetStockMovementPageQuery({
    movementType: 'receipt',
    cursorDate: receiptMovementCursor?.cursorDate,
    cursorId: receiptMovementCursor?.cursorId,
    limit: 8,
    sortDirection: 'desc',
  });
  const { data: currentStockRows = [] } = useGetCurrentStockQuery({ limit: 20 });
  const { data: priceVariancePage } = useGetPriceVariancePageQuery({ pageNumber: 1, pageSize: 8 });

  const { data: suppliers = [] } = useGetSuppliersQuery();
  const [updateSupplier] = useUpdatePurchaseRequestLineSupplierMutation();
  const [createPurchaseRequestFromDemand, { isLoading: isCreatingPurchaseRequest }] = useCreatePurchaseRequestFromDemandMutation();
  const [submitPurchaseRequest, { isLoading: isSubmittingPurchaseRequest }] = useSubmitPurchaseRequestMutation();
  const purchaseRequests = purchaseRequestsPageResponse?.items ?? [];
  const purchasePlanLines = (purchasePlanResponse?.items ?? []).map<DemandLine>((row) => ({
    id: `${row.periodKey}-${row.ingredientId}`,
    ingredientId: row.ingredientId,
    sourceDocumentCode: row.periodKey,
    serviceDate: row.periodStart,
    material: row.ingredientName ?? row.ingredientId,
    required: row.requiredQty,
    available: row.currentStockQty + row.pendingReceiptQty,
    reserved: 0,
    unit: row.unitName ?? '',
    source: row.supplierName ?? 'Chưa có nhà cung cấp',
    estimatedUnitPrice: row.estimatedUnitPrice,
    status: row.warnings.length > 0 ? row.warnings.join(', ') : row.shortageQty > 0 ? 'Thiếu hàng' : 'Đủ hàng',
    nextAction: row.shortageQty > 0 ? 'Đề xuất mua' : 'Không cần mua',
    tone: row.warnings.length > 0 ? 'danger' : row.shortageQty > 0 ? 'warning' : 'success',
  }));
  const purchaseRequestLines = purchaseRequests.flatMap<DemandLine>((request) =>
    request.lines.map((line) => ({
      id: line.purchaseRequestLineId,
      materialRequestId: request.materialRequestId,
      purchaseRequestId: request.purchaseRequestId,
      purchaseRequestLineId: line.purchaseRequestLineId,
      supplierId: line.supplierId,
      ingredientId: line.ingredientId,
      estimatedUnitPrice: line.estimatedUnitPrice,
      expectedDeliveryDate: line.expectedDeliveryDate,
      note: line.note,
      sourceDocumentCode: request.purchaseRequestCode,
      serviceDate: request.purchaseForDate,
      material: line.ingredientName,
      required: line.requiredQty,
      available: line.currentStockQty,
      reserved: line.purchaseQty,
      unit: line.unitName,
      source: line.supplierName || 'Chưa chọn nhà cung cấp',
      status: request.status,
      nextAction: request.status === 'APPROVED' ? 'Tạo đơn mua hàng' : request.status === 'DRAFT' ? 'Chọn nhà cung cấp' : 'Theo dõi đơn mua',
      tone: request.status === 'APPROVED' ? 'success' : request.status === 'SUBMITTED' ? 'warning' : 'neutral',
    })),
  );
  const supplierLines = purchaseRequestLines.filter((line) => Boolean(line.purchaseRequestId));
  const purchasingDocuments = workflowDocuments.filter((document) => document.type === 'Đơn mua');
  const receiptMovements = receiptMovementPage?.items ?? [];
  const warningPrice = priceVariancePage?.items.find((row) => row.warning);
  const primaryPurchasePlan = purchasePlanLines.find((line) => line.tone === 'danger' || line.tone === 'warning') ?? purchasePlanLines[0];
  const primaryPurchaseRequestLine = purchaseRequestLines.find((line) => line.purchaseRequestId) ?? purchaseRequestLines[0];
  const submitTargetId = primaryPurchaseRequestLine?.purchaseRequestId;
  const purchaseSummaryDocument = purchasingDocuments[0];
  const purchaseRequestCandidates = purchaseCandidatePageResponse?.items ?? [];
  const selectedPurchaseRequestCandidate = purchaseRequestCandidates.find((candidate) => candidate.materialRequestId === selectedMaterialRequestId);
  const formatPurchaseRequestCandidate = (candidate: (typeof purchaseRequestCandidates)[number]) =>
    `${candidate.materialRequestCode} | ${candidate.requestDate} | ${candidate.actionableLineCount} dòng thiếu${candidate.hasExistingPurchaseRequest ? ' | Đã có đề xuất' : ''}`;

  const openCreatePurchaseRequestDialog = () => {
    setPurchaseCandidatePage(1);
    setSelectedMaterialRequestId('');
    setIsCreateRequestDialogOpen(true);
  };

  const handleCreatePurchaseRequest = async () => {
    if (!selectedMaterialRequestId) {
      toast({ title: 'Chưa chọn nhu cầu nguyên liệu', description: 'Chọn một chứng từ có dòng thiếu để tạo đề xuất mua.', variant: 'warning' });
      return;
    }

    try {
      const response = await createPurchaseRequestFromDemand({ materialRequestId: selectedMaterialRequestId }).unwrap();
      setIsCreateRequestDialogOpen(false);
      setActiveView('supplier');
      toast({
        title: 'Đã tạo đề xuất mua',
        description: response.data?.purchaseRequestCode
          ? `${response.data.purchaseRequestCode} đã sẵn sàng để chọn nhà cung cấp.`
          : response.message || 'Đề xuất mua đã được tạo từ nhu cầu thiếu.',
        variant: 'success',
      });
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      toast({ title: 'Chưa thể tạo đề xuất mua', description: message, variant: 'danger', durationMs: 0 });
    }
  };

  const handleSubmitPurchaseRequest = async () => {
    if (!submitTargetId) {
      toast({ title: 'Chưa có đơn mua để gửi', description: 'Hãy hoàn tất đề xuất mua trước khi chuyển sang phê duyệt.', variant: 'warning' });
      return;
    }

    try {
      await submitPurchaseRequest(submitTargetId).unwrap();
      toast({ title: 'Đã gửi đơn mua chính thức', description: 'Đơn mua đã chuyển sang luồng phê duyệt.', variant: 'success' });
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      toast({ title: 'Chưa thể gửi đơn mua', description: message, variant: 'danger', durationMs: 0 });
    }
  };

  return (
    <OperationalFrame
      command={
        <CommandBar
          actionsClassName="ipc-purchasing-actions"
          actions={
            <>
              <button
                className="ipc-button ipc-button-primary"
                type="button"
                onClick={openCreatePurchaseRequestDialog}
              >
                Tạo đề xuất mua
              </button>
              <button
                className="ipc-button ipc-button-primary"
                type="button"
                onClick={handleSubmitPurchaseRequest}
                disabled={!submitTargetId || isSubmittingPurchaseRequest}
              >
                {isSubmittingPurchaseRequest ? 'Đang gửi...' : 'Gửi đơn mua'}
              </button>
              <Link className="ipc-button ipc-button-primary" to={ROUTES.WAREHOUSE}>
                <PackageCheck size={16} />
                Chuyển sang nhập kho
              </Link>
            </>
          }
        >
          <span className="ipc-command-meta">
            <ShoppingCart size={16} />
            Kế hoạch thu mua: {purchaseSummaryDocument?.title ?? primaryPurchasePlan?.sourceDocumentCode ?? 'Chưa có dữ liệu'}
          </span>
          <span className="ipc-command-meta">Ngưỡng cảnh báo: 15%</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Trạng thái mua', value: primaryPurchaseRequestLine ? formatWorkflowStatus(primaryPurchaseRequestLine.status) : 'Chưa có đơn mua', tone: primaryPurchaseRequestLine ? 'warning' : 'neutral' },
            { label: 'Cảnh báo giá', value: warningPrice ? `${warningPrice.name} +${warningPrice.change.toFixed(1)}%` : 'Không có', tone: warningPrice ? 'danger' : 'success' },
            { label: 'Bàn giao kho', value: receiptMovements.length > 0 ? `${receiptMovements.length} phiếu nhập` : 'Chờ phiếu nhập', tone: receiptMovements.length > 0 ? 'success' : 'warning' },
            { label: 'Nhà cung cấp đề xuất', value: warningPrice?.supplier ?? primaryPurchasePlan?.source ?? 'Chưa có', tone: 'neutral' },
          ]}
        />
      }
    >

      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn thu mua"
        tabs={[
          { id: 'purchasing-demand', label: 'Kế hoạch thu mua' },
          { id: 'purchasing-supplier', label: 'Giá và nhà cung cấp' },
          { id: 'purchasing-quotation', label: 'Báo giá nhà cung cấp' },
          { id: 'purchasing-orders', label: 'Đơn mua hàng' },
          { id: 'purchasing-handoff', label: 'Bàn giao kho' },
        ]}
        activeTab={`purchasing-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('purchasing-', '') as PurchasingView)}
      />

      {/* Bảng danh sách chọn Nhà Cung Cấp */}

      {activeView === 'demand' && (
        <div id="purchasing-demand-panel" role="tabpanel" aria-labelledby="purchasing-demand-tab">
          <SplitWorkbench
            detailLabel="Đơn mua"
            detail={
              <DocumentRail
                documents={purchasingDocuments}
                title={null}
                actionForDocument={(document) => (
                  <Link className="ipc-button ipc-button-ghost" to={document.route}>
                    Xem đơn mua
                  </Link>
                )}
              />
            }
          >
            <SectionPanel title="Kế hoạch thu mua dự kiến" icon={<ShoppingCart size={18} />}>
              <DemandSummary lines={purchasePlanLines} />
              <PaginationBar
                page={purchasePlanResponse?.pageNumber ?? purchasePlanPage}
                pageSize={purchasePlanResponse?.pageSize ?? 8}
                totalItems={purchasePlanResponse?.totalCount ?? 0}
                onPageChange={setPurchasePlanPage}
              />
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'supplier' && (
        <SectionPanel title="Nhà cung cấp, đơn mua và nhập giá">
          <div id="purchasing-supplier-panel" role="tabpanel" aria-labelledby="purchasing-supplier-tab">
            <TableViewport className="ipc-table-container mt-4" ariaLabel="Bảng dòng mua hàng và nhà cung cấp">
              <table className="ipc-table">
                <thead>
                  <tr>
                    <th>Chứng từ</th>
                    <th>Nguyên liệu</th>
                    <th className="text-right">Số lượng cần mua</th>
                    <th>Nhà cung cấp</th>
                    <th>Giá dự kiến (đ)</th>
                    <th>Ngày giao</th>
                    <th>Ghi chú</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierLines.map((line) => (
                    <SupplierLineItem 
                      key={line.id} 
                      line={line} 
                      suppliers={suppliers} 
                      onUpdate={updateSupplier} 
                    />
                  ))}
                  {supplierLines.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-slate-500 py-4">Chưa có đơn mua nào để cập nhật nhà cung cấp</td></tr>
                  )}
                </tbody>
              </table>
            </TableViewport>
            <PaginationBar
              page={purchaseRequestsPageResponse?.pageNumber ?? purchaseRequestPage}
              pageSize={purchaseRequestsPageResponse?.pageSize ?? 8}
              totalItems={purchaseRequestsPageResponse?.totalCount ?? 0}
              onPageChange={setPurchaseRequestPage}
            />
          </div>
        </SectionPanel>
      )}

      {activeView === 'quotation' && (
        <SectionPanel title="Quản lý báo giá nhà cung cấp">
          <div id="purchasing-quotation-panel" role="tabpanel" aria-labelledby="purchasing-quotation-tab">
            <SupplierQuotationManager suppliers={suppliers} />
          </div>
        </SectionPanel>
      )}

      {activeView === 'orders' && (
        <SectionPanel title="Đơn mua hàng (tách theo nhà cung cấp)">
          <div id="purchasing-orders-panel" role="tabpanel" aria-labelledby="purchasing-orders-tab">
            <PurchaseOrderManager purchaseRequestLines={purchaseRequestLines} currentStockRows={currentStockRows} />
          </div>
        </SectionPanel>
      )}

      {activeView === 'handoff' && (
        <SectionPanel title="Bàn giao sang kho" icon={<PackageCheck size={18} />}>
          <div id="purchasing-handoff-panel" role="tabpanel" aria-labelledby="purchasing-handoff-tab">
          <StockMovementTable
            movements={receiptMovements}
            cursorPagination={{
              page: receiptMovementCursors.length + 1,
              hasNext: receiptMovementPage?.hasNext ?? false,
              onPrevious: () => setReceiptMovementCursors((current) => current.slice(0, -1)),
              onNext: () => {
                const nextCursorDate = receiptMovementPage?.nextCursorDate;
                if (nextCursorDate) {
                  setReceiptMovementCursors((current) => [...current, { cursorDate: nextCursorDate, cursorId: receiptMovementPage?.nextCursorId }]);
                }
              },
            }}
          />
          </div>
        </SectionPanel>
      )}

      <Dialog open={isCreateRequestDialogOpen} onOpenChange={setIsCreateRequestDialogOpen}>
        <DialogContent aria-labelledby="create-purchase-request-title" aria-describedby="create-purchase-request-description">
          <DialogHeader>
            <DialogTitle id="create-purchase-request-title">Tạo đề xuất mua từ nhu cầu thiếu</DialogTitle>
            <DialogDescription id="create-purchase-request-description">
              Chọn đúng chứng từ nhu cầu. Hệ thống chỉ tạo các dòng còn thiếu sau khi đối chiếu tồn kho.
            </DialogDescription>
          </DialogHeader>
          {purchaseRequestCandidates.length > 0 ? (
            <div className="grid gap-2">
              <label id="purchase-demand-request-label" className="text-sm font-medium text-slate-700">
                Chứng từ nhu cầu nguyên liệu
              </label>
              <Select value={selectedMaterialRequestId} onValueChange={(value) => setSelectedMaterialRequestId(value ?? '')}>
                <SelectTrigger aria-labelledby="purchase-demand-request-label" className="w-full">
                  <SelectValue placeholder="Chọn chứng từ nhu cầu">
                    {selectedPurchaseRequestCandidate ? formatPurchaseRequestCandidate(selectedPurchaseRequestCandidate) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                {purchaseRequestCandidates.map((candidate) => (
                  <SelectItem key={candidate.materialRequestId} value={candidate.materialRequestId}>
                    {formatPurchaseRequestCandidate(candidate)}
                  </SelectItem>
                ))}
                </SelectContent>
              </Select>
              <PaginationBar
                page={purchaseCandidatePage}
                pageSize={purchaseCandidatePageResponse?.pageSize ?? 8}
                totalItems={purchaseCandidatePageResponse?.totalCount ?? 0}
                onPageChange={(page) => {
                  setSelectedMaterialRequestId('');
                  setPurchaseCandidatePage(page);
                }}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              {isFetchingPurchaseCandidates ? 'Đang tải chứng từ nhu cầu...' : 'Không có chứng từ nhu cầu hợp lệ để tạo đề xuất mua.'}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCreateRequestDialogOpen(false)} disabled={isCreatingPurchaseRequest}>
              Hủy
            </Button>
            <Button type="button" onClick={() => void handleCreatePurchaseRequest()} disabled={!selectedMaterialRequestId || isCreatingPurchaseRequest}>
              {isCreatingPurchaseRequest ? 'Đang tạo...' : 'Tạo đề xuất'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OperationalFrame>
  );
}

function SupplierQuotationManager({ suppliers }: { suppliers: SupplierDto[] }) {
  const { toast } = useToast();
  const { data: ingredients = [] } = useGetIngredientsQuery();
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [quotationPage, setQuotationPage] = useState(1);
  const { data: quotationPageResponse, isFetching } = useGetSupplierQuotationsByIngredientPageQuery({
    ingredientId: selectedIngredientId,
    pageNumber: quotationPage,
    pageSize: 8,
  }, {
    skip: !selectedIngredientId,
  });
  const [createQuotation, { isLoading: isCreating }] = useCreateSupplierQuotationMutation();
  const [updateQuotation] = useUpdateSupplierQuotationMutation();
  const [deactivateQuotation] = useDeactivateSupplierQuotationMutation();
  const quotationRows = quotationPageResponse?.items ?? [];

  const [form, setForm] = useState({ supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deactivateTargetId, setDeactivateTargetId] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientId) {
      toast({ title: 'Thiếu nguyên liệu', description: 'Vui lòng chọn nguyên liệu trước khi nhập báo giá.', variant: 'warning' });
      return;
    }
    if (!editingId && !form.supplierId) {
      toast({ title: 'Thiếu nhà cung cấp', description: 'Vui lòng chọn nhà cung cấp cho báo giá.', variant: 'warning' });
      return;
    }
    const unitPrice = Number(form.unitPrice);
    if (!unitPrice || unitPrice <= 0) {
      toast({ title: 'Đơn giá chưa hợp lệ', description: 'Vui lòng nhập đơn giá lớn hơn 0.', variant: 'warning' });
      return;
    }
    if (!form.effectiveFrom) {
      toast({ title: 'Thiếu ngày bắt đầu', description: 'Vui lòng chọn ngày bắt đầu hiệu lực của báo giá.', variant: 'warning' });
      return;
    }

    try {
      if (editingId) {
        await updateQuotation({
          quotationId: editingId,
          data: {
            unitPrice,
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo || null,
            note: form.note || null,
            isActive: true,
          },
        }).unwrap();
      } else {
        await createQuotation({
          supplierId: form.supplierId,
          ingredientId: selectedIngredientId,
          unitPrice,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo || null,
          note: form.note || null,
        }).unwrap();
      }
      resetForm();
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      toast({ title: 'Chưa thể lưu báo giá', description: message, variant: 'danger', durationMs: 0 });
    }
  };

  const handleEdit = (q: SupplierQuotationDto) => {
    setEditingId(q.quotationId);
    setForm({
      supplierId: q.supplierId,
      unitPrice: String(q.unitPrice),
      effectiveFrom: q.effectiveFrom,
      effectiveTo: q.effectiveTo ?? '',
      note: q.note ?? '',
    });
  };

  const handleDeactivate = (quotationId: string) => setDeactivateTargetId(quotationId);

  const handleConfirmDeactivate = async () => {
    if (!deactivateTargetId) return;
    try {
      await deactivateQuotation(deactivateTargetId).unwrap();
      setDeactivateTargetId(null);
      toast({ title: 'Đã ngừng báo giá', variant: 'success' });
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      toast({ title: 'Chưa thể ngừng báo giá', description: message, variant: 'danger', durationMs: 0 });
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mr-2">Nguyên liệu:</label>
        <select
          className="ipc-input ipc-quotation-ingredient"
          value={selectedIngredientId}
          onChange={(e) => {
            setSelectedIngredientId(e.target.value);
            setQuotationPage(1);
            resetForm();
          }}
        >
          <option value="">-- Chọn nguyên liệu --</option>
          {ingredients.map((ingredient: IngredientLookup) => (
            <option key={ingredient.ingredientId} value={ingredient.ingredientId}>{ingredient.ingredientName}</option>
          ))}
        </select>
      </div>

      {selectedIngredientId && (
        <>
          <TableViewport className="ipc-table-container" ariaLabel="Bảng báo giá theo nguyên liệu">
            <table className="ipc-table">
              <thead>
                <tr>
                  <th>Nhà cung cấp</th>
                  <th className="text-right">Đơn giá (đ)</th>
                  <th>Hiệu lực từ</th>
                  <th>Hiệu lực đến</th>
                  <th>Ghi chú</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {quotationRows.map((q) => (
                  <tr key={q.quotationId} className={q.isBestPrice ? 'bg-emerald-50' : ''}>
                    <td>
                      {q.supplierName}
                      {q.isBestPrice && <span className="ml-2 text-xs text-emerald-700 font-medium">Tốt nhất</span>}
                    </td>
                    <td className="text-right">{q.unitPrice.toLocaleString('vi-VN')}</td>
                    <td>{q.effectiveFrom}</td>
                    <td>{q.effectiveTo ?? '—'}</td>
                    <td>{q.note ?? ''}</td>
                    <td>
                      {q.isActive
                        ? <span className="text-emerald-600">Đang hoạt động</span>
                        : <span className="text-slate-400">Đã ngừng</span>}
                    </td>
                    <td className="space-x-2">
                      <button type="button" className="ipc-button ipc-button-ghost" onClick={() => handleEdit(q)}>Sửa</button>
                      {q.isActive && (
                        <button type="button" className="ipc-button ipc-button-danger" onClick={() => handleDeactivate(q.quotationId)}>Ngừng</button>
                      )}
                    </td>
                  </tr>
                ))}
                {quotationRows.length === 0 && !isFetching && (
                  <tr><td colSpan={7} className="text-center text-slate-500 py-4">Chưa có báo giá nào cho nguyên liệu này</td></tr>
                )}
              </tbody>
            </table>
          </TableViewport>
          <PaginationBar
            page={quotationPageResponse?.pageNumber ?? quotationPage}
            pageSize={quotationPageResponse?.pageSize ?? 8}
            totalItems={quotationPageResponse?.totalCount ?? 0}
            onPageChange={setQuotationPage}
          />

          <form onSubmit={handleSubmit} className="border-t border-slate-200 pt-4">
            <div className="font-medium text-slate-700 mb-2">{editingId ? 'Sửa báo giá' : 'Thêm báo giá mới'}</div>
            <div className="ipc-quotation-form-grid grid grid-cols-1 gap-3 md:grid-cols-5">
              <select
                className="ipc-input"
                value={form.supplierId}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                disabled={!!editingId}
              >
                <option value="">-- Nhà cung cấp --</option>
                {suppliers.map((s) => (
                  <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
                ))}
              </select>
              <input
                type="number"
                className="ipc-input"
                placeholder="Đơn giá"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              />
              <input
                type="date"
                className="ipc-input"
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              />
              <input
                type="date"
                className="ipc-input"
                value={form.effectiveTo}
                onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
              />
              <input
                type="text"
                className="ipc-input"
                placeholder="Ghi chú"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </div>
            <div className="flex gap-2 mt-3">
              <button type="submit" className="ipc-button ipc-button-primary" disabled={isCreating}>
                {editingId ? 'Cập nhật báo giá' : 'Thêm báo giá'}
              </button>
              {editingId && (
                <button type="button" className="ipc-button ipc-button-ghost" onClick={resetForm}>Hủy</button>
              )}
            </div>
          </form>
        </>
      )}
      <ConfirmDialog
        open={deactivateTargetId !== null}
        title="Ngừng báo giá này?"
        description="Báo giá sẽ không còn được chọn cho các giao dịch mới."
        confirmLabel="Ngừng báo giá"
        onConfirm={handleConfirmDeactivate}
        onOpenChange={(open) => !open && setDeactivateTargetId(null)}
      />
    </div>
  );
}

function PurchaseOrderManager({
  purchaseRequestLines,
  currentStockRows,
}: {
  purchaseRequestLines: DemandLine[];
  currentStockRows: CurrentStockRow[];
}) {
  const { toast } = useToast();
  const [orderPage, setOrderPage] = useState(1);
  const { data: purchaseOrdersResponse } = useGetPurchaseOrdersPageQuery({ pageNumber: orderPage, pageSize: 6 });
  const purchaseOrders = purchaseOrdersResponse?.page.items ?? [];
  const [createFromRequest, { isLoading: isCreating }] = useCreatePurchaseOrdersFromRequestMutation();
  const [recordReceipt] = useRecordPurchaseOrderReceiptMutation();
  const [cancelOrder] = useCancelPurchaseOrderMutation();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [receiveQtyByLine, setReceiveQtyByLine] = useState<Record<string, string>>({});
  const [receiveWarehouseByOrder, setReceiveWarehouseByOrder] = useState<Record<string, string>>({});

  const warehouseOptions = Array.from(
    new Map(currentStockRows.map((row) => [row.warehouseId, row.warehouse])).entries()
  ).map(([warehouseId, warehouse]) => ({ warehouseId, warehouse }));

  const supplierCountByRequest = new Map<string, Set<string>>();
  purchaseRequestLines.forEach((line) => {
    if (!line.purchaseRequestId || !line.supplierId) {
      return;
    }
    const suppliers = supplierCountByRequest.get(line.purchaseRequestId) ?? new Set<string>();
    suppliers.add(line.supplierId);
    supplierCountByRequest.set(line.purchaseRequestId, suppliers);
  });
  const orderCountByRequest = new Map(Object.entries(purchaseOrdersResponse?.orderCountByRequest ?? {}));

  const approvedRequests = Array.from(
    new Map(
      purchaseRequestLines
        .filter((line) => line.status === 'APPROVED' && line.purchaseRequestId)
        .filter((line) => (orderCountByRequest.get(line.purchaseRequestId!) ?? 0) < (supplierCountByRequest.get(line.purchaseRequestId!)?.size ?? 0))
        .map((line) => [line.purchaseRequestId!, line])
    ).values()
  );

  const getErrorMessage = (err: unknown) =>
    (err as { data?: { message?: string }; message?: string })?.data?.message ??
    (err as { message?: string })?.message ??
    'Đã xảy ra lỗi không xác định.';

  const handleCreate = async (purchaseRequestId: string) => {
    try {
      await createFromRequest(purchaseRequestId).unwrap();
    } catch (err) {
      toast({ title: 'Chưa thể tạo đơn mua hàng', description: getErrorMessage(err), variant: 'danger', durationMs: 0 });
    }
  };

  const handleReceive = async (order: PurchaseOrderDto) => {
    const warehouseId = receiveWarehouseByOrder[order.purchaseOrderId] || warehouseOptions[0]?.warehouseId || '';
    if (!warehouseId) {
      toast({ title: 'Thiếu kho nhập hàng', description: 'Vui lòng chọn kho trước khi ghi nhận nhận hàng.', variant: 'warning' });
      return;
    }
    const lines = order.lines
      .map((line) => ({ purchaseOrderLineId: line.purchaseOrderLineId, receivedQty: Number(receiveQtyByLine[line.purchaseOrderLineId] || 0) }))
      .filter((line) => line.receivedQty > 0);
    if (lines.length === 0) {
      toast({ title: 'Chưa có số lượng nhận', description: 'Vui lòng nhập số lượng cho ít nhất một dòng.', variant: 'warning' });
      return;
    }
    try {
      await recordReceipt({ purchaseOrderId: order.purchaseOrderId, data: { warehouseId, lines } }).unwrap();
      setReceiveQtyByLine({});
      setReceiveWarehouseByOrder((current) => ({ ...current, [order.purchaseOrderId]: warehouseId }));
      setExpandedOrderId(null);
    } catch (err) {
      toast({ title: 'Chưa thể ghi nhận nhận hàng', description: getErrorMessage(err), variant: 'danger', durationMs: 0 });
    }
  };

  const handleCancel = (purchaseOrderId: string) => setCancelTargetId(purchaseOrderId);

  const handleConfirmCancel = async () => {
    if (!cancelTargetId) return;
    try {
      await cancelOrder(cancelTargetId).unwrap();
      setCancelTargetId(null);
      toast({ title: 'Đã hủy đơn mua hàng', variant: 'success' });
    } catch (err) {
      toast({ title: 'Chưa thể hủy đơn mua hàng', description: getErrorMessage(err), variant: 'danger', durationMs: 0 });
    }
  };

  return (
    <div className="mt-4 space-y-6">
      <div>
        <div className="font-medium text-slate-700 mb-2">Đề xuất đã duyệt, chưa tạo đơn mua hàng</div>
        {approvedRequests.length === 0 ? (
          <div className="text-sm text-slate-500">Không có đề xuất mua hàng nào đã duyệt.</div>
        ) : (
          <TableViewport className="ipc-table-container" ariaLabel="Bảng đề xuất đã duyệt chờ tạo đơn mua">
            <table className="ipc-table">
              <thead>
                <tr>
                  <th>Chứng từ</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {approvedRequests.map((line) => (
                  <tr key={line.purchaseRequestId}>
                    <td className="font-mono">{line.sourceDocumentCode}</td>
                    <td>
                      <button
                        type="button"
                        className="ipc-button ipc-button-primary"
                        disabled={isCreating}
                        onClick={() => handleCreate(line.purchaseRequestId!)}
                      >
                        Tạo đơn mua hàng
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableViewport>
        )}
      </div>

      <div>
        <div className="font-medium text-slate-700 mb-2">Danh sách đơn mua hàng</div>
        <TableViewport className="ipc-table-container" ariaLabel="Bảng đơn mua hàng">
          <table className="ipc-table">
            <thead>
              <tr>
                <th>Mã đơn mua hàng</th>
                <th>Nhà cung cấp</th>
                <th>Đề xuất gốc</th>
                <th>Ngày đặt</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-500 py-4">Chưa có đơn mua hàng nào</td></tr>
              )}
              {purchaseOrders.map((order) => (
                <Fragment key={order.purchaseOrderId}>
                  <tr>
                    <td className="font-mono">{order.purchaseOrderCode}</td>
                    <td>{order.supplierName}</td>
                    <td className="font-mono">{order.purchaseRequestCode}</td>
                    <td>{order.orderDate}</td>
                    <td>{formatWorkflowStatus(order.status)}</td>
                    <td className="space-x-2">
                      {order.status !== 'CANCELLED' && order.status !== 'RECEIVED' && (
                        <button
                          type="button"
                          className="ipc-button ipc-button-ghost"
                          onClick={() => setExpandedOrderId(expandedOrderId === order.purchaseOrderId ? null : order.purchaseOrderId)}
                        >
                          {expandedOrderId === order.purchaseOrderId ? 'Đóng' : 'Ghi nhận nhận hàng'}
                        </button>
                      )}
                      {order.status === 'ORDERED' && (
                        <button type="button" className="ipc-button ipc-button-danger" onClick={() => handleCancel(order.purchaseOrderId)}>
                          Hủy
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedOrderId === order.purchaseOrderId && (
                    <tr>
                      <td colSpan={6}>
                        <div className="p-3 bg-slate-50 rounded-md space-y-2">
                          <label className="flex flex-col gap-1 text-sm text-slate-700 md:max-w-xs">
                            Kho nhập hàng
                            <select
                              className="ipc-input"
                              value={receiveWarehouseByOrder[order.purchaseOrderId] || warehouseOptions[0]?.warehouseId || ''}
                              onChange={(e) => setReceiveWarehouseByOrder({
                                ...receiveWarehouseByOrder,
                                [order.purchaseOrderId]: e.target.value,
                              })}
                            >
                              {warehouseOptions.length === 0 && <option value="">Chưa có kho từ tồn hiện tại</option>}
                              {warehouseOptions.map((warehouse) => (
                                <option key={warehouse.warehouseId} value={warehouse.warehouseId}>
                                  {warehouse.warehouse}
                                </option>
                              ))}
                            </select>
                          </label>
                          {order.lines.map((line) => (
                            <div key={line.purchaseOrderLineId} className="flex items-center gap-3">
                              <span className="flex-1">
                                {line.ingredientName} — đã đặt {line.orderedQty} {line.unitName}, đã nhận {line.receivedQty}
                              </span>
                              <input
                                type="number"
                                className="ipc-input w-32"
                                placeholder="SL nhận thêm"
                                value={receiveQtyByLine[line.purchaseOrderLineId] ?? ''}
                                onChange={(e) => setReceiveQtyByLine({ ...receiveQtyByLine, [line.purchaseOrderLineId]: e.target.value })}
                              />
                            </div>
                          ))}
                          <button type="button" className="ipc-button ipc-button-primary" onClick={() => handleReceive(order)}>
                            Ghi nhận
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TableViewport>
        <PaginationBar
          page={purchaseOrdersResponse?.page.pageNumber ?? orderPage}
          pageSize={purchaseOrdersResponse?.page.pageSize ?? 6}
          totalItems={purchaseOrdersResponse?.page.totalCount ?? 0}
          onPageChange={setOrderPage}
        />
      </div>
      <ConfirmDialog
        open={cancelTargetId !== null}
        title="Hủy đơn mua hàng này?"
        description="Đơn mua sẽ không tiếp tục được xử lý trong luồng thu mua."
        confirmLabel="Hủy đơn mua"
        onConfirm={handleConfirmCancel}
        onOpenChange={(open) => !open && setCancelTargetId(null)}
      />
    </div>
  );
}
