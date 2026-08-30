import { useState } from 'react'
import { Copy, Check, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TableSkeleton } from '@/components/common/TableSkeleton'
import { TableEmptyState } from '@/components/common/TableEmptyState'
import { getDateTimeFormat } from '@/lib/formatters'
import { getReconciliationBatchStatusPresentation } from '@/lib/workflowConfig'
import type { ReconciliationBatch } from './reconciliationApi'

const createdAtFormat = getDateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

export function ReconciliationBatchTable({
  batches,
  selectedId,
  isLoading = false,
  onSelect,
}: {
  batches: ReconciliationBatch[]
  selectedId?: string
  isLoading?: boolean
  onSelect: (id: string) => void
}) {
  const [copiedId, setCopiedId] = useState<string>()

  const handleCopy = async (batchId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(batchId)
      setCopiedId(batchId)
      setTimeout(() => setCopiedId(undefined), 2000)
    } catch {
      // clipboard write failed silently
    }
  }

  if (isLoading) {
    return (
      <TableSkeleton
        columns={[
          { width: '200px', align: 'left' },
          { width: '140px', align: 'left' },
          { width: '100px', align: 'right' },
          { width: '160px', align: 'right' },
        ]}
        rows={4}
        ariaLabel="Đang tải danh sách lô đối chiếu..."
      />
    )
  }

  if (batches.length === 0) {
    return (
      <TableEmptyState
        title="Chưa có lô đối chiếu nào"
        description="Hiện tại chưa có đợt đối chiếu nguyên liệu nào được tạo trong hệ thống."
        icon={<FileSpreadsheet className="h-5 w-5" />}
      />
    )
  }

  return (
    <Table aria-label="Danh sách lô đối chiếu">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">Lô đối chiếu</TableHead>
          <TableHead className="w-[140px]">Trạng thái</TableHead>
          <TableHead className="text-right w-[100px]">Số dòng</TableHead>
          <TableHead className="text-right w-[160px]">Ngày tạo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {batches.map((batch) => {
          const statusPres = getReconciliationBatchStatusPresentation(batch.status)
          const isSelected = batch.batchId === selectedId
          const isCopied = copiedId === batch.batchId

          return (
            <TableRow
              key={batch.batchId}
              aria-selected={isSelected}
              data-state={isSelected ? 'selected' : undefined}
            >
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 font-medium text-blue-700 hover:underline"
                    title={`Lô đối chiếu ${batch.batchId}`}
                    onClick={() => onSelect(batch.batchId)}
                  >
                    Lô …{batch.batchId.slice(-8)}
                    <span className="sr-only"> ({batch.batchId})</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
                    aria-label={`Sao chép mã lô ${batch.batchId}`}
                    title="Sao chép mã đầy đủ"
                    onClick={(e) => void handleCopy(batch.batchId, e)}
                  >
                    {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge variant={statusPres.tone} size="sm">
                  {statusPres.label}
                </StatusBadge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {batch.lines.length}
              </TableCell>
              <TableCell className="text-right tabular-nums text-slate-600">
                {createdAtFormat.format(new Date(batch.createdAt))}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
