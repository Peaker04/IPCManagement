import { useState } from 'react'
import { useSelector } from 'react-redux'
import { CheckCircle2, Play, ShieldCheck } from 'lucide-react'
import type { ProductionPlan, ServiceRunLifecycleProjectionDto } from '@/api/workflowApiTypes'
import { StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { AuthState } from '@/lib/auth/authTypes'
import {
  useCloseServiceRunMutation,
  useApproveServiceRunVarianceWaiverMutation,
  useConfirmServiceRunMutation,
  useCreateServiceRunAdjustmentMutation,
  useDeclareServiceRunVarianceMutation,
  useGetServiceRunByPlanQuery,
  useGetServiceRunByScopeQuery,
  useOpenServiceRunMutation,
  useRecordServiceRunActualServingsMutation,
  useResolveServiceRunVarianceMutation,
  useResolveServiceRunServingVarianceMutation,
  useStartServiceRunMutation,
  useWaiveServiceRunConfirmationMutation,
} from '../chefApi'
import { getChefMutationErrorMessage } from '../chefDashboardTypes'
import { formatServiceRunVarianceTrack } from '@/lib/workflowConfig'
import { formatCurrency, formatDateOnly } from '@/lib/formatters'
import type { ServiceRunScope } from '../serviceRunScopeTypes'
import { describeServiceRunScope, isExactServiceRunScope } from '../serviceRunScopeTypes'

type Props = { plans: ProductionPlan[]; shiftName: string; scope?: ServiceRunScope }

const INITIAL_VISIBLE_RUNS = 4
const statusLabel: Record<string, string> = {
  PLANNED: 'Đã mở ca', BLOCKED: 'Đang bị chặn', MATERIALS_IN_PROGRESS: 'Đang hoàn tất vật tư',
  READY_TO_PRODUCE: 'Sẵn sàng phục vụ', IN_SERVICE: 'Đang phục vụ',
  RECONCILIATION_REQUIRED: 'Cần đối soát', READY_TO_CLOSE: 'Sẵn sàng đóng ca', CLOSED: 'Đã đóng ca',
}
const outcomeLabel: Record<string, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', WAIVED: 'Đã miễn xác nhận' }

const tone = (status: string) => status === 'CLOSED' || status === 'READY_TO_CLOSE' ? 'success' as const : status === 'BLOCKED' || status === 'RECONCILIATION_REQUIRED' ? 'danger' as const : 'warning' as const

const varianceTracksForRole = (role?: string) => {
  if (role === 'beptruong') return ['SERVICE_EXECUTION'] as const
  if (role === 'quanly') return ['PLANNING', 'MATERIAL_SUPPLY', 'RECONCILIATION'] as const
  return [] as const
}

export function ServiceRunSection({ plans, shiftName, scope }: Props) {
  const [showAll, setShowAll] = useState(false)
  const scopedPlans = plans.filter((plan) => plan.lines.some((line) => line.shiftName === shiftName))
  const visiblePlans = showAll ? scopedPlans : scopedPlans.slice(0, INITIAL_VISIBLE_RUNS)

  return <section className="rounded-md border border-slate-200 bg-slate-50 p-3" aria-label="Ca phục vụ thực tế">
    <div className="mb-1 flex items-center gap-2"><Play className="size-4 text-slate-700" /><h2 className="text-sm font-semibold text-slate-800">Ca phục vụ thực tế</h2></div>
    <p className="mb-3 text-xs text-slate-600">Theo dõi riêng kế hoạch, vật tư, phục vụ và đối soát. Bếp đã nhận vật tư chưa có nghĩa là ca đã đóng.</p>
    {scopedPlans.length === 0 ? <p className="text-sm text-slate-600">Chưa có KHSX để mở Ca phục vụ.</p> : <div className="space-y-3">
      {scope?.allCustomers && <p className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900" role="status">{describeServiceRunScope(scope)}. Chọn một dòng phạm vi chính xác trước khi thao tác.</p>}
      {visiblePlans.map((plan) => <ServiceRunCard key={plan.planId} plan={plan} shiftName={shiftName} scope={scope ?? getPlanScope(plan, shiftName)} />)}
      {scopedPlans.length > INITIAL_VISIBLE_RUNS && <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((value) => !value)}>
        {showAll ? 'Thu gọn danh sách' : `Hiển thị ${scopedPlans.length - INITIAL_VISIBLE_RUNS} kế hoạch khác`}
      </Button>}
    </div>}
  </section>
}

const getPlanScope = (plan: ProductionPlan, shiftName: string): ServiceRunScope | undefined => {
  const tiers = [...new Set(plan.lines
    .filter((line) => line.shiftName === shiftName && line.priceTierAmount != null)
    .map((line) => line.priceTierAmount as number))]
  if (!plan.customerId || !plan.planDate || tiers.length !== 1) return undefined
  return {
    customerId: plan.customerId,
    serviceDate: plan.planDate,
    shiftName,
    priceTierAmount: tiers[0],
  }
}

const getScopeLabel = (plan: ProductionPlan, scope?: ServiceRunScope) => {
  if (!scope || !isExactServiceRunScope(scope)) return null
  const customer = plan.customerName || plan.customerCode || 'Khách hàng chưa có tên'
  const shift = scope.shiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'
  return `${customer} · ${formatDateOnly(scope.serviceDate)} · ${shift} · ${formatCurrency(scope.priceTierAmount)}`
}

function ServiceRunCard({ plan, shiftName, scope }: { plan: ProductionPlan; shiftName: string; scope?: ServiceRunScope }) {
  const [localRun, setLocalRun] = useState<ServiceRunLifecycleProjectionDto | null>(null)
  const [actual, setActual] = useState('')
  const [correctedActual, setCorrectedActual] = useState('')
  const [reason, setReason] = useState('')
  const [varianceTrack, setVarianceTrack] = useState('')
  const [varianceSourceLines, setVarianceSourceLines] = useState<string[]>([])
  const [varianceReason, setVarianceReason] = useState('')
  const [waiverDeclarationId, setWaiverDeclarationId] = useState('')
  const [waiverReason, setWaiverReason] = useState('')
  const [declaredByCurrentActor, setDeclaredByCurrentActor] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const user = useSelector((state: { auth: AuthState }) => state.auth.user)
  const { data: persistedRun, isFetching, isError, refetch } = useGetServiceRunByPlanQuery({ planId: plan.planId, shiftName })
  const scopedRun = useGetServiceRunByScopeQuery(scope!, { skip: !scope || !isExactServiceRunScope(scope) })
  const activeQuery = scope && isExactServiceRunScope(scope) ? scopedRun : { data: persistedRun, isFetching, isError, refetch }
  const run = localRun ?? activeQuery.data
  const scopedTracks = (run as (ServiceRunLifecycleProjectionDto & { tracks?: Array<{ trackId: string; displayLabel: string; blockers: Array<{ displayLabel: string }>; responsibleRole: string }> }) | null)?.tracks ?? []
  const sourceLineOptions = run?.sourceLineOptions ?? []
  const pendingDeclarations = run?.pendingVarianceDeclarations ?? []
  const [open, openState] = useOpenServiceRunMutation()
  const [start, startState] = useStartServiceRunMutation()
  const [record, recordState] = useRecordServiceRunActualServingsMutation()
  const [confirm, confirmState] = useConfirmServiceRunMutation()
  const [resolveVariance, resolveVarianceState] = useResolveServiceRunVarianceMutation()
  const [resolveServingVariance, resolveServingVarianceState] = useResolveServiceRunServingVarianceMutation()
  const [waiveConfirmation, waiveConfirmationState] = useWaiveServiceRunConfirmationMutation()
  const [close, closeState] = useCloseServiceRunMutation()
  const [createAdjustment, createAdjustmentState] = useCreateServiceRunAdjustmentMutation()
  const [declareVariance, declareVarianceState] = useDeclareServiceRunVarianceMutation()
  const [approveWaiver, approveWaiverState] = useApproveServiceRunVarianceWaiverMutation()
  const declarationTracks = varianceTracksForRole(user?.role)
  const isAdmin = user?.isAdminFullAccess || user?.role === 'admin'
  const act = async (operation: () => Promise<unknown>) => {
    try {
      setError(null)
      await operation()
      setLocalRun(null)
      await activeQuery.refetch()
    } catch (cause) { setError(getChefMutationErrorMessage(cause, 'Không thể cập nhật Ca phục vụ.')) }
  }
  const isMutating = openState.isLoading || startState.isLoading || recordState.isLoading || confirmState.isLoading || resolveVarianceState.isLoading || resolveServingVarianceState.isLoading || waiveConfirmationState.isLoading || closeState.isLoading || createAdjustmentState.isLoading || declareVarianceState.isLoading || approveWaiverState.isLoading
  const scopeLabel = getScopeLabel(plan, scope)

  return <article className="rounded-sm border border-slate-200 bg-white p-3" aria-busy={isMutating || activeQuery.isFetching}>
    <div className="flex flex-wrap items-start justify-between gap-2"><div><span className="text-sm font-medium text-slate-800">{plan.planCode}</span>{scopeLabel && <p className="mt-0.5 text-xs text-slate-600">{scopeLabel}</p>}</div>{run && <StatusBadge variant={tone(run.status)}>{statusLabel[run.status] ?? run.status}</StatusBadge>}</div>
    {activeQuery.isFetching && !run && <p className="mt-2 text-xs text-slate-500" role="status">Đang tải trạng thái Ca phục vụ…</p>}
    {activeQuery.isError && !localRun ? <div className="mt-3 flex flex-wrap items-center gap-2" role="alert"><p className="text-xs text-red-700">Không tải được trạng thái Ca phục vụ. Hãy tải lại trước khi mở ca.</p><Button type="button" size="sm" variant="outline" onClick={() => void activeQuery.refetch()}>Tải lại</Button></div> : !run && !activeQuery.isFetching ? scope?.allCustomers ? <p className="mt-3 text-xs text-slate-600">Tổng hợp không có thao tác. Mở một phạm vi khách hàng cụ thể để tiếp tục.</p> : !plan.sentToKitchenAt ? <p className="mt-3 text-xs text-amber-800" role="status">Kế hoạch chưa gửi Bếp. Hoàn tất bước gửi kế hoạch trước khi mở Ca phục vụ.</p> : scope && isExactServiceRunScope(scope) ? <Button size="sm" className="mt-3" disabled={openState.isLoading} onClick={() => void act(() => open({ planId: plan.planId, shiftName, customerId: scope.customerId, priceTierAmount: scope.priceTierAmount }).unwrap())}>Mở Ca phục vụ</Button> : <p className="mt-3 text-xs text-amber-800" role="status">Chọn khách hàng và tier giá chính xác trước khi mở Ca phục vụ.</p> : run && <>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
        <div><dt className="text-slate-500">Kế hoạch</dt><dd className="font-medium text-slate-800 tabular-nums">{run.plannedServings} suất</dd></div>
        <div><dt className="text-slate-500">Thực tế</dt><dd className="font-medium text-slate-800 tabular-nums">{run.actualServings ?? '—'} suất</dd></div>
        <div><dt className="text-slate-500">Phiếu xuất</dt><dd className="font-medium text-slate-800 tabular-nums">{run.issueCount}</dd></div>
        <div><dt className="text-slate-500">Chờ nhận</dt><dd className="font-medium text-slate-800 tabular-nums">{run.unreceivedIssueCount}</dd></div>
        <div><dt className="text-slate-500">Điều chỉnh hậu kiểm</dt><dd className="font-medium text-slate-800 tabular-nums">{run.adjustmentCount}</dd></div>
        <div><dt className="text-slate-500">Giao suất</dt><dd className="font-medium text-slate-800">{outcomeLabel[run.serviceConfirmationOutcome] ?? run.serviceConfirmationOutcome}</dd></div>
      </dl>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Các phần việc của Ca phục vụ">
        {scopedTracks.map((track) => <div key={track.trackId} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs"><dt className="font-medium text-slate-800">{track.displayLabel}</dt><dd className="mt-1 text-slate-600">{track.blockers.length ? track.blockers.map((blocker) => blocker.displayLabel).join(' · ') : 'Không có vướng mắc'}</dd><dd className="mt-1 text-slate-500">Phụ trách: {track.responsibleRole}</dd></div>)}
      </dl>
      {pendingDeclarations.length > 0 && <section className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs" aria-label="Ngoại lệ đang chờ xử lý">
        <h3 className="font-medium text-amber-900">Ngoại lệ đang chờ xử lý</h3>
        <ul className="mt-1 space-y-1 text-amber-900">{pendingDeclarations.map((item) => <li key={item.declarationId}>
          <strong>{item.declaredByLabel}</strong> · {formatServiceRunVarianceTrack(item.trackLabel)}: {item.reason}
        </li>)}</ul>
        <p className="mt-1 text-amber-800">Tiếp theo: Admin khác người khai báo kiểm tra và quyết định miễn xác nhận.</p>
      </section>}
      {run.status !== 'CLOSED' && declarationTracks.length > 0 && <fieldset className="mt-3 grid gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs" aria-label="Khai báo ngoại lệ Ca phục vụ">
        <legend className="px-1 font-medium text-amber-900">Khai báo ngoại lệ</legend>
        <p className="text-amber-900">Chọn nguyên liệu liên quan và nêu lý do. Khai báo không tự đóng ca.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 font-medium text-slate-700">Phạm vi ngoại lệ<select aria-label="Phạm vi ngoại lệ" value={varianceTrack} onChange={(event) => setVarianceTrack(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2"><option value="">Chọn phạm vi</option>{declarationTracks.map((track) => <option key={track} value={track}>{formatServiceRunVarianceTrack(track)}</option>)}</select></label>
          <label className="grid gap-1 font-medium text-slate-700">Lý do<Input aria-label="Lý do khai báo ngoại lệ" value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} placeholder="Bắt buộc" /></label>
        </div>
        <fieldset className="max-h-48 overflow-y-auto rounded border border-amber-200 bg-white p-2" aria-label="Nguyên liệu liên quan">
          <legend className="px-1 font-medium text-slate-700">Nguyên liệu liên quan</legend>
          {sourceLineOptions.length ? <div className="grid gap-1 sm:grid-cols-2">{sourceLineOptions.map((line) => <label key={line.sourceLineId} className="flex min-w-0 items-start gap-2 rounded px-2 py-1.5 hover:bg-amber-50 cursor-pointer"><Checkbox className="mt-0.5" checked={varianceSourceLines.includes(line.sourceLineId)} onCheckedChange={(checked) => setVarianceSourceLines((current) => checked === true ? [...current, line.sourceLineId] : current.filter((id) => id !== line.sourceLineId))} /><span className="min-w-0"><strong className="block truncate text-slate-800">{line.ingredientLabel}</strong><span className="text-slate-600">Cần {line.requiredQuantity} {line.unitLabel}</span></span></label>)}</div> : <p className="text-slate-600">Chưa có dòng nguyên liệu cho ca này.</p>}
        </fieldset>
        <div><Button size="sm" variant="outline" disabled={!varianceTrack || varianceSourceLines.length === 0 || !varianceReason.trim() || declareVarianceState.isLoading} onClick={() => void act(async () => {
          await declareVariance({ id: run.serviceRunId, body: { commandId: `service-run-variance-${crypto.randomUUID()}`, expectedVersion: run.currentVersion, track: varianceTrack, sourceLineIds: varianceSourceLines, reason: varianceReason } }).unwrap()
          setDeclaredByCurrentActor(true)
          setVarianceSourceLines([])
          setVarianceReason('')
        })}>Gửi khai báo ngoại lệ</Button></div>
      </fieldset>}
      {run.status !== 'CLOSED' && isAdmin && !declaredByCurrentActor && <fieldset className="mt-3 grid gap-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs" aria-label="Phê duyệt miễn xác nhận ngoại lệ">
        <legend className="px-1 font-medium text-slate-800">Phê duyệt miễn xác nhận</legend>
        <p className="text-slate-600">Chỉ phê duyệt khai báo của người khác. Hệ thống từ chối tự phê duyệt và tải lại kết quả sau thao tác.</p>
        <div className="grid gap-2 sm:grid-cols-3"><label className="grid gap-1 font-medium text-slate-700">Khai báo chờ duyệt<select aria-label="Khai báo chờ duyệt" value={waiverDeclarationId} onChange={(event) => setWaiverDeclarationId(event.target.value)} className="h-8 rounded border border-slate-300 bg-white px-2"><option value="">Chọn khai báo</option>{pendingDeclarations.map((item) => <option key={item.declarationId} value={item.declarationId}>{item.declaredByLabel} · {formatServiceRunVarianceTrack(item.trackLabel)} · {item.reason}</option>)}</select></label><label className="grid gap-1 font-medium text-slate-700 sm:col-span-2">Lý do miễn xác nhận<Input aria-label="Lý do phê duyệt miễn xác nhận" value={waiverReason} onChange={(event) => setWaiverReason(event.target.value)} placeholder="Bắt buộc" /></label></div>
        <div><Button size="sm" disabled={!waiverDeclarationId.trim() || !waiverReason.trim() || approveWaiverState.isLoading} onClick={() => void act(() => approveWaiver({ id: run.serviceRunId, declarationId: waiverDeclarationId, body: { commandId: `service-run-waiver-${crypto.randomUUID()}`, expectedVersion: run.currentVersion, reason: waiverReason } }).unwrap())}>Phê duyệt miễn xác nhận</Button></div>
      </fieldset>}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {run.canStartService && <Button size="sm" disabled={startState.isLoading} onClick={() => void act(() => start(run.serviceRunId).unwrap())}>Bắt đầu phục vụ</Button>}
        {run.canRecordActualServings && <>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Suất thực tế<Input aria-label="Số suất thực tế" type="number" min="0" value={actual} onChange={(event) => setActual(event.target.value)} className="h-8 w-28" /></label>
          <label className="grid gap-1 text-xs font-medium text-slate-700">Lý do chênh lệch / quyết định<Input aria-label="Lý do chênh lệch hoặc quyết định quản lý" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bắt buộc nếu lệch" className="h-8 w-56" /></label>
          <Button size="sm" disabled={recordState.isLoading || actual === ''} onClick={() => void act(() => record({ id: run.serviceRunId, body: { actualServings: Number(actual), reason: reason || null } }).unwrap())}>Ghi nhận</Button>
        </>}
        {run.canConfirmService && <Button size="sm" disabled={confirmState.isLoading} onClick={() => void act(() => confirm(run.serviceRunId).unwrap())}><CheckCircle2 className="size-4" />Xác nhận phục vụ</Button>}
        {run.canResolveVariance && <Button size="sm" variant="outline" disabled={resolveVarianceState.isLoading || !reason.trim()} onClick={() => void act(() => resolveVariance({ id: run.serviceRunId, body: { reason } }).unwrap())}>Quyết toán chênh lệch</Button>}
        {run.canResolveServingVariance && <Button size="sm" variant="outline" disabled={resolveServingVarianceState.isLoading || !reason.trim()} onClick={() => void act(() => resolveServingVariance({ id: run.serviceRunId, body: { reason } }).unwrap())}>Quyết định chênh lệch suất</Button>}
        {run.canWaiveServiceConfirmation && <Button size="sm" variant="outline" disabled={waiveConfirmationState.isLoading || !reason.trim()} onClick={() => void act(() => waiveConfirmation({ id: run.serviceRunId, body: { reason } }).unwrap())}>Miễn xác nhận</Button>}
        {run.canClose && <Button size="sm" disabled={closeState.isLoading} onClick={() => void act(() => close(run.serviceRunId).unwrap())}><ShieldCheck className="size-4" />Đóng ca</Button>}
        {run.status === 'CLOSED' && <>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Suất điều chỉnh<Input aria-label="Số suất điều chỉnh hậu kiểm" type="number" min="0" value={correctedActual} onChange={(event) => setCorrectedActual(event.target.value)} className="h-8 w-28" /></label>
            <label className="grid gap-1 text-xs font-medium text-slate-700">Lý do hậu kiểm<Input aria-label="Lý do điều chỉnh hậu kiểm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Bắt buộc" className="h-8 w-56" /></label>
            <Button size="sm" variant="outline" disabled={createAdjustmentState.isLoading || correctedActual === '' || !reason.trim()} onClick={() => void act(() => createAdjustment({ id: run.serviceRunId, body: { correctedActualServings: Number(correctedActual), reason } }).unwrap())}>Ghi điều chỉnh hậu kiểm</Button>
          </>}
      </div>
    </>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </article>
}
