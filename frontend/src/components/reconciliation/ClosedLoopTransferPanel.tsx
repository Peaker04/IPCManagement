import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routeConfig'
import { useListReconciliationBatchesQuery, useTransferReconciliationBatchMutation } from '@/api/reconciliationApi'

export function ClosedLoopTransferPanel({ menuVersionId, scopeLabel }: { menuVersionId?: string | null; scopeLabel: string }) {
  const { data = [], isLoading, isError, refetch } = useListReconciliationBatchesQuery()
  const [transfer, { isLoading: isTransferring }] = useTransferReconciliationBatchMutation()
  const batch = menuVersionId ? data.find((candidate) => candidate.menuVersionId === menuVersionId) : undefined
  const warehouseHref = batch ? `${ROUTES.WAREHOUSE}?batchId=${encodeURIComponent(batch.batchId)}` : ROUTES.WAREHOUSE

  return <section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Chuyển định lượng sang kho">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold text-slate-950">Định lượng xuất kho</h3><p className="mt-1 text-sm text-slate-600">{scopeLabel}. Chuyển danh sách đã chốt sang Kho không làm thay đổi tồn kho.</p></div>
      {batch?.status === 'READY'
        ? <Button type="button" disabled={isTransferring} onClick={() => void transfer({ id: batch.batchId, expectedVersion: batch.version })}>{isTransferring ? 'Đang chuyển...' : 'Chuyển sang Kho'}</Button>
        : batch && ['TRANSFERRED', 'IN_PROGRESS', 'COMPLETED'].includes(batch.status)
          ? <Link className="ipc-button ipc-button-primary" to={warehouseHref}>Mở danh sách cần xuất</Link>
          : null}
    </div>
    {isLoading && <p className="mt-3 text-sm text-slate-600">Đang tải định lượng đã chốt...</p>}
    {isError && <p className="mt-3 text-sm text-red-700" role="alert">Không tải được định lượng xuất kho. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetch()}>Thử lại</Button></p>}
    {!isLoading && !isError && !menuVersionId && <p className="mt-3 text-sm text-slate-600">Chọn đúng khách hàng và tuần có kế hoạch đã nhập để mở định lượng xuất kho.</p>}
    {!isLoading && !isError && menuVersionId && !batch && <p className="mt-3 text-sm text-slate-600">Phạm vi đang chọn chưa có lô định lượng. Hoàn tất nguồn số suất của đúng khách hàng và tuần trước khi chuyển sang Kho.</p>}
  </section>
}
