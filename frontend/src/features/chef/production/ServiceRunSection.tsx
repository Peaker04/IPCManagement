import { useState } from 'react'
import { CheckCircle2, Play, ShieldCheck } from 'lucide-react'
import type { ProductionPlan, ServiceRunLifecycleProjectionDto } from '@/api/workflowApiTypes'
import { ServiceRunTrackPanel, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useCloseServiceRunMutation,
  useConfirmServiceRunMutation,
  useCreateServiceRunAdjustmentMutation,
  useGetServiceRunByPlanQuery,
  useOpenServiceRunMutation,
  useRecordServiceRunActualServingsMutation,
  useResolveServiceRunVarianceMutation,
  useResolveServiceRunServingVarianceMutation,
  useStartServiceRunMutation,
  useWaiveServiceRunConfirmationMutation,
} from '../chefApi'
import { getChefMutationErrorMessage } from '../chefDashboardTypes'

type Props = { plans: ProductionPlan[]; shiftName: string }

const INITIAL_VISIBLE_RUNS = 4
const statusLabel: Record<string, string> = {
  PLANNED: 'Đã mở ca', BLOCKED: 'Đang bị chặn', MATERIALS_IN_PROGRESS: 'Đang hoàn tất vật tư',
  READY_TO_PRODUCE: 'Sẵn sàng phục vụ', IN_SERVICE: 'Đang phục vụ',
  RECONCILIATION_REQUIRED: 'Cần đối soát', READY_TO_CLOSE: 'Sẵn sàng đóng ca', CLOSED: 'Đã đóng ca',
}
const outcomeLabel: Record<string, string> = { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', WAIVED: 'Đã miễn xác nhận' }

const tone = (status: string) => status === 'CLOSED' || status === 'READY_TO_CLOSE' ? 'success' as const : status === 'BLOCKED' || status === 'RECONCILIATION_REQUIRED' ? 'danger' as const : 'warning' as const

export function ServiceRunSection({ plans, shiftName }: Props) {
  const [showAll, setShowAll] = useState(false)
  const scopedPlans = plans.filter((plan) => plan.lines.some((line) => line.shiftName === shiftName))
  const visiblePlans = showAll ? scopedPlans : scopedPlans.slice(0, INITIAL_VISIBLE_RUNS)

  return <section className="rounded-md border border-slate-200 bg-slate-50 p-3" aria-label="Ca phục vụ thực tế">
    <div className="mb-1 flex items-center gap-2"><Play className="size-4 text-slate-700" /><h2 className="text-sm font-semibold text-slate-800">Ca phục vụ thực tế</h2></div>
    <p className="mb-3 text-xs text-slate-600">Theo dõi riêng kế hoạch, vật tư, phục vụ và đối soát. Bếp đã nhận vật tư chưa có nghĩa là ca đã đóng.</p>
    {scopedPlans.length === 0 ? <p className="text-sm text-slate-600">Chưa có KHSX để mở Ca phục vụ.</p> : <div className="space-y-3">
      {visiblePlans.map((plan) => <ServiceRunCard key={plan.planId} plan={plan} shiftName={shiftName} />)}
      {scopedPlans.length > INITIAL_VISIBLE_RUNS && <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((value) => !value)}>
        {showAll ? 'Thu gọn danh sách' : `Hiển thị ${scopedPlans.length - INITIAL_VISIBLE_RUNS} kế hoạch khác`}
      </Button>}
    </div>}
  </section>
}

function ServiceRunCard({ plan, shiftName }: { plan: ProductionPlan; shiftName: string }) {
  const [localRun, setLocalRun] = useState<ServiceRunLifecycleProjectionDto | null>(null)
  const [actual, setActual] = useState('')
  const [correctedActual, setCorrectedActual] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data: persistedRun, isFetching, isError, refetch } = useGetServiceRunByPlanQuery({ planId: plan.planId, shiftName })
  const run = localRun ?? persistedRun
  const [open, openState] = useOpenServiceRunMutation()
  const [start, startState] = useStartServiceRunMutation()
  const [record, recordState] = useRecordServiceRunActualServingsMutation()
  const [confirm, confirmState] = useConfirmServiceRunMutation()
  const [resolveVariance, resolveVarianceState] = useResolveServiceRunVarianceMutation()
  const [resolveServingVariance, resolveServingVarianceState] = useResolveServiceRunServingVarianceMutation()
  const [waiveConfirmation, waiveConfirmationState] = useWaiveServiceRunConfirmationMutation()
  const [close, closeState] = useCloseServiceRunMutation()
  const [createAdjustment, createAdjustmentState] = useCreateServiceRunAdjustmentMutation()
  const act = async (operation: () => Promise<unknown>) => {
    try {
      setError(null)
      await operation()
      setLocalRun(null)
      await refetch()
    } catch (cause) { setError(getChefMutationErrorMessage(cause, 'Không thể cập nhật Ca phục vụ.')) }
  }
  const isMutating = openState.isLoading || startState.isLoading || recordState.isLoading || confirmState.isLoading || resolveVarianceState.isLoading || resolveServingVarianceState.isLoading || waiveConfirmationState.isLoading || closeState.isLoading || createAdjustmentState.isLoading

  return <article className="rounded-sm border border-slate-200 bg-white p-3" aria-busy={isMutating || isFetching}>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium text-slate-800">{plan.planCode}</span>{run && <StatusBadge variant={tone(run.status)}>{statusLabel[run.status] ?? run.status}</StatusBadge>}</div>
    {isFetching && !run && <p className="mt-2 text-xs text-slate-500" role="status">Đang tải trạng thái Ca phục vụ…</p>}
    {isError && !localRun ? <div className="mt-3 flex flex-wrap items-center gap-2" role="alert"><p className="text-xs text-red-700">Không tải được trạng thái Ca phục vụ. Hãy tải lại trước khi mở ca.</p><Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>Tải lại</Button></div> : !run && !isFetching ? <Button size="sm" className="mt-3" disabled={openState.isLoading} onClick={() => void act(() => open({ planId: plan.planId, shiftName }).unwrap())}>Mở Ca phục vụ</Button> : run && <>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-4">
        <div><dt className="text-slate-500">Kế hoạch</dt><dd className="font-medium text-slate-800 tabular-nums">{run.plannedServings} suất</dd></div>
        <div><dt className="text-slate-500">Thực tế</dt><dd className="font-medium text-slate-800 tabular-nums">{run.actualServings ?? '—'} suất</dd></div>
        <div><dt className="text-slate-500">Phiếu xuất</dt><dd className="font-medium text-slate-800 tabular-nums">{run.issueCount}</dd></div>
        <div><dt className="text-slate-500">Chờ nhận</dt><dd className="font-medium text-slate-800 tabular-nums">{run.unreceivedIssueCount}</dd></div>
        <div><dt className="text-slate-500">Điều chỉnh hậu kiểm</dt><dd className="font-medium text-slate-800 tabular-nums">{run.adjustmentCount}</dd></div>
        <div><dt className="text-slate-500">Giao suất</dt><dd className="font-medium text-slate-800">{outcomeLabel[run.serviceConfirmationOutcome] ?? run.serviceConfirmationOutcome}</dd></div>
      </dl>
      <ServiceRunTrackPanel run={run} />
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
