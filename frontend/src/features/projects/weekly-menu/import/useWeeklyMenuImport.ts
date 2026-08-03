import { useMemo, useReducer, useRef } from 'react'
import type { CreateCustomerContractRequest } from '@/types/coordination'
import {
  useCommitWeeklyMenuImportBatchMutation,
  useCommitWeeklyMenuImportMutation,
  useCreateCustomerContractMutation,
  useDownloadWeeklyMenuTemplateMutation,
  useGetWeeklyMenuImportHistoryQuery,
  usePreviewWeeklyMenuImportMutation,
  useRollbackWeeklyMenuImportMutation,
  useSaveCustomerImportMappingMutation,
} from '@/api/coordinationApi'
import type { CoordinationCustomerOption, WeeklyMenuImportResult } from '@/api/coordinationApi'
import type { BomPriceTier } from '../../weeklyMenuPlanning'
import { getApiErrorMessage, isValidWeekStartDate } from '../model/formatters'
import type { WeeklyMenuImportJob } from '../model/types'
import { getBlockingImportIssues, getImportWizardStep, hasBlockingImportIssues } from './importValidation'
import { buildImportPresentation } from './importPresentation'
import type { ImportDisplayDay } from './importPresentation'
import { initialWeeklyMenuImportState, weeklyMenuImportReducer } from './importState'
import type { ImportFeedback, ImportSetupErrors } from './importState'
import { toLabeledQueryView } from '@/lib/labeledQueryView'

type UseWeeklyMenuImportOptions = {
  customers: CoordinationCustomerOption[]
  isCustomerLoading: boolean
  isCustomerError: boolean
  refetchCustomers: () => unknown
  customerId: string
  weekStartDate: string
  committedWeekStartDate?: string
  menuPrice: BomPriceTier
  displayDays: ImportDisplayDay[]
  todayIso: string
  onCustomerCreated: (customerId: string) => void
  onMenuCommitted: (result: WeeklyMenuImportResult) => void
}

const makeFeedback = (title: string, message: string, variant: ImportFeedback['variant']): ImportFeedback => ({ title, message, variant })

export const useWeeklyMenuImport = ({
  customers, isCustomerLoading, isCustomerError, refetchCustomers, customerId, weekStartDate,
  committedWeekStartDate, menuPrice, displayDays, todayIso, onCustomerCreated, onMenuCommitted,
}: UseWeeklyMenuImportOptions) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [state, dispatch] = useReducer(weeklyMenuImportReducer, initialWeeklyMenuImportState)
  const [previewImport, { isLoading: isPreviewing }] = usePreviewWeeklyMenuImportMutation()
  const [downloadTemplate, { isLoading: isDownloadingTemplate }] = useDownloadWeeklyMenuTemplateMutation()
  const [commitImport, { isLoading: isCommitting }] = useCommitWeeklyMenuImportMutation()
  const [commitImportBatch, { isLoading: isBatchCommitting }] = useCommitWeeklyMenuImportBatchMutation()
  const [saveImportMapping, { isLoading: isSavingMapping }] = useSaveCustomerImportMappingMutation()
  const [createCustomerContract, { isLoading: isCreatingCustomer }] = useCreateCustomerContractMutation()
  const [rollbackImport, { isLoading: isRollingBack }] = useRollbackWeeklyMenuImportMutation()
  const historyQuery = useGetWeeklyMenuImportHistoryQuery()
  const historyView = toLabeledQueryView(historyQuery, 'lịch sử import thực đơn tuần', {
    instruction: 'Mở hộp thoại import để tải lịch sử import thực đơn tuần.',
  })
  const historyData = historyView.phase === 'ready'
    ? historyView.data
    : historyView.phase === 'error' ? historyQuery.currentData ?? historyQuery.data : undefined
  const history = useMemo(() => historyData?.data ?? [], [historyData?.data])
  const selectedCustomer = customers.find((item) => item.customerId === state.draftCustomerId)
  const selectedJob = state.jobs.find((job) => job.jobId === state.selectedJobId) ?? state.jobs[0]
  const presentation = useMemo(
    () => buildImportPresentation(selectedJob, displayDays, todayIso),
    [displayDays, selectedJob, todayIso],
  )
  const readyJobs = state.jobs.filter((job) => job.status === 'previewed' && job.previewResult && !job.error && !hasBlockingImportIssues(job.previewResult))
  const isImporting = isPreviewing || isCommitting || isBatchCommitting || isCreatingCustomer || state.jobs.some((job) => job.status === 'previewing' || job.status === 'committing')
  const hiddenFeedbackByDetail = (state.feedback?.variant === 'danger' && presentation.problemMessages.length > 0)
    || (state.feedback?.variant === 'warning' && presentation.warningMessages.length > 0)
  const clearFileInput = () => { if (fileInputRef.current) fileInputRef.current.value = '' }
  const setFeedback = (title: string, message: string, variant: ImportFeedback['variant']) => dispatch({ type: 'set-feedback', feedback: makeFeedback(title, message, variant) })
  const setSetupErrors = (errors: ImportSetupErrors) => dispatch({ type: 'set-setup-errors', errors })
  const close = () => { clearFileInput(); dispatch({ type: 'close' }) }
  const open = () => {
    clearFileInput()
    dispatch({ type: 'open', customerId, weekStartDate: committedWeekStartDate ?? weekStartDate, priceTierAmount: menuPrice })
  }

  const downloadWeeklyMenuTemplate = async () => {
    if (!selectedCustomer) return setSetupErrors({ customer: { title: 'Chọn khách hàng', message: 'Vui lòng chọn hoặc tạo khách hàng trước khi tải mẫu thực đơn riêng.' } })
    if (!isValidWeekStartDate(state.weekStartDate)) return setSetupErrors({ weekStartDate: { title: 'Chọn tuần bắt đầu', message: 'Vui lòng chọn ngày thứ 2 trước khi tải mẫu để file có đúng cột ngày trong tuần.' } })
    try {
      const url = await downloadTemplate({ customerId: selectedCustomer.customerId, weekStartDate: state.weekStartDate }).unwrap()
      const link = document.createElement('a')
      link.href = url
      link.download = `weekly-menu-template-${selectedCustomer.customerCode}-${state.weekStartDate}.xlsx`
      document.body.appendChild(link); link.click(); link.remove(); window.URL.revokeObjectURL(url)
      setFeedback('Đã tải mẫu thực đơn', `File ${selectedCustomer.customerCode} có 3 sheet 25k, 30k, 34k theo bố cục riêng của khách hàng.`, 'info')
    } catch (error) { setFeedback('Tải mẫu thất bại', getApiErrorMessage(error, 'Không thể tải mẫu thực đơn tuần.'), 'danger') }
  }

  const createQuickCustomer = async () => {
    const customerCode = state.quickCustomerCode.trim().toUpperCase()
    const customerName = state.quickCustomerName.trim()
    if (!customerCode || !customerName) return setFeedback('Thiếu thông tin khách hàng', 'Vui lòng nhập mã khách hàng và tên khách hàng trước khi tạo mới.', 'warning')
    const body: CreateCustomerContractRequest = {
      customerCode, customerName, note: 'Tạo nhanh khi nhập thực đơn từ Excel', isActive: true,
      activeWeekDays: ['t2', 't3', 't4', 't5', 't6', 't7'], shiftNames: ['MORNING', 'AFTERNOON'],
      defaultMenuPrice: state.priceTierAmount, defaultBomRatePercent: 100,
    }
    try {
      setFeedback('Đang tạo khách hàng', `Hệ thống đang tạo ${customerCode} để nhập thực đơn.`, 'info')
      const response = await createCustomerContract(body).unwrap()
      if (!response.success || !response.data) throw new Error(response.message || 'Không tạo được khách hàng.')
      await Promise.resolve(refetchCustomers())
      dispatch({ type: 'quick-customer-created', customerId: response.data.customerId })
      onCustomerCreated(response.data.customerId)
      setFeedback('Đã tạo khách hàng mới', `${response.data.customerCode} - ${response.data.customerName} đã được chọn cho file này.`, 'info')
    } catch (error) { setFeedback('Tạo khách hàng thất bại', getApiErrorMessage(error, 'Không thể tạo khách hàng mới.'), 'danger') }
  }

  const addJob = () => {
    if (!selectedCustomer || !state.selectedFile) {
      const error = { title: 'Thiếu thông tin', message: 'Vui lòng chọn khách hàng và file Excel trước khi kiểm tra.' }
      return setSetupErrors({
        ...(!selectedCustomer && { customer: error }),
        ...(!state.selectedFile && { file: error }),
      })
    }
    if (!isValidWeekStartDate(state.weekStartDate)) return setSetupErrors({ weekStartDate: { title: 'Ngày bắt đầu tuần không hợp lệ', message: 'Vui lòng chọn ngày thứ 2 để hệ thống đọc đúng các cột trong tuần.' } })
    const job: WeeklyMenuImportJob = {
      jobId: `import-${selectedCustomer.customerId}`, customerId: selectedCustomer.customerId,
      customerCode: selectedCustomer.customerCode, customerName: selectedCustomer.customerName,
      weekStartDate: state.weekStartDate, priceTierAmount: state.priceTierAmount, file: state.selectedFile,
      fileName: state.selectedFile.name, fileSize: state.selectedFile.size, status: 'idle', previewResult: null, warnings: [], error: null,
    }
    dispatch({ type: 'upsert-job', job }); clearFileInput()
    setFeedback('Đã thêm file', `${job.customerCode} - ${job.customerName} đã sẵn sàng để kiểm tra. Nếu khách này đã có trong danh sách, hệ thống đã thay bằng file mới.`, 'info')
  }

  const previewJob = async (jobId: string) => {
    const job = state.jobs.find((item) => item.jobId === jobId)
    if (!job) return false
    dispatch({ type: 'select-job', jobId })
    dispatch({ type: 'update-job', jobId, changes: { status: 'previewing', error: null, warnings: [], previewResult: null } })
    setFeedback('Đang kiểm tra file', `Hệ thống đang đọc ${job.fileName} cho ${job.customerCode}.`, 'info')
    try {
      const response = await previewImport({ file: job.file, customerId: job.customerId, weekStartDate: job.weekStartDate || undefined, priceTierAmount: job.priceTierAmount }).unwrap()
      if (!response.success || !response.data) throw new Error(response.message || 'Không đọc được file thực đơn.')
      const result = response.data
      const blocking = getBlockingImportIssues(result)
      dispatch({ type: 'update-job', jobId, changes: { status: blocking.length ? 'failed' : 'previewed', previewResult: result, warnings: [...result.warnings], error: blocking[0] ?? null } })
      setFeedback(blocking.length ? 'File có lỗi cần sửa' : 'File đã kiểm tra xong', blocking[0] ?? `${result.customerCode}: tìm thấy ${result.detectedLayout.rowsImported} dòng món hợp lệ, bỏ qua ${result.detectedLayout.rowsSkipped} dòng không phải món.`, blocking.length ? 'danger' : result.warnings.length ? 'warning' : 'info')
      return !blocking.length
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không thể kiểm tra file thực đơn.')
      dispatch({ type: 'update-job', jobId, changes: { status: 'failed', previewResult: null, warnings: [], error: message } })
      setFeedback('Kiểm tra file thất bại', message, 'danger')
      return false
    }
  }
  const previewAllJobs = async () => {
    if (!state.jobs.length) return setFeedback('Chưa có file', 'Vui lòng thêm ít nhất một khách hàng và file Excel.', 'warning')
    for (const job of state.jobs) if (job.status !== 'committed') await previewJob(job.jobId)
  }

  const commitJob = async (jobId: string, closeOnSuccess = state.jobs.length === 1) => {
    const job = state.jobs.find((item) => item.jobId === jobId)
    if (!job?.previewResult) { setFeedback('Chưa kiểm tra file', 'Vui lòng kiểm tra file trước khi lưu.', 'warning'); return false }
    const blocking = getBlockingImportIssues(job.previewResult)
    if (blocking.length) { setFeedback('File chưa thể lưu', blocking[0], 'danger'); return false }
    dispatch({ type: 'select-job', jobId }); dispatch({ type: 'update-job', jobId, changes: { status: 'committing', error: null } })
    setFeedback('Đang lưu thực đơn', `Hệ thống đang ghi thực đơn cho ${job.customerCode}.`, 'info')
    try {
      const response = await commitImport({
        file: job.file,
        customerId: job.customerId,
        weekStartDate: job.weekStartDate || undefined,
        priceTierAmount: job.priceTierAmount,
        previewToken: job.previewResult.previewToken ?? undefined,
      }).unwrap()
      if (!response.success || !response.data) throw new Error(response.message || 'Không lưu được thực đơn.')
      const result = response.data
      dispatch({ type: 'update-job', jobId, changes: { status: 'committed', previewResult: result, warnings: [...result.warnings], error: null } })
      if (state.jobs.length === 1 || result.customerId === customerId) onMenuCommitted(result)
      setFeedback(result.warnings.length ? 'Đã lưu thực đơn (có cảnh báo)' : 'Đã lưu thực đơn', `${result.customerCode}: đã lưu ${result.detectedLayout.rowsImported} dòng món, bỏ qua ${result.detectedLayout.rowsSkipped} dòng không phải món.`, result.warnings.length ? 'warning' : 'info')
      if (closeOnSuccess) close()
      return true
    } catch (error) {
      const message = getApiErrorMessage(error, 'Không thể lưu thực đơn.')
      dispatch({ type: 'update-job', jobId, changes: { status: 'failed', error: message } })
      setFeedback('Lưu thực đơn thất bại', message, 'danger')
      return false
    }
  }
  const commitReadyJobs = async () => {
    const pending = state.jobs.filter((job) => job.status === 'previewed' && job.previewResult && !job.error)
    if (!pending.length) return setFeedback('Chưa có dòng hợp lệ để lưu', 'Chỉ những file đã kiểm tra xong và không có lỗi mới được lưu.', 'warning')
    if (pending.length === 1) {
      if (await commitJob(pending[0].jobId, false)) close()
      return
    }

    pending.forEach((job) => dispatch({ type: 'update-job', jobId: job.jobId, changes: { status: 'committing', error: null } }))
    setFeedback('Đang lưu batch thực đơn', `Hệ thống đang lưu atomic ${pending.length} file; nếu một file lỗi, không file nào được ghi.`, 'info')
    try {
      const response = await commitImportBatch(pending.map((job) => ({
        file: job.file,
        customerId: job.customerId,
        weekStartDate: job.weekStartDate || undefined,
        priceTierAmount: job.priceTierAmount,
        previewToken: job.previewResult?.previewToken ?? undefined,
      }))).unwrap()
      const resultByCustomer = new Map(response.data?.map((result) => [result.customerId, result]))
      if (!response.success || !response.data || resultByCustomer.size !== pending.length || pending.some((job) => !resultByCustomer.has(job.customerId))) {
        throw new Error(response.message || 'Kết quả batch import không đầy đủ.')
      }

      pending.forEach((job) => {
        const result = resultByCustomer.get(job.customerId)!
        dispatch({ type: 'update-job', jobId: job.jobId, changes: { status: 'committed', previewResult: result, warnings: [...result.warnings], error: null } })
        if (result.customerId === customerId) onMenuCommitted(result)
      })
      setFeedback('Đã lưu toàn bộ batch', `${response.data.length} file thực đơn đã được lưu trong cùng một transaction.`, 'info')
      close()
    } catch (error) {
      pending.forEach((job) => dispatch({ type: 'update-job', jobId: job.jobId, changes: { status: 'previewed', error: null } }))
      setFeedback('Batch không được lưu', getApiErrorMessage(error, 'Không file nào được ghi. Có thể bấm lưu lại sau khi xử lý lỗi.'), 'danger')
    }
  }
  const saveMapping = async () => {
    if (!presentation.preview || !selectedJob) return
    try {
      await saveImportMapping({ customerId: selectedJob.customerId, sheetNameHint: presentation.preview.detectedLayout.sheetName, labelColumn: presentation.preview.detectedLayout.labelColumn }).unwrap()
      setFeedback('Đã ghi nhớ cách đọc file', `Lần sau của ${selectedJob.customerCode}, hệ thống sẽ đọc file theo mẫu này nhanh hơn.`, 'info')
    } catch (error) { setFeedback('Chưa ghi nhớ được cách đọc file', getApiErrorMessage(error, 'Không thể lưu cách đọc file cho khách hàng này.'), 'danger') }
  }
  const confirmRollback = async () => {
    if (!state.rollbackTarget) return
    const { menuVersionId, label } = state.rollbackTarget
    dispatch({ type: 'cancel-rollback' })
    try {
      await rollbackImport(menuVersionId).unwrap()
      setFeedback('Đã hủy phiên import', `Lịch thực đơn của "${label}" đã bị xóa. Có thể import lại file khác cho tuần này.`, 'info')
    } catch (error) { setFeedback('Hủy phiên import thất bại', getApiErrorMessage(error, 'Không thể hủy phiên import này.'), 'danger') }
  }

  return {
    state, customers, history, historyDataState: historyView, selectedCustomer, selectedJob, readyJobs, presentation, fileInputRef,
    wizardStep: getImportWizardStep(state.jobs), hiddenFeedbackByDetail,
    status: {
      isCustomerLoading,
      isCustomerError,
      isHistoryError: historyView.phase === 'error' || historyView.phase === 'forbidden',
      isImporting,
      isPreviewing,
      isCommitting: isCommitting || isBatchCommitting,
      isDownloadingTemplate,
      isSavingMapping,
      isCreatingCustomer,
      isRollingBack,
    },
    actions: {
      open, close, onOpenChange: (nextOpen: boolean) => nextOpen ? open() : close(),
      selectDraftCustomer: (value: string) => dispatch({ type: 'edit', field: 'draftCustomerId', value }),
      selectWeek: (value: string) => dispatch({ type: 'edit', field: 'weekStartDate', value }),
      selectPriceTier: (value: BomPriceTier) => dispatch({ type: 'edit', field: 'priceTierAmount', value }),
      selectFile: (value: File | null) => dispatch({ type: 'edit', field: 'selectedFile', value }),
      setQuickCustomerCode: (value: string) => dispatch({ type: 'edit', field: 'quickCustomerCode', value }),
      setQuickCustomerName: (value: string) => dispatch({ type: 'edit', field: 'quickCustomerName', value }),
      toggleQuickCustomer: () => dispatch({ type: 'toggle-quick-customer' }), downloadWeeklyMenuTemplate, createQuickCustomer, addJob,
      retryCustomers: refetchCustomers,
      removeJob: (jobId: string) => dispatch({ type: 'remove-job', jobId }), selectJob: (jobId: string) => dispatch({ type: 'select-job', jobId }),
      previewJob, previewAllJobs, commitJob, commitReadyJobs, saveMapping,
      requestRollback: (menuVersionId: string, label: string) => dispatch({ type: 'request-rollback', target: { menuVersionId, label } }),
      cancelRollback: () => dispatch({ type: 'cancel-rollback' }), confirmRollback,
    },
  }
}

export type WeeklyMenuImportWorkflow = ReturnType<typeof useWeeklyMenuImport>
