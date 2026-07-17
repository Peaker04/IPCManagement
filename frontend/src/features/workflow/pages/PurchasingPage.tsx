import { Fragment, useState, type FormEvent } from 'react';
import { PackageCheck, ShoppingCart } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CommandBar,
  ContextStrip,
  DemandSummary,
  DocumentRail,
  OperationalFrame,
  PaginatedTableFrame,
  PaginationBar,
  SectionPanel,
  SplitWorkbench,
  StockMovementTable,
  ViewSwitcher,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetPriceVarianceQuery,
  useGetPurchasePlanQuery,
  useGetPurchaseRequestsQuery,
  useGetCurrentStockQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useGetSuppliersQuery,
  useSubmitPurchaseRequestMutation,
  useUpdatePurchaseRequestLineSupplierMutation,
  useGetSupplierQuotationsByIngredientQuery,
  useCreateSupplierQuotationMutation,
  useUpdateSupplierQuotationMutation,
  useDeactivateSupplierQuotationMutation,
  useGetPurchaseOrdersQuery,
  useCreatePurchaseOrdersFromRequestMutation,
  useRecordPurchaseOrderReceiptMutation,
  useCancelPurchaseOrderMutation,
} from '@/features/workflow';
import type { CurrentStockRow, DemandLine, SupplierDto, SupplierQuotationDto, PurchaseOrderDto } from '@/features/workflow';
import { useGetIngredientsQuery, type IngredientLookup } from '@/features/projects/dishCatalogApi';
import { usePaginatedRows } from '@/lib/usePaginatedRows';

type PurchasingView = 'demand' | 'supplier' | 'quotation' | 'orders' | 'handoff';
const validPurchasingViews: PurchasingView[] = ['demand', 'supplier', 'quotation', 'orders', 'handoff'];

export default function PurchasingPage() {
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view');
  const [activeView, setActiveView] = useState<PurchasingView>(
    validPurchasingViews.includes(initialView as PurchasingView) ? (initialView as PurchasingView) : 'demand'
  );
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: purchasePlanRows = [] } = useGetPurchasePlanQuery({ groupBy: 'day', limit: 100 });
  const { data: purchaseRequestsResponse } = useGetPurchaseRequestsQuery({ pageSize: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: currentStockRows = [] } = useGetCurrentStockQuery({ limit: 100 });
  const { data: priceRows = [] } = useGetPriceVarianceQuery({ limit: 100 });

  const { data: suppliers = [] } = useGetSuppliersQuery();
  const [updateSupplier] = useUpdatePurchaseRequestLineSupplierMutation();
  const [submitPurchaseRequest, { isLoading: isSubmittingPurchaseRequest }] = useSubmitPurchaseRequestMutation();
  const purchaseRequests = purchaseRequestsResponse?.data ?? [];
  const purchasePlanLines = purchasePlanRows.map<DemandLine>((row) => ({
    id: `${row.periodKey}-${row.ingredientId}`,
    ingredientId: row.ingredientId,
    sourceDocumentCode: row.periodKey,
    serviceDate: row.periodStart,
    material: row.ingredientName ?? row.ingredientId,
    required: row.requiredQty,
    available: row.currentStockQty + row.pendingReceiptQty,
    reserved: 0,
    unit: row.unitName ?? '',
    source: row.supplierName ?? 'Chưa có NCC',
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
      source: line.supplierName || 'Chưa chọn NCC',
      status: request.status,
      nextAction: request.status === 'APPROVED' ? 'Tạo đơn mua hàng' : request.status === 'DRAFT' ? 'Chọn nhà cung cấp' : 'Theo dõi đơn mua',
      tone: request.status === 'APPROVED' ? 'success' : request.status === 'SUBMITTED' ? 'warning' : 'neutral',
    })),
  );
  const supplierLines = purchaseRequestLines.filter((line) => Boolean(line.purchaseRequestId));
  const supplierPagination = usePaginatedRows(supplierLines, 8);
  const purchasingDocuments = workflowDocuments.filter((document) => document.type === 'Đơn mua');
  const receiptMovements = stockMovements.filter((movement) => movement.type === 'receipt');
  const warningPrice = priceRows.find((row) => row.warning);
  const primaryPurchasePlan = purchasePlanLines.find((line) => line.tone === 'danger' || line.tone === 'warning') ?? purchasePlanLines[0];
  const primaryPurchaseRequestLine = purchaseRequestLines.find((line) => line.purchaseRequestId) ?? purchaseRequestLines[0];
  const submitTargetId = primaryPurchaseRequestLine?.purchaseRequestId;
  const purchaseSummaryDocument = purchasingDocuments[0];

  const handleSubmitPurchaseRequest = async () => {
    if (!submitTargetId) {
      alert('Chưa có đơn mua để gửi.');
      return;
    }

    try {
      await submitPurchaseRequest(submitTargetId).unwrap();
      alert('Đã gửi đơn mua chính thức.');
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      alert('Chưa thể gửi đơn mua: ' + message);
    }
  };

  return (
    <OperationalFrame
      command={
        <CommandBar
          actions={
            <>
              <button
                className="ipc-button ipc-button-primary"
                type="button"
                onClick={() => setActiveView('supplier')}
              >
                Chọn nhà cung cấp
              </button>
              <button
                className="ipc-button ipc-button-primary"
                type="button"
                onClick={handleSubmitPurchaseRequest}
                disabled={!submitTargetId || isSubmittingPurchaseRequest}
              >
                {isSubmittingPurchaseRequest ? 'Đang gửi...' : 'Gửi đơn mua'}
              </button>
              <button className="ipc-button ipc-button-warning" type="button">Gửi cảnh báo biến động giá</button>
              <Link className="ipc-button ipc-button-primary" to={ROUTES.WAREHOUSE}>
                <PackageCheck size={16} />
                Chuyển sang nhập kho
              </Link>
              <Link className="ipc-button ipc-button-ghost" to={ROUTES.APPROVALS}>
                Quay lại duyệt
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
            { label: 'Trạng thái mua', value: primaryPurchaseRequestLine?.status ?? 'Chưa có đơn mua', tone: primaryPurchaseRequestLine ? 'warning' : 'neutral' },
            { label: 'Cảnh báo giá', value: warningPrice ? `${warningPrice.name} +${warningPrice.change.toFixed(1)}%` : 'Không có', tone: warningPrice ? 'danger' : 'success' },
            { label: 'Handoff kho', value: receiptMovements.length > 0 ? `${receiptMovements.length} phiếu nhập` : 'Chờ phiếu nhập', tone: receiptMovements.length > 0 ? 'success' : 'warning' },
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
          { id: 'purchasing-supplier', label: 'Giá và NCC' },
          { id: 'purchasing-quotation', label: 'Báo giá NCC' },
          { id: 'purchasing-orders', label: 'Đơn mua hàng' },
          { id: 'purchasing-handoff', label: 'Handoff kho' },
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
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'supplier' && (
        <SectionPanel title="Nhà cung cấp, đơn mua và nhập giá">
          <div id="purchasing-supplier-panel" role="tabpanel" aria-labelledby="purchasing-supplier-tab">
            <PaginatedTableFrame className="ipc-table-container mt-4" ariaLabel="Bảng dòng mua hàng và nhà cung cấp">
              <table className="ipc-table">
                <thead>
                  <tr>
                    <th>Chứng từ</th>
                    <th>Nguyên liệu</th>
                    <th className="text-right">SL Cần mua</th>
                    <th>Nhà cung cấp</th>
                    <th>Giá dự kiến (đ)</th>
                    <th>Ngày giao</th>
                    <th>Ghi chú</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {supplierPagination.rows.map((line) => (
                    <SupplierLineItem 
                      key={line.id} 
                      line={line} 
                      suppliers={suppliers} 
                      onUpdate={updateSupplier} 
                    />
                  ))}
                  {supplierLines.length === 0 && (
                    <tr><td colSpan={8} className="text-center text-slate-500 py-4">Chưa có đơn mua nào để cập nhật NCC</td></tr>
                  )}
                </tbody>
              </table>
            </PaginatedTableFrame>
            <PaginationBar
              page={supplierPagination.page}
              pageSize={supplierPagination.pageSize}
              totalItems={supplierPagination.totalItems}
              onPageChange={supplierPagination.setPage}
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
        <SectionPanel title="Handoff sang kho" icon={<PackageCheck size={18} />}>
          <div id="purchasing-handoff-panel" role="tabpanel" aria-labelledby="purchasing-handoff-tab">
          <StockMovementTable movements={receiptMovements} />
          </div>
        </SectionPanel>
      )}
    </OperationalFrame>
  );
}

function SupplierLineItem({
  line,
  suppliers,
  onUpdate,
}: {
  line: DemandLine;
  suppliers: SupplierDto[];
  onUpdate: ReturnType<typeof useUpdatePurchaseRequestLineSupplierMutation>[0];
}) {
  const [selectedSupplierId, setSelectedSupplierId] = useState(line.supplierId ?? '');
  const [estimatedPrice, setEstimatedPrice] = useState<number>(line.estimatedUnitPrice ?? 0);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(line.expectedDeliveryDate ?? '');
  const [note, setNote] = useState(line.note ?? '');
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: quotations = [] } = useGetSupplierQuotationsByIngredientQuery(line.ingredientId ?? '', {
    skip: !line.ingredientId,
  });

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const matched = quotations.find((q) => q.supplierId === supplierId && q.isActive);
    if (matched) {
      setEstimatedPrice(matched.unitPrice);
    }
  };

  const bestQuotation = quotations.find((q) => q.isBestPrice);

  const handleSave = async () => {
    if (!line.purchaseRequestId || !line.purchaseRequestLineId || !selectedSupplierId) {
      alert('Vui lòng chọn Nhà cung cấp');
      return;
    }
    if (!estimatedPrice || estimatedPrice <= 0) {
      alert('Vui lòng nhập giá dự kiến lớn hơn 0');
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate({
        purchaseRequestId: line.purchaseRequestId,
        purchaseRequestLineId: line.purchaseRequestLineId,
        data: {
          supplierId: selectedSupplierId,
          estimatedUnitPrice: estimatedPrice,
          expectedDeliveryDate: expectedDeliveryDate || null,
          note: note.trim() || null,
        }
      }).unwrap();
      alert('Đã cập nhật Nhà cung cấp thành công!');
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      alert('Lỗi khi cập nhật Nhà cung cấp: ' + message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <tr>
      <td className="text-slate-500 font-mono text-sm">{line.sourceDocumentCode}</td>
      <td className="font-medium text-slate-800">{line.material}</td>
      <td className="text-right">{line.reserved} <span className="text-slate-500">{line.unit}</span></td>
      <td>
        <select
          className="ipc-input w-full"
          value={selectedSupplierId}
          onChange={(e) => handleSupplierChange(e.target.value)}
        >
          <option value="">-- Chọn Nhà cung cấp --</option>
          {suppliers.map(s => (
            <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
          ))}
        </select>
        {bestQuotation && bestQuotation.supplierId !== selectedSupplierId && (
          <div className="text-xs text-emerald-600 mt-1">
            Giá tốt nhất: {bestQuotation.supplierName} — {bestQuotation.unitPrice.toLocaleString('vi-VN')}đ
          </div>
        )}
      </td>
      <td>
        <input 
          type="number" 
          className="ipc-input w-full" 
          placeholder="VD: 150000" 
          value={estimatedPrice || ''}
          onChange={(e) => setEstimatedPrice(Number(e.target.value))}
        />
      </td>
      <td>
        <input
          type="date"
          className="ipc-input w-full"
          value={expectedDeliveryDate}
          onChange={(e) => setExpectedDeliveryDate(e.target.value)}
        />
      </td>
      <td>
        <input
          className="ipc-input w-full"
          placeholder="Ghi chú"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </td>
      <td>
        <button
          className="ipc-button ipc-button-primary"
          onClick={handleSave}
          disabled={isUpdating}
        >
          {isUpdating ? 'Đang lưu...' : 'Lưu NCC'}
        </button>
      </td>
    </tr>
  );
}

function SupplierQuotationManager({ suppliers }: { suppliers: SupplierDto[] }) {
  const { data: ingredients = [] } = useGetIngredientsQuery();
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const { data: quotations = [], isFetching } = useGetSupplierQuotationsByIngredientQuery(selectedIngredientId, {
    skip: !selectedIngredientId,
  });
  const [createQuotation, { isLoading: isCreating }] = useCreateSupplierQuotationMutation();
  const [updateQuotation] = useUpdateSupplierQuotationMutation();
  const [deactivateQuotation] = useDeactivateSupplierQuotationMutation();
  const quotationPagination = usePaginatedRows(quotations, 8);

  const [form, setForm] = useState({ supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientId) {
      alert('Vui lòng chọn nguyên liệu');
      return;
    }
    if (!editingId && !form.supplierId) {
      alert('Vui lòng chọn nhà cung cấp');
      return;
    }
    const unitPrice = Number(form.unitPrice);
    if (!unitPrice || unitPrice <= 0) {
      alert('Vui lòng nhập đơn giá lớn hơn 0');
      return;
    }
    if (!form.effectiveFrom) {
      alert('Vui lòng nhập ngày bắt đầu hiệu lực');
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
      alert('Lỗi khi lưu báo giá: ' + message);
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

  const handleDeactivate = async (quotationId: string) => {
    if (!confirm('Ngừng báo giá này?')) {
      return;
    }
    try {
      await deactivateQuotation(quotationId).unwrap();
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      alert('Lỗi khi ngừng báo giá: ' + message);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mr-2">Nguyên liệu:</label>
        <select
          className="ipc-input"
          value={selectedIngredientId}
          onChange={(e) => {
            setSelectedIngredientId(e.target.value);
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
          <PaginatedTableFrame className="ipc-table-container" ariaLabel="Bảng báo giá theo nguyên liệu">
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
                {quotationPagination.rows.map((q) => (
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
                {quotations.length === 0 && !isFetching && (
                  <tr><td colSpan={7} className="text-center text-slate-500 py-4">Chưa có báo giá nào cho nguyên liệu này</td></tr>
                )}
              </tbody>
            </table>
          </PaginatedTableFrame>
          <PaginationBar
            page={quotationPagination.page}
            pageSize={quotationPagination.pageSize}
            totalItems={quotationPagination.totalItems}
            onPageChange={quotationPagination.setPage}
          />

          <form onSubmit={handleSubmit} className="border-t border-slate-200 pt-4">
            <div className="font-medium text-slate-700 mb-2">{editingId ? 'Sửa báo giá' : 'Thêm báo giá mới'}</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
    </div>
  );
}

const purchaseOrderStatusLabel: Record<string, string> = {
  ORDERED: 'Đã đặt hàng',
  PARTIALLY_RECEIVED: 'Nhận một phần',
  RECEIVED: 'Đã nhận đủ',
  CANCELLED: 'Đã hủy',
};

function PurchaseOrderManager({
  purchaseRequestLines,
  currentStockRows,
}: {
  purchaseRequestLines: DemandLine[];
  currentStockRows: CurrentStockRow[];
}) {
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery();
  const [createFromRequest, { isLoading: isCreating }] = useCreatePurchaseOrdersFromRequestMutation();
  const [recordReceipt] = useRecordPurchaseOrderReceiptMutation();
  const [cancelOrder] = useCancelPurchaseOrderMutation();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [receiveQtyByLine, setReceiveQtyByLine] = useState<Record<string, string>>({});
  const [receiveWarehouseByOrder, setReceiveWarehouseByOrder] = useState<Record<string, string>>({});
  const orderPagination = usePaginatedRows(purchaseOrders, 6);

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
  const orderCountByRequest = new Map<string, number>();
  purchaseOrders.forEach((order) => {
    orderCountByRequest.set(order.purchaseRequestId, (orderCountByRequest.get(order.purchaseRequestId) ?? 0) + 1);
  });

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
      alert('Lỗi khi tạo đơn mua hàng: ' + getErrorMessage(err));
    }
  };

  const handleReceive = async (order: PurchaseOrderDto) => {
    const warehouseId = receiveWarehouseByOrder[order.purchaseOrderId] || warehouseOptions[0]?.warehouseId || '';
    if (!warehouseId) {
      alert('Vui lòng chọn kho nhập hàng trước khi ghi nhận.');
      return;
    }
    const lines = order.lines
      .map((line) => ({ purchaseOrderLineId: line.purchaseOrderLineId, receivedQty: Number(receiveQtyByLine[line.purchaseOrderLineId] || 0) }))
      .filter((line) => line.receivedQty > 0);
    if (lines.length === 0) {
      alert('Vui lòng nhập số lượng nhận cho ít nhất một dòng.');
      return;
    }
    try {
      await recordReceipt({ purchaseOrderId: order.purchaseOrderId, data: { warehouseId, lines } }).unwrap();
      setReceiveQtyByLine({});
      setReceiveWarehouseByOrder((current) => ({ ...current, [order.purchaseOrderId]: warehouseId }));
      setExpandedOrderId(null);
    } catch (err) {
      alert('Lỗi khi ghi nhận nhận hàng: ' + getErrorMessage(err));
    }
  };

  const handleCancel = async (purchaseOrderId: string) => {
    if (!confirm('Hủy đơn mua hàng này?')) {
      return;
    }
    try {
      await cancelOrder(purchaseOrderId).unwrap();
    } catch (err) {
      alert('Lỗi khi hủy đơn mua hàng: ' + getErrorMessage(err));
    }
  };

  return (
    <div className="mt-4 space-y-6">
      <div>
        <div className="font-medium text-slate-700 mb-2">Đề xuất đã duyệt, chưa tạo đơn mua hàng</div>
        {approvedRequests.length === 0 ? (
          <div className="text-sm text-slate-500">Không có đề xuất mua hàng nào đã duyệt.</div>
        ) : (
          <PaginatedTableFrame className="ipc-table-container" ariaLabel="Bảng đề xuất đã duyệt chờ tạo đơn mua">
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
          </PaginatedTableFrame>
        )}
      </div>

      <div>
        <div className="font-medium text-slate-700 mb-2">Danh sách đơn mua hàng</div>
        <PaginatedTableFrame className="ipc-table-container" ariaLabel="Bảng đơn mua hàng">
          <table className="ipc-table">
            <thead>
              <tr>
                <th>Mã PO</th>
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
              {orderPagination.rows.map((order) => (
                <Fragment key={order.purchaseOrderId}>
                  <tr>
                    <td className="font-mono">{order.purchaseOrderCode}</td>
                    <td>{order.supplierName}</td>
                    <td className="font-mono">{order.purchaseRequestCode}</td>
                    <td>{order.orderDate}</td>
                    <td>{purchaseOrderStatusLabel[order.status] ?? order.status}</td>
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
        </PaginatedTableFrame>
        <PaginationBar
          page={orderPagination.page}
          pageSize={orderPagination.pageSize}
          totalItems={orderPagination.totalItems}
          onPageChange={orderPagination.setPage}
        />
      </div>
    </div>
  );
}
