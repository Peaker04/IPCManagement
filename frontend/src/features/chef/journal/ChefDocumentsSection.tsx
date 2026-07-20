import { ClipboardList } from 'lucide-react'
import { DocumentRail, SectionPanel, StockMovementTable } from '@/components/common'
import type { StockMovement, WorkflowDocument } from '@/features/workflow'

type Props = { movements: StockMovement[]; documents: WorkflowDocument[] }

export function ChefDocumentsSection({ movements, documents }: Props) {
  return (
    <SectionPanel title="Kế hoạch, bàn giao và phiếu trả" icon={<ClipboardList size={18} />} className="ipc-chef-documents-panel">
      <div id="chef-documents-panel" role="tabpanel" aria-labelledby="chef-documents-tab">
        <div className="flex flex-col gap-3">
          <StockMovementTable movements={movements} />
          <DocumentRail documents={documents} title="Phiếu trả kho" />
        </div>
      </div>
    </SectionPanel>
  )
}
