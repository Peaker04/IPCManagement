import { AlertTriangle } from 'lucide-react'
import { useGetServiceRunPageQuery } from '@/api/chefApi'
import { EmptyState } from './EmptyState'
import { SectionPanel } from './SectionPanel'
import { StatusBadge } from './StatusBadge'
import type { ServiceRunLifecycleProjectionDto } from '@/api/workflowApiTypes'
import { formatServiceRunBlocker, formatServiceRunConfirmationOutcome } from '@/lib/workflowConfig'

const trackDefinitions = [
  { id: 'planning', label: 'Kế hoạch', blockers: ['PLAN_NOT_SIGNED_OFF', 'DEMAND_NOT_GENERATED'], evidence: (run: ServiceRunLifecycleProjectionDto) => `${run.materialRequestLineCount} dòng nhu cầu`, nextAction: (run: ServiceRunLifecycleProjectionDto) => run.canResolveVariance ? 'Quyết toán chênh lệch theo bước được phép' : 'Chờ chứng từ kế hoạch' },
  { id: 'supply', label: 'Vật tư / cấp phát', blockers: ['BOM_INCOMPLETE', 'OPEN_SUPPLY', 'UNRECEIVED_ISSUE', 'OPEN_SUPPLEMENTAL'], evidence: (run: ServiceRunLifecycleProjectionDto) => `${run.issueCount} phiếu xuất · ${run.unreceivedIssueCount} chờ nhận · ${run.openSupplementalCount} cấp bổ sung mở`, nextAction: () => 'Xử lý chứng từ nguồn được nêu bên dưới' },
  { id: 'service', label: 'Thực hiện phục vụ', blockers: ['ACTUAL_SERVINGS_NOT_RECORDED', 'SERVICE_CONFIRMATION_REQUIRED'], evidence: (run: ServiceRunLifecycleProjectionDto) => `Suất thực tế: ${run.actualServings ?? 'chưa ghi'} · ${formatServiceRunConfirmationOutcome(run.serviceConfirmationOutcome)}`, nextAction: (run: ServiceRunLifecycleProjectionDto) => run.canRecordActualServings ? 'Ghi nhận suất thực tế' : run.canConfirmService ? 'Xác nhận phục vụ' : 'Chờ bước tiếp theo được phép' },
  { id: 'reconciliation', label: 'Đối soát', blockers: ['UNRESOLVED_VARIANCE', 'UNRESOLVED_SERVING_VARIANCE', 'CONFIRMATION_OUTCOME_CONFLICT'], evidence: (run: ServiceRunLifecycleProjectionDto) => `${run.adjustmentCount} điều chỉnh hậu kiểm`, nextAction: (run: ServiceRunLifecycleProjectionDto) => run.canResolveVariance || run.canResolveServingVariance || run.canWaiveServiceConfirmation ? 'Thực hiện bước xử lý được phép' : 'Không có bước tự phê duyệt' },
] as const

/** Renders the backend blocker/action tokens in four operational tracks without recomputing lifecycle state. */
export function ServiceRunTrackPanel({ run }: { run: ServiceRunLifecycleProjectionDto }) {
  return <dl className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Bốn track Ca phục vụ">
    {trackDefinitions.map((track) => {
      const blockers = run.blockers.filter((blocker) => track.blockers.includes(blocker as never))
      const resolved = blockers.length === 0
      return <div key={track.id} className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
        <div className="flex items-center justify-between gap-2"><dt className="font-medium text-slate-800">{track.label}</dt><StatusBadge variant={resolved ? 'success' : 'warning'}>{resolved ? 'Không có blocker' : 'Cần xử lý'}</StatusBadge></div>
        <dd className="mt-1 text-slate-600">{blockers.length ? blockers.map(formatServiceRunBlocker).join(' · ') : track.evidence(run)}</dd>
        <dd className="mt-1 text-slate-500">Tiếp theo: {track.nextAction(run)}</dd>
      </div>
    })}
  </dl>
}

/** Shared projection of canonical Service Run blockers for the responsible workflow views. */
export function ServiceRunBlockerPanel({ serviceDate, owner }: { serviceDate?: string; owner: 'Kho' | 'Thu mua' }) {
  const { data, isError, isFetching, refetch } = useGetServiceRunPageQuery({ pageNumber: 1, pageSize: 20, serviceDate })
  if (isError) return <SectionPanel title="Ca phục vụ đang bị chặn" icon={<AlertTriangle size={18} />}><EmptyState variant="error" title="Không tải được trạng thái Ca phục vụ" description={`${owner} chưa thể kết luận không còn chứng từ chặn Ca.`} onRetry={() => void refetch()} isRetrying={isFetching} /></SectionPanel>
  const rows = (data?.items ?? []).filter(({ lifecycle }) => lifecycle.blockers.some((blocker) => ['BOM_INCOMPLETE', 'OPEN_SUPPLY', 'UNRECEIVED_ISSUE', 'OPEN_SUPPLEMENTAL'].includes(blocker)))
  if (!rows.length) return null
  return <SectionPanel title="Ca phục vụ đang bị chặn" icon={<AlertTriangle size={18} />} description={`Các điều kiện liên quan để ${owner.toLowerCase()} xử lý chứng từ nguồn, không phải trạng thái do màn hình tự suy diễn.`}>
    <ul className="divide-y divide-slate-200">{rows.map(({ lifecycle, materialRequestCodes, issueCodes, supplementalRequestCodes }) => <li key={lifecycle.serviceRunId} className="flex flex-wrap items-start justify-between gap-3 py-3"><div><p className="font-medium text-slate-800">{lifecycle.planCode} · {lifecycle.shiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'}</p><p className="mt-1 text-xs text-slate-600">{lifecycle.blockers.map(formatServiceRunBlocker).join(' · ')}</p><p className="mt-1 text-xs text-slate-500">Nhu cầu: {materialRequestCodes.join(', ') || '—'} · Xuất: {issueCodes.join(', ') || '—'} · Bổ sung: {supplementalRequestCodes.join(', ') || '—'}</p></div><StatusBadge variant="danger">Đang bị chặn</StatusBadge></li>)}</ul>
  </SectionPanel>
}
