import { AlertTriangle } from 'lucide-react'
import { useGetServiceRunPageQuery } from '@/api/workflowApi'
import { EmptyState } from './EmptyState'
import { SectionPanel } from './SectionPanel'
import { StatusBadge } from './StatusBadge'

/** Shared projection of canonical Service Run blockers for the responsible workflow views. */
export function ServiceRunBlockerPanel({ serviceDate, owner }: { serviceDate?: string; owner: 'Kho' | 'Thu mua' }) {
  const { data, isError, isFetching, refetch } = useGetServiceRunPageQuery({ pageNumber: 1, pageSize: 20, serviceDate })
  if (isError) return <SectionPanel title="Ca phục vụ đang bị chặn" icon={<AlertTriangle size={18} />}><EmptyState variant="error" title="Không tải được trạng thái Ca phục vụ" description={`${owner} chưa thể kết luận không còn chứng từ chặn Ca.`} onRetry={() => void refetch()} isRetrying={isFetching} /></SectionPanel>
  const rows = (data?.items ?? []).filter(({ lifecycle }) => lifecycle.blockers.some((blocker) => ['BOM_INCOMPLETE', 'OPEN_SUPPLY', 'UNRECEIVED_ISSUE', 'OPEN_SUPPLEMENTAL'].includes(blocker)))
  if (!rows.length) return null
  return <SectionPanel title="Ca phục vụ đang bị chặn" icon={<AlertTriangle size={18} />} description={`Các blocker liên quan để ${owner.toLowerCase()} xử lý chứng từ nguồn, không phải trạng thái do màn hình tự suy diễn.`}>
    <ul className="divide-y divide-slate-200">{rows.map(({ lifecycle, materialRequestCodes, issueCodes, supplementalRequestCodes }) => <li key={lifecycle.serviceRunId} className="flex flex-wrap items-start justify-between gap-3 py-3"><div><p className="font-medium text-slate-800">{lifecycle.planCode} · {lifecycle.shiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'}</p><p className="mt-1 text-xs text-slate-600">{lifecycle.blockers.join(' · ')}</p><p className="mt-1 text-xs text-slate-500">Nhu cầu: {materialRequestCodes.join(', ') || '—'} · Xuất: {issueCodes.join(', ') || '—'} · Bổ sung: {supplementalRequestCodes.join(', ') || '—'}</p></div><StatusBadge variant="danger">Đang bị chặn</StatusBadge></li>)}</ul>
  </SectionPanel>
}
