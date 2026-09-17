import { X } from 'lucide-react'
import { InlineAlert, QueryErrorAlert } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getImportWizardStepClass, importWizardSteps } from './importValidation'
import { WeeklyMenuImportHistory } from './WeeklyMenuImportHistory'
import { WeeklyMenuImportJobs } from './WeeklyMenuImportJobs'
import { WeeklyMenuImportReview } from './WeeklyMenuImportReview'
import { WeeklyMenuImportSetup } from './WeeklyMenuImportSetup'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

export const WeeklyMenuImportDialog = ({ workflow, surface = 'dialog' }: { workflow: WeeklyMenuImportWorkflow; surface?: 'dialog' | 'page' }) => {
  const { state, status, actions, readyJobs, wizardStep, hiddenFeedbackByDetail } = workflow
  const content = (
        <DialogContent role={surface === 'page' ? 'region' : 'dialog'} aria-modal={surface === 'page' ? false : undefined} aria-label="Nhập thực đơn từ Excel" className={surface === 'page' ? 'max-h-none max-w-none gap-0 border-0 p-0 shadow-none' : 'ipc-weekly-dialog max-w-6xl gap-0'}>
          <DialogHeader className="static flex flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900">Nhập thực đơn từ Excel</DialogTitle>
            <Button type="button" variant="outline" size="xs" onClick={actions.close} aria-label="Đóng modal nhập thực đơn" title="Đóng">
              <X size={16} /><span>Đóng</span>
            </Button>
          </DialogHeader>
          <div className="mt-5 flex max-h-[calc(85vh-150px)] flex-col gap-5 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 p-0.5 md:grid-cols-3">
              {importWizardSteps.map((step, index) => (
                <div key={step.key} className={getImportWizardStepClass(step.key, wizardStep)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-slate-500">Bước {index + 1}</span>
                    {step.key === wizardStep && <span className="rounded border border-blue-200 bg-white px-2 py-0.5 text-xs font-semibold text-blue-700">Đang xử lý</span>}
                  </div>
                  <div className="mt-1 text-sm font-bold">{step.label}</div>
                  <div className="text-xs font-medium text-slate-500">{step.hint}</div>
                </div>
              ))}
            </div>
            <WeeklyMenuImportSetup workflow={workflow} />
            {status.isCustomerError && (
              <QueryErrorAlert title="Chưa tải được danh sách khách hàng" onRetry={actions.retryCustomers} isRetrying={status.isCustomerLoading}>
                Kiểm tra kết nối hoặc quyền truy cập trước khi nhập thực đơn.
              </QueryErrorAlert>
            )}
            {state.feedback && !hiddenFeedbackByDetail && <InlineAlert title={state.feedback.title} variant={state.feedback.variant}>{state.feedback.message}</InlineAlert>}
            <WeeklyMenuImportJobs workflow={workflow} />
            <WeeklyMenuImportHistory workflow={workflow} />
            <WeeklyMenuImportReview workflow={workflow} />
          </div>
          {state.rollbackTarget !== null && (
            <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950">
              <span><strong>Xác nhận hủy phiên import “{state.rollbackTarget.label}”?</strong> Lịch thực đơn của tuần đó sẽ bị xóa và không thể khôi phục.</span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={status.isRollingBack} onClick={actions.cancelRollback}>Giữ phiên import</Button>
                <Button type="button" variant="destructive" size="sm" disabled={status.isRollingBack} onClick={() => void actions.confirmRollback()}>{status.isRollingBack ? 'Đang hủy...' : 'Xác nhận hủy'}</Button>
              </div>
            </div>
          )}
          <DialogFooter className="static mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-sm font-medium text-slate-600">
              {state.jobs.length === 0 ? 'Thêm ít nhất một khách hàng và file Excel để bắt đầu' : `${readyJobs.length}/${state.jobs.length} file đã kiểm tra xong`}
            </div>
            <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={actions.close}>Đóng</Button></div>
          </DialogFooter>
        </DialogContent>
  )

  return surface === 'page'
    ? content
    : <Dialog open={state.isOpen} onOpenChange={actions.onOpenChange}>{content}</Dialog>
}
