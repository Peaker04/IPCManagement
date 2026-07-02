import { useState } from 'react';
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
  useSubmitPurchaseRequestMutation,
  useUpdatePurchaseRequestLineSupplierMutation,
} from '@/features/workflow';
import type { DemandLine, SupplierDto } from '@/features/workflow';

export default function PurchasingPage() {
  const [activeView, setActiveView] = useState<'demand' | 'supplier' | 'handoff'>('demand');
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 100 });
  const { data: purchaseDemandLines = [] } = useGetPurchaseDemandQuery({ limit: 100 });
  const { data: stockMovements = [] } = useGetStockMovementsQuery({ limit: 100 });
  const { data: priceRows = [] } = useGetPriceVarianceQuery({ limit: 100 });

  const { data: suppliers = [] } = useGetSuppliersQuery();
  const [updateSupplier] = useUpdatePurchaseRequestLineSupplierMutation();
  const [submitPurchaseRequest, { isLoading: isSubmittingPurchaseRequest }] = useSubmitPurchaseRequestMutation();
  const purchasingDocuments = workflowDocuments.filter((document) => document.type === 'Đơn mua' || document.type === 'Danh sách mua thêm');
  const receiptMovements = stockMovements.filter((movement) => movement.type === 'receipt');
  const warningPrice = priceRows.find((row) => row.warning);
  const primaryPurchaseDemand = purchaseDemandLines.find((line) => line.tone === 'danger') ?? purchaseDemandLines[0];
  const submitTargetId = primaryPurchaseDemand?.purchaseRequestId;
  const purchaseSummaryDocument = purchasingDocuments.find((document) => document.type === 'Danh sách mua thêm')
    ?? purchasingDocuments[0];

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
          { id: 'purchasing-handoff', label: 'Handoff kho' },
        ]}
        activeTab={`purchasing-${activeView}`}
        onTabChange={(id) => setActiveView(id.replace('purchasing-', '') as 'demand' | 'supplier' | 'handoff')}
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
                    <th>Ngày giao</th>
                    <th>Ghi chú</th>
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
                    <tr><td colSpan={8} className="text-center text-slate-500 py-4">Không có nhu cầu mua thêm nào</td></tr>
                  )}
                </tbody>
              </table>
            </div>
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
          onChange={(e) => setSelectedSupplierId(e.target.value)}
        >
          <option value="">-- Chọn Nhà cung cấp --</option>
          {suppliers.map(s => (
            <option key={s.supplierId} value={s.supplierId}>{s.supplierName}</option>
          ))}
        </select>
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
