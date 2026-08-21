import { X } from 'lucide-react'
import { ConfirmDialog, InlineAlert, QueryErrorAlert } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getImportWizardStepClass, importWizardSteps } from './importValidation'
import { WeeklyMenuImportHistory } from './WeeklyMenuImportHistory'
import { WeeklyMenuImportJobs } from './WeeklyMenuImportJobs'
import { WeeklyMenuImportReview } from './WeeklyMenuImportReview'
import { WeeklyMenuImportSetup } from './WeeklyMenuImportSetup'
import type { WeeklyMenuImportWorkflow } from './useWeeklyMenuImport'

export const WeeklyMenuImportDialog = ({ workflow }: { workflow: WeeklyMenuImportWorkflow }) => {
  const { state, status, actions, readyJobs, wizardStep, hiddenFeedbackByDetail } = workflow
  return (
    <>
      <Dialog open={state.isOpen} onOpenChange={actions.onOpenChange}>
        <DialogContent aria-label="Nhập thực đơn từ Excel" className="ipc-weekly-dialog max-w-6xl">
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
          <DialogFooter className="static mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-sm font-medium text-slate-600">
              {state.jobs.length === 0 ? 'Thêm ít nhất một khách hàng và file Excel để bắt đầu' : `${readyJobs.length}/${state.jobs.length} file đã kiểm tra xong`}
            </div>
            <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={actions.close}>Đóng</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {state.rollbackTarget !== null && (
        <ConfirmDialog
          open={state.rollbackTarget !== null}
          title="Xác nhận hủy phiên import"
          description={`Hủy phiên import "${state.rollbackTarget?.label ?? ''}"? Lịch thực đơn của tuần đó sẽ bị xóa và không thể khôi phục.`}
          confirmLabel="Xác nhận hủy"
          busy={status.isRollingBack}
          busyLabel="Đang hủy..."
          onConfirm={() => void actions.confirmRollback()}
          onOpenChange={(open) => !open && actions.cancelRollback()}
        />
      )}
    </>
  )
}
