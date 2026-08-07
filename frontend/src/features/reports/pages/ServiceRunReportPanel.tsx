import { ClipboardList } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, PaginationBar, SectionPanel, StatusBadge, TableViewport } from '@/components/common'
import { useGetServiceRunPageQuery } from '@/api/workflowApi'

type Props = { dateFrom: string; dateTo: string; shiftName: string }
const label: Record<string, string> = { BLOCKED: 'Đang bị chặn', MATERIALS_IN_PROGRESS: 'Đang hoàn tất vật tư', READY_TO_PRODUCE: 'Sẵn sàng phục vụ', IN_SERVICE: 'Đang phục vụ', RECONCILIATION_REQUIRED: 'Cần đối soát', READY_TO_CLOSE: 'Sẵn sàng đóng ca', CLOSED: 'Đã đóng ca' }
const tone = (status: string) => status === 'CLOSED' || status === 'READY_TO_CLOSE' ? 'success' as const : status === 'BLOCKED' || status === 'RECONCILIATION_REQUIRED' ? 'danger' as const : 'warning' as const
const formatCurrency = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

export function ServiceRunReportPanel({ dateFrom, dateTo, shiftName }: Props) {
  const [page, setPage] = useState(1)
  const serviceDate = dateFrom && dateFrom === dateTo ? dateFrom : undefined
  const { data, isFetching, isError, refetch } = useGetServiceRunPageQuery({ pageNumber: page, pageSize: 20, serviceDate, shiftName: shiftName || undefined })
  const rows = data?.items ?? []
  return <SectionPanel title="Ca phục vụ và chứng từ nguồn" icon={<ClipboardList size={18} />} description="Trạng thái do backend tính từ KHSX, nhu cầu, phiếu xuất/trả và cấp bổ sung. Ca đã đóng dùng snapshot tại thời điểm close; legacy chưa có snapshot được ghi rõ.">
    {isError ? <EmptyState variant="error" title="Không tải được Ca phục vụ" description="Không thể kết luận tình trạng đóng ca khi projection chứng từ nguồn chưa tải được." onRetry={() => void refetch()} isRetrying={isFetching} /> : <>
      <TableViewport ariaLabel="Bảng Ca phục vụ" caption="Các chứng từ nguồn được hiển thị theo từng Ca, không gộp theo tên nguyên liệu.">
        <table className="ipc-data-table ipc-status-action-table min-w-[1080px]"><thead><tr><th>KHSX / ca</th><th>Trạng thái</th><th>Blocker</th><th>Nhu cầu</th><th>Xuất / trả</th><th>Bổ sung</th><th>Chi phí</th><th>Suất</th></tr></thead><tbody>
          {rows.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-slate-600">Chưa có Ca phục vụ trong phạm vi đang lọc.</td></tr> : rows.map(({ lifecycle, materialRequestCodes, issueCodes, returnCodes, supplementalRequestCodes, materialRequestLineIds, issueLineIds, estimatedPurchaseCost, actualReceivedCost, isCloseSnapshot }) => <tr key={lifecycle.serviceRunId}>
            <td><div className="font-medium text-slate-800">{lifecycle.planCode}</div><div className="text-xs text-slate-500">{lifecycle.shiftName === 'MORNING' ? 'Ca sáng' : 'Ca chiều'}{lifecycle.status === 'CLOSED' ? (isCloseSnapshot ? ' · Snapshot đóng ca' : ' · Legacy: dữ liệu live') : ''}</div></td>
            <td><StatusBadge variant={tone(lifecycle.status)}>{label[lifecycle.status] ?? lifecycle.status}</StatusBadge></td><td className="max-w-64 text-xs">{lifecycle.blockers.length ? lifecycle.blockers.join(' · ') : '—'}</td>
            <td className="text-xs">{materialRequestCodes.join(', ') || '—'}<div className="mt-1 text-slate-500">{materialRequestLineIds.length} source-line</div></td><td className="text-xs">{[...issueCodes, ...returnCodes].join(', ') || '—'}<div className="mt-1 text-slate-500">{issueLineIds.length} source-line</div></td><td className="text-xs">{supplementalRequestCodes.join(', ') || '—'}</td>
            <td className="text-right text-xs tabular-nums"><div>Chi phí mua ước tính: {formatCurrency(estimatedPurchaseCost ?? 0)}</div><div className="mt-1 text-slate-500">Chi phí mua thực nhận: {actualReceivedCost == null ? 'Chưa phát sinh nhập' : formatCurrency(actualReceivedCost)}</div></td>
            <td className="ipc-numeric-cell tabular-nums">{lifecycle.actualServings ?? '—'} / {lifecycle.plannedServings}</td>
          </tr>)}
        </tbody></table>
      </TableViewport>
      <PaginationBar page={data?.pageNumber ?? page} pageSize={data?.pageSize ?? 20} totalItems={data?.totalCount ?? 0} onPageChange={setPage} />
    </>}
  </SectionPanel>
}
