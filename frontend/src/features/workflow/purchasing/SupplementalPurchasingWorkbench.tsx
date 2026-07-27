import { useMemo, useState } from 'react';
import { ChefHat } from 'lucide-react';
import { InlineAlert, SectionPanel, StatusBadge, TableViewport } from '@/components/common';
import { Button } from '@/components/ui/button';
import { formatQuantityWithUnit } from '@/lib/formatters';
import { formatWorkflowStatus } from '@/lib/workflowConfig';
import {
  useGetPurchaseOrdersQuery,
  useGetPurchaseRequestsQuery,
  useGetSupplementalMaterialRequestsQuery,
  type PurchaseRequestWorkflowLine,
  type PurchaseWorkbenchServiceDate,
} from '@/api/workflowApi';
import { PurchaseDecisionPanel } from './PurchaseDecisionPanel';
import type { PurchasingStageId } from './purchasingModel';

const isSupplierReady = (line?: {
  currentSupplierDecision?: unknown;
  supplierId?: string | null;
  estimatedUnitPrice: number;
  expectedDeliveryDate?: string | null;
}) => Boolean(
  line?.currentSupplierDecision ||
  (line?.supplierId && line.estimatedUnitPrice > 0 && line.expectedDeliveryDate),
);

const resolveStage = (status: string, line?: PurchaseRequestWorkflowLine, hasOrders = false): PurchasingStageId => {
  const normalized = status.toUpperCase();
  if (normalized === 'DRAFT') return isSupplierReady(line) ? 'submitted' : 'supplier-price';
  if (normalized === 'SENTTOSUPPLIER') return 'submitted';
  if (normalized === 'APPROVED') return hasOrders ? 'receiving' : 'approved-order';
  return 'receiving';
};

export function SupplementalPurchasingWorkbench({ week }: { week: string }) {
  const supplementalQuery = useGetSupplementalMaterialRequestsQuery({ pageNumber: 1, pageSize: 100 });
  const purchaseQuery = useGetPurchaseRequestsQuery();
  const orderQuery = useGetPurchaseOrdersQuery();
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const supplementalItems = useMemo(
    () => (supplementalQuery.data?.items ?? []).filter((item) => item.purchaseRequestId && item.remainingQty > 0),
    [supplementalQuery.data?.items],
  );
  const purchaseRequests = purchaseQuery.data?.data ?? [];
  const purchaseOrders = orderQuery.data ?? [];

  const effectiveSelectedRequestId = selectedRequestId && supplementalItems.some((item) => item.requestId === selectedRequestId)
    ? selectedRequestId
    : supplementalItems[0]?.requestId;
  const selectedSupplemental = supplementalItems.find((item) => item.requestId === effectiveSelectedRequestId);
  const selectedPurchaseRequest = purchaseRequests.find((item) => item.purchaseRequestId === selectedSupplemental?.purchaseRequestId);
  const selectedOrders = purchaseOrders.filter((item) => item.purchaseRequestId === selectedPurchaseRequest?.purchaseRequestId);
  const selectedLine = useMemo<PurchaseRequestWorkflowLine | undefined>(() => {
    const line = selectedPurchaseRequest?.lines[0];
    if (!line) return undefined;
    return {
      ...line,
      supplierDecisionStatus: line.supplierDecisionStatus ?? (isSupplierReady(line) ? 'READY' : 'BLOCKED'),
      currentSupplierDecision: line.currentSupplierDecision ?? null,
      supplierDecisionHistory: line.supplierDecisionHistory ?? [],
    };
  }, [selectedPurchaseRequest]);
  const selectedStage = resolveStage(selectedPurchaseRequest?.status ?? 'DRAFT', selectedLine, selectedOrders.length > 0);
  const serviceDate = useMemo<PurchaseWorkbenchServiceDate | undefined>(() => {
    if (!selectedPurchaseRequest || !selectedSupplemental) return undefined;
    return {
      serviceDate: selectedPurchaseRequest.purchaseForDate,
      scope: selectedPurchaseRequest.shiftName || 'FULLDAY',
      currentStage: selectedStage,
      approvedDemandCount: 1,
      shortageLineCount: 1,
      supplierReadyLineCount: isSupplierReady(selectedLine) ? 1 : 0,
      blockingExceptionCount: 0,
      purchaseRequestId: selectedPurchaseRequest.purchaseRequestId,
      purchaseRequestCode: selectedPurchaseRequest.purchaseRequestCode,
      purchaseRequestStatus: selectedPurchaseRequest.status,
      orderCount: selectedOrders.length,
      receivingLineCount: selectedOrders.reduce((count, order) => count + order.lines.length, 0),
      fullyReceivedLineCount: selectedOrders.reduce(
        (count, order) => count + order.lines.filter((line) => line.receivedQty >= line.orderedQty).length,
        0,
      ),
      approvedDemands: [],
      purchaseLines: selectedLine ? [selectedLine] : [],
    };
  }, [selectedLine, selectedOrders, selectedPurchaseRequest, selectedStage, selectedSupplemental]);

  if (supplementalQuery.isError || purchaseQuery.isError || orderQuery.isError) {
    return (
      <InlineAlert title="Không tải được nhu cầu mua bổ sung từ bếp" variant="danger">
        Không thể chọn nhà cung cấp khi yêu cầu bổ sung hoặc đề xuất mua chưa tải thành công. Hãy thử tải lại trang.
      </InlineAlert>
    );
  }
  if (supplementalItems.length === 0) return null;

  return (
    <SectionPanel
      title="Nhu cầu mua bổ sung từ bếp"
      icon={<ChefHat size={18} aria-hidden="true" />}
      description="Các yêu cầu kho không đủ hàng. Chọn một dòng để hoàn tất nhà cung cấp, gửi duyệt và tạo đơn mua."
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <TableViewport ariaLabel="Danh sách nhu cầu mua bổ sung từ bếp" caption="Đề xuất mua được liên kết với yêu cầu bổ sung và phiếu xuất gốc.">
          <table className="ipc-data-table min-w-[760px]">
            <thead><tr><th>Yêu cầu bếp</th><th>Nguyên liệu</th><th>Còn thiếu</th><th>Đề xuất mua</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>{supplementalItems.map((item) => {
              const purchase = purchaseRequests.find((candidate) => candidate.purchaseRequestId === item.purchaseRequestId);
              const selected = item.requestId === effectiveSelectedRequestId;
              return (
                <tr key={item.requestId} className={selected ? 'bg-blue-50/60' : undefined}>
                  <td><span className="block font-semibold text-slate-950">{item.requestCode}</span><span className="text-xs text-slate-600">Từ {item.issueCode}</span></td>
                  <td>{item.ingredientName}</td>
                  <td>{formatQuantityWithUnit(item.remainingQty, item.unitName)}</td>
                  <td>{item.purchaseRequestCode || 'Đang tạo liên kết'}</td>
                  <td><StatusBadge variant={purchase?.status === 'DRAFT' ? 'warning' : 'neutral'}>{formatWorkflowStatus(purchase?.status || item.status)}</StatusBadge></td>
                  <td><Button type="button" size="sm" variant={selected ? 'default' : 'outline'} aria-pressed={selected} onClick={() => setSelectedRequestId(item.requestId)}>{selected ? 'Đang xử lý' : 'Mở xử lý'}</Button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </TableViewport>

        {serviceDate && selectedLine ? (
          <PurchaseDecisionPanel
            key={`${serviceDate.purchaseRequestId}-${selectedLine.purchaseRequestLineId}-${selectedStage}`}
            week={week}
            selectedStage={selectedStage}
            serviceDate={serviceDate}
            selectedLine={selectedLine}
          />
        ) : (
          <InlineAlert title="Đang đồng bộ đề xuất mua" variant="info">
            Yêu cầu đã được kho chuyển sang thu mua nhưng chi tiết đề xuất chưa tải xong.
          </InlineAlert>
        )}
      </div>
    </SectionPanel>
  );
}
