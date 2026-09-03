import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Snowflake, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineAlert, StatusBadge } from '@/components/common'
import { ROUTES } from '@/lib/routeConfig'
import {
  useCommitReconciliationQuantityImportMutation,
  useInitializeReconciliationToleranceMutation,
  useListReconciliationBatchesQuery,
  usePreviewReconciliationQuantityImportMutation,
  useReadyReconciliationBatchMutation,
  useTransferReconciliationBatchMutation,
  type QuantityImportPreview,
} from '@/api/reconciliationApi'

const errorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error && 'data' in error) {
    const data = (error as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  return error instanceof Error ? error.message : fallback
}

const shiftLabel = (shift?: string) => shift ? ({ MORNING: 'Ca sáng', AFTERNOON: 'Ca chiều', EVENING: 'Ca tối' })[shift.toUpperCase()] ?? shift : 'Chưa xác định'

interface ClosedLoopTransferPanelProps {
  menuVersionId?: string | null
  menuVersionStatus?: string | null
  scopeLabel: string
  isPublishingMenu?: boolean
  onPublishMenu?: () => void
  incompleteServingPlanCount?: number
  onEditServings?: () => void
  canInitializeTolerance?: boolean
}

export function ClosedLoopTransferPanel({ menuVersionId, menuVersionStatus, scopeLabel, isPublishingMenu = false, onPublishMenu, incompleteServingPlanCount = 0, onEditServings, canInitializeTolerance = false }: ClosedLoopTransferPanelProps) {
  const { data = [], isLoading, isError, refetch } = useListReconciliationBatchesQuery()
  const [preview, setPreview] = useState<QuantityImportPreview>()
  const [expandedLineId, setExpandedLineId] = useState<string>()
  const [needsToleranceInitialization, setNeedsToleranceInitialization] = useState(false)
  const [feedback, setFeedback] = useState<{ title: string; message: string; variant: 'info' | 'warning' | 'danger' }>()
  const [initializeTolerance, { isLoading: isInitializingTolerance }] = useInitializeReconciliationToleranceMutation()
  const [previewSource, { isLoading: isPreviewing }] = usePreviewReconciliationQuantityImportMutation()
  const [commitSource, { isLoading: isCommitting }] = useCommitReconciliationQuantityImportMutation()
  const [ready, { isLoading: isFreezing }] = useReadyReconciliationBatchMutation()
  const [transfer, { isLoading: isTransferring }] = useTransferReconciliationBatchMutation()
  const batch = menuVersionId ? data.find((candidate) => candidate.menuVersionId === menuVersionId) : undefined
  const warehouseHref = batch ? `${ROUTES.WAREHOUSE}?batchId=${encodeURIComponent(batch.batchId)}` : ROUTES.WAREHOUSE
  const previewSummary = useMemo(() => {
    const plans = preview?.plans ?? []
    const ingredientTotals = new Map<string, { name: string; code: string; unit: string; quantity: number }>()
    for (const plan of plans) for (const line of plan.lines) for (const dish of line.dishes ?? []) for (const material of dish.materials) {
      const key = `${material.ingredientId}:${material.canonicalUnitId}`
      const current = ingredientTotals.get(key)
      ingredientTotals.set(key, { name: material.ingredientName, code: material.ingredientCode, unit: material.canonicalUnitName, quantity: (current?.quantity ?? 0) + material.requiredQuantity })
    }
    return {
      planCount: plans.length,
      lineCount: plans.reduce((sum, plan) => sum + plan.lines.length, 0),
      servingCount: plans.reduce((sum, plan) => sum + plan.lines.reduce((lineSum, line) => lineSum + line.finalServings, 0), 0),
      complete: plans.length > 0 && plans.every((plan) => plan.status.toUpperCase() === 'COMPLETED' && plan.lines.length > 0 && plan.lines.every((line) => line.finalServings > 0)),
      ingredientTotals: [...ingredientTotals.values()].sort((left, right) => left.name.localeCompare(right.name, 'vi')),
    }
  }, [preview])
  const isMenuPublished = !menuVersionStatus || ['ACTIVE', 'PUBLISHED', 'COMMITTED'].includes(menuVersionStatus.toUpperCase())
  const busy = isInitializingTolerance || isPreviewing || isCommitting || isFreezing || isTransferring || isPublishingMenu

  const inspectSource = async () => {
    if (!menuVersionId) return
    setFeedback(undefined)
    try {
      const result = await previewSource({ menuVersionId, sourceLabel: scopeLabel }).unwrap()
      setPreview(result)
      setExpandedLineId(undefined)
      setFeedback({ title: 'Kế hoạch đã sẵn sàng', message: 'Kiểm tra số suất, món ăn và lượng nguyên liệu trước khi tạo lô.', variant: 'info' })
    } catch (error) {
      setPreview(undefined)
      setFeedback({ title: 'Kế hoạch chưa sẵn sàng', message: errorMessage(error, 'Kiểm tra món ăn, định mức nguyên liệu và số suất trước khi thử lại.'), variant: 'danger' })
    }
  }
  const commitPreview = async () => {
    if (!preview) return
    setFeedback(undefined)
    try {
      await commitSource({ token: preview.token, contentFingerprint: preview.contentFingerprint, sourceLabel: scopeLabel }).unwrap()
      setNeedsToleranceInitialization(false)
      setPreview(undefined)
      await refetch()
      setFeedback({ title: 'Đã tạo lô định lượng', message: 'Kiểm tra nguyên liệu rồi xác nhận khóa định lượng trước khi chuyển sang Kho.', variant: 'info' })
    } catch (error) {
      const message = errorMessage(error, 'Nguồn có thể đã thay đổi sau khi xem trước. Hãy kiểm tra lại.')
      setNeedsToleranceInitialization(message.includes('dung sai mặc định hệ thống'))
      setFeedback({ title: 'Không thể cam kết nguồn', message, variant: 'danger' })
    }
  }
  const initializeSystemTolerance = async () => {
    setFeedback(undefined)
    try {
      await initializeTolerance().unwrap()
      setNeedsToleranceInitialization(false)
      setFeedback({ title: 'Đã khởi tạo dung sai đối chiếu', message: 'Cấu hình mặc định đã sẵn sàng. Bạn có thể tạo lại lô từ preview hiện tại.', variant: 'info' })
    } catch (error) {
      setFeedback({ title: 'Không thể khởi tạo dung sai', message: errorMessage(error, 'Cần quản trị viên kiểm tra cấu hình đối chiếu.'), variant: 'danger' })
    }
  }
  const freezeBatch = async () => {
    if (!batch) return
    setFeedback(undefined)
    try {
      await ready({ id: batch.batchId, expectedVersion: batch.version }).unwrap()
      await refetch()
      setFeedback({ title: 'Đã khóa định lượng', message: 'Món ăn, định mức, số suất, đơn vị và số lượng của lô này không thể thay đổi.', variant: 'info' })
    } catch (error) {
      setFeedback({ title: 'Chưa thể khóa định lượng', message: errorMessage(error, 'Lô còn thiếu định mức nguyên liệu, số suất hoặc dòng nguyên liệu hợp lệ.'), variant: 'danger' })
    }
  }
  const transferBatch = async () => {
    if (!batch) return
    setFeedback(undefined)
    try {
      await transfer({ id: batch.batchId, expectedVersion: batch.version }).unwrap()
      await refetch()
    } catch (error) {
      setFeedback({ title: 'Chưa chuyển được sang Kho', message: errorMessage(error, 'Lô đã thay đổi. Hãy tải lại trước khi chuyển.'), variant: 'danger' })
    }
  }

  return <section className="rounded-lg border border-slate-200 bg-white p-4" aria-label="Chuẩn bị và chuyển định lượng sang kho">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold text-slate-950">Định lượng xuất kho</h3><p className="mt-1 text-sm text-slate-600">{scopeLabel}. Kiểm tra kế hoạch, tạo lô và khóa định lượng trước khi chuyển sang Kho.</p></div>
      <div className="flex flex-wrap gap-2">
        {!batch && menuVersionId && isMenuPublished && incompleteServingPlanCount === 0 && <Button type="button" variant="outline" disabled={busy} onClick={() => void inspectSource()}>{isPreviewing ? 'Đang kiểm tra...' : preview ? 'Kiểm tra lại nguồn' : 'Kiểm tra nguồn định lượng'}</Button>}
        {!batch && preview && <Button type="button" disabled={busy || !previewSummary.complete} onClick={() => void commitPreview()}>{isCommitting ? 'Đang tạo lô...' : 'Tạo lô định lượng'}</Button>}
        {batch?.status === 'DRAFT' && <Button type="button" disabled={busy || (batch.lines?.length ?? 0) === 0} onClick={() => void freezeBatch()}>{isFreezing ? 'Đang khóa...' : 'Xác nhận và khóa'}</Button>}
        {batch?.status === 'READY' && <Button type="button" disabled={busy} onClick={() => void transferBatch()}>{isTransferring ? 'Đang chuyển...' : 'Chuyển sang Kho'}</Button>}
        {batch && ['TRANSFERRED', 'IN_PROGRESS', 'COMPLETED'].includes(batch.status) && <Link className="ipc-button ipc-button-primary" to={warehouseHref}>Mở danh sách cần xuất</Link>}
      </div>
    </div>

    {!batch && menuVersionId && !isMenuPublished && <div className="mt-3"><InlineAlert title="Thực đơn tuần chưa được phát hành" variant="warning">Hoàn tất chỉnh món, định mức nguyên liệu và số suất, sau đó xuất bản tuần trước khi tổng hợp nguyên liệu.<div className="mt-2"><Button type="button" size="sm" disabled={busy || !onPublishMenu} onClick={onPublishMenu}>{isPublishingMenu ? 'Đang xuất bản...' : 'Xuất bản tuần'}</Button></div></InlineAlert></div>}
    {!batch && menuVersionId && isMenuPublished && incompleteServingPlanCount > 0 && <div className="mt-3"><InlineAlert title="Số suất chưa hoàn tất" variant="warning">Còn {incompleteServingPlanCount} kế hoạch ngày/ca ở trạng thái nháp. Mở trình chỉnh sửa và nhấn “Hoàn tất” cho từng ngày/ca trước khi kiểm tra nguồn.<div className="mt-2"><Button type="button" size="sm" disabled={busy || !onEditServings} onClick={onEditServings}>Nhập và hoàn tất số suất</Button></div></InlineAlert></div>}
    {feedback && <div className="mt-3"><InlineAlert title={feedback.title} variant={feedback.variant}>{feedback.message}{needsToleranceInitialization && <div className="mt-2">{canInitializeTolerance ? <Button type="button" size="sm" disabled={busy} onClick={() => void initializeSystemTolerance()}>{isInitializingTolerance ? 'Đang khởi tạo...' : 'Khởi tạo dung sai đối chiếu'}</Button> : <span className="text-sm font-medium">Liên hệ quản trị viên để khởi tạo dung sai đối chiếu.</span>}</div>}</InlineAlert></div>}
    {preview && <div className="mt-3 overflow-hidden rounded border border-slate-200" aria-label="Kế hoạch định lượng">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div><strong className="text-sm text-slate-950">Kế hoạch theo ngày và ca</strong><p className="mt-0.5 text-xs text-slate-600">{previewSummary.lineCount} ca · {previewSummary.servingCount.toLocaleString('vi-VN')} suất · {previewSummary.ingredientTotals.length} nguyên liệu</p></div>
        {onEditServings && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => { setPreview(undefined); setExpandedLineId(undefined); setFeedback({ title: 'Kế hoạch cần được kiểm tra lại', message: 'Sau khi chỉnh thực đơn hoặc số suất, hãy kiểm tra lại trước khi tạo lô.', variant: 'warning' }); onEditServings() }}>Chỉnh thực đơn và số suất</Button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-600"><tr><th scope="col" className="px-4 py-2.5">Ngày</th><th scope="col" className="px-4 py-2.5">Ca</th><th scope="col" className="px-4 py-2.5 text-right">Số suất</th><th scope="col" className="px-4 py-2.5 text-right">Số món</th><th scope="col" className="w-28 px-4 py-2.5"><span className="sr-only">Chi tiết</span></th></tr></thead>
          <tbody className="divide-y divide-slate-200">{preview.plans.flatMap((plan) => plan.lines.map((line) => ({ plan, line }))).map(({ plan, line }) => {
            const expanded = expandedLineId === line.quantityPlanLineId
            return <Fragment key={line.quantityPlanLineId}><tr className="hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-900">{plan.serviceDate ? new Date(`${plan.serviceDate}T00:00:00`).toLocaleDateString('vi-VN') : 'Chưa xác định'}</td><td className="px-4 py-3">{shiftLabel(line.shift)}</td><td className="px-4 py-3 text-right tabular-nums">{line.finalServings.toLocaleString('vi-VN')}</td><td className="px-4 py-3 text-right tabular-nums">{(line.dishes ?? []).length}</td><td className="px-4 py-3 text-right"><Button type="button" size="sm" variant="ghost" aria-expanded={expanded} onClick={() => setExpandedLineId(expanded ? undefined : line.quantityPlanLineId)}>{expanded ? 'Thu gọn' : 'Xem món'}<ChevronDown className={`ml-1 size-4 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" /></Button></td></tr>
              {expanded && <tr><td colSpan={5} className="bg-slate-50 px-4 py-3"><table className="w-full border-collapse text-xs"><thead><tr className="text-left text-slate-600"><th scope="col" className="pb-2 pr-3">Món ăn</th><th scope="col" className="pb-2 pr-3">Nguyên liệu</th><th scope="col" className="pb-2 text-right">Lượng cần</th></tr></thead><tbody className="divide-y divide-slate-200">{(line.dishes ?? []).flatMap((dish) => dish.materials.map((material, index) => <tr key={material.dishBomId}><td className="py-2 pr-3 font-medium text-slate-900">{index === 0 ? dish.dishName : ''}</td><td className="py-2 pr-3">{material.ingredientName}</td><td className="py-2 text-right font-medium tabular-nums">{material.requiredQuantity.toLocaleString('vi-VN', { maximumFractionDigits: 6 })} {material.canonicalUnitName}</td></tr>))}</tbody></table></td></tr>}
            </Fragment>
          })}</tbody>
        </table>
      </div>
      {previewSummary.ingredientTotals.length > 0 && <details className="border-t border-slate-200"><summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-900">Xem tổng nguyên liệu</summary><div className="max-h-80 overflow-auto border-t border-slate-200"><table className="w-full text-sm"><thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-600"><tr><th scope="col" className="px-4 py-2">Nguyên liệu</th><th scope="col" className="px-4 py-2 text-right">Tổng lượng cần</th></tr></thead><tbody className="divide-y divide-slate-200">{previewSummary.ingredientTotals.map((material) => <tr key={`${material.code}:${material.unit}`}><td className="px-4 py-2">{material.name}</td><td className="px-4 py-2 text-right font-medium tabular-nums">{material.quantity.toLocaleString('vi-VN', { maximumFractionDigits: 6 })} {material.unit}</td></tr>)}</tbody></table></div></details>}
    </div>}
    {batch && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><StatusBadge variant={batch.status === 'COMPLETED' ? 'success' : batch.status === 'DRAFT' ? 'warning' : 'info'}>{batch.status === 'DRAFT' ? 'Chờ xác nhận' : batch.status === 'READY' ? 'Đã khóa' : batch.status === 'TRANSFERRED' ? 'Đã chuyển Kho' : batch.status === 'IN_PROGRESS' ? 'Đang đối chiếu' : 'Hoàn tất'}</StatusBadge><span>{batch.lines?.length ?? 0} nguyên liệu</span>{batch.status !== 'DRAFT' && <span className="inline-flex items-center gap-1 text-slate-600"><Snowflake size={14} aria-hidden="true" />Định lượng đã khóa; thay đổi sau đó sẽ áp dụng cho lô mới.</span>}</div>}
    {isLoading && <p className="mt-3 text-sm text-slate-600">Đang tải định lượng đã chốt...</p>}
    {isError && <p className="mt-3 text-sm text-red-700" role="alert">Không tải được định lượng xuất kho. <Button type="button" variant="link" className="h-auto p-0" onClick={() => refetch()}>Thử lại</Button></p>}
    {!isLoading && !isError && !menuVersionId && <p className="mt-3 text-sm text-slate-600">Chọn đúng khách hàng và tuần có kế hoạch đã nhập để mở định lượng xuất kho.</p>}
    {!isLoading && !isError && menuVersionId && isMenuPublished && incompleteServingPlanCount === 0 && !batch && !preview && <p className="mt-3 flex items-start gap-2 text-sm text-slate-600"><TriangleAlert className="mt-0.5 shrink-0" size={16} aria-hidden="true" />Chưa có lô định lượng. Hãy kiểm tra nguồn để xác nhận thực đơn, định mức nguyên liệu và số suất đã sẵn sàng.</p>}
  </section>
}
