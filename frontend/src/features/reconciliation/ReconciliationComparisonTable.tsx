import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatQuantity, formatUnit } from '@/lib/formatters'
import { PaginationBar, SearchField, StatusBadge, TableViewport } from '@/components/common'
import { reconciliationStatusRegistry } from '@/lib/status/statusRegistry'
import type { StatusPresentation } from '@/lib/statusPresentation'
import { typography } from '@/lib/typography'
import { cn } from '@/lib/utils'
import { useLocalPagination } from '@/lib/useLocalPagination'
import type { ReconciliationLine } from '@/api/reconciliationApi'

function getReconciliationLineStatus(status: string, hasDifference: boolean, hasDisposition: boolean): StatusPresentation {
  if (status === 'MATCHED') {
    return hasDifference ? reconciliationStatusRegistry.MATCHED_THRESHOLD : reconciliationStatusRegistry.MATCHED
  }
  if (hasDisposition) {
    return reconciliationStatusRegistry.DISPOSED
  }
  if (status === 'NEEDS_REVIEW') {
    return reconciliationStatusRegistry.NEEDS_REVIEW
  }
  return reconciliationStatusRegistry.UNDER_ISSUED
}

function CompactQuantity({ quantity, unit, isDifference = false }: { quantity: number | null | undefined; unit?: string | null; isDifference?: boolean }) {
  if (quantity == null) return <>Chưa xuất</>
  const formattedUnit = unit ? formatUnit(unit) : ''
  const suffix = formattedUnit ? ` ${formattedUnit}` : ''
  const prefix = isDifference && quantity > 0 ? '+' : ''
  const formatted = `${prefix}${formatQuantity(quantity)}${suffix}`
  const colorClass = isDifference
    ? quantity > 0
      ? 'text-amber-700 font-semibold'
      : quantity < 0
      ? 'text-rose-700 font-semibold'
      : 'text-slate-600'
    : ''
  return <span className={colorClass} title={`Giá trị chính xác: ${prefix}${formatQuantity(quantity, { maximumFractionDigits: 6 })}${suffix}`}>{formatted}</span>
}

export function ReconciliationComparisonTable({ lines, showAll = false, onDetail }: {
  lines: ReconciliationLine[]
  showAll?: boolean
  onDetail?: (line: ReconciliationLine) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEEDS_REVIEW' | 'DISPOSED' | 'MATCHED'>('ALL')
  const [pageSize, setPageSize] = useState(15)

  const baseLines = useMemo(() => {
    return showAll ? lines : lines.filter((line) => line.status !== 'MATCHED')
  }, [lines, showAll])

  const filteredLines = useMemo(() => {
    return baseLines.filter((line) => {
      if (statusFilter === 'NEEDS_REVIEW') {
        if (line.status !== 'NEEDS_REVIEW' || line.disposition) return false
      } else if (statusFilter === 'DISPOSED') {
        if (!line.disposition) return false
      } else if (statusFilter === 'MATCHED') {
        if (line.status !== 'MATCHED') return false
      }

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase()
        const nameMatch = line.ingredientName?.toLowerCase().includes(query)
        const codeMatch = line.ingredientCode?.toLowerCase().includes(query)
        if (!nameMatch && !codeMatch) return false
      }

      return true
    })
  }, [baseLines, statusFilter, searchTerm])

  const pagination = useLocalPagination(filteredLines, pageSize)

  const needsReviewCount = useMemo(() => lines.filter((l) => l.status === 'NEEDS_REVIEW' && !l.disposition).length, [lines])
  const disposedCount = useMemo(() => lines.filter((l) => Boolean(l.disposition)).length, [lines])
  const matchedCount = useMemo(() => lines.filter((l) => l.status === 'MATCHED').length, [lines])

  return (
    <div className="space-y-3">
      {/* Search & Status Quick Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5">
        <div className="w-full sm:w-auto">
          <SearchField
            id="reconciliation-ingredient-search"
            label="Tìm kiếm nguyên liệu"
            placeholder="Tìm theo tên hoặc mã nguyên liệu..."
            hideLabel
            width="standard"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              pagination.resetPage()
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Lọc trạng thái nguyên liệu">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-7 rounded-md px-2.5 text-xs font-semibold',
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white'
                : 'bg-white text-slate-700 hover:border-slate-300',
            )}
            onClick={() => {
              setStatusFilter('ALL')
              pagination.resetPage()
            }}
          >
            Tất cả ({baseLines.length})
          </Button>
          {needsReviewCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-semibold',
                statusFilter === 'NEEDS_REVIEW'
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-amber-200 bg-white text-amber-800 hover:bg-amber-50',
              )}
              onClick={() => {
                setStatusFilter('NEEDS_REVIEW')
                pagination.resetPage()
              }}
            >
              Cần kiểm tra ({needsReviewCount})
            </Button>
          )}
          {disposedCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-semibold',
                statusFilter === 'DISPOSED'
                  ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-700 hover:text-white'
                  : 'border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300',
              )}
              onClick={() => {
                setStatusFilter('DISPOSED')
                pagination.resetPage()
              }}
            >
              Đã xử lý ({disposedCount})
            </Button>
          )}
          {showAll && matchedCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                'h-7 rounded-md px-2.5 text-xs font-semibold',
                statusFilter === 'MATCHED'
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 hover:text-white'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300',
              )}
              onClick={() => {
                setStatusFilter('MATCHED')
                pagination.resetPage()
              }}
            >
              Khớp ({matchedCount})
            </Button>
          )}
        </div>
      </div>

      <TableViewport ariaLabel="Kết quả đối chiếu nguyên liệu" caption="Bảng so sánh nhu cầu và lượng đã xuất theo nguyên liệu.">
      <Table aria-label="Kết quả đối chiếu nguyên liệu">
        <caption className="sr-only">Kết quả đối chiếu nguyên liệu</caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Nguyên liệu</TableHead>
            <TableHead scope="col" className="text-right">Cần xuất</TableHead>
            <TableHead scope="col" className="text-right">Đã xuất kho</TableHead>
            <TableHead scope="col" className="text-right">Sai lệch</TableHead>
            <TableHead scope="col">Kết quả</TableHead>
            <TableHead scope="col" className="w-28">Chi tiết</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pagination.rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-600">
                {searchTerm
                  ? `Không tìm thấy nguyên liệu nào khớp với từ khóa "${searchTerm}".`
                  : 'Không có dòng cần xử lý. Chọn “Hiện tất cả” để xem các dòng đã khớp.'}
              </TableCell>
            </TableRow>
          ) : (
            pagination.rows.map((line) => {
              const unit = line.canonicalUnitName ?? undefined
              const difference = line.issuedQuantity == null
                ? null
                : line.issuedRequiredDifference ?? line.issuedQuantity - line.requiredQuantity
              const rowHighlight = undefined
              return (
                <TableRow key={line.batchLineId} className={rowHighlight}>
                  <TableCell>
                    <span className="block font-medium text-slate-900">{line.ingredientName || 'Nguyên liệu chưa đặt tên'}</span>
                    {line.ingredientCode && <span className={cn('block text-xs text-slate-500 tabular-nums', typography.code)}>{line.ingredientCode}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums"><CompactQuantity quantity={line.requiredQuantity} unit={unit} /></TableCell>
                  <TableCell className="text-right tabular-nums"><CompactQuantity quantity={line.issuedQuantity} unit={unit} /></TableCell>
                  <TableCell className="text-right tabular-nums"><CompactQuantity quantity={difference} unit={unit} isDifference /></TableCell>
                  <TableCell>
                    {(() => {
                      const lineStatus = getReconciliationLineStatus(line.status, Boolean(difference), Boolean(line.disposition));
                      return (
                        <StatusBadge size="sm" tone={lineStatus.tone}>
                          {lineStatus.label}
                        </StatusBadge>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {onDetail && <Button type="button" variant="outline" size="xs" className="w-full" onClick={() => onDetail(line)}>Thao tác</Button>}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
      </TableViewport>

      {/* Pagination Footer */}
      {filteredLines.length > 0 && (
        <div className="border-t border-slate-200/80 pt-3">
          <PaginationBar
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            onPageChange={pagination.setPage}
            pageSizeOptions={[10, 15, 25, 50]}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              pagination.resetPage()
            }}
            itemLabel="nguyên liệu"
          />
        </div>
      )}
    </div>
  )
}
