import { ClipboardList } from 'lucide-react'
import { DocumentRail, EmptyState, SectionPanel } from '@/components/common'
import { StockMovementTable } from '@/components/common/StockMovementTable'
import type { StockMovement, WorkflowDocument } from '@/types/workflow'
import { typography } from '@/lib/typography'
import { cn } from '@/lib/utils'

type Props = {
  movements: StockMovement[]
  documents: WorkflowDocument[]
  isError?: boolean
  isRetrying?: boolean
  onRetry?: () => unknown
}

export function ChefDocumentsSection({ movements, documents, isError = false, isRetrying, onRetry }: Props) {
  return (
    <SectionPanel title="Kế hoạch, bàn giao và phiếu trả" icon={<ClipboardList size={18} />} className={cn(typography.body, 'ipc-chef-documents-panel')}>
      <div className="flex flex-col gap-3">
        {isError && onRetry ? (
          <EmptyState
            variant="error"
            title="Không tải được chứng từ và luân chuyển của bếp"
            description="Vui lòng thử tải lại để nạp chứng từ và luân chuyển của bếp."
            onRetry={onRetry}
            isRetrying={isRetrying}
          />
        ) : movements.length === 0 && documents.length === 0 ? (
          <EmptyState
            title="Chưa có bàn giao, luân chuyển hoặc phiếu trả trong ca này."
            description="Các chứng từ sẽ xuất hiện tại đây sau khi kho bàn giao hoặc bếp lập phiếu trả."
          />
        ) : (
          <>
            {movements.length > 0 ? <StockMovementTable movements={movements} /> : <EmptyState title="Chưa có bút toán kho trong ca này." />}
            {documents.length > 0 ? <DocumentRail documents={documents} title="Phiếu trả kho" /> : <EmptyState title="Chưa có phiếu trả kho trong ca này." />}
          </>
        )}
      </div>
    </SectionPanel>
  )
}
