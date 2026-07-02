import { useState, type FormEvent } from 'react';
import { PackageCheck, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CommandBar,
  ContextStrip,
  DemandSummary,
  DocumentRail,
  OperationalFrame,
  SectionPanel,
  SplitWorkbench,
  StockMovementTable,
  ViewSwitcher,
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
} from '@/features/workflow';
import type { DemandLine, SupplierDto, SupplierQuotationDto } from '@/features/workflow';
import { useGetIngredientsQuery, type IngredientLookup } from '@/features/projects/dishCatalogApi';

export default function PurchasingPage() {
  const [activeView, setActiveView] = useState<'demand' | 'supplier' | 'quotation' | 'handoff'>('demand');
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
          { id: 'purchasing-handoff', label: 'Handoff kho' },
        ]}
        activeTab={`purchasing-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('purchasing-', '') as 'demand' | 'supplier' | 'quotation' | 'handoff')}
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
            <div className="ipc-table-container mt-4">
              <table className="ipc-table">
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
          estimatedUnitPrice: estimatedPrice
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
          <div className="ipc-table-container">
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
          </div>

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
