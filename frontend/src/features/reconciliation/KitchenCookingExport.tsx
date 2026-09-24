import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { InlineAlert, TableViewport, TabContentSkeleton } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useGetReconciliationKitchenCookingQuery, useLazyGetReconciliationKitchenCookingCsvQuery, useLazyGetReconciliationKitchenCookingXlsxQuery, type ReconciliationKitchenCookingRow } from '@/api/reconciliationApi'
import { formatDateOnly, formatPercent, formatQuantityWithUnit } from '@/lib/formatters'

export function KitchenCookingExport({ batchId }: { batchId: string }) {
  const [open, setOpen] = useState(false)
  const query = useGetReconciliationKitchenCookingQuery(batchId, { skip: !open })
  const [loadCsv, csvState] = useLazyGetReconciliationKitchenCookingCsvQuery()
  const [loadXlsx, xlsxState] = useLazyGetReconciliationKitchenCookingXlsxQuery()

  const rawKitchenError = query.error && 'data' in query.error && typeof query.error.data === 'object' && query.error.data && 'message' in query.error.data
    ? String(query.error.data.message)
    : ''
  const compatibilityError = rawKitchenError.includes('LEGACY_DAILY_LINEAGE_MISSING') || rawKitchenError.includes('KITCHEN_FROZEN_LINEAGE_MISSING')
  const kitchenError = compatibilityError ? 'Lô này chưa có dữ liệu phiếu nấu theo ngày.' : rawKitchenError || 'Không tải được phiếu nấu.'

  const cookingRows = query.data?.rows
  const groups = useMemo(() => {
    const grouped = new Map<string, { serviceDate: string; weekday: string; shiftName: string; dishCode: string; dishName: string; servings: number; rows: ReconciliationKitchenCookingRow[] }>()
    for (const row of cookingRows ?? []) {
      const key = `${row.serviceDate}-${row.shiftName}-${row.dishCode}`
      const group = grouped.get(key) ?? { serviceDate: row.serviceDate, weekday: row.weekday, shiftName: row.shiftName, dishCode: row.dishCode, dishName: row.dishName, servings: row.servings, rows: [] }
      group.rows.push(row)
      grouped.set(key, group)
    }
    return [...grouped.values()]
  }, [cookingRows])

  const download = async (format: 'csv' | 'xlsx') => {
    const blob = await (format === 'csv' ? loadCsv(batchId) : loadXlsx(batchId)).unwrap()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `phieu-nau-${batchId}.${format}`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return <>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Xuất phiếu nấu</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent scrollMode="body" className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Phiếu nấu</DialogTitle>
          <DialogDescription>Định lượng theo ngày, ca, món và nguyên liệu đã chốt.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {query.isLoading && <TabContentSkeleton geometry="table" rows={3} columns={4} message="Đang tải phiếu nấu..." />}
          {query.isError && <InlineAlert variant={compatibilityError ? 'warning' : 'danger'} action={!compatibilityError ? <Button type="button" variant="link" className="h-auto p-0" onClick={() => void query.refetch()}>Thử lại</Button> : undefined}>{kitchenError}</InlineAlert>}
          {query.data?.rows.length === 0 && <InlineAlert variant="warning">Lô không có dòng phiếu nấu để xuất.</InlineAlert>}
          {groups.length > 0 && <div className="space-y-3 pr-1" aria-label="Xem trước phiếu nấu">
          {groups.map((group) => <section key={`${group.serviceDate}-${group.shiftName}-${group.dishCode}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div><h3 className="text-sm font-semibold text-slate-900">{group.dishName}</h3><p className="text-xs text-slate-600">{group.weekday} · {formatDateOnly(group.serviceDate)} · {group.shiftName}</p></div>
              <p className="text-sm font-semibold tabular-nums text-slate-800">{group.servings} suất</p>
            </div>
            <TableViewport ariaLabel={`Nguyên liệu món ${group.dishName}`} caption={`Định lượng nguyên liệu cho ${group.dishName}`}>
              <table className="ipc-data-table">
                <thead><tr><th scope="col">Nguyên liệu</th><th scope="col" className="text-right">BOM / suất</th><th scope="col" className="text-right">Hao hụt</th><th scope="col" className="text-right">Tổng cần</th></tr></thead>
                <tbody>{group.rows.map((row) => <tr key={`${row.ingredientCode}-${row.unitName}`}>
                  <td><span className="block font-medium">{row.ingredientName}</span>{row.ingredientCode && <span className="text-xs text-slate-500">{row.ingredientCode}</span>}</td>
                  <td className="text-right tabular-nums">{formatQuantityWithUnit(row.bomQuantityPerServing, row.unitName, { maximumFractionDigits: 6 })}</td>
                  <td className="text-right tabular-nums">{row.wasteRatePercent == null ? '—' : formatPercent(row.wasteRatePercent, 2)}</td>
                  <td className="text-right font-semibold tabular-nums">{formatQuantityWithUnit(row.totalRequiredQuantity, row.unitName, { maximumFractionDigits: 3 })}</td>
                </tr>)}</tbody>
              </table>
            </TableViewport>
          </section>)}
          </div>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Đóng</Button>
          {(query.data?.rows.length ?? 0) > 0 && <><Button type="button" variant="outline" disabled={xlsxState.isFetching} onClick={() => void download('xlsx')}><Download aria-hidden="true" className="size-4" />{xlsxState.isFetching ? 'Đang tải...' : 'Tải Excel'}</Button><Button type="button" disabled={csvState.isFetching} onClick={() => void download('csv')}><Download aria-hidden="true" className="size-4" />{csvState.isFetching ? 'Đang tải...' : 'Tải CSV'}</Button></>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
