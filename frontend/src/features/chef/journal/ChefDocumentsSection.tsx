import { ClipboardList } from 'lucide-react'
import { DocumentRail, EmptyState, SectionPanel, StockMovementTable } from '@/components/common'
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
            description="Danh sách trống ở đây là do lỗi tải dữ liệu, không phải vì ca này chưa có phiếu xuất hay phiếu trả. Hãy tải lại trước khi đối chiếu nguyên liệu đã nhận."
            onRetry={onRetry}
            isRetrying={isRetrying}
          />
        ) : (
          <>
            <StockMovementTable movements={movements} />
            <DocumentRail documents={documents} title="Phiếu trả kho" />
          </>
        )}
      </div>
    </SectionPanel>
  )
}
