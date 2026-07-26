import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DemandSummary, DocumentRail, PaginationBar, SectionPanel, SplitWorkbench } from '@/components/common';
import type { WorkflowDocument } from '@/features/workflow';
import type { usePurchaseDemand } from './usePurchaseDemand';

type PurchaseDemandWorkflow = ReturnType<typeof usePurchaseDemand>;

export function PurchaseDemandSection({
  workflow,
  documents,
}: {
  workflow: PurchaseDemandWorkflow;
  documents: WorkflowDocument[];
}) {
  return (
    <div id="purchasing-demand-panel" role="tabpanel" aria-labelledby="purchasing-demand-tab">
      <SplitWorkbench
        detailLabel="Đơn mua"
        detail={
          <DocumentRail
            documents={documents}
            title={null}
            actionForDocument={(document) => (
              <Link className="ipc-button ipc-button-ghost" to={document.route}>Xem đơn mua</Link>
            )}
          />
        }
      >
        <SectionPanel title="Kế hoạch thu mua dự kiến" icon={<ShoppingCart size={18} />}>
          <DemandSummary lines={workflow.presentation.purchasePlanLines} />
          <PaginationBar
            page={workflow.planPage.response?.pageNumber ?? workflow.planPage.page}
            pageSize={workflow.planPage.response?.pageSize ?? 8}
            totalItems={workflow.planPage.response?.totalCount ?? 0}
            onPageChange={workflow.planPage.setPage}
          />
        </SectionPanel>
      </SplitWorkbench>
    </div>
  );
}
