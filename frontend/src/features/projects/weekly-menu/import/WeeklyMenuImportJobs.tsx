import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { ConfirmDialog, StatusBadge, TableViewport } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'
import { typography } from '@/lib/typography'
import { formatBomTierLabel } from '../../weeklyMenuPlanning'
import { formatFileSize, formatImportDate, getImportJobStatusLabel } from '../model/formatters'
import { getImportJobStatusTone } from './importValidation'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

export function WeeklyMenuImportJobs({ workflow }: { workflow: WeeklyMenuImportWorkflow }) {
  const { state, selectedJob, readyJobs, status, actions } = workflow
  const [search, setSearch] = useState('')
  const [commitTarget, setCommitTarget] = useState<{ kind: 'all' } | { kind: 'job'; jobId: string } | null>(null)
  const commitJob = commitTarget?.kind === 'job' ? state.jobs.find((job) => job.jobId === commitTarget.jobId) : undefined
  const readyRowCount = readyJobs.reduce((total, job) => total + (job.previewResult?.detectedLayout.rowsImported ?? 0), 0)
  const filteredJobs = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('vi-VN')
    if (!needle) return state.jobs
    return state.jobs.filter((job) => [
      job.customerCode,
      job.customerName,
      job.fileName,
      job.weekStartDate,
      formatBomTierLabel(job.priceTierAmount),
      getImportJobStatusLabel(job.status),
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi-VN').includes(needle))
  }, [search, state.jobs])

  return (
    <div className={cn(typography.body, 'flex flex-col gap-3')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className={cn(typography.sectionTitle, 'text-slate-900')}>File cần kiểm tra</h3>
          <p className={cn(typography.body, 'font-medium text-slate-500')}>Kiểm tra lỗi ngày, món ăn hoặc dòng trùng trước khi lưu thực đơn.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void actions.previewAllJobs()} disabled={status.isImporting || state.jobs.length === 0}>
            {status.isPreviewing ? 'Đang kiểm tra...' : 'Kiểm tra tất cả'}
          </Button>
          <Button type="button" size="sm" onClick={() => setCommitTarget({ kind: 'all' })} disabled={status.isImporting || state.jobs.length === 0 || readyJobs.length !== state.jobs.length}>
            {status.isCommitting ? 'Đang lưu...' : 'Lưu toàn bộ file'}
          </Button>
        </div>
      </div>
      <div className="relative max-w-md">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm khách hàng, tuần, file hoặc trạng thái"
          aria-label="Tìm trong danh sách file thực đơn"
          className="pl-9"
        />
      </div>
      <TableViewport caption="Danh sách file thực đơn chờ kiểm tra" className="max-h-[260px]" ariaLabel="Danh sách file thực đơn chờ kiểm tra" frozenFirstIdentifier={false}>
        <table className="ipc-data-table table-fixed">
          <thead><tr>
            <th className="text-left whitespace-nowrap">Khách hàng</th><th className="text-left whitespace-nowrap">Tuần</th>
            <th className="text-center whitespace-nowrap">Định mức</th><th className="text-left whitespace-nowrap">File</th>
            <th className="text-center whitespace-nowrap">File đọc</th><th className="text-center whitespace-nowrap">Dòng món</th>
            <th className="text-center whitespace-nowrap">Trạng thái</th><th className="w-[190px] text-right whitespace-nowrap">Thao tác</th>
          </tr></thead>
          <tbody>
            {filteredJobs.map((job) => {
              const preview = job.previewResult
              return (
                <tr key={job.jobId} className={cn(selectedJob?.jobId === job.jobId && 'bg-blue-50/70')}>
                  <td className="text-left"><Button type="button" variant="outline" size="xs" textWrap="wrap" onClick={() => actions.selectJob(job.jobId)} className="w-full justify-start text-left font-bold text-slate-900 hover:text-blue-700">{job.customerCode} - {job.customerName}</Button></td>
                  <td className="text-left font-medium whitespace-nowrap">{job.weekStartDate ? formatImportDate(job.weekStartDate) : 'Tự nhận theo file'}</td>
                  <td className="text-center whitespace-nowrap"><span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{formatBomTierLabel(job.priceTierAmount)}</span></td>
                  <td className="text-left"><div className="flex min-w-0 flex-col"><span className="break-words font-semibold text-slate-800">{job.fileName}</span><span className="text-xs text-slate-500">{formatFileSize(job.fileSize)}</span></div></td>
                  <td className="text-center whitespace-nowrap">{preview ? `${preview.detectedLayout.sections.length} phần / ${preview.detectedLayout.dayColumns.length} ngày` : '-'}</td>
                  <td className={cn(typography.numeric, 'text-center whitespace-nowrap')}>{preview ? formatNumber(preview.detectedLayout.rowsImported) : '-'}</td>
                  <td className="text-center whitespace-nowrap"><StatusBadge variant={getImportJobStatusTone(job.status)} className="min-w-[116px] justify-center whitespace-nowrap">{getImportJobStatusLabel(job.status)}</StatusBadge></td>
                  <td className="text-right"><div data-testid="import-job-actions" className="flex flex-nowrap justify-end gap-1.5 whitespace-nowrap">
                    <Button type="button" variant="outline" size="xs" className="shrink-0" onClick={() => void actions.previewJob(job.jobId)} disabled={status.isImporting || job.status === 'committed'}>Kiểm tra</Button>
                    <Button type="button" size="xs" className="shrink-0" onClick={() => setCommitTarget({ kind: 'job', jobId: job.jobId })} disabled={status.isImporting || job.status !== 'previewed'}>Lưu</Button>
                    <Button type="button" variant="outline" size="xs" className="shrink-0" onClick={() => actions.removeJob(job.jobId)} disabled={status.isImporting}>Xóa</Button>
                  </div></td>
                </tr>
              )
            })}
            {state.jobs.length === 0 && <tr><td colSpan={8} className="p-5 text-center text-sm font-medium text-slate-500">Chưa có file nào. Chọn khách hàng, tuần, định mức và file Excel rồi bấm Thêm file.</td></tr>}
            {state.jobs.length > 0 && filteredJobs.length === 0 && <tr><td colSpan={8} className="p-5 text-center text-sm font-medium text-slate-500">Không tìm thấy file thực đơn phù hợp.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
      {commitTarget !== null && (
        <ConfirmDialog
          open={commitTarget !== null}
          title={commitTarget?.kind === 'all' ? `Lưu toàn bộ ${readyJobs.length} file?` : 'Lưu file thực đơn này?'}
          description={commitTarget?.kind === 'all'
            ? `${readyJobs.length} file với ${readyRowCount} dòng món sẽ được lưu atomic trong cùng một transaction theo từng khách hàng và tuần; dữ liệu ở cùng phạm vi có thể được cập nhật. Nếu một file lỗi, toàn bộ batch sẽ được hoàn tác và không file nào được lưu.`
            : commitJob
              ? `${commitJob.customerCode} · tuần ${commitJob.weekStartDate || 'tự nhận theo file'} · ${commitJob.fileName} · ${commitJob.previewResult?.detectedLayout.rowsImported ?? 0} dòng món. Thực đơn đang lưu ở cùng phạm vi có thể được cập nhật.`
              : 'File đã chọn sẽ được ghi vào thực đơn của khách hàng và tuần tương ứng.'}
          confirmLabel={commitTarget?.kind === 'all' ? 'Lưu toàn bộ file' : 'Lưu file'}
          busy={status.isCommitting}
          busyLabel="Đang lưu..."
          onConfirm={() => {
            const target = commitTarget
            setCommitTarget(null)
            if (target?.kind === 'all') void actions.commitReadyJobs()
            if (target?.kind === 'job') void actions.commitJob(target.jobId)
          }}
          onOpenChange={(open) => !open && setCommitTarget(null)}
        />
      )}
    </div>
  )
}
