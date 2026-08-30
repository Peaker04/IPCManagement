import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { StatusBadge } from '@/components/common/StatusBadge'
import { TableSkeleton } from '@/components/common/TableSkeleton'
import { TableEmptyState } from '@/components/common/TableEmptyState'
import { formatQuantity } from '@/lib/formatters'
import { getReconciliationLineStatusPresentation } from '@/lib/workflowConfig'
import type { ReconciliationLine } from './reconciliationApi'

export function ReconciliationComparisonTable({
  lines,
  showAll = false,
  isLoading = false,
  onEdit,
  onDisposition,
}: {
  lines: ReconciliationLine[]
  showAll?: boolean
  isLoading?: boolean
  onEdit?: (line: ReconciliationLine) => void
  onDisposition?: (line: ReconciliationLine) => void
}) {
  const visible = showAll ? lines : lines.filter((line) => line.status !== 'MATCHED')

  if (isLoading) {
    return (
      <TableSkeleton
        columns={[
          { width: '180px', align: 'left' },
          { width: '110px', align: 'right' },
          { width: '110px', align: 'right' },
          { width: '110px', align: 'right' },
          { width: '110px', align: 'right' },
          { width: '110px', align: 'right' },
          { width: '110px', align: 'right' },
          { width: '130px', align: 'left' },
          { width: '140px', align: 'left' },
        ]}
        rows={6}
        ariaLabel="Đang tải kết quả đối chiếu nguyên liệu..."
      />
    )
  }

  if (visible.length === 0) {
    return (
      <TableEmptyState
        title={showAll ? 'Chưa có dòng nguyên liệu nào' : 'Không có dòng lệch số liệu'}
        description={showAll ? 'Lô đối chiếu này chưa có dòng nguyên liệu nào.' : 'Toàn bộ dòng nguyên liệu trong lô đối chiếu đều khớp 100%.'}
      />
    )
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Table aria-label="Kết quả đối chiếu nguyên liệu">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Nguyên liệu</TableHead>
              <TableHead className="text-right w-[110px]">Cần</TableHead>
              <TableHead className="text-right w-[110px]">Đã mua</TableHead>
              <TableHead className="text-right w-[110px]">Đã xuất</TableHead>
              <TableHead className="text-right w-[110px]">Mua − cần</TableHead>
              <TableHead className="text-right w-[110px]">Xuất − cần</TableHead>
              <TableHead className="text-right w-[110px]">Mua − xuất</TableHead>
              <TableHead className="w-[130px]">Kết quả</TableHead>
              <TableHead className="w-[140px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((line) => {
              const statusPres = getReconciliationLineStatusPresentation(line.status)
              const lineLabel = `dòng …${line.ingredientId.slice(-8)}`

              return (
                <TableRow key={line.batchLineId}>
                  <TableCell title={`Mã nguyên liệu: ${line.ingredientId}`} className="font-medium text-slate-900">
                    …{line.ingredientId.slice(-8)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(line.requiredQuantity, { maximumFractionDigits: 6 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.purchasedQuantity == null ? (
                      <span className="text-slate-400">Chưa nhập</span>
                    ) : (
                      formatQuantity(line.purchasedQuantity, { maximumFractionDigits: 6 })
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {line.issuedQuantity == null ? (
                      <span className="text-slate-400">Chưa nhập</span>
                    ) : (
                      formatQuantity(line.issuedQuantity, { maximumFractionDigits: 6 })
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-mono text-xs">
                    {line.purchasedRequiredDifference == null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      formatQuantity(line.purchasedRequiredDifference, { maximumFractionDigits: 6 })
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-mono text-xs">
                    {line.issuedRequiredDifference == null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      formatQuantity(line.issuedRequiredDifference, { maximumFractionDigits: 6 })
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-mono text-xs">
                    {line.purchasedIssuedDifference == null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      formatQuantity(line.purchasedIssuedDifference, { maximumFractionDigits: 6 })
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={statusPres.tone} size="sm">
                      {statusPres.label}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {onEdit && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-blue-700 hover:underline"
                          aria-label={`Cập nhật số liệu cho ${lineLabel}`}
                          onClick={() => onEdit(line)}
                        >
                          Cập nhật số liệu
                        </Button>
                      )}
                      {onDisposition && line.status === 'NEEDS_REVIEW' && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-blue-700 hover:underline"
                          aria-label={`${line.disposition ? 'Sửa xử lý' : 'Xử lý chênh lệch'} cho ${lineLabel}`}
                          onClick={() => onDisposition(line)}
                        >
                          {line.disposition ? 'Sửa xử lý' : 'Xử lý chênh lệch'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {visible.length === 0 && (
        <p className="p-4 text-center text-sm text-slate-500 bg-slate-50 rounded-md border border-dashed border-slate-200">
          Không có dòng cần kiểm tra.
        </p>
      )}
    </div>
  )
}
