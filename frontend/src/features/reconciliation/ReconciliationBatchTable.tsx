import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getDateTimeFormat } from '@/lib/formatters'
import type { ReconciliationBatch } from './reconciliationApi'

const createdAtFormat = getDateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

export function ReconciliationBatchTable({ batches, selectedId, onSelect }: { batches: ReconciliationBatch[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <Table aria-label="Danh sách lô đối chiếu">
      <TableHeader><TableRow><TableHead>Lô đối chiếu</TableHead><TableHead>Trạng thái</TableHead><TableHead>Số dòng</TableHead><TableHead>Ngày tạo</TableHead></TableRow></TableHeader>
      <TableBody>{batches.map((batch) => (
        <TableRow key={batch.batchId} aria-selected={batch.batchId === selectedId} data-state={batch.batchId === selectedId ? 'selected' : undefined}>
          <TableCell><Button type="button" variant="link" className="h-auto p-0 font-medium" title={`Lô đối chiếu ${batch.batchId}`} onClick={() => onSelect(batch.batchId)}>Lô …{batch.batchId.slice(-8)}<span className="sr-only"> ({batch.batchId})</span></Button></TableCell>
          <TableCell>{batch.status}</TableCell><TableCell>{batch.lines.length}</TableCell><TableCell>{createdAtFormat.format(new Date(batch.createdAt))}</TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  )
}
