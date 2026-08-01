import { ContextStrip, InlineAlert, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { ImportedLayoutMatrix } from '../../components/ImportedLayoutMatrix'
import { formatImportDate, getImportJobStatusLabel } from '../model/formatters'
import { getImportJobStatusTone } from './importValidation'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

type Props = { workflow: WeeklyMenuImportWorkflow }

export const WeeklyMenuImportReview = ({ workflow }: Props) => {
  const { selectedJob: job, presentation, status, actions } = workflow
  const { activeDayKey, diffRows, displayDays, issues, layoutRows, preview, problemMessages, warningMessages, warningSummary } = presentation
  if (!job) return null

  return (
    <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-900">Kết quả kiểm tra {job.customerCode}</h3>
          <p className="text-sm font-medium text-slate-500">{job.fileName}</p>
        </div>
        <StatusBadge variant={getImportJobStatusTone(job.status)}>{getImportJobStatusLabel(job.status)}</StatusBadge>
      </div>

      {problemMessages.length > 0 && (
        <InlineAlert title="Cần sửa file Excel" variant="danger">
          <ul className="list-disc space-y-1 pl-4">
            {problemMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
          </ul>
          {issues.length > problemMessages.length && (
            <p className="mt-1 font-medium">
              Còn {issues.length - problemMessages.length} mục khác. Sửa các lỗi đầu rồi bấm Kiểm tra lại.
            </p>
          )}
        </InlineAlert>
      )}

      {preview && preview.detectedLayout.dayColumns.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ContextStrip
              items={[
                { label: 'Tuần trong file', value: `${formatImportDate(preview.weekStartDate)} - ${formatImportDate(preview.weekEndDate)}`, tone: 'info' },
                { label: 'Số món đọc được', value: preview.detectedLayout.rowsImported.toString(), tone: 'success' },
              ]}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              textWrap="wrap"
              onClick={() => void actions.saveMapping()}
              disabled={status.isSavingMapping}
              title="Ghi nhớ cách đọc file này cho khách hàng, dùng lại cho lần sau"
            >
              {status.isSavingMapping ? 'Đang ghi nhớ...' : 'Ghi nhớ cách đọc file'}
            </Button>
          </div>

          {diffRows.length > 0 && (
            <InlineAlert title={`${job.customerCode}: file Excel khác thực đơn đang lưu`} variant="info">
              <div className="space-y-1">
                <p>Nếu bấm Lưu, các món trong file Excel sẽ thay cho các món đang lưu ở những vị trí này.</p>
                <ul className="list-disc space-y-1 pl-4">
                  {diffRows.slice(0, 3).map((row, index) => (
                    <li key={`${row.serviceDate}-${row.shiftName}-${row.slot}-${index}`}>
                      {formatImportDate(row.serviceDate)} {row.shiftName}: đang lưu "{row.currentDishName}", file Excel "{row.importedDishName}"
                    </li>
                  ))}
                </ul>
                {diffRows.length > 3 && <p className="font-medium">Còn {diffRows.length - 3} vị trí khác.</p>}
              </div>
            </InlineAlert>
          )}

          {warningMessages.length > 0 && (
            <InlineAlert title={job.status === 'committed' ? 'Đã lưu thực đơn, cần chú ý' : 'Cần chú ý khi đọc file'} variant="warning">
              <ul className="list-disc space-y-1 pl-4">
                {warningMessages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
              </ul>
              {warningSummary.length > warningMessages.length && (
                <p className="mt-1 font-medium">Còn {warningSummary.length - warningMessages.length} nhắc nhở khác.</p>
              )}
            </InlineAlert>
          )}

          <ImportedLayoutMatrix
            rows={layoutRows}
            displayDays={displayDays}
            activeDayKey={activeDayKey}
            maxBodyHeight="max-h-[300px]"
          />
        </>
      )}
    </div>
  )
}
