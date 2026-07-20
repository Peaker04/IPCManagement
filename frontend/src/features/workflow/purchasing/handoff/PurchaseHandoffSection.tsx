import { PackageCheck } from 'lucide-react';
import { SectionPanel, StockMovementTable } from '@/components/common';
import type { usePurchaseHandoff } from './usePurchaseHandoff';

type PurchaseHandoffWorkflow = ReturnType<typeof usePurchaseHandoff>;

export function PurchaseHandoffSection({ workflow }: { workflow: PurchaseHandoffWorkflow }) {
  return (
    <SectionPanel title="Bàn giao sang kho" icon={<PackageCheck size={18} />}>
      <div id="purchasing-handoff-panel" role="tabpanel" aria-labelledby="purchasing-handoff-tab">
        <StockMovementTable movements={workflow.movements} cursorPagination={{ page: workflow.page, hasNext: workflow.response?.hasNext ?? false, onPrevious: workflow.previous, onNext: workflow.next }} />
      </div>
    </SectionPanel>
  );
}
