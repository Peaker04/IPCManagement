import { Fragment, useState, type FormEvent } from 'react';
import { PackageCheck, ShoppingCart } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CommandBar,
  ConfirmDialog,
  ContextStrip,
  DemandSummary,
  DocumentRail,
  ErrorDialog,
  OperationalFrame,
  SearchableSelect,
  SectionPanel,
  SplitWorkbench,
  StockMovementTable,
  ViewSwitcher,
  type SearchableSelectOption,
} from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import {
  useGetPriceVarianceQuery,
  useGetPurchaseDemandQuery,
  useGetStockMovementsQuery,
  useGetWorkflowDocumentsQuery,
  useGetSuppliersQuery,
  useUpdatePurchaseRequestLineSupplierMutation,
  useGetSupplierQuotationsByIngredientQuery,
  useCreateSupplierQuotationMutation,
  useUpdateSupplierQuotationMutation,
  useDeactivateSupplierQuotationMutation,
  useGetPurchaseOrdersQuery,
  useCreatePurchaseOrdersFromRequestMutation,
  useRecordPurchaseOrderReceiptMutation,
  useCancelPurchaseOrderMutation,
  useCreateInventoryReceiptMutation,
} from '@/features/workflow';
import type { DemandLine, SupplierDto, SupplierQuotationDto, PurchaseOrderDto } from '@/features/workflow';
import { useGetIngredientsQuery, useGetWarehousesQuery, useSearchIngredientsQuery, type IngredientLookup } from '@/features/projects/dishCatalogApi';
import { CreateIngredientDialog } from '../components/CreateIngredientDialog';
import { CreateSupplierDialog } from '../components/CreateSupplierDialog';

type PurchasingView = 'demand' | 'supplier' | 'quotation' | 'orders' | 'handoff';
const validPurchasingViews: PurchasingView[] = ['demand', 'supplier', 'quotation', 'orders', 'handoff'];

export default function PurchasingPage() {
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view');
  const [activeView, setActiveView] = useState<PurchasingView>(
    validPurchasingViews.includes(initialView as PurchasingView) ? (initialView as PurchasingView) : 'demand'
  );
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: purchaseDemandLines = [] } = useGetPurchaseDemandQuery({ limit: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: priceRows = [] } = useGetPriceVarianceQuery({ limit: 100 });

  const { data: suppliers = [] } = useGetSuppliersQuery();
  const [updateSupplier] = useUpdatePurchaseRequestLineSupplierMutation();
  const purchasingDocuments = workflowDocuments.filter((document) => document.type === 'Đơn mua' || document.type === 'Danh sách mua thêm');
  const receiptMovements = stockMovements.filter((movement) => movement.type === 'receipt');
  const warningPrice = priceRows.find((row) => row.warning);
  const primaryPurchaseDemand = purchaseDemandLines.find((line) => line.tone === 'danger') ?? purchaseDemandLines[0];
  const purchaseSummaryDocument = purchasingDocuments.find((document) => document.type === 'Danh sách mua thêm')
    ?? purchasingDocuments[0];

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
            Danh sách mua thêm: {purchaseSummaryDocument?.title ?? primaryPurchaseDemand?.sourceDocumentCode ?? 'Chưa có chứng từ'}
          </span>
          <span className="ipc-command-meta">Ngưỡng cảnh báo: 15%</span>
        </CommandBar>
      }
      context={
        <ContextStrip
          items={[
            { label: 'Trạng thái mua', value: primaryPurchaseDemand?.status ?? 'Chưa có đơn mua', tone: primaryPurchaseDemand ? 'warning' : 'neutral' },
            { label: 'Cảnh báo giá', value: warningPrice ? `${warningPrice.name} +${warningPrice.change.toFixed(1)}%` : 'Không có', tone: warningPrice ? 'danger' : 'success' },
            { label: 'Handoff kho', value: receiptMovements.length > 0 ? `${receiptMovements.length} phiếu nhập` : 'Chờ phiếu nhập', tone: receiptMovements.length > 0 ? 'success' : 'warning' },
            { label: 'Nhà cung cấp đề xuất', value: warningPrice?.supplier ?? primaryPurchaseDemand?.source ?? 'Chưa có', tone: 'neutral' },
          ]}
        />
      }
    >

      <ViewSwitcher
        compact
        ariaLabel="Chọn góc nhìn thu mua"
        tabs={[
          { id: 'purchasing-demand', label: 'Nhu cầu mua' },
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
            <SectionPanel title="Nhu cầu mua thêm" icon={<ShoppingCart size={18} />}>
              <DemandSummary lines={purchaseDemandLines} />
            </SectionPanel>
          </SplitWorkbench>
        </div>
      )}

      {activeView === 'supplier' && (
        <SectionPanel title="Nhà cung cấp, đơn mua và nhập giá">
          <div id="purchasing-supplier-panel" role="tabpanel" aria-labelledby="purchasing-supplier-tab">
            <div className="ipc-table-shell mt-4">
              <table className="ipc-data-table">
                <thead>
                  <tr>
                    <th>Chứng từ</th>
                    <th>Nguyên liệu</th>
                    <th className="text-right">SL Cần mua</th>
                    <th>Nhà cung cấp</th>
                    <th>Giá dự kiến (đ)</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseDemandLines
                    .filter(line => line.purchaseRequestId)
                    .map((line) => (
                    <SupplierLineItem 
                      key={line.id} 
                      line={line} 
                      suppliers={suppliers} 
                      onUpdate={updateSupplier} 
                    />
                  ))}
                  {purchaseDemandLines.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-slate-500 py-4">Không có nhu cầu mua thêm nào</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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
            <PurchaseOrderManager purchaseDemandLines={purchaseDemandLines} />
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
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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

  // Chỉ cho chọn NCC còn báo giá đang hoạt động cho đúng nguyên liệu này — NCC có báo giá
  // đã ngừng không hiện trong danh sách để chọn mới (vẫn hiển thị đúng tên nếu đó là giá trị
  // đã gán từ trước, nhờ `selectedLabel` bên dưới).
  const supplierOptions: SearchableSelectOption[] = suppliers
    .filter((s) => quotations.some((q) => q.supplierId === s.supplierId && q.isActive))
    .sort((a, b) => {
      const aBest = quotations.find((q) => q.supplierId === a.supplierId && q.isActive)?.isBestPrice ? 0 : 1;
      const bBest = quotations.find((q) => q.supplierId === b.supplierId && q.isActive)?.isBestPrice ? 0 : 1;
      return aBest - bBest;
    })
    .map((s) => {
      const quotation = quotations.find((q) => q.supplierId === s.supplierId && q.isActive)!;
      return {
        value: s.supplierId,
        label: s.supplierName,
        hint: `${quotation.unitPrice.toLocaleString('vi-VN')}đ${quotation.isBestPrice ? ' ⭐ Tốt nhất' : ''}`,
        keywords: s.supplierCode,
      };
    });

  const handleSave = async () => {
    if (!line.purchaseRequestId || !line.purchaseRequestLineId || !selectedSupplierId) {
      setErrorMessage('Vui lòng chọn Nhà cung cấp');
      return;
    }
    if (!estimatedPrice || estimatedPrice <= 0) {
      setErrorMessage('Vui lòng nhập giá dự kiến lớn hơn 0');
      return;
    }
    setIsUpdating(true);
    try {
      await onUpdate({
        purchaseRequestId: line.purchaseRequestId,
        purchaseRequestLineId: line.purchaseRequestLineId,
        data: {
          supplierId: selectedSupplierId,
          estimatedUnitPrice: estimatedPrice
        }
      }).unwrap();
      setSavedAt(Date.now());
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      setErrorMessage('Lỗi khi cập nhật Nhà cung cấp: ' + message);
    } finally {
      setIsUpdating(false);
    }
  };

  const isEditable = line.status === 'DRAFT';

  return (
    <tr>
      <td className="text-slate-500 font-mono text-sm">{line.sourceDocumentCode}</td>
      <td className="font-medium text-slate-800">{line.material}</td>
      <td className="text-right">{line.reserved} <span className="text-slate-500">{line.unit}</span></td>
      <td>
        <SearchableSelect
          value={selectedSupplierId}
          onChange={handleSupplierChange}
          options={supplierOptions}
          selectedLabel={suppliers.find((s) => s.supplierId === selectedSupplierId)?.supplierName}
          placeholder="-- Chọn Nhà cung cấp --"
          disabled={!isEditable}
        />
        {bestQuotation && bestQuotation.supplierId !== selectedSupplierId && (
          <div className="text-xs text-emerald-600 mt-1">
            Giá tốt nhất: {bestQuotation.supplierName} — {bestQuotation.unitPrice.toLocaleString('vi-VN')}đ
          </div>
        )}
        {!isEditable && (
          <div className="text-xs text-slate-400 mt-1">Đã duyệt — chỉ đổi được NCC khi đề xuất còn ở trạng thái nháp</div>
        )}
      </td>
      <td>
        <input
          type="number"
          className="ipc-input w-full"
          placeholder="VD: 150000"
          value={estimatedPrice || ''}
          onChange={(e) => setEstimatedPrice(Number(e.target.value))}
          disabled={!isEditable}
        />
      </td>
      <td>
        <button
          className="ipc-button ipc-button-primary"
          onClick={handleSave}
          disabled={isUpdating || !isEditable}
        >
          {isUpdating ? 'Đang lưu...' : 'Lưu NCC'}
        </button>
        {savedAt && <div className="text-xs text-emerald-600 mt-1">✓ Đã lưu</div>}
        <ErrorDialog
          open={errorMessage !== null}
          onOpenChange={(open) => !open && setErrorMessage(null)}
          message={errorMessage ?? ''}
        />
      </td>
    </tr>
  );
}

function SupplierQuotationManager({ suppliers }: { suppliers: SupplierDto[] }) {
  const { data: ingredients = [] } = useGetIngredientsQuery();
  const [ingredientQuery, setIngredientQuery] = useState('');
  const { data: searchedIngredients = [], isFetching: isSearchingIngredients } = useSearchIngredientsQuery(ingredientQuery);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const { data: quotations = [], isFetching } = useGetSupplierQuotationsByIngredientQuery(selectedIngredientId, {
    skip: !selectedIngredientId,
  });
  const [createQuotation, { isLoading: isCreating }] = useCreateSupplierQuotationMutation();
  const [updateQuotation] = useUpdateSupplierQuotationMutation();
  const [deactivateQuotation] = useDeactivateSupplierQuotationMutation();

  const [form, setForm] = useState({ supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateIngredient, setShowCreateIngredient] = useState(false);
  const [showCreateSupplier, setShowCreateSupplier] = useState(false);
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [deactivateTargetId, setDeactivateTargetId] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ supplierId: '', unitPrice: '', effectiveFrom: '', effectiveTo: '', note: '' });
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIngredientId) {
      setErrorMessage('Vui lòng chọn nguyên liệu.');
      return;
    }
    if (!editingId && !form.supplierId) {
      setErrorMessage('Vui lòng chọn nhà cung cấp.');
      return;
    }
    const unitPrice = Number(form.unitPrice);
    if (!unitPrice || unitPrice <= 0) {
      setErrorMessage('Vui lòng nhập đơn giá lớn hơn 0.');
      return;
    }
    if (!form.effectiveFrom) {
      setErrorMessage('Vui lòng nhập ngày bắt đầu hiệu lực.');
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
      setErrorMessage('Lỗi khi lưu báo giá: ' + message);
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
    try {
      await deactivateQuotation(quotationId).unwrap();
    } catch (err) {
      const message =
        (err as { data?: { message?: string }; message?: string })?.data?.message ??
        (err as { message?: string })?.message ??
        'Đã xảy ra lỗi không xác định.';
      setErrorMessage('Lỗi khi ngừng báo giá: ' + message);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="max-w-sm">
        <label className="text-sm font-medium text-slate-700 mb-1 block">Nguyên liệu:</label>
        <SearchableSelect
          value={selectedIngredientId}
          onChange={(nextValue) => {
            setSelectedIngredientId(nextValue);
            resetForm();
          }}
          options={searchedIngredients.map((ingredient: IngredientLookup) => ({
            value: ingredient.ingredientId,
            label: ingredient.ingredientName,
            hint: ingredient.ingredientCode,
          }))}
          selectedLabel={ingredients.find((i) => i.ingredientId === selectedIngredientId)?.ingredientName}
          onQueryChange={setIngredientQuery}
          isLoading={isSearchingIngredients}
          placeholder="-- Chọn nguyên liệu --"
          onCreateNew={(query) => {
            setNewIngredientName(query);
            setShowCreateIngredient(true);
          }}
          createNewLabel="+ Thêm nguyên liệu mới..."
        />
      </div>

      <CreateIngredientDialog
        open={showCreateIngredient}
        onOpenChange={setShowCreateIngredient}
        initialName={newIngredientName}
        onCreated={(ingredientId) => {
          setSelectedIngredientId(ingredientId);
          resetForm();
        }}
      />
      <CreateSupplierDialog
        open={showCreateSupplier}
        onOpenChange={setShowCreateSupplier}
        initialName={newSupplierName}
        onCreated={(supplierId) => setForm((prev) => ({ ...prev, supplierId }))}
      />
      <ErrorDialog
        open={errorMessage !== null}
        onOpenChange={(open) => !open && setErrorMessage(null)}
        message={errorMessage ?? ''}
      />
      <ConfirmDialog
        open={deactivateTargetId !== null}
        onOpenChange={(open) => !open && setDeactivateTargetId(null)}
        title="Ngừng báo giá"
        message="Ngừng báo giá này? Báo giá sẽ không còn hiển thị trong danh sách gợi ý cho nguyên liệu này."
        confirmLabel="Ngừng báo giá"
        danger
        onConfirm={() => deactivateTargetId && handleDeactivate(deactivateTargetId)}
      />

      {selectedIngredientId && (
        <>
          <div className="ipc-table-shell">
            <table className="ipc-data-table">
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
                {quotations.map((q) => (
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
                        <button type="button" className="ipc-button ipc-button-danger" onClick={() => setDeactivateTargetId(q.quotationId)}>Ngừng</button>
                      )}
                    </td>
                  </tr>
                ))}
                {quotations.length === 0 && !isFetching && (
                  <tr><td colSpan={7} className="text-center text-slate-500 py-4">Chưa có báo giá nào cho nguyên liệu này</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 pt-4">
            <div className="font-medium text-slate-700 mb-2">{editingId ? 'Sửa báo giá' : 'Thêm báo giá mới'}</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <SearchableSelect
                value={form.supplierId}
                onChange={(nextValue) => setForm({ ...form, supplierId: nextValue })}
                options={suppliers.map((s) => ({ value: s.supplierId, label: s.supplierName, keywords: s.supplierCode }))}
                placeholder="-- Nhà cung cấp --"
                disabled={!!editingId}
                onCreateNew={
                  editingId
                    ? undefined
                    : (query) => {
                        setNewSupplierName(query);
                        setShowCreateSupplier(true);
                      }
                }
                createNewLabel="+ Thêm NCC mới..."
              />
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

function PurchaseOrderManager({ purchaseDemandLines }: { purchaseDemandLines: DemandLine[] }) {
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery();
  const { data: warehouses = [] } = useGetWarehousesQuery();
  const [createFromRequest, { isLoading: isCreating }] = useCreatePurchaseOrdersFromRequestMutation();
  const [recordReceipt] = useRecordPurchaseOrderReceiptMutation();
  const [cancelOrder] = useCancelPurchaseOrderMutation();
  const [createInventoryReceipt] = useCreateInventoryReceiptMutation();
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [receiveQtyByLine, setReceiveQtyByLine] = useState<Record<string, string>>({});
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const supplierCountByRequest = new Map<string, Set<string>>();
  purchaseDemandLines.forEach((line) => {
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
      purchaseDemandLines
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
      setErrorMessage('Lỗi khi tạo đơn mua hàng: ' + getErrorMessage(err));
    }
  };

  const handleReceive = async (order: PurchaseOrderDto) => {
    const receivedLines = order.lines
      .map((line) => ({ line, receivedQty: Number(receiveQtyByLine[line.purchaseOrderLineId] || 0) }))
      .filter(({ receivedQty }) => receivedQty > 0);
    if (receivedLines.length === 0) {
      setErrorMessage('Vui lòng nhập số lượng nhận cho ít nhất một dòng.');
      return;
    }
    if (!effectiveWarehouseId) {
      setErrorMessage('Vui lòng chọn kho nhận hàng.');
      return;
    }
    try {
      await recordReceipt({
        purchaseOrderId: order.purchaseOrderId,
        data: { lines: receivedLines.map(({ line, receivedQty }) => ({ purchaseOrderLineId: line.purchaseOrderLineId, receivedQty })) },
      }).unwrap();
      try {
        await createInventoryReceipt({
          receiptDate: new Date().toISOString().slice(0, 10),
          supplierId: order.supplierId,
          warehouseId: receiveWarehouseId,
          purchaseRequestId: order.purchaseRequestId,
          lines: receivedLines.map(({ line, receivedQty }) => ({
            ingredientId: line.ingredientId,
            quantity: receivedQty,
            unitId: line.unitId,
            unitPrice: line.unitPrice,
          })),
        }).unwrap();
      } catch (stockErr) {
        setErrorMessage(
          'Đã ghi nhận nhận hàng trên đơn mua, nhưng lỗi khi cập nhật tồn kho: ' +
            getErrorMessage(stockErr) +
            ' — vui lòng kiểm tra lại tồn kho thủ công.'
        );
        return;
      }
      setReceiveQtyByLine({});
      setExpandedOrderId(null);
    } catch (err) {
      setErrorMessage('Lỗi khi ghi nhận nhận hàng: ' + getErrorMessage(err));
    }
  };

  const handleCancel = async (purchaseOrderId: string) => {
    try {
      await cancelOrder(purchaseOrderId).unwrap();
    } catch (err) {
      setErrorMessage('Lỗi khi hủy đơn mua hàng: ' + getErrorMessage(err));
    }
  };

  const effectiveWarehouseId = receiveWarehouseId || warehouses[0]?.warehouseId || '';

  return (
    <div className="mt-4 space-y-6">
      <ErrorDialog
        open={errorMessage !== null}
        onOpenChange={(open) => !open && setErrorMessage(null)}
        message={errorMessage ?? ''}
      />
      <ConfirmDialog
        open={cancelTargetId !== null}
        onOpenChange={(open) => !open && setCancelTargetId(null)}
        title="Hủy đơn mua hàng"
        message="Hủy đơn mua hàng này? Hành động này không thể hoàn tác."
        confirmLabel="Hủy đơn"
        danger
        onConfirm={() => cancelTargetId && handleCancel(cancelTargetId)}
      />
      <div>
        <div className="font-medium text-slate-700 mb-2">Đề xuất đã duyệt, chưa tạo đơn mua hàng</div>
        {approvedRequests.length === 0 ? (
          <div className="text-sm text-slate-500">Không có đề xuất mua hàng nào đã duyệt.</div>
        ) : (
          <div className="ipc-table-shell">
            <table className="ipc-data-table">
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
          </div>
        )}
      </div>

      <div>
        <div className="font-medium text-slate-700 mb-2">Danh sách đơn mua hàng</div>
        <div className="ipc-table-shell">
          <table className="ipc-data-table">
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
              {purchaseOrders.map((order) => (
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
                        <button type="button" className="ipc-button ipc-button-danger" onClick={() => setCancelTargetId(order.purchaseOrderId)}>
                          Hủy
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedOrderId === order.purchaseOrderId && (
                    <tr>
                      <td colSpan={6}>
                        <div className="p-3 bg-slate-50 rounded-md space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600">Nhận vào kho:</label>
                            <select
                              className="ipc-input w-56"
                              value={effectiveWarehouseId}
                              onChange={(e) => setReceiveWarehouseId(e.target.value)}
                            >
                              {warehouses.map((w) => (
                                <option key={w.warehouseId} value={w.warehouseId}>{w.warehouseName}</option>
                              ))}
                            </select>
                          </div>
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
                          <div className="text-xs text-slate-500">Ghi nhận sẽ đồng thời cập nhật tồn kho thực tế của kho đã chọn.</div>
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
        </div>
      </div>
    </div>
  );
}
