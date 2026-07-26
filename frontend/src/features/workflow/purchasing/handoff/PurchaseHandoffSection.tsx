import { PackageCheck } from 'lucide-react';
import { EmptyState, SectionPanel, StockMovementTable } from '@/components/common';
import type { usePurchaseHandoff } from './usePurchaseHandoff';

type PurchaseHandoffWorkflow = ReturnType<typeof usePurchaseHandoff>;

export function PurchaseHandoffSection({ workflow }: { workflow: PurchaseHandoffWorkflow }) {
  return (
    <SectionPanel title="Bàn giao sang kho" icon={<PackageCheck size={18} />}>
      <div id="purchasing-handoff-panel" role="tabpanel" aria-labelledby="purchasing-handoff-tab">
        {workflow.isError ? (
          <EmptyState
            variant="error"
            title="Không tải được sổ bàn giao sang kho"
            description="Danh sách trống ở đây là do lỗi tải dữ liệu, không phải vì chưa có lần nhập kho nào. Hãy tải lại trước khi đối chiếu tiến độ nhận hàng."
            onRetry={workflow.retry}
            isRetrying={workflow.isRetrying}
          />
        ) : (
          <StockMovementTable movements={workflow.movements} cursorPagination={{ page: workflow.page, hasNext: workflow.response?.hasNext ?? false, onPrevious: workflow.previous, onNext: workflow.next }} />
        )}
      </div>
    </SectionPanel>
  );
}
