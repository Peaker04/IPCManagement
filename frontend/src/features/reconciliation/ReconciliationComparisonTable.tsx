import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatQuantity } from '@/lib/formatters'
import type { ReconciliationLine } from '@/api/reconciliationApi'

function CompactQuantity({ quantity, unit }: { quantity: number | null | undefined; unit?: string | null }) {
  if (quantity == null) return <>Chưa xuất</>
  const suffix = unit ? ` ${unit}` : ''
  return <span title={`Giá trị chính xác: ${formatQuantity(quantity, { maximumFractionDigits: 6 })}${suffix}`}>{formatQuantity(quantity)}{suffix}</span>
}

export function ReconciliationComparisonTable({ lines, showAll = false, onDisposition, onDetail }: {
  lines: ReconciliationLine[]
  showAll?: boolean
  onDisposition?: (line: ReconciliationLine) => void
  onDetail?: (line: ReconciliationLine) => void
}) {
  const visible = showAll ? lines : lines.filter((line) => line.status !== 'MATCHED')
  return <div>
    <Table aria-label="Kết quả đối chiếu nguyên liệu">
      <TableHeader><TableRow>
        <TableHead>Nguyên liệu</TableHead>
        <TableHead className="text-right">Cần xuất</TableHead>
        <TableHead className="text-right">Đã xuất kho</TableHead>
        <TableHead className="text-right">Sai lệch</TableHead>
        <TableHead>Kết quả</TableHead>
        <TableHead>Thao tác</TableHead>
      </TableRow></TableHeader>
      <TableBody>{visible.map((line) => {
        const unit = line.canonicalUnitName ?? undefined
        const difference = line.issuedRequiredDifference ?? ((line.issuedQuantity ?? 0) - line.requiredQuantity)
        return <TableRow key={line.batchLineId}>
          <TableCell><span className="block font-medium text-slate-900">{line.ingredientName || 'Nguyên liệu chưa đặt tên'}</span>{line.ingredientCode && <span className="block text-xs text-slate-600">{line.ingredientCode}</span>}</TableCell>
          <TableCell className="text-right tabular-nums"><CompactQuantity quantity={line.requiredQuantity} unit={unit} /></TableCell>
          <TableCell className="text-right tabular-nums"><CompactQuantity quantity={line.issuedQuantity} unit={unit} /></TableCell>
          <TableCell className="text-right tabular-nums"><CompactQuantity quantity={difference} unit={unit} /></TableCell>
          <TableCell>{line.status === 'MATCHED' ? 'Khớp' : line.status === 'NEEDS_REVIEW' ? 'Cần kiểm tra' : 'Chưa xuất đủ'}</TableCell>
          <TableCell><div className="flex flex-col items-start gap-1">
            {onDetail && <Button type="button" variant="link" className="h-auto p-0" onClick={() => onDetail(line)}>Xem chi tiết</Button>}
            {onDisposition && line.status === 'NEEDS_REVIEW' && <Button type="button" variant="link" className="h-auto p-0" onClick={() => onDisposition(line)}>{line.disposition ? 'Sửa xử lý' : 'Xử lý chênh lệch'}</Button>}
          </div></TableCell>
        </TableRow>
      })}</TableBody>
    </Table>
    {visible.length === 0 && <p className="p-4 text-sm text-slate-600">Không có dòng cần xử lý. Chọn “Hiện tất cả” để xem các dòng đã khớp.</p>}
  </div>
}
