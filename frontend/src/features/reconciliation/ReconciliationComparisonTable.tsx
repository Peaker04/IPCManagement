import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatQuantity, formatUnit } from '@/lib/formatters'
import { StatusBadge } from '@/components/common'
import { typography } from '@/lib/typography'
import { cn } from '@/lib/utils'
import type { ReconciliationLine } from '@/api/reconciliationApi'

function CompactQuantity({ quantity, unit }: { quantity: number | null | undefined; unit?: string | null }) {
  if (quantity == null) return <>Chưa xuất</>
  const formattedUnit = unit ? formatUnit(unit) : ''
  const suffix = formattedUnit ? ` ${formattedUnit}` : ''
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
        const difference = line.issuedQuantity == null
          ? null
          : line.issuedRequiredDifference ?? line.issuedQuantity - line.requiredQuantity
        return <TableRow key={line.batchLineId}>
          <TableCell>
            <span className="block font-medium text-slate-900">{line.ingredientName || 'Nguyên liệu chưa đặt tên'}</span>
            {line.ingredientCode && <span className={cn('block text-xs text-slate-500 tabular-nums', typography.code)}>{line.ingredientCode}</span>}
          </TableCell>
          <TableCell className="text-right tabular-nums"><CompactQuantity quantity={line.requiredQuantity} unit={unit} /></TableCell>
          <TableCell className="text-right tabular-nums"><CompactQuantity quantity={line.issuedQuantity} unit={unit} /></TableCell>
          <TableCell className="text-right tabular-nums"><CompactQuantity quantity={difference} unit={unit} /></TableCell>
          <TableCell>
            <StatusBadge
              size="sm"
              variant={line.status === 'MATCHED' ? 'success' : line.status === 'NEEDS_REVIEW' ? 'warning' : 'danger'}
            >
              {line.status === 'MATCHED' ? 'Khớp' : line.status === 'NEEDS_REVIEW' ? 'Cần kiểm tra' : 'Chưa xuất đủ'}
            </StatusBadge>
          </TableCell>
          <TableCell><div className="flex flex-wrap items-center gap-2">
            {onDetail && <Button type="button" variant="outline" size="sm" onClick={() => onDetail(line)}>Chi tiết</Button>}
            {onDisposition && line.status === 'NEEDS_REVIEW' && <Button type="button" variant="secondary" size="sm" onClick={() => onDisposition(line)}>{line.disposition ? 'Cập nhật xử lý' : 'Xử lý chênh lệch'}</Button>}
          </div></TableCell>
        </TableRow>
      })}</TableBody>
    </Table>
    {visible.length === 0 && <p className="p-4 text-sm text-slate-600">Không có dòng cần xử lý. Chọn “Hiện tất cả” để xem các dòng đã khớp.</p>}
  </div>
}
