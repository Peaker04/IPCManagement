import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DemandSummary, DocumentRail, EmptyState, PaginationBar, SectionPanel, SplitWorkbench } from '@/components/common';
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
          {workflow.error.isPlanError ? (
            <EmptyState
              variant="error"
              title="Không tải được kế hoạch thu mua"
              description="Danh sách trống ở đây là do lỗi tải dữ liệu, không phải vì tuần này không cần mua gì. Hãy tải lại trước khi chốt đề xuất mua."
              onRetry={workflow.error.retryPlan}
              isRetrying={workflow.error.isPlanRetrying}
            />
          ) : <DemandSummary lines={workflow.presentation.purchasePlanLines} />}
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
