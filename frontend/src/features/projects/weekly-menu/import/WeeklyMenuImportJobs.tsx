import { TableViewport } from '@/components/common'
import { cn } from '@/lib/utils'
import { formatBomTierLabel } from '../../weeklyMenuPlanning'
import { formatFileSize, formatImportDate, getImportJobStatusLabel } from '../model/formatters'
import { getImportJobStatusClass } from './importValidation'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

export function WeeklyMenuImportJobs({ workflow }: { workflow: WeeklyMenuImportWorkflow }) {
  const { state, selectedJob, readyJobs, status, actions } = workflow
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">File cần kiểm tra</h3>
          <p className="text-sm font-medium text-slate-500">Kiểm tra lỗi ngày, món ăn hoặc dòng trùng trước khi lưu thực đơn.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void actions.previewAllJobs()} disabled={status.isImporting || state.jobs.length === 0} className="ipc-button ipc-button-ghost">
            {status.isPreviewing ? 'Đang kiểm tra...' : 'Kiểm tra tất cả'}
          </button>
          <button type="button" onClick={() => void actions.commitReadyJobs()} disabled={status.isImporting || readyJobs.length === 0} className="ipc-button ipc-button-primary">
            {status.isCommitting ? 'Đang lưu...' : 'Lưu file hợp lệ'}
          </button>
        </div>
      </div>
      <TableViewport caption="Danh sách file thực đơn chờ kiểm tra" className="max-h-[260px]" ariaLabel="Danh sách file thực đơn chờ kiểm tra">
        <table className="ipc-data-table min-w-[980px]">
          <thead><tr>
            <th className="text-left whitespace-nowrap">Khách hàng</th><th className="text-left whitespace-nowrap">Tuần</th>
            <th className="text-center whitespace-nowrap">Định mức</th><th className="text-left whitespace-nowrap">File</th>
            <th className="text-center whitespace-nowrap">File đọc</th><th className="text-center whitespace-nowrap">Dòng món</th>
            <th className="text-center whitespace-nowrap">Trạng thái</th><th className="text-right whitespace-nowrap">Thao tác</th>
          </tr></thead>
          <tbody>
            {state.jobs.map((job) => {
              const preview = job.previewResult
              return (
                <tr key={job.jobId} className={cn(selectedJob?.jobId === job.jobId && 'bg-blue-50/70')}>
                  <td className="text-left min-w-[140px]"><button type="button" onClick={() => actions.selectJob(job.jobId)} className="text-left font-bold text-slate-900 hover:text-blue-700">{job.customerCode} - {job.customerName}</button></td>
                  <td className="text-left font-medium whitespace-nowrap">{job.weekStartDate ? formatImportDate(job.weekStartDate) : 'Tự nhận theo file'}</td>
                  <td className="text-center whitespace-nowrap"><span className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{formatBomTierLabel(job.priceTierAmount)}</span></td>
                  <td className="text-left min-w-[280px]"><div className="flex flex-col"><span className="font-semibold text-slate-800 whitespace-nowrap">{job.fileName}</span><span className="text-xs text-slate-500">{formatFileSize(job.fileSize)}</span></div></td>
                  <td className="text-center whitespace-nowrap">{preview ? `${preview.detectedLayout.sections.length} phần / ${preview.detectedLayout.dayColumns.length} ngày` : '-'}</td>
                  <td className="text-center whitespace-nowrap">{preview ? preview.detectedLayout.rowsImported.toLocaleString('vi-VN') : '-'}</td>
                  <td className="text-center whitespace-nowrap"><span className={cn(getImportJobStatusClass(job.status), 'whitespace-nowrap')}>{getImportJobStatusLabel(job.status)}</span></td>
                  <td className="text-right min-w-[220px]"><div className="flex flex-nowrap justify-end gap-2">
                    <button type="button" onClick={() => void actions.previewJob(job.jobId)} disabled={status.isImporting || job.status === 'committed'} className="ipc-button ipc-button-ghost min-w-[76px] whitespace-nowrap">Kiểm tra</button>
                    <button type="button" onClick={() => void actions.commitJob(job.jobId)} disabled={status.isImporting || job.status !== 'previewed'} className="ipc-button ipc-button-primary min-w-[52px] whitespace-nowrap">Lưu</button>
                    <button type="button" onClick={() => actions.removeJob(job.jobId)} disabled={status.isImporting} className="ipc-button ipc-button-ghost min-w-[52px] whitespace-nowrap">Xóa</button>
                  </div></td>
                </tr>
              )
            })}
            {state.jobs.length === 0 && <tr><td colSpan={8} className="p-5 text-center text-sm font-medium text-slate-500">Chưa có file nào. Chọn khách hàng, tuần, định mức và file Excel rồi bấm Thêm file.</td></tr>}
          </tbody>
        </table>
      </TableViewport>
    </div>
  )
}
