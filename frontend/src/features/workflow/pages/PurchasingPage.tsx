import { useState } from 'react';
import { PackageCheck, ShoppingCart } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { CommandBar, ContextStrip, OperationalFrame, ViewSwitcher } from '@/components/common';
import { ROUTES } from '@/routes/routeConfig';
import { useGetPriceVariancePageQuery, useGetWorkflowDocumentsQuery } from '@/features/workflow';
import { formatWorkflowStatus } from '../workflowConfig';
import { CreatePurchaseRequestDialog } from '../purchasing/demand/CreatePurchaseRequestDialog';
import { PurchaseDemandSection } from '../purchasing/demand/PurchaseDemandSection';
import { usePurchaseDemand } from '../purchasing/demand/usePurchaseDemand';
import { PurchaseHandoffSection } from '../purchasing/handoff/PurchaseHandoffSection';
import { usePurchaseHandoff } from '../purchasing/handoff/usePurchaseHandoff';
import { PurchaseOrderSection } from '../purchasing/orders/PurchaseOrderSection';
import { usePurchaseOrders } from '../purchasing/orders/usePurchaseOrders';
import { SupplierQuotationSection } from '../purchasing/quotation/SupplierQuotationSection';
import { useSupplierQuotations } from '../purchasing/quotation/useSupplierQuotations';
import { PurchaseSupplierSection } from '../purchasing/supplier/PurchaseSupplierSection';
import { usePurchaseSupplier } from '../purchasing/supplier/usePurchaseSupplier';

type PurchasingView = 'demand' | 'supplier' | 'quotation' | 'orders' | 'handoff';
const validPurchasingViews: PurchasingView[] = ['demand', 'supplier', 'quotation', 'orders', 'handoff'];

export default function PurchasingPage() {
  const [searchParams] = useSearchParams();
  const initialView = searchParams.get('view');
  const [activeView, setActiveView] = useState<PurchasingView>(
    validPurchasingViews.includes(initialView as PurchasingView) ? (initialView as PurchasingView) : 'demand',
  );
  const demandWorkflow = usePurchaseDemand(() => setActiveView('supplier'));
  const supplierWorkflow = usePurchaseSupplier();
  const quotationWorkflow = useSupplierQuotations();
  const orderWorkflow = usePurchaseOrders();
  const handoffWorkflow = usePurchaseHandoff();
  const { data: workflowDocuments = [] } = useGetWorkflowDocumentsQuery({ limit: 20 });
  const { data: priceVariancePage } = useGetPriceVariancePageQuery({ pageNumber: 1, pageSize: 8 });

  const purchasingDocuments = workflowDocuments.filter((document) => document.type === 'Đơn mua');
  const purchaseSummaryDocument = purchasingDocuments[0];
  const warningPrice = priceVariancePage?.items.find((row) => row.warning);
  const primaryPlan = demandWorkflow.presentation.primaryPlan;
  const primaryRequestLine = demandWorkflow.presentation.primaryRequestLine;

  return (
    <OperationalFrame
      command={
        <CommandBar
          actionsClassName="ipc-purchasing-actions"
          actions={<>
            <button className="ipc-button ipc-button-primary" type="button" onClick={demandWorkflow.command.openCreateDialog}>Tạo đề xuất mua</button>
            <button
              className="ipc-button ipc-button-primary"
              type="button"
              onClick={() => void demandWorkflow.command.submitPurchaseRequest()}
              disabled={!demandWorkflow.command.submitTargetId || demandWorkflow.command.isSubmitting}
            >
              {demandWorkflow.command.isSubmitting ? 'Đang gửi...' : 'Gửi đơn mua'}
            </button>
            <Link className="ipc-button ipc-button-primary" to={ROUTES.WAREHOUSE}><PackageCheck size={16} />Chuyển sang nhập kho</Link>
          </>}
        >
          <span className="ipc-command-meta"><ShoppingCart size={16} />Kế hoạch thu mua: {purchaseSummaryDocument?.title ?? primaryPlan?.sourceDocumentCode ?? 'Chưa có dữ liệu'}</span>
          <span className="ipc-command-meta">Ngưỡng cảnh báo: 15%</span>
        </CommandBar>
      }
      context={
        <ContextStrip items={[
          { label: 'Trạng thái mua', value: primaryRequestLine ? formatWorkflowStatus(primaryRequestLine.status) : 'Chưa có đơn mua', tone: primaryRequestLine ? 'warning' : 'neutral' },
          { label: 'Cảnh báo giá', value: warningPrice ? `${warningPrice.name} +${warningPrice.change.toFixed(1)}%` : 'Không có', tone: warningPrice ? 'danger' : 'success' },
          { label: 'Bàn giao kho', value: handoffWorkflow.movements.length > 0 ? `${handoffWorkflow.movements.length} phiếu nhập` : 'Chờ phiếu nhập', tone: handoffWorkflow.movements.length > 0 ? 'success' : 'warning' },
          { label: 'Nhà cung cấp đề xuất', value: warningPrice?.supplier ?? primaryPlan?.source ?? 'Chưa có', tone: 'neutral' },
        ]} />
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

      {activeView === 'demand' && <PurchaseDemandSection workflow={demandWorkflow} documents={purchasingDocuments} />}
      {activeView === 'supplier' && <PurchaseSupplierSection workflow={supplierWorkflow} />}
      {activeView === 'quotation' && <SupplierQuotationSection workflow={quotationWorkflow} />}
      {activeView === 'orders' && <PurchaseOrderSection workflow={orderWorkflow} />}
      {activeView === 'handoff' && <PurchaseHandoffSection workflow={handoffWorkflow} />}
      <CreatePurchaseRequestDialog dialog={demandWorkflow.dialog} />
    </OperationalFrame>
  );
}
